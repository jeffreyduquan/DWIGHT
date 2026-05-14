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
import { outcomeIconFor } from '$lib/graph/outcomeIcon';
import { createBetGraph } from '$lib/server/repos/betGraphs';
import { buildGraph, findTemplate, type TemplateId, type TemplateParams } from '$lib/graph/templates';

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
			preview: previewSentence(g.graphJson),
			icon: outcomeIconFor(g.graphJson)
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
	},
	createGraphFromTemplate: async ({ request, locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const mode = await findById(params.id);
		if (!mode || mode.ownerUserId !== locals.user.id) return fail(403, { error: 'Kein Zugriff' });

		const form = await request.formData();
		const templateId = String(form.get('template') ?? '').trim() as TemplateId;
		const spec = findTemplate(templateId);
		if (!spec) return fail(400, { error: 'Unbekannte Vorlage' });

		const params2: TemplateParams = {};
		const trackableId = String(form.get('trackable') ?? '').trim();
		const entityName = String(form.get('entity') ?? '').trim();
		const threshold = Number(form.get('threshold') ?? NaN);
		const topK = Number(form.get('topK') ?? NaN);
		const seconds = Number(form.get('seconds') ?? NaN);
		const direction = String(form.get('direction') ?? '').trim();
		if (trackableId) params2.trackable = trackableId;
		if (entityName) params2.entity = entityName;
		if (Number.isFinite(threshold)) params2.threshold = threshold;
		if (Number.isFinite(topK)) params2.topK = topK;
		if (Number.isFinite(seconds)) params2.seconds = seconds;
		if (direction === 'up' || direction === 'down') params2.direction = direction;

		const trackableLabel = mode.trackables.find((t) => t.id === trackableId)?.label ?? trackableId;
		const built = buildGraph(templateId, params2, {
			trackable: trackableLabel,
			entity: entityName || undefined
		});
		if (!built.ok) return fail(400, { error: built.error });

		await createBetGraph({
			modeId: mode.id,
			name: built.name,
			description: null,
			graphJson: built.graph
		});
		return { ok: true };
	}
};
