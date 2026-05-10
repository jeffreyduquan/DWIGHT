/**
 * @file modes/[id]/+page.server.ts — edit existing Mode.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteMode, findById, findBySlug, updateMode } from '$lib/server/repos/modes';
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
	default: async ({ request, locals, params }) => {
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
		return { ok: true, savedAt: new Date().toISOString() };
	},
	delete: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		await deleteMode(params.id, locals.user.id);
		throw redirect(303, '/modes');
	}
};
