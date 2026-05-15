/**
 * @file modes/[id]/graphs/+page.server.ts -- Bet-graph CRUD for a mode (Phase 6 MVP).
 *
 * Provides:
 *  - list of all graphs of this mode
 *  - `create`: stub graph with given name
 *  - `save`: update name/description/graphJson (raw JSON textarea)
 *  - `delete`: remove a graph
 *
 * The visual editor will replace the JSON textarea in a follow-up phase.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findById as findModeById } from '$lib/server/repos/modes';
import {
	createBetGraph,
	deleteBetGraph,
	findById as findGraphById,
	listByMode,
	updateBetGraph
} from '$lib/server/repos/betGraphs';
import { validateGraph } from '$lib/graph/validate';
import { previewSentence } from '$lib/graph/preview';
import type { BetGraph } from '$lib/server/db/schema';
import { GRAPH_GRID_COLS, GRAPH_GRID_ROWS } from '$lib/server/db/schema';

const EMPTY_GRAPH: BetGraph = {
	version: 2,
	grid: { cols: GRAPH_GRID_COLS, rows: GRAPH_GRID_ROWS },
	nodes: [],
	edges: []
};

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');
	const mode = await findModeById(params.id);
	if (!mode) throw error(404, 'Mode nicht gefunden');
	if (mode.ownerUserId !== locals.user.id) throw error(403, 'Nicht dein Mode');
	const graphs = await listByMode(mode.id);
	return {
		mode: { id: mode.id, name: mode.name, trackables: mode.trackables, defaultEntities: mode.defaultEntities },
		graphs: graphs.map((g) => ({
			id: g.id,
			name: g.name,
			description: g.description,
			graphJson: g.graphJson,
			orderIndex: g.orderIndex,
			preview: previewSentence(g.graphJson),
			validation: validateGraph(g.graphJson)
		}))
	};
};

function parseGraphJson(raw: string): { ok: true; graph: BetGraph } | { ok: false; error: string } {
	if (!raw.trim()) return { ok: true, graph: EMPTY_GRAPH };
	try {
		const parsed = JSON.parse(raw) as BetGraph;
		if (parsed == null || typeof parsed !== 'object') return { ok: false, error: 'Graph muss ein Objekt sein' };
		if (parsed.version !== 2) return { ok: false, error: 'Graph version != 2' };
		if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
			return { ok: false, error: 'Graph braucht nodes[] und edges[]' };
		}
		if (!parsed.grid) parsed.grid = { cols: GRAPH_GRID_COLS, rows: GRAPH_GRID_ROWS };
		return { ok: true, graph: parsed };
	} catch (e) {
		return { ok: false, error: 'JSON-Parse-Fehler: ' + (e as Error).message };
	}
}

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const mode = await findModeById(params.id);
		if (!mode || mode.ownerUserId !== locals.user.id) return fail(403, { error: 'Kein Zugriff' });
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim() || 'Neuer Graph';
		const description = String(form.get('description') ?? '').trim() || null;
		await createBetGraph({ modeId: mode.id, name, description, graphJson: EMPTY_GRAPH });
		return { ok: true };
	},
	save: async ({ request, locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const mode = await findModeById(params.id);
		if (!mode || mode.ownerUserId !== locals.user.id) return fail(403, { error: 'Kein Zugriff' });
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const name = String(form.get('name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim() || null;
		const rawJson = String(form.get('graphJson') ?? '');
		if (!id || !name) return fail(400, { error: 'id + name erforderlich' });
		const existing = await findGraphById(id);
		if (!existing || existing.modeId !== mode.id) return fail(404, { error: 'Graph nicht gefunden' });
		const parsed = parseGraphJson(rawJson);
		if (!parsed.ok) return fail(400, { error: parsed.error });
		await updateBetGraph(id, { name, description, graphJson: parsed.graph });
		return { ok: true };
	},
	delete: async ({ request, locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const mode = await findModeById(params.id);
		if (!mode || mode.ownerUserId !== locals.user.id) return fail(403, { error: 'Kein Zugriff' });
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'id erforderlich' });
		const existing = await findGraphById(id);
		if (!existing || existing.modeId !== mode.id) return fail(404, { error: 'Graph nicht gefunden' });
		await deleteBetGraph(id);
		return { ok: true };
	}
};
