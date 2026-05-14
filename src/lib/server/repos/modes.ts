/**
 * @file modes.ts
 * @implements REQ-MODE-001..006
 */
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import {
	modes,
	sessions,
	type ModeDefaultConfig,
	type ModeDefaultEntity,
	type ModeTerminology,
	type Trackable
} from '../db/schema';

export type DbMode = typeof modes.$inferSelect;

/** Built-in modes (owner=null) + modes owned by `userId`. */
export async function listAvailableForUser(userId: string): Promise<DbMode[]> {
	return db
		.select()
		.from(modes)
		.where(or(isNull(modes.ownerUserId), eq(modes.ownerUserId, userId)));
}

/** Modes the user can edit/delete (own only). */
export async function listOwnedByUser(userId: string): Promise<DbMode[]> {
	return db.select().from(modes).where(eq(modes.ownerUserId, userId));
}

export async function findById(id: string): Promise<DbMode | null> {
	const rows = await db.select().from(modes).where(eq(modes.id, id)).limit(1);
	return rows[0] ?? null;
}

export type CreateModeInput = {
	ownerUserId: string;
	name: string;
	description: string;
	terminology: ModeTerminology;
	defaultEntities: ModeDefaultEntity[];
	trackables: Trackable[];
	defaultConfig: ModeDefaultConfig;
};

export async function createMode(input: CreateModeInput): Promise<DbMode> {
	const [row] = await db.insert(modes).values(input).returning();
	return row;
}

export type UpdateModeInput = Omit<CreateModeInput, 'ownerUserId'>;

/** Update an own mode. */
export async function updateMode(
	id: string,
	userId: string,
	patch: UpdateModeInput
): Promise<DbMode | null> {
	const [row] = await db
		.update(modes)
		.set(patch)
		.where(and(eq(modes.id, id), eq(modes.ownerUserId, userId)))
		.returning();
	return row ?? null;
}

export async function deleteMode(id: string, userId: string): Promise<boolean> {
	try {
		const rows = await db
			.delete(modes)
			.where(and(eq(modes.id, id), eq(modes.ownerUserId, userId)))
			.returning({ id: modes.id });
		return rows.length > 0;
	} catch (err: unknown) {
		// FK violation: sessions still reference this Mode → re-throw a typed error.
		const code = (err as { code?: string })?.code;
		if (code === '23503') {
			const blockers = await listSessionsUsingMode(id);
			throw new ModeInUseError(blockers);
		}
		throw err;
	}
}

/** Sessions (any status) that still reference the Mode — used to explain delete failures. */
export async function listSessionsUsingMode(
	modeId: string
): Promise<Array<{ id: string; name: string; status: string }>> {
	return db
		.select({ id: sessions.id, name: sessions.name, status: sessions.status })
		.from(sessions)
		.where(eq(sessions.modeId, modeId));
}

export class ModeInUseError extends Error {
	readonly blockers: Array<{ id: string; name: string; status: string }>;
	constructor(blockers: Array<{ id: string; name: string; status: string }> = []) {
		super('Mode wird von bestehenden Sessions verwendet');
		this.name = 'ModeInUseError';
		this.blockers = blockers;
	}
}

export async function duplicateMode(sourceId: string, userId: string): Promise<DbMode | null> {
	const source = await findById(sourceId);
	if (!source) return null;
	return createMode({
		ownerUserId: userId,
		name: `${source.name} (Kopie)`,
		description: source.description,
		terminology: source.terminology,
		defaultEntities: source.defaultEntities,
		trackables: source.trackables,
		defaultConfig: source.defaultConfig
	});
}
