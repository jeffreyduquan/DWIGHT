/**
 * @file graph/catalog.ts -- Node specification catalogue for Graph 2.0.
 *
 * Phase 21 (Graph 2.0) — consolidated from the original ~20 kinds to 12 core
 * kinds (always visible) + 5 advanced kinds (hidden behind "Erweitert"-toggle).
 *
 * Families:
 *  - source:  produce values, no inputs (Spalte 0 by convention)
 *  - compute: aggregation / ranking
 *  - logic:   comparisons, boolean combinators, branching
 *  - outcome: terminal node (exactly one per graph)
 *
 * Hard-coded family colors live in `FAMILY_COLORS` and are consumed by the
 * SlotGraphEditor for tile fill + pin ring. Pin types get individual fill
 * colors in `PIN_COLORS`.
 */
import type { GraphNodeKind } from '$lib/server/db/schema';

/** Pin data types. Connections are valid when output type === input type. */
export type PinType =
	| 'Entity'
	| 'EntityList'
	| 'Trackable'
	| 'Number'
	| 'Boolean'
	| 'Timestamp';

export type PinDef = {
	name: string;
	type: PinType;
	/** Required pins must be connected for the graph to be valid. */
	required?: boolean;
	/** Allow multiple incoming edges (e.g. `combine.inputs`). */
	multi?: boolean;
};

export type PropDef = {
	name: string;
	kind: 'string' | 'number' | 'boolean' | 'enum' | 'modeRef';
	/** For modeRef: 'trackable' or 'entity'. */
	modeRefKind?: 'trackable' | 'entity';
	enumValues?: string[];
	label: string;
	defaultValue?: unknown;
};

export type NodeFamily = 'source' | 'compute' | 'logic' | 'outcome';

export type NodeSpec = {
	kind: GraphNodeKind;
	family: NodeFamily;
	label: string;
	description: string;
	inputs: PinDef[];
	outputs: PinDef[];
	props: PropDef[];
	/** Advanced specs are hidden behind the "Erweitert"-toggle. */
	advanced?: boolean;
	/** Lucide icon name for the catalog sidebar + tile. */
	icon?: string;
};

const CMP_OPS = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'] as const;
export type CmpOp = (typeof CMP_OPS)[number];

const TIME_OPS = ['lt', 'gt', 'eq'] as const;
export type TimeOp = (typeof TIME_OPS)[number];

const TRIGGERS = ['OnRoundEnd', 'OnFirstSatisfied'] as const;
export type Trigger = (typeof TRIGGERS)[number];

const AGG_OPS = ['sum', 'count'] as const;
export type AggOp = (typeof AGG_OPS)[number];

const COMBINE_OPS = ['and', 'or', 'not'] as const;
export type CombineOp = (typeof COMBINE_OPS)[number];

/** Human-readable symbols / words for enum prop values. */
export const ENUM_LABELS: Record<string, Record<string, string>> = {
	op: {
		eq: '=',
		neq: '≠',
		gt: '>',
		lt: '<',
		gte: '≥',
		lte: '≤'
	},
	trigger: {
		OnRoundEnd: 'Am Ende',
		OnFirstSatisfied: 'Sobald erfüllt'
	},
	direction: {
		up: '↑ hoch',
		down: '↓ runter',
		asc: '↑ aufsteigend',
		desc: '↓ absteigend'
	},
	mode: {
		signed: 'mit Vorzeichen',
		abs: 'absolut'
	},
	agg: {
		sum: 'Summe',
		count: 'Anzahl'
	},
	combine: {
		and: 'UND',
		or: 'ODER',
		not: 'NICHT'
	}
};

export function enumLabel(propName: string, value: string): string {
	return ENUM_LABELS[propName]?.[value] ?? value;
}

/** Full node catalogue. Indexed by `kind`. 12 core + 5 advanced. */
export const NODE_CATALOG: Record<GraphNodeKind, NodeSpec> = {
	// ---------- Tier 1 — Quellen (4) ----------
	entities: {
		kind: 'entities',
		family: 'source',
		icon: 'Users',
		label: 'Entitäten',
		description: 'Alle konfigurierten Entitäten dieses Modes.',
		inputs: [],
		outputs: [{ name: 'out', type: 'EntityList' }],
		props: []
	},
	event: {
		kind: 'event',
		family: 'source',
		icon: 'Sparkle',
		label: 'Event',
		description: 'Ein Counter (Trackable) aus dem Mode.',
		inputs: [],
		outputs: [{ name: 'out', type: 'Trackable' }],
		props: [
			{ name: 'trackableId', kind: 'modeRef', modeRefKind: 'trackable', label: 'Event' }
		]
	},
	number: {
		kind: 'number',
		family: 'source',
		icon: 'Hash',
		label: 'Zahl',
		description: 'Eine feste Zahl.',
		inputs: [],
		outputs: [{ name: 'out', type: 'Number' }],
		props: [{ name: 'value', kind: 'number', label: 'Wert', defaultValue: 0 }]
	},
	time: {
		kind: 'time',
		family: 'source',
		icon: 'Clock',
		label: 'Zeit',
		description: 'Sekunden seit Rundenstart.',
		inputs: [],
		outputs: [{ name: 'out', type: 'Timestamp' }],
		props: []
	},

	// ---------- Tier 2 — Rechnen (2) ----------
	aggregate: {
		kind: 'aggregate',
		family: 'compute',
		icon: 'Calculator',
		label: 'Aggregat',
		description: 'Summe oder Anzahl eines Events über einen Bereich.',
		inputs: [
			{ name: 'event', type: 'Trackable', required: true },
			{ name: 'scope', type: 'EntityList', required: true }
		],
		outputs: [{ name: 'out', type: 'Number' }],
		props: [
			{
				name: 'agg',
				kind: 'enum',
				enumValues: [...AGG_OPS],
				label: 'Operation',
				defaultValue: 'count'
			}
		]
	},
	rank: {
		kind: 'rank',
		family: 'compute',
		icon: 'ListOrdered',
		label: 'Ranking',
		description:
			'Sortiert Entitäten nach Event-Counter. Mit Schwelle = Wettrennen (wer erreicht zuerst N).',
		inputs: [
			{ name: 'event', type: 'Trackable', required: true },
			{ name: 'scope', type: 'EntityList', required: true }
		],
		outputs: [{ name: 'out', type: 'EntityList' }],
		props: [
			{
				name: 'direction',
				kind: 'enum',
				enumValues: ['desc', 'asc'],
				label: 'Richtung',
				defaultValue: 'desc'
			},
			{ name: 'topK', kind: 'number', label: 'Top-K (0 = alle)', defaultValue: 0 },
			{
				name: 'threshold',
				kind: 'number',
				label: 'Schwelle (0 = aktueller Stand)',
				defaultValue: 0
			}
		]
	},

	// ---------- Tier 3a — Logik (3) ----------
	compare: {
		kind: 'compare',
		family: 'logic',
		icon: 'Scale',
		label: 'Vergleich',
		description: 'a Operator b → wahr/falsch.',
		inputs: [
			{ name: 'a', type: 'Number', required: true },
			{ name: 'b', type: 'Number', required: true }
		],
		outputs: [{ name: 'out', type: 'Boolean' }],
		props: [
			{
				name: 'op',
				kind: 'enum',
				enumValues: [...CMP_OPS],
				label: 'Operator',
				defaultValue: 'gte'
			}
		]
	},
	condition: {
		kind: 'condition',
		family: 'logic',
		icon: 'GitBranch',
		label: 'Bedingung',
		description: 'Wenn cond, dann result. (¬cond ∨ result)',
		inputs: [
			{ name: 'cond', type: 'Boolean', required: true },
			{ name: 'result', type: 'Boolean', required: true }
		],
		outputs: [{ name: 'out', type: 'Boolean' }],
		props: []
	},
	combine: {
		kind: 'combine',
		family: 'logic',
		icon: 'Merge',
		label: 'Verknüpfung',
		description: 'UND / ODER / NICHT mehrerer Booleans.',
		inputs: [{ name: 'inputs', type: 'Boolean', multi: true, required: true }],
		outputs: [{ name: 'out', type: 'Boolean' }],
		props: [
			{
				name: 'combine',
				kind: 'enum',
				enumValues: [...COMBINE_OPS],
				label: 'Operation',
				defaultValue: 'and'
			}
		]
	},

	// ---------- Tier 3b — Ergebnis (3) ----------
	winner: {
		kind: 'winner',
		family: 'outcome',
		icon: 'Trophy',
		label: 'Gewinner',
		description: 'Eine Entität gewinnt diese Wette.',
		inputs: [{ name: 'result', type: 'Entity', required: true }],
		outputs: [],
		props: [
			{ name: 'marketTitle', kind: 'string', label: 'Titel', defaultValue: 'Neue Wette' },
			{
				name: 'trigger',
				kind: 'enum',
				enumValues: [...TRIGGERS],
				label: 'Auswerten wann?',
				defaultValue: 'OnRoundEnd'
			}
		]
	},
	truth: {
		kind: 'truth',
		family: 'outcome',
		icon: 'CheckCircle2',
		label: 'Ja/Nein',
		description: 'Trifft die Bedingung zu?',
		inputs: [{ name: 'result', type: 'Boolean', required: true }],
		outputs: [],
		props: [
			{ name: 'marketTitle', kind: 'string', label: 'Titel', defaultValue: 'Neue Wette' },
			{
				name: 'trigger',
				kind: 'enum',
				enumValues: [...TRIGGERS],
				label: 'Auswerten wann?',
				defaultValue: 'OnRoundEnd'
			},
			{ name: 'yesLabel', kind: 'string', label: 'Ja-Label', defaultValue: 'Ja' },
			{ name: 'noLabel', kind: 'string', label: 'Nein-Label', defaultValue: 'Nein' }
		]
	},
	podium: {
		kind: 'podium',
		family: 'outcome',
		icon: 'Medal',
		label: 'Podium',
		description: 'Top-K Ranking, mit oder ohne Reihenfolge.',
		inputs: [{ name: 'result', type: 'EntityList', required: true }],
		outputs: [],
		props: [
			{ name: 'marketTitle', kind: 'string', label: 'Titel', defaultValue: 'Podium' },
			{
				name: 'trigger',
				kind: 'enum',
				enumValues: [...TRIGGERS],
				label: 'Auswerten wann?',
				defaultValue: 'OnRoundEnd'
			},
			{ name: 'topK', kind: 'number', label: 'Top-K', defaultValue: 3 },
			{ name: 'withOrder', kind: 'boolean', label: 'Mit Reihenfolge', defaultValue: true }
		]
	},

	// ---------- Advanced (hidden by default) ----------
	first_occurrence: {
		kind: 'first_occurrence',
		family: 'compute',
		advanced: true,
		icon: 'Flag',
		label: 'Erstes Vorkommen',
		description: 'Zeitpunkt des ersten Events, optional pro Entität.',
		inputs: [
			{ name: 'event', type: 'Trackable', required: true },
			{ name: 'entity', type: 'Entity' }
		],
		outputs: [{ name: 'out', type: 'Timestamp' }],
		props: []
	},
	delta: {
		kind: 'delta',
		family: 'compute',
		advanced: true,
		icon: 'Minus',
		label: 'Differenz',
		description: 'Differenz zweier Zahlen.',
		inputs: [
			{ name: 'a', type: 'Number', required: true },
			{ name: 'b', type: 'Number', required: true }
		],
		outputs: [{ name: 'out', type: 'Number' }],
		props: [
			{
				name: 'mode',
				kind: 'enum',
				enumValues: ['signed', 'abs'],
				label: 'Modus',
				defaultValue: 'signed'
			}
		]
	},
	between: {
		kind: 'between',
		family: 'logic',
		advanced: true,
		icon: 'ArrowLeftRight',
		label: 'Zwischen',
		description: 'value ∈ [min..max].',
		inputs: [
			{ name: 'value', type: 'Number', required: true },
			{ name: 'min', type: 'Number', required: true },
			{ name: 'max', type: 'Number', required: true }
		],
		outputs: [{ name: 'out', type: 'Boolean' }],
		props: [{ name: 'inclusive', kind: 'boolean', label: 'Inklusiv', defaultValue: true }]
	},
	time_compare: {
		kind: 'time_compare',
		family: 'logic',
		advanced: true,
		icon: 'TimerReset',
		label: 'Zeitvergleich',
		description: 't1 OP t2 (Timestamps).',
		inputs: [
			{ name: 'a', type: 'Timestamp', required: true },
			{ name: 'b', type: 'Timestamp', required: true }
		],
		outputs: [{ name: 'out', type: 'Boolean' }],
		props: [
			{
				name: 'op',
				kind: 'enum',
				enumValues: [...TIME_OPS],
				label: 'Operator',
				defaultValue: 'lt'
			}
		]
	},
	sequence_match: {
		kind: 'sequence_match',
		family: 'logic',
		advanced: true,
		icon: 'ListChecks',
		label: 'Reihenfolge',
		description: 'Muster aus Events in Reihenfolge.',
		inputs: [{ name: 'steps', type: 'Trackable', multi: true, required: true }],
		outputs: [{ name: 'out', type: 'Boolean' }],
		props: [
			{
				name: 'allowOthersBetween',
				kind: 'boolean',
				label: 'Andere Events erlaubt',
				defaultValue: false
			}
		]
	}
};

export const FAMILY_LABELS: Record<NodeFamily, string> = {
	source: 'Quelle',
	compute: 'Berechne',
	logic: 'Vergleiche',
	outcome: 'Ergebnis'
};

/** Per-family tile fill (Quantum Plasma palette). */
export const FAMILY_COLORS: Record<NodeFamily, string> = {
	source: 'oklch(60% 0.055 148)', // sage
	compute: 'oklch(65% 0.08 295)', // lavendel
	logic: 'oklch(70% 0.12 70)', // bernstein
	outcome: 'oklch(58% 0.10 50)' // bronze
};

export const PIN_COLORS: Record<PinType, string> = {
	Entity: 'oklch(78% 0.10 220)', // blau
	EntityList: 'oklch(72% 0.10 220)', // blau-tiefer
	Trackable: 'oklch(82% 0.13 80)', // amber
	Number: 'oklch(75% 0.12 148)', // grün
	Boolean: 'oklch(75% 0.13 330)', // rosa
	Timestamp: 'oklch(70% 0.13 295)' // violett
};

/** Core kinds (always visible in the catalog). */
export const CORE_KINDS: GraphNodeKind[] = [
	'entities',
	'event',
	'number',
	'time',
	'aggregate',
	'rank',
	'compare',
	'condition',
	'combine',
	'winner',
	'truth',
	'podium'
];

/** Advanced kinds (revealed by the "Erweitert"-toggle). */
export const ADVANCED_KINDS: GraphNodeKind[] = [
	'first_occurrence',
	'delta',
	'between',
	'time_compare',
	'sequence_match'
];

export function specOf(kind: GraphNodeKind): NodeSpec {
	return NODE_CATALOG[kind];
}

export function isOutcomeKind(kind: GraphNodeKind): boolean {
	return NODE_CATALOG[kind].family === 'outcome';
}
