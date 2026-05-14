/**
 * @file modes/[id]/graphs/new/+page.server.ts -- Wett-Vorlagen-Picker (Phase 18b).
 *
 * GET shows the catalog of templates. POST builds a `BetGraph` from the chosen
 * template + parameters and persists it via the existing `createBetGraph` repo.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findById as findModeById } from '$lib/server/repos/modes';
import { createBetGraph } from '$lib/server/repos/betGraphs';
import { TEMPLATES, buildGraph, findTemplate, type TemplateId, type TemplateParams } from '$lib/graph/templates';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');
	const mode = await findModeById(params.id);
	if (!mode) throw error(404, 'Mode nicht gefunden');
	if (mode.ownerUserId !== locals.user.id) throw error(403, 'Nicht dein Mode');
	return {
		modeId: mode.id,
		modeName: mode.name,
		trackables: mode.trackables.map((t) => ({ id: t.id, label: t.label, emoji: t.emoji, color: t.color })),
		entities: mode.defaultEntities.map((e) => ({ name: e.name })),
		templates: TEMPLATES
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const mode = await findModeById(params.id);
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
		if (!built.ok) return fail(400, { error: built.error, template: templateId });

		await createBetGraph({
			modeId: mode.id,
			name: built.name,
			description: null,
			graphJson: built.graph
		});

		throw redirect(303, `/modes/${mode.id}`);
	}
};
