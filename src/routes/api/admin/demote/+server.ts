/**
 * @file /api/admin/demote — clear admin cookie for current session.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearAdminCookie } from '$lib/server/auth/admin';

export const POST: RequestHandler = async ({ cookies }) => {
	clearAdminCookie(cookies);
	return json({ ok: true });
};
