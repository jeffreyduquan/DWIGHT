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
	type MarketTemplate,
	type Predicate,
	type CounterExpr,
	type Trackable
} from '../db/schema';
import { evalPredicate, negate, type CounterSnapshot } from '../bets/predicate';
import { computeMarketPayouts, type OutcomeForPayout } from '../bets/payout';
import { getCounterSnapshot } from './events';
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
 * Auto-instantiate all markets defined by the session's marketTemplates onto a
 * round. Idempotent: skipped if the round already has any markets.
 *
 * - binary_count + scope=global  → 1 binary market (predicate.entityId=null)
 * - binary_count + scope=each    → 1 binary market per session entity. Title
 *   placeholder `{entity}` is replaced with entity.name; `{n}` with the count.
 * - compare_entities             → 1 market with one outcome per session entity
 *   (entity strictly > all others). If tieBehavior='tie_outcome', an extra
 *   "Gleichstand" outcome is appended (NOT any win).
 */
export async function instantiateMarketTemplates(args: {
	roundId: string;
	sessionId: string;
	createdByUserId: string;
}): Promise<number> {
	const [s] = await db
		.select({
			marketTemplates: sessions.marketTemplates,
			trackables: sessions.trackables
		})
		.from(sessions)
		.where(eq(sessions.id, args.sessionId));
	if (!s) throw new Error('SESSION_NOT_FOUND');
	const tpls: MarketTemplate[] = s.marketTemplates ?? [];
	if (tpls.length === 0) return 0;
	const trackables: Trackable[] = s.trackables ?? [];
	const trackById = new Map(trackables.map((t) => [t.id, t]));

	// Skip if markets already exist (idempotency)
	const existing = await db
		.select({ id: betMarkets.id })
		.from(betMarkets)
		.where(eq(betMarkets.roundId, args.roundId))
		.limit(1);
	if (existing.length > 0) return 0;

	const ents = await db
		.select({ id: entities.id, name: entities.name })
		.from(entities)
		.where(eq(entities.sessionId, args.sessionId));

	/** Find entity by case-insensitive trimmed name. */
	const normEntName = (n: string) => n.trim().toLowerCase();
	const entByName = new Map(ents.map((e) => [normEntName(e.name), e]));
	const findEnt = (name: string) => entByName.get(normEntName(name));

	/** Validate that the trackable exists and matches the requested scope. */
	function validateTrackable(
		tpl: MarketTemplate,
		expected: 'global' | 'entity' | 'any'
	): Trackable {
		const tr = trackById.get(tpl.trackableId);
		if (!tr) {
			throw new Error(
				`MODE_INVALID:${tpl.kind}/${tpl.id}:Trackable "${tpl.trackableId}" existiert nicht in dieser Session.`
			);
		}
		if (expected !== 'any' && tr.scope !== expected) {
			throw new Error(
				`MODE_INVALID:${tpl.kind}/${tpl.id}:Trackable "${tr.label}" ist scope=${tr.scope}, Template erwartet ${expected}.`
			);
		}
		return tr;
	}

	let created = 0;
	for (const tpl of tpls) {
		if (tpl.kind === 'binary_count') {
			validateTrackable(tpl, tpl.entityScope === 'global' ? 'global' : 'entity');
			if (tpl.entityScope === 'global') {
				const title = renderTitle(tpl.title, null, tpl.n);
				await createBinaryMarket({
					roundId: args.roundId,
					title,
					createdByUserId: args.createdByUserId,
					predicate: {
						kind: 'count',
						trackableId: tpl.trackableId,
						entityId: null,
						cmp: tpl.cmp,
						n: tpl.n
					}
				});
				created++;
			} else {
				for (const e of ents) {
					const title = renderTitle(tpl.title, e.name, tpl.n);
					await createBinaryMarket({
						roundId: args.roundId,
						title,
						createdByUserId: args.createdByUserId,
						predicate: {
							kind: 'count',
							trackableId: tpl.trackableId,
							entityId: e.id,
							cmp: tpl.cmp,
							n: tpl.n
						}
					});
					created++;
				}
			}
		} else if (tpl.kind === 'compare_entities') {
			validateTrackable(tpl, 'entity');
			if (ents.length < 2) continue;
			const direction = tpl.direction ?? 'max';
			const winOutcomes: OutcomeDraft[] = ents.map((e) => ({
				label: e.name,
				predicate: buildStrictExtremePredicate(
					tpl.trackableId,
					e.id,
					ents.map((x) => x.id),
					direction
				)
			}));
			const outcomes: OutcomeDraft[] = [...winOutcomes];
			if (tpl.tieBehavior === 'tie_outcome') {
				outcomes.push({
					label: 'Gleichstand',
					predicate: {
						kind: 'and',
						children: winOutcomes.map((o) => ({ kind: 'not', child: o.predicate }))
					}
				});
			}
			await createMarket({
				roundId: args.roundId,
				title: tpl.title,
				createdByUserId: args.createdByUserId,
				outcomes
			});
			created++;
		} else if (tpl.kind === 'range_count') {
			validateTrackable(tpl, tpl.entityScope === 'global' ? 'global' : 'entity');
			const lo = Math.min(tpl.nMin, tpl.nMax);
			const hi = Math.max(tpl.nMin, tpl.nMax);
			const buildRangePred = (entityId: string | null): Predicate => ({
				kind: 'and',
				children: [
					{ kind: 'count', trackableId: tpl.trackableId, entityId, cmp: 'gte', n: lo },
					{ kind: 'count', trackableId: tpl.trackableId, entityId, cmp: 'lte', n: hi }
				]
			});
			if (tpl.entityScope === 'global') {
				const title = renderRangeTitle(tpl.title, null, lo, hi);
				await createBinaryMarket({
					roundId: args.roundId,
					title,
					createdByUserId: args.createdByUserId,
					predicate: buildRangePred(null)
				});
				created++;
			} else {
				for (const e of ents) {
					const title = renderRangeTitle(tpl.title, e.name, lo, hi);
					await createBinaryMarket({
						roundId: args.roundId,
						title,
						createdByUserId: args.createdByUserId,
						predicate: buildRangePred(e.id)
					});
					created++;
				}
			}
		} else if (tpl.kind === 'head_to_head') {
			validateTrackable(tpl, 'entity');
			const a = findEnt(tpl.entityNameA);
			const b = findEnt(tpl.entityNameB);
			if (!a || !b || a.id === b.id) {
				throw new Error(
					`MODE_INVALID:head_to_head/${tpl.id}:Entities "${tpl.entityNameA}" und "${tpl.entityNameB}" müssen beide in der Session existieren und verschieden sein.`
				);
			}
			const predAWins: Predicate = {
				kind: 'compare_counters',
				left: { trackableId: tpl.trackableId, entityId: a.id },
				right: { trackableId: tpl.trackableId, entityId: b.id },
				cmp: 'gt'
			};
			const predBWins: Predicate = {
				kind: 'compare_counters',
				left: { trackableId: tpl.trackableId, entityId: b.id },
				right: { trackableId: tpl.trackableId, entityId: a.id },
				cmp: 'gt'
			};
			const outcomes: OutcomeDraft[] = [
				{ label: a.name, predicate: predAWins },
				{ label: b.name, predicate: predBWins }
			];
			if (tpl.tieBehavior === 'tie_outcome') {
				outcomes.push({
					label: 'Gleichstand',
					predicate: {
						kind: 'compare_counters',
						left: { trackableId: tpl.trackableId, entityId: a.id },
						right: { trackableId: tpl.trackableId, entityId: b.id },
						cmp: 'eq'
					}
				});
			}
			await createMarket({
				roundId: args.roundId,
				title: tpl.title,
				createdByUserId: args.createdByUserId,
				outcomes
			});
			created++;
		} else if (tpl.kind === 'top_k') {
			validateTrackable(tpl, 'entity');
			if (ents.length < 2) continue;
			const k = Math.max(1, Math.min(tpl.k, ents.length - 1));
			const direction = tpl.direction ?? 'max';
			// Entity X is in Top-K (max) iff: < k other entities have strictly more.
			// Bottom-K (min) iff: < k other entities have strictly less.
			const allIds = ents.map((e) => e.id);
			const outcomes: OutcomeDraft[] = ents.map((e) => {
				const others = allIds.filter((id) => id !== e.id);
				const innerCmp: 'gt' | 'lt' = direction === 'min' ? 'lt' : 'gt';
				const child: Predicate = {
					kind: 'compare_counters',
					left: { trackableId: tpl.trackableId, entityId: '$self' },
					right: { trackableId: tpl.trackableId, entityId: e.id },
					cmp: innerCmp
				};
				return {
					label: e.name,
					predicate: {
						kind: 'count_entities_where',
						candidates: others,
						child,
						cmp: 'lt',
						n: k
					}
				};
			});
			await createMarket({
				roundId: args.roundId,
				title: renderTopKTitle(tpl.title, k, direction),
				createdByUserId: args.createdByUserId,
				outcomes
			});
			created++;
		} else if (tpl.kind === 'count_matching') {
			validateTrackable(tpl, 'entity');
			if (ents.length < 1) continue;
			const allIds = ents.map((e) => e.id);
			const child: Predicate = {
				kind: 'count',
				trackableId: tpl.trackableId,
				entityId: '$self',
				cmp: tpl.perEntityCmp,
				n: tpl.perEntityN
			};
			const predicate: Predicate = {
				kind: 'count_entities_where',
				candidates: allIds,
				child,
				cmp: tpl.cmp,
				n: tpl.k
			};
			await createBinaryMarket({
				roundId: args.roundId,
				title: renderCountMatchingTitle(tpl.title, tpl.k, ents.length),
				createdByUserId: args.createdByUserId,
				predicate
			});
			created++;
		} else if (tpl.kind === 'team_total') {
			validateTrackable(tpl, 'entity');
			// Resolve team members by name (case-insensitive, trimmed). All names must resolve.
			const memberIds: string[] = [];
			const missing: string[] = [];
			for (const name of tpl.entityNames) {
				const ent = findEnt(name);
				if (ent) memberIds.push(ent.id);
				else missing.push(name);
			}
			if (missing.length > 0) {
				throw new Error(
					`MODE_INVALID:team_total/${tpl.id}:Team-Entities nicht gefunden: ${missing.join(', ')}.`
				);
			}
			if (memberIds.length === 0) continue;
			// Sum per-entity counters of all team members
			const left: CounterExpr = {
				kind: 'sum',
				operands: memberIds.map((eid) => ({
					kind: 'ref' as const,
					trackableId: tpl.trackableId,
					entityId: eid
				}))
			};
			const predicate: Predicate = {
				kind: 'compare_counters',
				left,
				right: { kind: 'const', value: tpl.n },
				cmp: tpl.cmp
			};
			await createBinaryMarket({
				roundId: args.roundId,
				title: renderTeamTotalTitle(tpl.title, tpl.entityNames, tpl.n),
				createdByUserId: args.createdByUserId,
				predicate
			});
			created++;
		} else if (tpl.kind === 'spread') {
			validateTrackable(tpl, 'entity');
			const a = findEnt(tpl.entityNameA);
			const b = findEnt(tpl.entityNameB);
			if (!a || !b) {
				throw new Error(
					`MODE_INVALID:spread/${tpl.id}:Entities "${tpl.entityNameA}" und "${tpl.entityNameB}" müssen beide in der Session existieren.`
				);
			}
			const predicate: Predicate = {
				kind: 'compare_counters',
				left: {
					kind: 'diff',
					operands: [
						{ kind: 'ref', trackableId: tpl.trackableId, entityId: a.id },
						{ kind: 'ref', trackableId: tpl.trackableId, entityId: b.id }
					]
				},
				right: { kind: 'const', value: tpl.n },
				cmp: tpl.cmp
			};
			await createBinaryMarket({
				roundId: args.roundId,
				title: renderSpreadTitle(tpl.title, a.name, b.name, tpl.n),
				createdByUserId: args.createdByUserId,
				predicate
			});
			created++;
		} else if (tpl.kind === 'ordered_finish') {
			validateTrackable(tpl, 'entity');
			if (ents.length < 2) continue;
			// position=0 means last place
			const resolvedPos = tpl.position === 0 ? ents.length : tpl.position;
			if (resolvedPos < 1 || resolvedPos > ents.length) continue;
			const posLabel =
				resolvedPos === 1
					? '1.'
					: resolvedPos === ents.length
						? 'Letzter'
						: `${resolvedPos}.`;
			const outcomes: OutcomeDraft[] = ents.map((e) => ({
				label: e.name,
				predicate: {
					kind: 'log_rank' as const,
					trackableId: tpl.trackableId,
					entityId: e.id,
					position: resolvedPos
				}
			}));
			const title = (tpl.title || `Wer war als ${posLabel} {trackable} eingetragen?`).replace(
				'{trackable}',
				tpl.trackableId
			);
			await createMarket({
				roundId: args.roundId,
				title,
				createdByUserId: args.createdByUserId,
				outcomes
			});
			created++;
		}
	}
	return created;
}

/**
 * Auto-instantiate markets from the session's bet-graphs snapshot.
 * Side-by-side companion to `instantiateMarketTemplates` during Phase 6.
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

function renderTopKTitle(tpl: string, k: number, direction: 'max' | 'min'): string {
	return tpl
		.replaceAll('{k}', String(k))
		.replaceAll('{dir}', direction === 'min' ? 'Bottom' : 'Top')
		.trim();
}

function renderCountMatchingTitle(tpl: string, k: number, total: number): string {
	return tpl
		.replaceAll('{k}', String(k))
		.replaceAll('{n}', String(total))
		.trim();
}

function renderTeamTotalTitle(tpl: string, teamNames: string[], n: number): string {
	return tpl
		.replaceAll('{team}', teamNames.join(', '))
		.replaceAll('{n}', String(n))
		.trim();
}

function renderSpreadTitle(tpl: string, a: string, b: string, n: number): string {
	return tpl
		.replaceAll('{entityA}', a)
		.replaceAll('{entityB}', b)
		.replaceAll('{n}', String(n))
		.trim();
}

function renderTitle(tpl: string, entityName: string | null, n: number): string {
	return tpl
		.replaceAll('{entity}', entityName ?? '')
		.replaceAll('{n}', String(n))
		.trim();
}

function renderRangeTitle(
	tpl: string,
	entityName: string | null,
	lo: number,
	hi: number
): string {
	return tpl
		.replaceAll('{entity}', entityName ?? '')
		.replaceAll('{min}', String(lo))
		.replaceAll('{max}', String(hi))
		.replaceAll('{n}', `${lo}-${hi}`)
		.trim();
}

/** Predicate: entity `myId` strictly greater than every other entity in `allIds`. */
function buildStrictMaxPredicate(
	trackableId: string,
	myId: string,
	allIds: string[]
): Predicate {
	const others = allIds.filter((id) => id !== myId);
	const children: Predicate[] = others.map((otherId) => ({
		kind: 'compare_counters',
		left: { trackableId, entityId: myId },
		right: { trackableId, entityId: otherId },
		cmp: 'gt'
	}));
	if (children.length === 1) return children[0];
	return { kind: 'and', children };
}

/**
 * Predicate: entity `myId` is strictly the extreme (max or min) versus all others.
 * direction='max' → `myId > other` for all others.
 * direction='min' → `myId < other` for all others.
 */
function buildStrictExtremePredicate(
	trackableId: string,
	myId: string,
	allIds: string[],
	direction: 'max' | 'min'
): Predicate {
	const others = allIds.filter((id) => id !== myId);
	const cmp: 'gt' | 'lt' = direction === 'min' ? 'lt' : 'gt';
	const children: Predicate[] = others.map((otherId) => ({
		kind: 'compare_counters',
		left: { trackableId, entityId: myId },
		right: { trackableId, entityId: otherId },
		cmp
	}));
	if (children.length === 1) return children[0];
	return { kind: 'and', children };
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
	const voidAll = r.status === 'CANCELLED';

	const markets = await db
		.select()
		.from(betMarkets)
		.where(eq(betMarkets.roundId, roundId));

	for (const m of markets) {
		if (m.status === 'SETTLED' || m.status === 'VOID') continue;
		await settleOneMarket(m.id, snap, voidAll);
	}
}

async function settleOneMarket(
	marketId: string,
	snap: CounterSnapshot,
	voidAll: boolean
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
			isWinner: voidAll ? false : evalPredicate(o.predicate, snap)
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
