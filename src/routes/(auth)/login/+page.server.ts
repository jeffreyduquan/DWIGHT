/**
 * @file login/+page.server.ts
 * @implements REQ-AUTH-003 — login sets session cookie
 * @implements REQ-AUTH-005 — rate-limit login attempts (5 / 5min per IP+username)
 */
import { fail, redirect, type Actions } from '@sveltejs/kit';
import { verifyPassword } from '$lib/server/auth/password';
import { signSession } from '$lib/server/auth/jwt';
import { setSessionCookie } from '$lib/server/auth/cookie';
import { findUserByUsername } from '$lib/server/repos/users';
import { checkRateLimit, resetRateLimit } from '$lib/server/auth/rateLimit';
import type { PageServerLoad } from './$types';

const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX = 5;

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) {
		const next = url.searchParams.get('next') ?? '/';
		throw redirect(303, next);
	}
	return { next: url.searchParams.get('next') ?? '/' };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const next = String(form.get('next') ?? '/') || '/';

		if (!username || !password) {
			return fail(400, { username, error: 'Username und Passwort erforderlich.' });
		}

		const ip = getClientAddress();
		const rlKey = `login:${ip}:${username.toLowerCase()}`;
		const rl = checkRateLimit(rlKey, { windowMs: RATE_WINDOW_MS, max: RATE_MAX });
		if (!rl.allowed) {
			return fail(429, {
				username,
				error: `Zu viele Versuche. Bitte ${rl.retryAfterSeconds}s warten.`
			});
		}

		const user = await findUserByUsername(username);
		const ok = user ? await verifyPassword(user.passwordHash, password) : false;

		if (!user || !ok) {
			return fail(401, { username, error: 'Username oder Passwort falsch.' });
		}

		resetRateLimit(rlKey);

		const token = await signSession({ sub: user.id, username: user.username });
		setSessionCookie(cookies, token);

		// Validate `next` is a same-origin path to prevent open-redirect.
		const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
		throw redirect(303, safeNext);
	}
};
