/**
 * @file markets.ts — BetMarket + BetOutcome CRUD and settle.
 * @implements REQ-MARKET-001..006, REQ-BET-004, REQ-BET-005
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
	bets,
	betMarkets,
	betOutcomes,
	entities,
	rounds,
	sessionPlayers,
	sessions,
	type Predicate,
	type CounterExpr
} from '../db/schema';
import { evalPredicate, negate, type CounterSnapshot } from '../bets/predicate';
import { computeMarketPayouts, type OutcomeForPayout } from '../bets/payout';
import { getCounterSnapshot, getEventLog } from './events';
import { compileSessionGraphs } from '$lib/graph/compile';

export type DbBetMarket = typeof betMarkets.$inferSelect;
export type DbBetOutcome = typeof betOutcomes.$inferSelect;

export type OutcomeDraft = {
	label: string;
	predicate: Predicate;
};

type CreateMarketInput = {
	roundId: string;
	title: string;
	description?: string;
	createdByUserId: string;
	outcomes: OutcomeDraft[];
};

/** Create a market with explicit outcomes. */
export async function createMarket(input: CreateMarketInput): Promise<{
	market: DbBetMarket;
	outcomes: DbBetOutcome[];
}> {
	if (input.outcomes.length < 2) throw new Error('MARKET_NEEDS_2_OUTCOMES');
	return await db.transaction(async (tx) => {
		const [r] = await tx
			.select({ id: rounds.id, status: rounds.status })
			.from(rounds)
			.where(eq(rounds.id, input.roundId));
		if (!r) throw new Error('ROUND_NOT_FOUND');
		if (r.status !== 'BETTING_OPEN' && r.status !== 'SETUP') {
			throw new Error(`MARKET_CREATE_ROUND_LOCKED:${r.status}`);
		}

		const [m] = await tx
			.insert(betMarkets)
			.values({
				roundId: input.roundId,
				title: input.title,
				description: input.description ?? null,
				createdByUserId: input.createdByUserId,
				status: 'OPEN'
			})
			.returning();

		const outs = await tx
			.insert(betOutcomes)
			.values(
				input.outcomes.map((o, i) => ({
					marketId: m.id,
					label: o.label,
					predicate: o.predicate,
					orderIndex: i
				}))
			)
			.returning();
		return { market: m, outcomes: outs };
	});
}

/**
 * Convenience: create a binary market YES/NO from a single predicate.
 */
export function createBinaryMarket(args: {
	roundId: string;
	title: string;
	description?: string;
	createdByUserId: string;
	predicate: Predicate;
	yesLabel?: string;
	noLabel?: string;
}) {
	return createMarket({
		roundId: args.roundId,
		title: args.title,
		description: args.description,
		createdByUserId: args.createdByUserId,
		outcomes: [
			{ label: args.yesLabel ?? 'JA', predicate: args.predicate },
			{ label: args.noLabel ?? 'NEIN', predicate: negate(args.predicate) }
		]
	});
}

/**
 * Auto-instantiate markets from the session's bet-graphs snapshot.
 *
 * Returns the number of markets created. Unsupported graph shapes (compiler
 * returns `ok:false`) are skipped silently so that bad graphs don't block the
 * round from opening.
 */
export async function instantiateBetGraphs(args: {
	roundId: string;
	sessionId: string;
	createdByUserId: string;
}): Promise<number> {
	const [s] = await db
		.select({
			betGraphsSnapshot: sessions.betGraphsSnapshot,
			trackables: sessions.trackables
		})
		.from(sessions)
		.where(eq(sessions.id, args.sessionId));
	if (!s) throw new Error('SESSION_NOT_FOUND');
	const graphs = s.betGraphsSnapshot ?? [];
	if (graphs.length === 0) return 0;
	const ents = await db
		.select({ id: entities.id, name: entities.name })
		.from(entities)
		.where(eq(entities.sessionId, args.sessionId));

	const compiled = compileSessionGraphs(graphs, {
		entities: ents,
		trackables: s.trackables ?? []
	});
	let created = 0;
	for (const m of compiled) {
		await createMarket({
			roundId: args.roundId,
			title: m.title,
			description: m.description ?? undefined,
			createdByUserId: args.createdByUserId,
			outcomes: m.outcomes.map((o) => ({ label: o.label, predicate: o.predicate }))
		});
		created++;
	}
	return created;
}

export async function lockMarket(marketId: string): Promise<DbBetMarket> {
	return await db.transaction(async (tx) => {
		const [m] = await tx.select().from(betMarkets).where(eq(betMarkets.id, marketId)).for('update');
		if (!m) throw new Error('MARKET_NOT_FOUND');
		if (m.status !== 'OPEN') throw new Error(`MARKET_NOT_OPEN:${m.status}`);
		const [u] = await tx
			.update(betMarkets)
			.set({ status: 'LOCKED' })
			.where(eq(betMarkets.id, marketId))
			.returning();
		return u;
	});
}

export async function listMarketsByRound(roundId: string): Promise<DbBetMarket[]> {
	return await db
		.select()
		.from(betMarkets)
		.where(eq(betMarkets.roundId, roundId))
		.orderBy(asc(betMarkets.createdAt));
}

export async function listOutcomesByMarket(marketId: string): Promise<DbBetOutcome[]> {
	return await db
		.select()
		.from(betOutcomes)
		.where(eq(betOutcomes.marketId, marketId))
		.orderBy(asc(betOutcomes.orderIndex));
}

/**
 * Settle all OPEN/LOCKED markets in a round:
 *   1. Build counter snapshot.
 *   2. For each outcome: evaluate predicate, set isWinner.
 *   3. Compute parimutuel payouts, credit users, mark market SETTLED.
 *
 * If round status is CANCELLED, all markets are VOID and stakes are refunded
 * regardless of predicate evaluation.
 */
export async function settleRoundMarkets(roundId: string): Promise<void> {
	const [r] = await db.select().from(rounds).where(eq(rounds.id, roundId));
	if (!r) throw new Error('ROUND_NOT_FOUND');

	const snap: CounterSnapshot =
		r.status === 'CANCELLED' ? {} : await getCounterSnapshot(roundId);
	const events =
		r.status === 'CANCELLED' ? [] : await getEventLog(roundId);
	const voidAll = r.status === 'CANCELLED';

	const markets = await db
		.select()
		.from(betMarkets)
		.where(eq(betMarkets.roundId, roundId));

	for (const m of markets) {
		if (m.status === 'SETTLED' || m.status === 'VOID') continue;
		await settleOneMarket(m.id, snap, voidAll, events);
	}
}

async function settleOneMarket(
	marketId: string,
	snap: CounterSnapshot,
	voidAll: boolean,
	events: Awaited<ReturnType<typeof getEventLog>>
): Promise<void> {
	await db.transaction(async (tx) => {
		const [m] = await tx.select().from(betMarkets).where(eq(betMarkets.id, marketId)).for('update');
		if (!m) throw new Error('MARKET_NOT_FOUND');
		if (m.status === 'SETTLED' || m.status === 'VOID') return;

		const outs = await tx
			.select()
			.from(betOutcomes)
			.where(eq(betOutcomes.marketId, marketId))
			.orderBy(asc(betOutcomes.orderIndex));

		// Set isWinner per outcome (false if voidAll so payout module triggers void path)
		const withWin = outs.map((o) => ({
			outcome: o,
			isWinner: voidAll ? false : evalPredicate(o.predicate, snap, events)
		}));

		for (const w of withWin) {
			await tx
				.update(betOutcomes)
				.set({ isWinner: w.isWinner })
				.where(eq(betOutcomes.id, w.outcome.id));
		}

		const outcomeIds = outs.map((o) => o.id);
		const allBets =
			outcomeIds.length === 0
				? []
				: await tx.select().from(bets).where(inArray(bets.outcomeId, outcomeIds));

		// Group bets per outcome
		const betsByOutcome = new Map<string, typeof allBets>();
		for (const o of outs) betsByOutcome.set(o.id, []);
		for (const b of allBets) {
			betsByOutcome.get(b.outcomeId)!.push(b);
		}

		const outcomesForPayout: OutcomeForPayout[] = withWin.map((w) => ({
			id: w.outcome.id,
			isWinner: w.isWinner,
			bets: (betsByOutcome.get(w.outcome.id) ?? []).map((b) => ({
				id: b.id,
				stake: b.stake,
				createdAt: b.createdAt
			}))
		}));

		const result = computeMarketPayouts(outcomesForPayout);

		// Build userId map for credit
		const userByBet = new Map<string, string>();
		for (const b of allBets) userByBet.set(b.id, b.userId);

		// Aggregate credit per (sessionId, userId)
		// All bets in a market are in the same session — fetch from round->session
		const [rs] = await tx
			.select({ sessionId: rounds.sessionId })
			.from(rounds)
			.where(eq(rounds.id, m.roundId));
		if (!rs) throw new Error('ROUND_NOT_FOUND');

		const creditByUser = new Map<string, number>();
		const now = new Date();
		for (const p of result.payouts) {
			const userId = userByBet.get(p.betId)!;
			creditByUser.set(userId, (creditByUser.get(userId) ?? 0) + p.payout);
			await tx
				.update(bets)
				.set({ payoutAmount: p.payout, settledAt: now })
				.where(eq(bets.id, p.betId));
		}

		// Credit balances
		for (const [userId, amount] of creditByUser) {
			if (amount === 0) continue;
			const [sp] = await tx
				.select()
				.from(sessionPlayers)
				.where(
					and(eq(sessionPlayers.sessionId, rs.sessionId), eq(sessionPlayers.userId, userId))
				)
				.for('update');
			if (!sp) continue;
			await tx
				.update(sessionPlayers)
				.set({ moneyBalance: sp.moneyBalance + amount })
				.where(
					and(eq(sessionPlayers.sessionId, rs.sessionId), eq(sessionPlayers.userId, userId))
				);
		}

		await tx
			.update(betMarkets)
			.set({ status: result.isVoid ? 'VOID' : 'SETTLED', settledAt: now })
			.where(eq(betMarkets.id, marketId));
	});
}
