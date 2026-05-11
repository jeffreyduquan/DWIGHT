/**
 * @file /admin — admin panel: list users + all sessions with cleanup actions.
 * Gated by hooks.server.ts (requires locals.isAdmin).
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, sessions } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import { deleteSession } from '$lib/server/repos/sessions';
import { deleteUser } from '$lib/server/repos/users';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.isAdmin) throw error(403, 'Admin-Bereich');
	const allUsers = await db
		.select({ id: users.id, username: users.username, createdAt: users.createdAt })
		.from(users)
		.orderBy(desc(users.createdAt));
	const allSessions = await db
		.select({
			id: sessions.id,
			name: sessions.name,
			inviteCode: sessions.inviteCode,
			status: sessions.status,
			hostUserId: sessions.hostUserId,
			createdAt: sessions.createdAt
		})
		.from(sessions)
		.orderBy(desc(sessions.createdAt));
	return { users: allUsers, sessions: allSessions };
};

export const actions: Actions = {
	deleteSession: async ({ request, locals }) => {
		if (!locals.isAdmin) throw error(403, 'Admin-Bereich');
		const fd = await request.formData();
		const sessionId = String(fd.get('sessionId') ?? '');
		if (!sessionId) return fail(400, { error: 'sessionId fehlt' });
		await deleteSession(sessionId);
		throw redirect(303, '/admin');
	},
	deleteUser: async ({ request, locals }) => {
		if (!locals.isAdmin) throw error(403, 'Admin-Bereich');
		const fd = await request.formData();
		const userId = String(fd.get('userId') ?? '');
		if (!userId) return fail(400, { error: 'userId fehlt' });
		if (locals.user && userId === locals.user.id) {
			return fail(400, { error: 'Du kannst dich nicht selbst löschen' });
		}
		await deleteUser(userId);
		throw redirect(303, '/admin');
	}
};
