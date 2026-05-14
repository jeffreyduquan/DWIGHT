/**
 * @file modes/[id]/+page.server.ts — edit existing Mode.
 * Phase 18c: one-page editor — Mode-Form + Wettenliste inline.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteMode, findById, updateMode, ModeInUseError } from '$lib/server/repos/modes';
import { parseModeForm } from '$lib/server/modes/parseForm';
import { deleteBetGraph, findById as findGraphById, listByMode } from '$lib/server/repos/betGraphs';
import { previewSentence } from '$lib/graph/preview';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');
	const mode = await findById(params.id);
	if (!mode) throw error(404, 'Mode nicht gefunden');
	if (mode.ownerUserId !== locals.user.id) throw error(403, 'Nicht dein Mode');
	const graphs = await listByMode(mode.id);
	return {
		mode: {
			id: mode.id,
			name: mode.name,
			defaultEntities: mode.defaultEntities,
			trackables: mode.trackables
		},
		graphs: graphs.map((g) => ({
			id: g.id,
			name: g.name,
			preview: previewSentence(g.graphJson)
		}))
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params, url }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const parsed = parseModeForm(form);
		if (!parsed.ok) return fail(400, { error: parsed.error });

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
					error: 'Mode wird von bestehenden Sessions verwendet. Lösche oder beende zuerst diese Sessions.',
					blockers: err.blockers
				});
			}
			throw err;
		}
		throw redirect(303, '/modes');
	},
	deleteGraph: async ({ request, locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const mode = await findById(params.id);
		if (!mode || mode.ownerUserId !== locals.user.id) return fail(403, { error: 'Kein Zugriff' });
		const form = await request.formData();
		const id = String(form.get('graphId') ?? '');
		if (!id) return fail(400, { error: 'graphId erforderlich' });
		const existing = await findGraphById(id);
		if (!existing || existing.modeId !== mode.id) return fail(404, { error: 'Wette nicht gefunden' });
		await deleteBetGraph(id);
		return { ok: true };
	}
};
