/**
 * @file entities.ts
 * @implements REQ-ENT-001..003
 */
import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { entities } from '../db/schema';

export type DbEntity = typeof entities.$inferSelect;

export async function listForSession(sessionId: string): Promise<DbEntity[]> {
	return db
		.select()
		.from(entities)
		.where(eq(entities.sessionId, sessionId))
		.orderBy(asc(entities.orderIndex));
}
