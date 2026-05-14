/**
 * @file modes.ts
 * @implements REQ-MODE-001..006
 */
import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '../db';
import {
	modes,
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

export async function findBySlug(slug: string): Promise<DbMode | null> {
	const rows = await db.select().from(modes).where(eq(modes.slug, slug)).limit(1);
	return rows[0] ?? null;
}

export type CreateModeInput = {
	ownerUserId: string;
	slug: string;
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

export type UpdateModeInput = Omit<CreateModeInput, 'ownerUserId' | 'slug'> & {
	slug?: string;
};

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
		if (code === '23503') throw new ModeInUseError();
		throw err;
	}
}

export class ModeInUseError extends Error {
	constructor() {
		super('Mode wird von bestehenden Sessions verwendet');
		this.name = 'ModeInUseError';
	}
}

export async function duplicateMode(sourceId: string, userId: string): Promise<DbMode | null> {
	const source = await findById(sourceId);
	if (!source) return null;
	const baseSlug = `${source.slug}-copy`;
	let slug = baseSlug;
	for (let i = 1; i < 50; i++) {
		const exists = await findBySlug(slug);
		if (!exists) break;
		slug = `${baseSlug}-${i + 1}`;
	}
	return createMode({
		ownerUserId: userId,
		slug,
		name: `${source.name} (Kopie)`,
		description: source.description,
		terminology: source.terminology,
		defaultEntities: source.defaultEntities,
		trackables: source.trackables,
		defaultConfig: source.defaultConfig
	});
}
