/**
 * @file modes/[id]/+page.server.ts — edit existing Mode.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteMode, findById, findBySlug, updateMode, ModeInUseError } from '$lib/server/repos/modes';
import { parseModeForm } from '$lib/server/modes/parseForm';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');
	const mode = await findById(params.id);
	if (!mode) throw error(404, 'Mode nicht gefunden');
	if (mode.ownerUserId !== locals.user.id) throw error(403, 'Nicht dein Mode');
	return {
		mode: {
			id: mode.id,
			slug: mode.slug,
			name: mode.name,
			description: mode.description,
			terminology: mode.terminology,
			defaultEntities: mode.defaultEntities,
			trackables: mode.trackables,
			defaultConfig: mode.defaultConfig
		}
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params, url }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const parsed = parseModeForm(form);
		if (!parsed.ok) return fail(400, { error: parsed.error });

		const conflict = await findBySlug(parsed.data.slug);
		if (conflict && conflict.id !== params.id) {
			return fail(409, { error: `Slug "${parsed.data.slug}" ist schon vergeben` });
		}

		const updated = await updateMode(params.id, locals.user.id, parsed.data);
		if (!updated) return fail(404, { error: 'Mode nicht gefunden' });
		const next = url.searchParams.get('next');
		if (next && next.startsWith('/') && !next.startsWith('//')) {
			throw redirect(303, next);
		}
		throw redirect(303, '/modes');
	},
	delete: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		try {
			await deleteMode(params.id, locals.user.id);
		} catch (err) {
			if (err instanceof ModeInUseError) {
				return fail(409, {
					error: 'Mode wird von bestehenden Sessions verwendet. Lösche zuerst alle Sessions mit diesem Mode.'
				});
			}
			throw err;
		}
		throw redirect(303, '/modes');
	}
};
