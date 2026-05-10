/**
 * @file s/join/+page.server.ts — join via invite code
 * @implements REQ-MODE-001, REQ-DATA-005
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findByInviteCode, joinSession } from '$lib/server/repos/sessions';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');

		const form = await request.formData();
		const code = String(form.get('code') ?? '')
			.trim()
			.toUpperCase();
		if (code.length !== 6) return fail(400, { error: 'Code muss 6 Zeichen haben', code });

		const session = await findByInviteCode(code);
		if (!session) return fail(404, { error: 'Session nicht gefunden', code });
		if (session.status === 'ENDED') return fail(410, { error: 'Session ist beendet', code });

		await joinSession({
			sessionId: session.id,
			userId: locals.user.id,
			startingMoney: session.config.startingMoney
		});

		throw redirect(303, `/s/${session.id}`);
	}
};
