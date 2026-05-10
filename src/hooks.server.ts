/**
 * @file hooks.server.ts — server-side hooks
 * @implements REQ-AUTH-003 — populate event.locals.user from session cookie
 * @implements REQ-AUTH-004 — protect routes; redirect unauth → /login
 */
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, clearSessionCookie } from '$lib/server/auth/cookie';
import { verifySession } from '$lib/server/auth/jwt';

const PUBLIC_ROUTES = new Set(['/', '/login', '/register']);

function isPublic(pathname: string): boolean {
	if (PUBLIC_ROUTES.has(pathname)) return true;
	// allow internal sveltekit/vite assets
	if (pathname.startsWith('/_app/')) return true;
	if (pathname.startsWith('/favicon')) return true;
	return false;
}

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	let user: App.Locals['user'] = null;

	if (token) {
		const claims = await verifySession(token);
		if (claims) {
			user = { id: claims.sub, username: claims.username };
		} else {
			clearSessionCookie(event.cookies);
		}
	}

	event.locals.user = user;

	const path = event.url.pathname;
	if (!user && !isPublic(path)) {
		const target = `/login?next=${encodeURIComponent(path + event.url.search)}`;
		throw redirect(303, target);
	}

	return resolve(event);
};
