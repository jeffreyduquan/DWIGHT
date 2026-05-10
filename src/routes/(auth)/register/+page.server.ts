/**
 * @file register/+page.server.ts
 * @implements REQ-AUTH-001 — register with username + password
 * @implements REQ-AUTH-002 — argon2id hashing on registration
 * @implements REQ-AUTH-003 — set session cookie on success
 */
import { fail, redirect, type Actions } from '@sveltejs/kit';
import { hashPassword } from '$lib/server/auth/password';
import { signSession } from '$lib/server/auth/jwt';
import { setSessionCookie } from '$lib/server/auth/cookie';
import { validatePassword, validateUsername } from '$lib/server/auth/validation';
import { createUser, findUserByUsername } from '$lib/server/repos/users';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) throw redirect(303, '/');
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const password = String(form.get('password') ?? '');

		const usernameError = validateUsername(username);
		const passwordError = validatePassword(password);
		if (usernameError || passwordError) {
			return fail(400, { username, usernameError, passwordError });
		}

		const existing = await findUserByUsername(username);
		if (existing) {
			return fail(409, { username, usernameError: 'Username ist bereits vergeben.' });
		}

		const passwordHash = await hashPassword(password);
		const user = await createUser({ username, passwordHash });

		const token = await signSession({ sub: user.id, username: user.username });
		setSessionCookie(cookies, token);

		throw redirect(303, '/');
	}
};
