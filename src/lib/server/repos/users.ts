/**
 * @file users.ts — server-side user repository
 * @implements REQ-AUTH-001, REQ-AUTH-007
 */
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

export type DbUser = typeof users.$inferSelect;

export async function findUserByUsername(username: string): Promise<DbUser | null> {
	const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
	return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<DbUser | null> {
	const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
	return rows[0] ?? null;
}

export async function createUser(input: {
	username: string;
	passwordHash: string;
}): Promise<DbUser> {
	const [row] = await db
		.insert(users)
		.values({ username: input.username, passwordHash: input.passwordHash })
		.returning();
	return row;
}

/** Hard-delete a user. FK cascades remove session memberships; sessions owned by user cascade-delete. */
export async function deleteUser(id: string): Promise<boolean> {
	const res = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
	return res.length > 0;
}
