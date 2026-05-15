/**
 * @file graph/templates.ts -- High-level bet-graph templates ("Wett-Vorlagen").
 *
 * Phase 18b: instead of building bet-graphs node-by-node, users pick one of a
 * handful of templates and fill a small form. Each template produces a valid
 * `BetGraph` JSON that the existing compiler already understands, so no
 * compiler / runtime changes are required.
 */
import type { BetGraph, GraphNode, GraphEdge } from '$lib/server/db/schema';

export type TemplateId =
	| 'race'
	| 'champion'
	| 'loser'
	| 'will_player'
	| 'will_happen'
	| 'podium'
	| 'race_vs_time';

export type TemplateField =
	| { name: string; kind: 'trackable'; label: string; required: true }
	| { name: string; kind: 'entity'; label: string; required: true }
	| { name: string; kind: 'number'; label: string; min?: number; max?: number; defaultValue: number; required: true }
	| { name: string; kind: 'enum'; label: string; options: { value: string; label: string }[]; defaultValue: string; required: true };

export type TemplateSpec = {
	id: TemplateId;
	/** Lucide icon name. */
	icon:
		| 'Flag'
		| 'Trophy'
		| 'Skull'
		| 'Target'
		| 'Zap'
		| 'Medal'
		| 'Timer';
	title: string;
	tagline: string;
	fields: TemplateField[];
	/** Pretty German sentence describing the resulting bet for the UI. */
	sentence: (params: Record<string, string>) => string;
};

/** Stable, human-readable node-id helper. */
function nid(prefix: string, suffix: string): string {
	return `${prefix}_${suffix}`;
}

function edge(fromId: string, fromPin: string, toId: string, toPin: string): GraphEdge {
	return { from: { nodeId: fromId, pin: fromPin }, to: { nodeId: toId, pin: toPin } };
}

/** All available templates. */
export const TEMPLATES: TemplateSpec[] = [
	{
		id: 'race',
		icon: 'Flag',
		title: 'Wettrennen',
		tagline: 'Wer schafft zuerst N × Event?',
		fields: [
			{ name: 'trackable', kind: 'trackable', label: 'Event', required: true },
			{ name: 'threshold', kind: 'number', label: 'Schwelle (N)', defaultValue: 3, min: 1, required: true },
			{
				name: 'direction',
				kind: 'enum',
				label: 'Richtung',
				options: [
					{ value: 'up', label: 'Aufwärts (zuerst N erreichen)' },
					{ value: 'down', label: 'Abwärts (zuerst auf N fallen)' }
				],
				defaultValue: 'up',
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
			{ name: 'threshold', kind: 'number', label: 'Schwelle (N)', defaultValue: 3, min: 1, required: true }
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
			{ name: 'threshold', kind: 'number', label: 'Schwelle (N)', defaultValue: 5, min: 1, required: true }
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
			{ name: 'threshold', kind: 'number', label: 'Schwelle (N)', defaultValue: 3, min: 1, required: true },
			{ name: 'seconds', kind: 'number', label: 'Sekunden (T)', defaultValue: 60, min: 5, required: true }
		],
		sentence: (p) => `Schafft jemand ${p.threshold} × ${p.trackableLabel} vor ${p.seconds}s?`
	}
];

export function findTemplate(id: string): TemplateSpec | null {
	return TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Templates that need a per-entity counter (compare entities against each other).
 * Templates not in this set sum/aggregate over all entities and work with both
 * global and entity-scoped trackables.
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
	direction?: 'up' | 'down';
};

export type BuildResult =
	| { ok: true; graph: BetGraph; name: string }
	| { ok: false; error: string };

/** Build a full BetGraph from a template + params. */
export function buildGraph(templateId: TemplateId, params: TemplateParams, labels: { trackable?: string; entity?: string }): BuildResult {
	switch (templateId) {
		case 'race':
			return buildRace(params, labels);
		case 'champion':
			return buildChampion(params, labels, 'arg_max');
		case 'loser':
			return buildChampion(params, labels, 'arg_min');
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

function buildRace(p: TemplateParams, labels: { trackable?: string }): BuildResult {
	if (!p.trackable) return { ok: false, error: 'Event fehlt' };
	if (!p.threshold || p.threshold < 1) return { ok: false, error: 'Schwelle muss ≥ 1 sein' };
	const direction = p.direction === 'down' ? 'down' : 'up';
	const t = nid('trk', 'main');
	const scope = nid('ents', 'all');
	const k = nid('k', 'th');
	const race = nid('race', 'main');
	const out = nid('out', 'res');
	const nodes: GraphNode[] = [
		{ id: t, kind: 'trackable', props: { trackableId: p.trackable } },
		{ id: scope, kind: 'all_entities' },
		{ id: k, kind: 'constant', props: { value: p.threshold } },
		{ id: race, kind: 'race_to_threshold', props: { direction } },
		{
			id: out,
			kind: 'entity_outcome',
			props: { marketTitle: `Wettrennen: zuerst ${p.threshold} × ${labels.trackable ?? 'Event'}`, trigger: 'OnFirstSatisfied' }
		}
	];
	const edges: GraphEdge[] = [
		edge(t, 'out', race, 'trackable'),
		edge(scope, 'out', race, 'scope'),
		edge(k, 'out', race, 'threshold'),
		edge(race, 'winner', out, 'result')
	];
	return {
		ok: true,
		name: `Wettrennen: zuerst ${p.threshold} × ${labels.trackable ?? 'Event'}`,
		graph: { version: 1, nodes, edges }
	};
}

function buildChampion(
	p: TemplateParams,
	labels: { trackable?: string },
	kind: 'arg_max' | 'arg_min'
): BuildResult {
	if (!p.trackable) return { ok: false, error: 'Event fehlt' };
	const t = nid('trk', 'main');
	const scope = nid('ents', 'all');
	const arg = nid('arg', kind);
	const out = nid('out', 'res');
	const isMin = kind === 'arg_min';
	const title = isMin
		? `Letzter: wenigste ${labels.trackable ?? 'Event'}`
		: `Champion: meiste ${labels.trackable ?? 'Event'}`;
	const nodes: GraphNode[] = [
		{ id: t, kind: 'trackable', props: { trackableId: p.trackable } },
		{ id: scope, kind: 'all_entities' },
		{ id: arg, kind },
		{ id: out, kind: 'entity_outcome', props: { marketTitle: title, trigger: 'OnRoundEnd' } }
	];
	const edges: GraphEdge[] = [
		edge(t, 'out', arg, 'trackable'),
		edge(scope, 'out', arg, 'scope'),
		edge(arg, 'out', out, 'result')
	];
	return { ok: true, name: title, graph: { version: 1, nodes, edges } };
}

function buildWillPlayer(
	p: TemplateParams,
	labels: { trackable?: string; entity?: string }
): BuildResult {
	if (!p.trackable) return { ok: false, error: 'Event fehlt' };
	if (!p.entity) return { ok: false, error: 'Entität fehlt' };
	if (!p.threshold || p.threshold < 1) return { ok: false, error: 'Schwelle muss ≥ 1 sein' };
	const t = nid('trk', 'main');
	const e = nid('ent', 'main');
	const cnt = nid('cnt', 'main');
	const k = nid('k', 'th');
	const cmp = nid('cmp', 'gte');
	const out = nid('out', 'res');
	const title = `Schafft ${labels.entity ?? 'Entität'} ${p.threshold} × ${labels.trackable ?? 'Event'}?`;
	const nodes: GraphNode[] = [
		{ id: t, kind: 'trackable', props: { trackableId: p.trackable } },
		{ id: e, kind: 'entity', props: { entityName: p.entity } },
		{ id: cnt, kind: 'count' },
		{ id: k, kind: 'constant', props: { value: p.threshold } },
		{ id: cmp, kind: 'compare', props: { op: 'gte' } },
		{ id: out, kind: 'boolean_outcome', props: { marketTitle: title, trigger: 'OnFirstSatisfied', yesLabel: 'Ja', noLabel: 'Nein' } }
	];
	const edges: GraphEdge[] = [
		edge(t, 'out', cnt, 'trackable'),
		edge(e, 'out', cnt, 'entity'),
		edge(cnt, 'out', cmp, 'a'),
		edge(k, 'out', cmp, 'b'),
		edge(cmp, 'out', out, 'result')
	];
	return { ok: true, name: title, graph: { version: 1, nodes, edges } };
}

function buildWillHappen(p: TemplateParams, labels: { trackable?: string }): BuildResult {
	if (!p.trackable) return { ok: false, error: 'Event fehlt' };
	if (!p.threshold || p.threshold < 1) return { ok: false, error: 'Schwelle muss ≥ 1 sein' };
	const t = nid('trk', 'main');
	const scope = nid('ents', 'all');
	const sum = nid('sum', 'main');
	const k = nid('k', 'th');
	const cmp = nid('cmp', 'gte');
	const out = nid('out', 'res');
	const title = `Passiert ${labels.trackable ?? 'Event'} mind. ${p.threshold}-mal?`;
	const nodes: GraphNode[] = [
		{ id: t, kind: 'trackable', props: { trackableId: p.trackable } },
		{ id: scope, kind: 'all_entities' },
		{ id: sum, kind: 'sum' },
		{ id: k, kind: 'constant', props: { value: p.threshold } },
		{ id: cmp, kind: 'compare', props: { op: 'gte' } },
		{ id: out, kind: 'boolean_outcome', props: { marketTitle: title, trigger: 'OnFirstSatisfied', yesLabel: 'Ja', noLabel: 'Nein' } }
	];
	const edges: GraphEdge[] = [
		edge(t, 'out', sum, 'trackable'),
		edge(scope, 'out', sum, 'scope'),
		edge(sum, 'out', cmp, 'a'),
		edge(k, 'out', cmp, 'b'),
		edge(cmp, 'out', out, 'result')
	];
	return { ok: true, name: title, graph: { version: 1, nodes, edges } };
}

function buildPodium(p: TemplateParams, labels: { trackable?: string }): BuildResult {
	if (!p.trackable) return { ok: false, error: 'Event fehlt' };
	if (!p.topK || p.topK < 1) return { ok: false, error: 'Top-K muss ≥ 1 sein' };
	const t = nid('trk', 'main');
	const scope = nid('ents', 'all');
	const rk = nid('rank', 'main');
	const out = nid('out', 'res');
	const title = `Top ${p.topK} bei ${labels.trackable ?? 'Event'}`;
	const nodes: GraphNode[] = [
		{ id: t, kind: 'trackable', props: { trackableId: p.trackable } },
		{ id: scope, kind: 'all_entities' },
		{ id: rk, kind: 'rank', props: { direction: 'desc', topK: p.topK } },
		{ id: out, kind: 'ranking_outcome', props: { marketTitle: title, trigger: 'OnRoundEnd' } }
	];
	const edges: GraphEdge[] = [
		edge(t, 'out', rk, 'trackable'),
		edge(scope, 'out', rk, 'scope'),
		edge(rk, 'out', out, 'result')
	];
	return { ok: true, name: title, graph: { version: 1, nodes, edges } };
}

function buildRaceVsTime(p: TemplateParams, labels: { trackable?: string }): BuildResult {
	// "Schafft die Gruppe N × Event innerhalb T Sekunden?"
	// Modelled as: sum(trackable, all_entities) >= N  AND  now < T.
	// With `OnFirstSatisfied` trigger this fires the moment the threshold is
	// crossed before the time cap. If never crossed before T, the outcome
	// resolves to "Nein" at round end.
	if (!p.trackable) return { ok: false, error: 'Event fehlt' };
	if (!p.threshold || p.threshold < 1) return { ok: false, error: 'Schwelle muss ≥ 1 sein' };
	if (!p.seconds || p.seconds < 1) return { ok: false, error: 'Sekunden müssen ≥ 1 sein' };
	const t = nid('trk', 'main');
	const scope = nid('ents', 'all');
	const sum = nid('sum', 'main');
	const k = nid('k', 'th');
	const cmp = nid('cmp', 'gte');
	const nowNode = nid('now', 'main');
	const tcap = nid('k', 'time');
	const tcmp = nid('tcmp', 'lt');
	const andN = nid('and', 'main');
	const out = nid('out', 'res');
	const title = `${p.threshold} × ${labels.trackable ?? 'Event'} innerhalb ${p.seconds}s?`;
	const nodes: GraphNode[] = [
		{ id: t, kind: 'trackable', props: { trackableId: p.trackable } },
		{ id: scope, kind: 'all_entities' },
		{ id: sum, kind: 'sum' },
		{ id: k, kind: 'constant', props: { value: p.threshold } },
		{ id: cmp, kind: 'compare', props: { op: 'gte' } },
		{ id: nowNode, kind: 'now' },
		{ id: tcap, kind: 'constant', props: { value: p.seconds } },
		{ id: tcmp, kind: 'time_compare', props: { op: 'lt' } },
		{ id: andN, kind: 'and' },
		{ id: out, kind: 'boolean_outcome', props: { marketTitle: title, trigger: 'OnFirstSatisfied', yesLabel: 'Ja', noLabel: 'Nein' } }
	];
	const edges: GraphEdge[] = [
		edge(t, 'out', sum, 'trackable'),
		edge(scope, 'out', sum, 'scope'),
		edge(sum, 'out', cmp, 'a'),
		edge(k, 'out', cmp, 'b'),
		edge(nowNode, 'out', tcmp, 'a'),
		edge(tcap, 'out', tcmp, 'b'),
		edge(cmp, 'out', andN, 'inputs'),
		edge(tcmp, 'out', andN, 'inputs'),
		edge(andN, 'out', out, 'result')
	];
	return { ok: true, name: title, graph: { version: 1, nodes, edges } };
}
