/**
 * @file sessions.ts
 * @implements REQ-MODE-001, REQ-MODE-015, REQ-ENT-001, REQ-ECON-001, REQ-DATA-005
 */
import { and, desc, eq, inArray, not as dbNot } from 'drizzle-orm';
import { db } from '../db';
import {
	entities,
	rounds,
	sessionPlayers,
	sessions,
	type SessionConfig,
	type ModeDefaultEntity,
	type SessionBetGraph,
	type Trackable
} from '../db/schema';

export type DbSession = typeof sessions.$inferSelect;
export type DbSessionPlayer = typeof sessionPlayers.$inferSelect;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
function generateInviteCode(): string {
	let s = '';
	for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
	return s;
}

export async function findById(sessionId: string): Promise<DbSession | null> {
	const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
	return rows[0] ?? null;
}

export async function findByInviteCode(code: string): Promise<DbSession | null> {
	const rows = await db.select().from(sessions).where(eq(sessions.inviteCode, code)).limit(1);
	return rows[0] ?? null;
}

/** Sessions where `userId` is a player (host or otherwise). */
export async function listForUser(userId: string): Promise<DbSession[]> {
	const memberships = await db
		.select({ sessionId: sessionPlayers.sessionId })
		.from(sessionPlayers)
		.where(eq(sessionPlayers.userId, userId));
	if (memberships.length === 0) return [];
	const ids = memberships.map((m) => m.sessionId);
	return db
		.select()
		.from(sessions)
		.where(inArray(sessions.id, ids))
		.orderBy(desc(sessions.createdAt));
}

export async function listPlayers(sessionId: string): Promise<DbSessionPlayer[]> {
	return db.select().from(sessionPlayers).where(eq(sessionPlayers.sessionId, sessionId));
}

export async function getPlayer(
	sessionId: string,
	userId: string
): Promise<DbSessionPlayer | null> {
	const rows = await db
		.select()
		.from(sessionPlayers)
		.where(and(eq(sessionPlayers.sessionId, sessionId), eq(sessionPlayers.userId, userId)))
		.limit(1);
	return rows[0] ?? null;
}

export type CreateSessionInput = {
	hostUserId: string;
	modeId: string;
	name: string;
	config: SessionConfig;
	trackables: Trackable[];
	betGraphsSnapshot?: SessionBetGraph[];
	defaultEntities: ModeDefaultEntity[];
};

export async function createSession(input: CreateSessionInput): Promise<DbSession> {
	return db.transaction(async (tx) => {
		// Generate unique invite code (retry on collision; tiny probability)
		let inviteCode = generateInviteCode();
		for (let attempt = 0; attempt < 5; attempt++) {
			const exists = await tx
				.select({ id: sessions.id })
				.from(sessions)
				.where(eq(sessions.inviteCode, inviteCode))
				.limit(1);
			if (exists.length === 0) break;
			inviteCode = generateInviteCode();
		}

		const [session] = await tx
			.insert(sessions)
			.values({
				hostUserId: input.hostUserId,
				modeId: input.modeId,
				name: input.name,
				inviteCode,
				config: input.config,
				trackables: input.trackables,
				betGraphsSnapshot: input.betGraphsSnapshot ?? []
			})
			.returning();

		// Add host as PLAYER+HOST
		await tx.insert(sessionPlayers).values({
			sessionId: session.id,
			userId: input.hostUserId,
			role: 'HOST',
			moneyBalance: input.config.startingMoney
		});

		// Insert default entities
		if (input.defaultEntities.length > 0) {
			await tx.insert(entities).values(
				input.defaultEntities.map((e, idx) => ({
					sessionId: session.id,
					kind: e.kind,
					name: e.name,
					attributes: e.attributes,
					orderIndex: idx
				}))
			);
		}

		return session;
	});
}

/** Add a user to a session as PLAYER. Idempotent (no-op if already a member). */
export async function joinSession(input: {
	sessionId: string;
	userId: string;
	startingMoney: number;
}): Promise<DbSessionPlayer> {
	return db.transaction(async (tx) => {
		const existing = await tx
			.select()
			.from(sessionPlayers)
			.where(
				and(
					eq(sessionPlayers.sessionId, input.sessionId),
					eq(sessionPlayers.userId, input.userId)
				)
			)
			.limit(1);
		if (existing[0]) return existing[0];

		const [row] = await tx
			.insert(sessionPlayers)
			.values({
				sessionId: input.sessionId,
				userId: input.userId,
				role: 'PLAYER',
				moneyBalance: input.startingMoney
			})
			.returning();
		return row;
	});
}

/** Mark a session as ENDED (host-only check at route level). */
export async function endSession(sessionId: string): Promise<DbSession | null> {
	const [updated] = await db
		.update(sessions)
		.set({ status: 'ENDED' })
		.where(eq(sessions.id, sessionId))
		.returning();
	return updated ?? null;
}

/** Hard-delete a session and all dependent rows (cascades via FK). */
export async function deleteSession(sessionId: string): Promise<boolean> {
	const res = await db.delete(sessions).where(eq(sessions.id, sessionId)).returning({ id: sessions.id });
	return res.length > 0;
}

/**
 * Patch a session's config jsonb. Host-only at route level. Returns the new
 * row or null if not found.
 */
export async function updateSessionConfig(
	sessionId: string,
	patch: Partial<import('../db/schema').SessionConfig>
): Promise<DbSession | null> {
	const [current] = await db
		.select({ config: sessions.config })
		.from(sessions)
		.where(eq(sessions.id, sessionId));
	if (!current) return null;
	const nextConfig = { ...current.config, ...patch };
	const [updated] = await db
		.update(sessions)
		.set({ config: nextConfig })
		.where(eq(sessions.id, sessionId))
		.returning();
	return updated ?? null;
}

/**
 * Switch a session's active mode. Guards:
 * - Only callable when no non-terminal round exists (SETUP/BETTING_OPEN/LIVE/RESOLVING).
 * - Atomically updates modeId, trackables, betGraphsSnapshot, clears entityOverrides,
 *   deletes old entities, inserts new ones from the new mode.
 * Players, balances, drinks, and settled rounds are untouched.
 * @implements REQ-MODE-015
 */
export async function switchSessionMode(input: {
	sessionId: string;
	newModeId: string;
	newTrackables: Trackable[];
	newBetGraphsSnapshot: SessionBetGraph[];
	newDefaultEntities: ModeDefaultEntity[];
}): Promise<DbSession> {
	const TERMINAL_STATUSES = ['SETTLED', 'CANCELLED'] as const;

	return db.transaction(async (tx) => {
		// Lock session row
		const [session] = await tx
			.select()
			.from(sessions)
			.where(eq(sessions.id, input.sessionId))
			.for('update');
		if (!session) throw new Error('SESSION_NOT_FOUND');
		if (session.status === 'ENDED') throw new Error('SESSION_ENDED');

		// Check for active (non-terminal) rounds
		const activeRounds = await tx
			.select({ id: rounds.id, status: rounds.status })
			.from(rounds)
			.where(
				and(
					eq(rounds.sessionId, input.sessionId),
					dbNot(inArray(rounds.status, [...TERMINAL_STATUSES]))
				)
			);
		if (activeRounds.length > 0) {
			throw new Error('ACTIVE_ROUND_EXISTS');
		}

		// Clear entityOverrides from config
		const nextConfig: SessionConfig = {
			...session.config,
			entityOverrides: {}
		};

		// Update session: modeId, trackables, betGraphsSnapshot, config
		const [updated] = await tx
			.update(sessions)
			.set({
				modeId: input.newModeId,
				trackables: input.newTrackables,
				betGraphsSnapshot: input.newBetGraphsSnapshot,
				config: nextConfig
			})
			.where(eq(sessions.id, input.sessionId))
			.returning();

		// Delete old entities
		await tx.delete(entities).where(eq(entities.sessionId, input.sessionId));

		// Insert new entities from the new mode
		if (input.newDefaultEntities.length > 0) {
			await tx.insert(entities).values(
				input.newDefaultEntities.map((e, idx) => ({
					sessionId: input.sessionId,
					kind: e.kind,
					name: e.name,
					attributes: e.attributes,
					orderIndex: idx
				}))
			);
		}

		return updated;
	});
}
