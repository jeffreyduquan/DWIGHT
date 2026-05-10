/**
 * @file logout/+server.ts — POST clears session cookie
 * @implements REQ-AUTH-003 — logout clears session
 */
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { clearSessionCookie } from '$lib/server/auth/cookie';

export const POST: RequestHandler = ({ cookies }) => {
	clearSessionCookie(cookies);
	throw redirect(303, '/login');
};
