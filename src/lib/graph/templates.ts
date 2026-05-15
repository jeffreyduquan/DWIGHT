/**
 * @file graph/templates.ts -- High-level bet-graph templates ("Wett-Vorlagen") for Graph 2.0.
 *
 * Phase 21c: templates emit Graph 2.0 nodes with slot positions on the 20×10
 * grid. Slot convention:
 *   - col 0: entity-list / single-entity sources
 *   - col 1: event sources, number constants, time
 *   - col 2-3: compute (aggregate, rank, delta)
 *   - col 4: logic (compare, combine, condition, time_compare)
 *   - col 5: outcome (winner, truth, podium)
 */
import type { BetGraph, GraphEdge, GraphNode } from '$lib/server/db/schema';
import { GRAPH_GRID_COLS, GRAPH_GRID_ROWS } from '$lib/graph/grid';

export type TemplateId =
	| 'race'
	| 'champion'
	| 'loser'
	| 'will_player'
	| 'will_happen'
	| 'podium'
	| 'race_vs_time'
	| 'finish_first'
	| 'finish_last'
	| 'count_zero'
	| 'count_less_than'
	| 'count_more_than';

export type TemplateField =
	| { name: string; kind: 'trackable'; label: string; required: true }
	| { name: string; kind: 'entity'; label: string; required: true }
	| {
			name: string;
			kind: 'number';
			label: string;
			min?: number;
			max?: number;
			defaultValue: number;
			required: true;
	  }
	| {
			name: string;
			kind: 'enum';
			label: string;
			options: { value: string; label: string }[];
			defaultValue: string;
			required: true;
	  };

export type TemplateSpec = {
	id: TemplateId;
	icon: 'Flag' | 'Trophy' | 'Skull' | 'Target' | 'Zap' | 'Medal' | 'Timer' | 'X' | 'Minus' | 'Hash';
	title: string;
	tagline: string;
	fields: TemplateField[];
	sentence: (params: Record<string, string>) => string;
};

function nid(prefix: string, suffix: string): string {
	return `${prefix}_${suffix}`;
}

function edge(fromId: string, fromPin: string, toId: string, toPin: string): GraphEdge {
	return { from: { nodeId: fromId, pin: fromPin }, to: { nodeId: toId, pin: toPin } };
}

function makeGraph(nodes: GraphNode[], edges: GraphEdge[]): BetGraph {
	return {
		version: 2,
		grid: { cols: GRAPH_GRID_COLS, rows: GRAPH_GRID_ROWS },
		nodes,
		edges
	};
}

export const TEMPLATES: TemplateSpec[] = [
	{
		id: 'race',
		icon: 'Flag',
		title: 'Wettrennen',
		tagline: 'Wer schafft zuerst N × Event?',
		fields: [
			{ name: 'trackable', kind: 'trackable', label: 'Event', required: true },
			{
				name: 'threshold',
				kind: 'number',
				label: 'Schwelle (N)',
				defaultValue: 3,
				min: 1,
				required: true
			}
		],
		sentence: (p) => `Wer schafft zuerst ${p.threshold} × ${p.trackableLabel}?`
	},
	{
		id: 'champion',
		icon: 'Trophy',
		title: 'Champion',
		tagline: 'Wer hat am Ende die meisten Events?',
		fields: [{ name: 'trackable', kind: 'trackable', label: 'Event', required: true }],
		sentence: (p) => `Wer hat am Ende die meisten ${p.trackableLabel}?`
	},
	{
		id: 'loser',
		icon: 'Skull',
		title: 'Letzter',
		tagline: 'Wer hat am Ende die wenigsten Events?',
		fields: [{ name: 'trackable', kind: 'trackable', label: 'Event', required: true }],
		sentence: (p) => `Wer hat am Ende die wenigsten ${p.trackableLabel}?`
	},
	{
		id: 'will_player',
		icon: 'Target',
		title: 'Schafft der das?',
		tagline: 'Schafft eine Entität mindestens N Events?',
		fields: [
			{ name: 'entity', kind: 'entity', label: 'Entität', required: true },
			{ name: 'trackable', kind: 'trackable', label: 'Event', required: true },
			{
				name: 'threshold',
				kind: 'number',
				label: 'Schwelle (N)',
				defaultValue: 3,
				min: 1,
				required: true
			}
		],
		sentence: (p) => `Schafft ${p.entityLabel} mindestens ${p.threshold} × ${p.trackableLabel}?`
	},
	{
		id: 'will_happen',
		icon: 'Zap',
		title: 'Passiert das?',
		tagline: 'Tritt Event mind. N-mal ein? (egal wer)',
		fields: [
			{ name: 'trackable', kind: 'trackable', label: 'Event', required: true },
			{
				name: 'threshold',
				kind: 'number',
				label: 'Schwelle (N)',
				defaultValue: 5,
				min: 1,
				required: true
			}
		],
		sentence: (p) => `Passiert ${p.trackableLabel} mindestens ${p.threshold}-mal?`
	},
	{
		id: 'podium',
		icon: 'Medal',
		title: 'Podest',
		tagline: 'Wer wird Platz K?',
		fields: [
			{ name: 'trackable', kind: 'trackable', label: 'Event', required: true },
			{ name: 'topK', kind: 'number', label: 'Top-K', defaultValue: 3, min: 1, required: true }
		],
		sentence: (p) => `Top ${p.topK} bei ${p.trackableLabel}?`
	},
	{
		id: 'race_vs_time',
		icon: 'Timer',
		title: 'Race vs Zeit',
		tagline: 'Schafft jemand N Events vor T Sekunden?',
		fields: [
			{ name: 'trackable', kind: 'trackable', label: 'Event', required: true },
			{
				name: 'threshold',
				kind: 'number',
				label: 'Schwelle (N)',
				defaultValue: 3,
				min: 1,
				required: true
			},
			{
				name: 'seconds',
				kind: 'number',
				label: 'Sekunden (T)',
				defaultValue: 60,
				min: 5,
				required: true
			}
		],
		sentence: (p) => `Schafft jemand ${p.threshold} × ${p.trackableLabel} vor ${p.seconds}s?`
	}
];

export function findTemplate(id: string): TemplateSpec | null {
	return TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Templates that need per-entity counters (compare entities against each other).
 * Templates not in this set work with both global and entity-scoped trackables.
 */
const ENTITY_SCOPE_REQUIRED: ReadonlySet<TemplateId> = new Set([
	'race',
	'champion',
	'loser',
	'will_player',
	'podium'
]);

export function templateRequiresEntityScope(id: TemplateId): boolean {
	return ENTITY_SCOPE_REQUIRED.has(id);
}

export type TemplateParams = {
	trackable?: string;
	entity?: string;
	threshold?: number;
	topK?: number;
	seconds?: number;
};

export type BuildResult =
	| { ok: true; graph: BetGraph; name: string }
	| { ok: false; error: string };

export function buildGraph(
	templateId: TemplateId,
	params: TemplateParams,
	labels: { trackable?: string; entity?: string }
): BuildResult {
	switch (templateId) {
		case 'race':
			return buildRace(params, labels);
		case 'champion':
			return buildRankWinner(params, labels, 'desc', 'Champion: meiste');
		case 'loser':
			return buildRankWinner(params, labels, 'asc', 'Letzter: wenigste');
		case 'will_player':
			return buildWillPlayer(params, labels);
		case 'will_happen':
			return buildWillHappen(params, labels);
		case 'podium':
			return buildPodium(params, labels);
		case 'race_vs_time':
			return buildRaceVsTime(params, labels);
		default:
			return { ok: false, error: `Unbekannte Vorlage: ${templateId}` };
	}
}

// ---------- template builders ----------

function buildRace(
	p: TemplateParams,
	labels: { trackable?: string }
): BuildResult {
	if (!p.trackable) return { ok: false, error: 'Event fehlt' };
	if (!p.threshold || p.threshold < 1) return { ok: false, error: 'Schwelle muss ≥ 1 sein' };
	const ents = nid('ents', 'all');
	const evt = nid('evt', 'main');
	const rk = nid('rank', 'race');
	const out = nid('out', 'res');
	const title = `Wettrennen: zuerst ${p.threshold} × ${labels.trackable ?? 'Event'}`;
	const nodes: GraphNode[] = [
		{ id: ents, kind: 'entities', pos: { col: 0, row: 4 } },
		{ id: evt, kind: 'event', pos: { col: 1, row: 3 }, props: { trackableId: p.trackable } },
		{
			id: rk,
			kind: 'rank',
			pos: { col: 3, row: 3 },
			props: { direction: 'desc', topK: 1, threshold: p.threshold }
		},
		{
			id: out,
			kind: 'winner',
			pos: { col: 5, row: 3 },
			props: { marketTitle: title, trigger: 'OnFirstSatisfied' }
		}
	];
	const edges: GraphEdge[] = [
		edge(evt, 'out', rk, 'event'),
		edge(ents, 'out', rk, 'scope'),
		edge(rk, 'out', out, 'result')
	];
	return { ok: true, name: title, graph: makeGraph(nodes, edges) };
}

function buildRankWinner(
	p: TemplateParams,
	labels: { trackable?: string },
	direction: 'asc' | 'desc',
	titlePrefix: string
): BuildResult {
	if (!p.trackable) return { ok: false, error: 'Event fehlt' };
	const ents = nid('ents', 'all');
	const evt = nid('evt', 'main');
	const rk = nid('rank', direction);
	const out = nid('out', 'res');
	const title = `${titlePrefix} ${labels.trackable ?? 'Event'}`;
	const nodes: GraphNode[] = [
		{ id: ents, kind: 'entities', pos: { col: 0, row: 4 } },
		{ id: evt, kind: 'event', pos: { col: 1, row: 3 }, props: { trackableId: p.trackable } },
		{
			id: rk,
			kind: 'rank',
			pos: { col: 3, row: 3 },
			props: { direction, topK: 1, threshold: 0 }
		},
		{
			id: out,
			kind: 'winner',
			pos: { col: 5, row: 3 },
			props: { marketTitle: title, trigger: 'OnRoundEnd' }
		}
	];
	const edges: GraphEdge[] = [
		edge(evt, 'out', rk, 'event'),
		edge(ents, 'out', rk, 'scope'),
		edge(rk, 'out', out, 'result')
	];
	return { ok: true, name: title, graph: makeGraph(nodes, edges) };
}

function buildWillPlayer(
	p: TemplateParams,
	labels: { trackable?: string; entity?: string }
): BuildResult {
	if (!p.trackable) return { ok: false, error: 'Event fehlt' };
	if (!p.entity) return { ok: false, error: 'Entität fehlt' };
	if (!p.threshold || p.threshold < 1) return { ok: false, error: 'Schwelle muss ≥ 1 sein' };
	const ent = nid('ent', 'pick');
	const evt = nid('evt', 'main');
	const agg = nid('agg', 'main');
	const num = nid('num', 'th');
	const cmp = nid('cmp', 'gte');
	const out = nid('out', 'res');
	const title = `Schafft ${labels.entity ?? 'Entität'} ${p.threshold} × ${labels.trackable ?? 'Event'}?`;
	const nodes: GraphNode[] = [
		{ id: ent, kind: 'entity', pos: { col: 0, row: 4 }, props: { entityName: p.entity } },
		{ id: evt, kind: 'event', pos: { col: 1, row: 3 }, props: { trackableId: p.trackable } },
		{ id: agg, kind: 'aggregate', pos: { col: 3, row: 3 }, props: { agg: 'count' } },
		{ id: num, kind: 'number', pos: { col: 1, row: 5 }, props: { value: p.threshold } },
		{ id: cmp, kind: 'compare', pos: { col: 4, row: 4 }, props: { op: 'gte' } },
		{
			id: out,
			kind: 'truth',
			pos: { col: 5, row: 4 },
			props: {
				marketTitle: title,
				trigger: 'OnFirstSatisfied',
				yesLabel: 'Ja',
				noLabel: 'Nein'
			}
		}
	];
	const edges: GraphEdge[] = [
		edge(evt, 'out', agg, 'event'),
		edge(ent, 'out', agg, 'scope'), // Entity → EntityList coercion
		edge(agg, 'out', cmp, 'a'),
		edge(num, 'out', cmp, 'b'),
		edge(cmp, 'out', out, 'result')
	];
	return { ok: true, name: title, graph: makeGraph(nodes, edges) };
}

function buildWillHappen(
	p: TemplateParams,
	labels: { trackable?: string }
): BuildResult {
	if (!p.trackable) return { ok: false, error: 'Event fehlt' };
	if (!p.threshold || p.threshold < 1) return { ok: false, error: 'Schwelle muss ≥ 1 sein' };
	const ents = nid('ents', 'all');
	const evt = nid('evt', 'main');
	const agg = nid('agg', 'main');
	const num = nid('num', 'th');
	const cmp = nid('cmp', 'gte');
	const out = nid('out', 'res');
	const title = `Passiert ${labels.trackable ?? 'Event'} mind. ${p.threshold}-mal?`;
	const nodes: GraphNode[] = [
		{ id: ents, kind: 'entities', pos: { col: 0, row: 4 } },
		{ id: evt, kind: 'event', pos: { col: 1, row: 3 }, props: { trackableId: p.trackable } },
		{ id: agg, kind: 'aggregate', pos: { col: 3, row: 3 }, props: { agg: 'sum' } },
		{ id: num, kind: 'number', pos: { col: 1, row: 5 }, props: { value: p.threshold } },
		{ id: cmp, kind: 'compare', pos: { col: 4, row: 4 }, props: { op: 'gte' } },
		{
			id: out,
			kind: 'truth',
			pos: { col: 5, row: 4 },
			props: {
				marketTitle: title,
				trigger: 'OnFirstSatisfied',
				yesLabel: 'Ja',
				noLabel: 'Nein'
			}
		}
	];
	const edges: GraphEdge[] = [
		edge(evt, 'out', agg, 'event'),
		edge(ents, 'out', agg, 'scope'),
		edge(agg, 'out', cmp, 'a'),
		edge(num, 'out', cmp, 'b'),
		edge(cmp, 'out', out, 'result')
	];
	return { ok: true, name: title, graph: makeGraph(nodes, edges) };
}

function buildPodium(p: TemplateParams, labels: { trackable?: string }): BuildResult {
	if (!p.trackable) return { ok: false, error: 'Event fehlt' };
	if (!p.topK || p.topK < 1) return { ok: false, error: 'Top-K muss ≥ 1 sein' };
	const ents = nid('ents', 'all');
	const evt = nid('evt', 'main');
	const rk = nid('rank', 'desc');
	const out = nid('out', 'res');
	const title = `Top ${p.topK} bei ${labels.trackable ?? 'Event'}`;
	const nodes: GraphNode[] = [
		{ id: ents, kind: 'entities', pos: { col: 0, row: 4 } },
		{ id: evt, kind: 'event', pos: { col: 1, row: 3 }, props: { trackableId: p.trackable } },
		{
			id: rk,
			kind: 'rank',
			pos: { col: 3, row: 3 },
			props: { direction: 'desc', topK: p.topK, threshold: 0 }
		},
		{
			id: out,
			kind: 'podium',
			pos: { col: 5, row: 3 },
			props: { marketTitle: title, trigger: 'OnRoundEnd', topK: p.topK, withOrder: true }
		}
	];
	const edges: GraphEdge[] = [
		edge(evt, 'out', rk, 'event'),
		edge(ents, 'out', rk, 'scope'),
		edge(rk, 'out', out, 'result')
	];
	return { ok: true, name: title, graph: makeGraph(nodes, edges) };
}

function buildRaceVsTime(p: TemplateParams, labels: { trackable?: string }): BuildResult {
	// Group-race against time: sum(event, entities) ≥ N  AND  now < T.
	if (!p.trackable) return { ok: false, error: 'Event fehlt' };
	if (!p.threshold || p.threshold < 1) return { ok: false, error: 'Schwelle muss ≥ 1 sein' };
	if (!p.seconds || p.seconds < 1) return { ok: false, error: 'Sekunden müssen ≥ 1 sein' };
	const ents = nid('ents', 'all');
	const evt = nid('evt', 'main');
	const agg = nid('agg', 'main');
	const numTh = nid('num', 'th');
	const cmpN = nid('cmp', 'gte');
	const tNow = nid('time', 'now');
	const numT = nid('num', 'time');
	const tcmp = nid('tcmp', 'lt');
	const comb = nid('comb', 'and');
	const out = nid('out', 'res');
	const title = `${p.threshold} × ${labels.trackable ?? 'Event'} innerhalb ${p.seconds}s?`;
	const nodes: GraphNode[] = [
		{ id: ents, kind: 'entities', pos: { col: 0, row: 1 } },
		{ id: evt, kind: 'event', pos: { col: 1, row: 0 }, props: { trackableId: p.trackable } },
		{ id: agg, kind: 'aggregate', pos: { col: 3, row: 1 }, props: { agg: 'sum' } },
		{ id: numTh, kind: 'number', pos: { col: 1, row: 2 }, props: { value: p.threshold } },
		{ id: cmpN, kind: 'compare', pos: { col: 4, row: 2 }, props: { op: 'gte' } },
		{ id: tNow, kind: 'time', pos: { col: 1, row: 5 } },
		{ id: numT, kind: 'number', pos: { col: 1, row: 6 }, props: { value: p.seconds } },
		{ id: tcmp, kind: 'time_compare', pos: { col: 4, row: 5 }, props: { op: 'lt' } },
		{ id: comb, kind: 'combine', pos: { col: 5, row: 3 }, props: { combine: 'and' } },
		{
			id: out,
			kind: 'truth',
			pos: { col: 6, row: 3 },
			props: {
				marketTitle: title,
				trigger: 'OnFirstSatisfied',
				yesLabel: 'Ja',
				noLabel: 'Nein'
			}
		}
	];
	const edges: GraphEdge[] = [
		edge(evt, 'out', agg, 'event'),
		edge(ents, 'out', agg, 'scope'),
		edge(agg, 'out', cmpN, 'a'),
		edge(numTh, 'out', cmpN, 'b'),
		edge(tNow, 'out', tcmp, 'a'),
		edge(numT, 'out', tcmp, 'b'), // Number → Timestamp coercion
		edge(cmpN, 'out', comb, 'inputs'),
		edge(tcmp, 'out', comb, 'inputs'),
		edge(comb, 'out', out, 'result')
	];
	return { ok: true, name: title, graph: makeGraph(nodes, edges) };
}
