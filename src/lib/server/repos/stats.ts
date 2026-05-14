/**
 * @file stats.ts
 * @implements REQ-STAT-001..004
 *
 * Aggregated read-only queries for the post-game stats view.
 *
 * All numbers are derived from the canonical tables (bets, drinks, rounds,
 * session_players). No precomputed snapshot — recompute on each page load.
 */
import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db';
import {
	bets,
	betMarkets,
	betOutcomes,
	drinks,
	rounds,
	sessionPlayers,
	users
} from '../db/schema';

export type LeaderboardRow = {
	userId: string;
	username: string;
	role: 'HOST' | 'PLAYER';
	moneyBalance: number;
	totalStaked: number;
	totalPayout: number;
	betsPlaced: number;
	betsWon: number;
	drinksSelf: number;
	drinksReceivedForce: number;
	drinksDealtForce: number;
	drinksByType: { SCHLUCK: number; KURZER: number; BIER_EXEN: number };
	pnl: number; // moneyBalance - startingMoney
};

export type MyStats = LeaderboardRow & {
	roi: number | null; // (payout-stake)/stake; null if no bets
	hitRate: number | null; // betsWon/betsPlaced; null if no bets
};

export type RoundHistoryRow = {
	id: string;
	roundNumber: number;
	status: string;
	createdAt: Date;
	settledAt: Date | null;
	markets: number;
	totalPool: number;
};

/**
 * Build per-user aggregates from bets + drinks + session_players within a session.
 * Returns sorted by moneyBalance desc.
 */
export async function getSessionLeaderboard(
	sessionId: string,
	startingMoney: number
): Promise<LeaderboardRow[]> {
	// Players in session with username
	const players = await db
		.select({
			userId: sessionPlayers.userId,
			username: users.username,
			role: sessionPlayers.role,
			moneyBalance: sessionPlayers.moneyBalance
		})
		.from(sessionPlayers)
		.innerJoin(users, eq(users.id, sessionPlayers.userId))
		.where(eq(sessionPlayers.sessionId, sessionId));

	// Bet aggregates per user (only bets on outcomes within this session's rounds)
	const betAgg = await db
		.select({
			userId: bets.userId,
			betsPlaced: sql<number>`count(*)::int`,
			totalStaked: sql<number>`coalesce(sum(${bets.stake}),0)::int`,
			totalPayout: sql<number>`coalesce(sum(${bets.payoutAmount}),0)::int`,
			betsWon: sql<number>`sum(case when ${bets.payoutAmount} is not null and ${bets.payoutAmount} > ${bets.stake} then 1 else 0 end)::int`
		})
		.from(bets)
		.innerJoin(betOutcomes, eq(betOutcomes.id, bets.outcomeId))
		.innerJoin(betMarkets, eq(betMarkets.id, betOutcomes.marketId))
		.innerJoin(rounds, eq(rounds.id, betMarkets.roundId))
		.where(eq(rounds.sessionId, sessionId))
		.groupBy(bets.userId);

	const betMap = new Map(betAgg.map((b) => [b.userId, b]));

	// Drink aggregates per user
	const drinkAgg = await db
		.select({
			userId: drinks.targetUserId,
			drinksSelf: sql<number>`sum(case when ${drinks.origin}='SELF' and ${drinks.status}='CONFIRMED' then 1 else 0 end)::int`,
			drinksReceivedForce: sql<number>`sum(case when ${drinks.origin}='FORCE' and ${drinks.status}='CONFIRMED' then 1 else 0 end)::int`,
			schluck: sql<number>`sum(case when ${drinks.drinkType}='SCHLUCK' and ${drinks.status}='CONFIRMED' then 1 else 0 end)::int`,
			kurzer: sql<number>`sum(case when ${drinks.drinkType}='KURZER' and ${drinks.status}='CONFIRMED' then 1 else 0 end)::int`,
			bierExen: sql<number>`sum(case when ${drinks.drinkType}='BIER_EXEN' and ${drinks.status}='CONFIRMED' then 1 else 0 end)::int`
		})
		.from(drinks)
		.where(eq(drinks.sessionId, sessionId))
		.groupBy(drinks.targetUserId);
	const drinkRecvMap = new Map(drinkAgg.map((d) => [d.userId, d]));

	const forceDealtAgg = await db
		.select({
			userId: drinks.attackerUserId,
			drinksDealtForce: sql<number>`sum(case when ${drinks.status} <> 'CANCELLED' then 1 else 0 end)::int`
		})
		.from(drinks)
		.where(and(eq(drinks.sessionId, sessionId), eq(drinks.origin, 'FORCE'), isNotNull(drinks.attackerUserId)))
		.groupBy(drinks.attackerUserId);
	const dealtMap = new Map(forceDealtAgg.map((d) => [d.userId, d.drinksDealtForce]));

	const rows: LeaderboardRow[] = players.map((p) => {
		const b = betMap.get(p.userId);
		const d = drinkRecvMap.get(p.userId);
		return {
			userId: p.userId,
			username: p.username,
			role: p.role as 'HOST' | 'PLAYER',
			moneyBalance: p.moneyBalance,
			totalStaked: b?.totalStaked ?? 0,
			totalPayout: b?.totalPayout ?? 0,
			betsPlaced: b?.betsPlaced ?? 0,
			betsWon: b?.betsWon ?? 0,
			drinksSelf: d?.drinksSelf ?? 0,
			drinksReceivedForce: d?.drinksReceivedForce ?? 0,
			drinksDealtForce: dealtMap.get(p.userId) ?? 0,
			drinksByType: {
				SCHLUCK: d?.schluck ?? 0,
				KURZER: d?.kurzer ?? 0,
				BIER_EXEN: d?.bierExen ?? 0
			},
			pnl: p.moneyBalance - startingMoney
		};
	});

	rows.sort((a, b) => b.moneyBalance - a.moneyBalance);
	return rows;
}

export async function getMySessionStats(
	sessionId: string,
	userId: string,
	startingMoney: number
): Promise<MyStats | null> {
	const all = await getSessionLeaderboard(sessionId, startingMoney);
	const mine = all.find((r) => r.userId === userId);
	if (!mine) return null;
	const roi = mine.totalStaked > 0 ? (mine.totalPayout - mine.totalStaked) / mine.totalStaked : null;
	const hitRate = mine.betsPlaced > 0 ? mine.betsWon / mine.betsPlaced : null;
	return { ...mine, roi, hitRate };
}

export async function getRoundHistory(sessionId: string): Promise<RoundHistoryRow[]> {
	const rs = await db
		.select({
			id: rounds.id,
			roundNumber: rounds.roundNumber,
			status: rounds.status,
			createdAt: rounds.createdAt,
			settledAt: rounds.settledAt
		})
		.from(rounds)
		.where(eq(rounds.sessionId, sessionId))
		.orderBy(asc(rounds.roundNumber));

	if (rs.length === 0) return [];

	const poolAgg = await db
		.select({
			roundId: betMarkets.roundId,
			markets: sql<number>`count(distinct ${betMarkets.id})::int`,
			totalPool: sql<number>`coalesce(sum(${bets.stake}),0)::int`
		})
		.from(betMarkets)
		.leftJoin(betOutcomes, eq(betOutcomes.marketId, betMarkets.id))
		.leftJoin(bets, eq(bets.outcomeId, betOutcomes.id))
		.where(
			sql`${betMarkets.roundId} in (select id from ${rounds} where session_id = ${sessionId})`
		)
		.groupBy(betMarkets.roundId);
	const poolMap = new Map(poolAgg.map((p) => [p.roundId, p]));

	return rs.map((r) => ({
		id: r.id,
		roundNumber: r.roundNumber,
		status: r.status as string,
		createdAt: r.createdAt,
		settledAt: r.settledAt,
		markets: poolMap.get(r.id)?.markets ?? 0,
		totalPool: poolMap.get(r.id)?.totalPool ?? 0
	}));
}

// silence unused
void desc;
