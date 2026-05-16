/**
 * @file betGraphs.ts -- CRUD for mode-level visual bet-graphs.
 * @implements REQ-MODE-007 (Phase 6 -- visual market builder)
 */
import { asc, eq, inArray, sql, count } from 'drizzle-orm';
import { db } from '../db';
import { betGraphs, type BetGraph, type SessionBetGraph } from '../db/schema';

export type DbBetGraph = typeof betGraphs.$inferSelect;

export async function listByMode(modeId: string): Promise<DbBetGraph[]> {
	return db
		.select()
		.from(betGraphs)
		.where(eq(betGraphs.modeId, modeId))
		.orderBy(asc(betGraphs.orderIndex), asc(betGraphs.createdAt));
}

export async function findById(id: string): Promise<DbBetGraph | null> {
	const rows = await db.select().from(betGraphs).where(eq(betGraphs.id, id)).limit(1);
	return rows[0] ?? null;
}

export type CreateBetGraphInput = {
	modeId: string;
	name: string;
	description?: string | null;
	graphJson: BetGraph;
	orderIndex?: number;
};

export async function createBetGraph(input: CreateBetGraphInput): Promise<DbBetGraph> {
	const [row] = await db
		.insert(betGraphs)
		.values({
			modeId: input.modeId,
			name: input.name,
			description: input.description ?? null,
			graphJson: input.graphJson,
			orderIndex: input.orderIndex ?? 0
		})
		.returning();
	return row;
}

export type UpdateBetGraphInput = {
	name?: string;
	description?: string | null;
	graphJson?: BetGraph;
	orderIndex?: number;
};

export async function updateBetGraph(
	id: string,
	patch: UpdateBetGraphInput
): Promise<DbBetGraph | null> {
	const [row] = await db
		.update(betGraphs)
		.set({ ...patch, updatedAt: new Date() })
		.where(eq(betGraphs.id, id))
		.returning();
	return row ?? null;
}

export async function deleteBetGraph(id: string): Promise<boolean> {
	const rows = await db.delete(betGraphs).where(eq(betGraphs.id, id)).returning({ id: betGraphs.id });
	return rows.length > 0;
}

/** Return a map of modeId → bet-graph count for the given mode IDs. */
export async function countByModeIds(modeIds: string[]): Promise<Map<string, number>> {
	if (modeIds.length === 0) return new Map();
	const rows = await db
		.select({ modeId: betGraphs.modeId, cnt: count() })
		.from(betGraphs)
		.where(inArray(betGraphs.modeId, modeIds))
		.groupBy(betGraphs.modeId);
	const m = new Map<string, number>();
	for (const r of rows) m.set(r.modeId, r.cnt);
	return m;
}

/** Build the snapshot array for a session from a mode's stored graphs. */
export async function snapshotForMode(modeId: string): Promise<SessionBetGraph[]> {
	const rows = await listByMode(modeId);
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		description: r.description,
		graph: r.graphJson
	}));
}
