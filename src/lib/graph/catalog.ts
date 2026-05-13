/**
 * @file graph/catalog.ts -- Node specification catalogue for the bet-graph editor.
 *
 * Defines, for each `GraphNodeKind`, the list of input pins, output pins, and
 * configurable properties. Drives validation, auto-layout, and the editor UI.
 *
 * Phase 6 (foundation).
 */
import type { GraphNodeKind } from '$lib/server/db/schema';

/** Pin data types. Connections only legal when output type === input type. */
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
	/** Allow multiple incoming edges (e.g. `and.inputs`). */
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
	/** Macro nodes get a small "M" badge in the editor. */
	macro?: boolean;
};

const CMP_OPS = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'] as const;
export type CmpOp = (typeof CMP_OPS)[number];

const TIME_OPS = ['lt', 'gt', 'eq'] as const;
export type TimeOp = (typeof TIME_OPS)[number];

const TRIGGERS = ['OnRoundEnd', 'OnFirstSatisfied'] as const;
export type Trigger = (typeof TRIGGERS)[number];

/** Full node catalogue. Indexed by `kind`. */
export const NODE_CATALOG: Record<GraphNodeKind, NodeSpec> = {
	// ---------- Sources ----------
	entity: {
		kind: 'entity',
		family: 'source',
		label: 'Entity-Auswahl',
		description: 'Eine konkrete Entity aus dem Mode.',
		inputs: [],
		outputs: [{ name: 'out', type: 'Entity' }],
		props: [{ name: 'entityName', kind: 'modeRef', modeRefKind: 'entity', label: 'Entity' }]
	},
	all_entities: {
		kind: 'all_entities',
		family: 'source',
		label: 'Alle Entities',
		description: 'Liste aller Entities in der Runde.',
		inputs: [],
		outputs: [{ name: 'out', type: 'EntityList' }],
		props: []
	},
	trackable: {
		kind: 'trackable',
		family: 'source',
		label: 'Trackable',
		description: 'Ein Counter / Event-Typ aus dem Mode.',
		inputs: [],
		outputs: [{ name: 'out', type: 'Trackable' }],
		props: [
			{ name: 'trackableId', kind: 'modeRef', modeRefKind: 'trackable', label: 'Trackable' }
		]
	},
	constant: {
		kind: 'constant',
		family: 'source',
		label: 'Konstante Zahl',
		description: 'Eine feste Zahl.',
		inputs: [],
		outputs: [{ name: 'out', type: 'Number' }],
		props: [{ name: 'value', kind: 'number', label: 'Wert', defaultValue: 0 }]
	},
	// ---------- Compute ----------
	count: {
		kind: 'count',
		family: 'compute',
		label: 'Zähle Trackable',
		description: 'Anzahl Vorkommen, optional gefiltert auf eine Entity.',
		inputs: [
			{ name: 'trackable', type: 'Trackable', required: true },
			{ name: 'entity', type: 'Entity' }
		],
		outputs: [{ name: 'out', type: 'Number' }],
		props: []
	},
	sum: {
		kind: 'sum',
		family: 'compute',
		label: 'Summe über Entities',
		description: 'Summe eines Trackables über alle übergebenen Entities.',
		inputs: [
			{ name: 'trackable', type: 'Trackable', required: true },
			{ name: 'scope', type: 'EntityList', required: true }
		],
		outputs: [{ name: 'out', type: 'Number' }],
		props: []
	},
	arg_max: {
		kind: 'arg_max',
		family: 'compute',
		label: 'Entity mit Maximum',
		description: 'Liefert die Entity mit dem höchsten Counter.',
		inputs: [
			{ name: 'trackable', type: 'Trackable', required: true },
			{ name: 'scope', type: 'EntityList', required: true }
		],
		outputs: [{ name: 'out', type: 'Entity' }],
		props: []
	},
	arg_min: {
		kind: 'arg_min',
		family: 'compute',
		label: 'Entity mit Minimum',
		description: 'Liefert die Entity mit dem niedrigsten Counter.',
		inputs: [
			{ name: 'trackable', type: 'Trackable', required: true },
			{ name: 'scope', type: 'EntityList', required: true }
		],
		outputs: [{ name: 'out', type: 'Entity' }],
		props: []
	},
	rank: {
		kind: 'rank',
		family: 'compute',
		label: 'Ranking',
		description: 'Sortiert Entities nach Counter; optional Top-K.',
		inputs: [
			{ name: 'trackable', type: 'Trackable', required: true },
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
			{ name: 'topK', kind: 'number', label: 'Top-K (0 = alle)', defaultValue: 0 }
		]
	},
	first_occurrence: {
		kind: 'first_occurrence',
		family: 'compute',
		label: 'Erstes Vorkommen',
		description: 'Zeitpunkt des ersten Events, optional pro Entity.',
		inputs: [
			{ name: 'trackable', type: 'Trackable', required: true },
			{ name: 'entity', type: 'Entity' }
		],
		outputs: [{ name: 'out', type: 'Timestamp' }],
		props: []
	},
	delta: {
		kind: 'delta',
		family: 'compute',
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
	race_to_threshold: {
		kind: 'race_to_threshold',
		family: 'compute',
		macro: true,
		label: 'Wettrennen zur Schwelle',
		description: 'Welche Entity erreicht zuerst N? Macro über Count + ArgMin(Timestamp).',
		inputs: [
			{ name: 'trackable', type: 'Trackable', required: true },
			{ name: 'scope', type: 'EntityList', required: true },
			{ name: 'threshold', type: 'Number', required: true }
		],
		outputs: [
			{ name: 'winner', type: 'Entity' },
			{ name: 'whenSatisfied', type: 'Timestamp' }
		],
		props: [
			{
				name: 'direction',
				kind: 'enum',
				enumValues: ['up', 'down'],
				label: 'Richtung',
				defaultValue: 'up'
			}
		]
	},
	// ---------- Logic ----------
	compare: {
		kind: 'compare',
		family: 'logic',
		label: 'Zahlenvergleich',
		description: 'a OP b -> Boolean.',
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
	between: {
		kind: 'between',
		family: 'logic',
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
	entity_equals: {
		kind: 'entity_equals',
		family: 'logic',
		label: 'Entity-Vergleich',
		description: 'a == b (Entity).',
		inputs: [
			{ name: 'a', type: 'Entity', required: true },
			{ name: 'b', type: 'Entity', required: true }
		],
		outputs: [{ name: 'out', type: 'Boolean' }],
		props: []
	},
	time_compare: {
		kind: 'time_compare',
		family: 'logic',
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
	and: {
		kind: 'and',
		family: 'logic',
		label: 'UND',
		description: 'Alle Eingänge wahr.',
		inputs: [{ name: 'inputs', type: 'Boolean', multi: true, required: true }],
		outputs: [{ name: 'out', type: 'Boolean' }],
		props: []
	},
	or: {
		kind: 'or',
		family: 'logic',
		label: 'ODER',
		description: 'Mind. ein Eingang wahr.',
		inputs: [{ name: 'inputs', type: 'Boolean', multi: true, required: true }],
		outputs: [{ name: 'out', type: 'Boolean' }],
		props: []
	},
	not: {
		kind: 'not',
		family: 'logic',
		label: 'NICHT',
		description: 'Negation.',
		inputs: [{ name: 'in', type: 'Boolean', required: true }],
		outputs: [{ name: 'out', type: 'Boolean' }],
		props: []
	},
	if_then: {
		kind: 'if_then',
		family: 'logic',
		label: 'Wenn-Dann',
		description: 'cond -> then (entspricht ¬cond ∨ then).',
		inputs: [
			{ name: 'cond', type: 'Boolean', required: true },
			{ name: 'then', type: 'Boolean', required: true }
		],
		outputs: [{ name: 'out', type: 'Boolean' }],
		props: []
	},
	sequence_match: {
		kind: 'sequence_match',
		family: 'logic',
		macro: true,
		label: 'Reihenfolgenmuster',
		description: 'Muster aus Trackable-Events in Reihenfolge.',
		inputs: [{ name: 'steps', type: 'Trackable', multi: true, required: true }],
		outputs: [{ name: 'out', type: 'Boolean' }],
		props: [
			{ name: 'allowOthersBetween', kind: 'boolean', label: 'Andere Events erlaubt', defaultValue: false }
		]
	},
	// ---------- Outcomes ----------
	entity_outcome: {
		kind: 'entity_outcome',
		family: 'outcome',
		label: 'Entity-Wette',
		description: 'Wer gewinnt? (eine Entity).',
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
	boolean_outcome: {
		kind: 'boolean_outcome',
		family: 'outcome',
		label: 'Ja/Nein-Wette',
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
	ranking_outcome: {
		kind: 'ranking_outcome',
		family: 'outcome',
		label: 'Ranking-Wette',
		description: 'Top-K in Reihenfolge.',
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
	}
};

export const FAMILY_LABELS: Record<NodeFamily, string> = {
	source: 'Quelle',
	compute: 'Berechne',
	logic: 'Vergleiche',
	outcome: 'Ergebnis'
};

export const PIN_COLORS: Record<PinType, string> = {
	Entity: 'oklch(85% 0.04 220)',
	EntityList: 'oklch(78% 0.05 220)',
	Trackable: 'oklch(88% 0.08 80)',
	Number: 'oklch(78% 0.07 148)',
	Boolean: 'oklch(78% 0.08 250)',
	Timestamp: 'oklch(78% 0.08 320)'
};
