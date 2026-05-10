/**
 * @file sessions.ts
 * @implements REQ-MODE-001, REQ-ENT-001, REQ-ECON-001, REQ-DATA-005
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
	entities,
	sessionPlayers,
	sessions,
	type SessionConfig,
	type ModeDefaultEntity
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
				trackables: input.trackables
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
