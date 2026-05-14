/**
 * @file modes/+page.server.ts — list user's own modes, delete + duplicate actions.
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteMode, duplicateMode, listOwnedByUser } from '$lib/server/repos/modes';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	const modes = await listOwnedByUser(locals.user.id);
	return {
		modes: modes.map((m) => ({
			id: m.id,
			slug: m.slug,
			name: m.name,
			entityCount: m.defaultEntities.length
		}))
	};
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'id fehlt' });
		const ok = await deleteMode(id, locals.user.id);
		if (!ok) return fail(404, { error: 'Mode nicht gefunden' });
		return { ok: true };
	},
	duplicate: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'id fehlt' });
		const copy = await duplicateMode(id, locals.user.id);
		if (!copy) return fail(404, { error: 'Quell-Mode nicht gefunden' });
		throw redirect(303, `/modes/${copy.id}`);
	}
};
