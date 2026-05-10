/**
 * @file cookie.ts — set/clear the session cookie
 * @implements REQ-AUTH-003 — HttpOnly, Secure, SameSite=Lax
 */
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { SESSION_TTL_SECONDS } from './jwt';

export const SESSION_COOKIE = 'dwight_session';

export function setSessionCookie(cookies: Cookies, token: string): void {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: SESSION_TTL_SECONDS
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
