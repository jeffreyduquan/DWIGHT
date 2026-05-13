/**
 * @file modes/new/+page.server.ts — create new Mode.
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createMode, findBySlug } from '$lib/server/repos/modes';
import { freshModeDefaultConfig } from '$lib/server/modes/defaults';
import { parseModeForm } from '$lib/server/modes/parseForm';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {
		initial: {
			name: '',
			slug: '',
			description: '',
			terminology: { round: 'Runde', entity: 'Entität', startedVerb: 'läuft' },
			defaultEntities: [],
			trackables: [],
			marketTemplates: [],
			defaultConfig: freshModeDefaultConfig()
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const parsed = parseModeForm(form);
		if (!parsed.ok) return fail(400, { error: parsed.error });

		const conflict = await findBySlug(parsed.data.slug);
		if (conflict) return fail(409, { error: `Slug "${parsed.data.slug}" ist schon vergeben` });

		const created = await createMode({ ownerUserId: locals.user.id, ...parsed.data });
		const next = url.searchParams.get('next');
		// Only allow internal redirects
		if (next && next.startsWith('/') && !next.startsWith('//')) {
			throw redirect(303, next);
		}
		// Mode-save closes the edit window and returns to the templates list.
		// (created.id available via flash if needed in future.)
		void created;
		throw redirect(303, '/modes');
	}
};
