/**
 * @file bets.ts — place bets on a BetOutcome (parimutuel V1).
 * @implements REQ-BET-001, REQ-BET-002, REQ-ECON-002, REQ-ECON-003
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import {
	bets,
	betMarkets,
	betOutcomes,
	drinks,
	rounds,
	sessionPlayers,
	sessions
} from '../db/schema';
import { isLockedByDrinks } from '../../drinks/lock';

export type DbBet = typeof bets.$inferSelect;

type PlaceBetInput = {
	outcomeId: string;
	userId: string;
	stake: number;
};

/**
 * Place a bet atomically:
 *   - Validate stake ≥ minStake (from session.config).
 *   - Validate market is OPEN.
 *   - Validate user is in the session and has enough money.
 *   - Deduct stake from session_players.moneyBalance.
 *   - Insert the bet row.
 */
export async function placeBet(input: PlaceBetInput): Promise<DbBet> {
	if (!Number.isFinite(input.stake) || input.stake <= 0) throw new Error('INVALID_STAKE');
	const stake = Math.floor(input.stake);

	return await db.transaction(async (tx) => {
		// Resolve outcome → market → round → session
		const [o] = await tx
			.select({
				id: betOutcomes.id,
				marketId: betOutcomes.marketId
			})
			.from(betOutcomes)
			.where(eq(betOutcomes.id, input.outcomeId));
		if (!o) throw new Error('OUTCOME_NOT_FOUND');

		const [m] = await tx
			.select()
			.from(betMarkets)
			.where(eq(betMarkets.id, o.marketId))
			.for('update');
		if (!m) throw new Error('MARKET_NOT_FOUND');
		if (m.status !== 'OPEN') throw new Error(`MARKET_NOT_OPEN:${m.status}`);

		const [r] = await tx
			.select({ id: rounds.id, status: rounds.status, sessionId: rounds.sessionId })
			.from(rounds)
			.where(eq(rounds.id, m.roundId));
		if (!r) throw new Error('ROUND_NOT_FOUND');
		if (r.status === 'SETTLED' || r.status === 'CANCELLED' || r.status === 'RESOLVING') {
			throw new Error(`ROUND_NOT_OPEN_FOR_BETS:${r.status}`);
		}

		const [s] = await tx
			.select({ config: sessions.config })
			.from(sessions)
			.where(eq(sessions.id, r.sessionId));
		if (!s) throw new Error('SESSION_NOT_FOUND');
		if (stake < s.config.minStake) throw new Error('STAKE_BELOW_MIN');
		const maxPct = s.config.maxStakePctOfStart;
		if (typeof maxPct === 'number' && maxPct > 0 && maxPct <= 100) {
			const cap = Math.floor((s.config.startingMoney * maxPct) / 100);
			if (cap > 0 && stake > cap) throw new Error('STAKE_ABOVE_MAX');
		}

		const [sp] = await tx
			.select()
			.from(sessionPlayers)
			.where(
				and(
					eq(sessionPlayers.sessionId, r.sessionId),
					eq(sessionPlayers.userId, input.userId)
				)
			)
			.for('update');
		if (!sp) throw new Error('NOT_IN_SESSION');
		if (sp.betLocked) throw new Error('BET_LOCKED');
		// TIMER_LOCK: lazy check against pending drinks. If oldest pending drink
		// has exceeded `lockTimerSeconds`, treat as locked.
		const pending = await tx
			.select({ createdAt: drinks.createdAt })
			.from(drinks)
			.where(
				and(
					eq(drinks.sessionId, r.sessionId),
					eq(drinks.targetUserId, input.userId),
					eq(drinks.status, 'PENDING')
				)
			);
		if (isLockedByDrinks(s.config, pending.map((p) => p.createdAt))) {
			throw new Error('BET_LOCKED');
		}
		if (sp.moneyBalance < stake) throw new Error('INSUFFICIENT_FUNDS');

		await tx
			.update(sessionPlayers)
			.set({ moneyBalance: sp.moneyBalance - stake })
			.where(
				and(
					eq(sessionPlayers.sessionId, r.sessionId),
					eq(sessionPlayers.userId, input.userId)
				)
			);

		const [bet] = await tx
			.insert(bets)
			.values({
				outcomeId: input.outcomeId,
				userId: input.userId,
				stake
			})
			.returning();
		return bet;
	});
}

export async function listBetsByOutcome(outcomeId: string): Promise<DbBet[]> {
	return await db.select().from(bets).where(eq(bets.outcomeId, outcomeId));
}

export async function listBetsByUserInRound(
	userId: string,
	outcomeIds: string[]
): Promise<DbBet[]> {
	if (outcomeIds.length === 0) return [];
	const rows = await db
		.select()
		.from(bets)
		.where(eq(bets.userId, userId));
	return rows.filter((b) => outcomeIds.includes(b.outcomeId));
}
