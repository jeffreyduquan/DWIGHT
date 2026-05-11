/**
 * @file logout/+server.ts — POST clears session cookie
 * @implements REQ-AUTH-003 — logout clears session
 */
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearSessionCookie } from '$lib/server/auth/cookie';
import { clearAdminCookie } from '$lib/server/auth/admin';

export const POST: RequestHandler = ({ cookies }) => {
	clearSessionCookie(cookies);
	clearAdminCookie(cookies);
	throw redirect(303, '/login');
};
