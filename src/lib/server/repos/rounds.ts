/**
 * @file rounds.ts — round lifecycle for D3.
 * @implements REQ-ROUND-001..006
 */
import { and, desc, eq, sql, not } from 'drizzle-orm';
import { db } from '../db';
import { rounds, sessions } from '../db/schema';

export type DbRound = typeof rounds.$inferSelect;
export type RoundStatus = DbRound['status'];

const TERMINAL: RoundStatus[] = ['SETTLED', 'CANCELLED'];

const ALLOWED: Record<RoundStatus, RoundStatus[]> = {
	SETUP: ['BETTING_OPEN', 'CANCELLED'],
	BETTING_OPEN: ['LIVE', 'CANCELLED'],
	LIVE: ['RESOLVING', 'CANCELLED'],
	RESOLVING: ['SETTLED', 'CANCELLED'],
	SETTLED: [],
	CANCELLED: []
};

export async function getCurrentRound(sessionId: string): Promise<DbRound | null> {
	const [r] = await db
		.select()
		.from(rounds)
		.where(eq(rounds.sessionId, sessionId))
		.orderBy(desc(rounds.roundNumber))
		.limit(1);
	return r ?? null;
}

export async function getRound(roundId: string): Promise<DbRound | null> {
	const [r] = await db.select().from(rounds).where(eq(rounds.id, roundId)).limit(1);
	return r ?? null;
}

/**
 * Create a new round in SETUP. Rejected if the session has a non-terminal
 * round already (REQ-ROUND-005).
 */
export async function createRound(sessionId: string): Promise<DbRound> {
	return await db.transaction(async (tx) => {
		const [s] = await tx
			.select({ id: sessions.id, status: sessions.status })
			.from(sessions)
			.where(eq(sessions.id, sessionId))
			.for('update');
		if (!s) throw new Error('SESSION_NOT_FOUND');
		if (s.status === 'ENDED') throw new Error('SESSION_ENDED');

		const existing = await tx
			.select({ id: rounds.id, status: rounds.status, roundNumber: rounds.roundNumber })
			.from(rounds)
			.where(eq(rounds.sessionId, sessionId))
			.orderBy(desc(rounds.roundNumber));

		const active = existing.find((r) => !TERMINAL.includes(r.status));
		if (active) throw new Error('ROUND_ALREADY_ACTIVE');

		const nextNumber = (existing[0]?.roundNumber ?? 0) + 1;
		const [created] = await tx
			.insert(rounds)
			.values({ sessionId, roundNumber: nextNumber, status: 'SETUP' })
			.returning();
		return created;
	});
}

/**
 * Transition a round to a new status. Validates the transition graph and
 * stamps the corresponding timestamp column.
 */
export async function transitionStatus(
	roundId: string,
	next: RoundStatus
): Promise<DbRound> {
	return await db.transaction(async (tx) => {
		const [r] = await tx.select().from(rounds).where(eq(rounds.id, roundId)).for('update');
		if (!r) throw new Error('ROUND_NOT_FOUND');
		const allowed = ALLOWED[r.status] ?? [];
		if (!allowed.includes(next)) throw new Error(`INVALID_TRANSITION:${r.status}->${next}`);

		const patch: Partial<typeof rounds.$inferInsert> = { status: next };
		if (next === 'BETTING_OPEN' && !r.startedAt) patch.startedAt = new Date();
		if (next === 'LIVE') patch.lockedAt = new Date();
		if (next === 'SETTLED') patch.settledAt = new Date();

		const [updated] = await tx
			.update(rounds)
			.set(patch)
			.where(eq(rounds.id, roundId))
			.returning();
		return updated;
	});
}
