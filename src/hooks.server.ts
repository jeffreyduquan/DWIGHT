/**
 * @file hooks.server.ts — server-side hooks
 * @implements REQ-AUTH-003 — populate event.locals.user from session cookie
 * @implements REQ-AUTH-004 — protect routes; redirect unauth → /login
 */
import type { Handle } from '@sveltejs/kit';
import { redirect, error } from '@sveltejs/kit';
import { SESSION_COOKIE, clearSessionCookie } from '$lib/server/auth/cookie';
import { verifySession } from '$lib/server/auth/jwt';
import { ADMIN_COOKIE, clearAdminCookie, verifyAdminToken } from '$lib/server/auth/admin';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const PUBLIC_ROUTES = new Set(['/', '/login', '/register', '/healthz']);

function isPublic(pathname: string): boolean {
	if (PUBLIC_ROUTES.has(pathname)) return true;
	// allow internal sveltekit/vite assets
	if (pathname.startsWith('/_app/')) return true;
	if (pathname.startsWith('/favicon')) return true;
	return false;
}

function isAdminRoute(pathname: string): boolean {
	if (pathname.startsWith('/admin')) return true;
	if (pathname.startsWith('/modes')) return true;
	return false;
}

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	let user: App.Locals['user'] = null;

	if (token) {
		const claims = await verifySession(token);
		if (claims) {
			// Verify user still exists in DB (guard against stale JWTs after DB reset)
			const [row] = await db
				.select({ id: users.id, username: users.username })
				.from(users)
				.where(eq(users.id, claims.sub))
				.limit(1);
			if (row) {
				user = { id: row.id, username: row.username };
			} else {
				clearSessionCookie(event.cookies);
			}
		} else {
			clearSessionCookie(event.cookies);
		}
	}

	event.locals.user = user;

	// Admin cookie must be bound to current user.
	let isAdmin = false;
	const adminToken = event.cookies.get(ADMIN_COOKIE);
	if (adminToken && user) {
		const adminUserId = await verifyAdminToken(adminToken);
		if (adminUserId === user.id) {
			isAdmin = true;
		} else {
			clearAdminCookie(event.cookies);
		}
	} else if (adminToken && !user) {
		clearAdminCookie(event.cookies);
	}
	event.locals.isAdmin = isAdmin;

	const path = event.url.pathname;
	if (!user && !isPublic(path)) {
		const target = `/login?next=${encodeURIComponent(path + event.url.search)}`;
		throw redirect(303, target);
	}

	if (user && isAdminRoute(path) && !isAdmin) {
		throw error(403, 'Admin-Bereich');
	}

	return resolve(event);
};
