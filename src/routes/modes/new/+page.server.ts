/**
 * @file modes/new/+page.server.ts — create new Mode.
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createMode } from '$lib/server/repos/modes';
import { parseModeForm } from '$lib/server/modes/parseForm';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {
		initial: {
			name: '',
			defaultEntities: [],
			trackables: []
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const parsed = parseModeForm(form);
		if (!parsed.ok) return fail(400, { error: parsed.error });

		const created = await createMode({
			ownerUserId: locals.user.id,
			...parsed.data
		});
		const next = url.searchParams.get('next');
		if (next && next.startsWith('/') && !next.startsWith('//')) {
			throw redirect(303, next);
		}
		throw redirect(303, `/modes/${created.id}`);
	}
};
