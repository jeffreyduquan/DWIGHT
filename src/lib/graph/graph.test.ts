/**
 * @file graph.test.ts -- Validator + compiler tests for the bet-graph engine.
 */
import { describe, expect, it } from 'vitest';
import type { BetGraph, Trackable } from '$lib/server/db/schema';
import { validateGraph } from './validate';
import { compileGraph, type CompileContext } from './compile';
import { previewSentence } from './preview';

const TRACKABLES: Trackable[] = [
	{ id: 'goal', label: 'Tor', scope: 'entity' },
	{ id: 'foul', label: 'Foul', scope: 'entity' }
];

const CTX: CompileContext = {
	entities: [
		{ id: 'e1', name: 'Mario' },
		{ id: 'e2', name: 'Luigi' },
		{ id: 'e3', name: 'Peach' }
	],
	trackables: TRACKABLES
};

function g(nodes: BetGraph['nodes'], edges: BetGraph['edges']): BetGraph {
	return { version: 1, nodes, edges };
}

describe('validateGraph', () => {
	it('passes a minimal valid graph (arg_max -> entity_outcome)', () => {
		const graph = g(
			[
				{ id: 't', kind: 'trackable', props: { trackableId: 'goal' } },
				{ id: 'a', kind: 'all_entities' },
				{ id: 'am', kind: 'arg_max' },
				{ id: 'o', kind: 'entity_outcome', props: { marketTitle: 'Top-Scorer' } }
			],
			[
				{ from: { nodeId: 't', pin: 'out' }, to: { nodeId: 'am', pin: 'trackable' } },
				{ from: { nodeId: 'a', pin: 'out' }, to: { nodeId: 'am', pin: 'scope' } },
				{ from: { nodeId: 'am', pin: 'out' }, to: { nodeId: 'o', pin: 'result' } }
			]
		);
		expect(validateGraph(graph)).toEqual({ ok: true, errors: [] });
	});

	it('catches missing required input pins', () => {
		const graph = g(
			[
				{ id: 'am', kind: 'arg_max' },
				{ id: 'o', kind: 'entity_outcome' }
			],
			[{ from: { nodeId: 'am', pin: 'out' }, to: { nodeId: 'o', pin: 'result' } }]
		);
		const res = validateGraph(graph);
		expect(res.ok).toBe(false);
		expect(res.errors.some((e) => e.code === 'MISSING_INPUT')).toBe(true);
	});

	it('catches type mismatch on connection', () => {
		const graph = g(
			[
				{ id: 'c', kind: 'constant', props: { value: 5 } },
				{ id: 'o', kind: 'entity_outcome' }
			],
			[{ from: { nodeId: 'c', pin: 'out' }, to: { nodeId: 'o', pin: 'result' } }]
		);
		const res = validateGraph(graph);
		expect(res.ok).toBe(false);
		expect(res.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true);
	});

	it('requires exactly one outcome', () => {
		const graph = g([{ id: 'c', kind: 'constant', props: { value: 5 } }], []);
		const res = validateGraph(graph);
		expect(res.errors.some((e) => e.code === 'NO_OUTCOME')).toBe(true);
	});

	it('rejects cycles', () => {
		const graph = g(
			[
				{ id: 'and1', kind: 'and' },
				{ id: 'not1', kind: 'not' },
				{ id: 'o', kind: 'boolean_outcome' }
			],
			[
				{ from: { nodeId: 'and1', pin: 'out' }, to: { nodeId: 'not1', pin: 'in' } },
				{ from: { nodeId: 'not1', pin: 'out' }, to: { nodeId: 'and1', pin: 'inputs' } },
				{ from: { nodeId: 'and1', pin: 'out' }, to: { nodeId: 'o', pin: 'result' } }
			]
		);
		expect(validateGraph(graph).errors.some((e) => e.code === 'CYCLE')).toBe(true);
	});
});

describe('compileGraph', () => {
	it('compiles arg_max + entity_outcome to compare_entities-style outcomes', () => {
		const graph = g(
			[
				{ id: 't', kind: 'trackable', props: { trackableId: 'goal' } },
				{ id: 'a', kind: 'all_entities' },
				{ id: 'am', kind: 'arg_max' },
				{ id: 'o', kind: 'entity_outcome', props: { marketTitle: 'Top-Scorer' } }
			],
			[
				{ from: { nodeId: 't', pin: 'out' }, to: { nodeId: 'am', pin: 'trackable' } },
				{ from: { nodeId: 'a', pin: 'out' }, to: { nodeId: 'am', pin: 'scope' } },
				{ from: { nodeId: 'am', pin: 'out' }, to: { nodeId: 'o', pin: 'result' } }
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.market.title).toBe('Top-Scorer');
		expect(res.market.outcomes).toHaveLength(3);
		expect(res.market.outcomes.map((o) => o.label).sort()).toEqual(['Luigi', 'Mario', 'Peach']);
		// each outcome is AND of (this entity > each other entity)
		for (const o of res.market.outcomes) {
			expect(o.predicate.kind).toBe('and');
		}
	});

	it('compiles race_to_threshold with N=1 to log_rank outcomes', () => {
		const graph = g(
			[
				{ id: 't', kind: 'trackable', props: { trackableId: 'goal' } },
				{ id: 'a', kind: 'all_entities' },
				{ id: 'n', kind: 'constant', props: { value: 1 } },
				{ id: 'r', kind: 'race_to_threshold' },
				{ id: 'o', kind: 'entity_outcome', props: { marketTitle: 'Erstes Tor' } }
			],
			[
				{ from: { nodeId: 't', pin: 'out' }, to: { nodeId: 'r', pin: 'trackable' } },
				{ from: { nodeId: 'a', pin: 'out' }, to: { nodeId: 'r', pin: 'scope' } },
				{ from: { nodeId: 'n', pin: 'out' }, to: { nodeId: 'r', pin: 'threshold' } },
				{ from: { nodeId: 'r', pin: 'winner' }, to: { nodeId: 'o', pin: 'result' } }
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.market.outcomes).toHaveLength(3);
		for (const o of res.market.outcomes) {
			expect(o.predicate.kind).toBe('log_rank');
		}
	});

	it('compiles sum + compare(>N) + boolean_outcome to compare_counters sum predicate', () => {
		const graph = g(
			[
				{ id: 't', kind: 'trackable', props: { trackableId: 'goal' } },
				{ id: 'a', kind: 'all_entities' },
				{ id: 's', kind: 'sum' },
				{ id: 'n', kind: 'constant', props: { value: 5 } },
				{ id: 'c', kind: 'compare', props: { op: 'gt' } },
				{ id: 'o', kind: 'boolean_outcome', props: { marketTitle: 'Über 5 Tore total' } }
			],
			[
				{ from: { nodeId: 't', pin: 'out' }, to: { nodeId: 's', pin: 'trackable' } },
				{ from: { nodeId: 'a', pin: 'out' }, to: { nodeId: 's', pin: 'scope' } },
				{ from: { nodeId: 's', pin: 'out' }, to: { nodeId: 'c', pin: 'a' } },
				{ from: { nodeId: 'n', pin: 'out' }, to: { nodeId: 'c', pin: 'b' } },
				{ from: { nodeId: 'c', pin: 'out' }, to: { nodeId: 'o', pin: 'result' } }
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.market.outcomes).toHaveLength(2);
		const yes = res.market.outcomes[0];
		expect(yes.predicate.kind).toBe('compare_counters');
	});

	it('compiles count + compare to compare_counters predicate', () => {
		const graph = g(
			[
				{ id: 't', kind: 'trackable', props: { trackableId: 'foul' } },
				{ id: 'cnt', kind: 'count' },
				{ id: 'n', kind: 'constant', props: { value: 1 } },
				{ id: 'cmp', kind: 'compare', props: { op: 'gte' } },
				{ id: 'o', kind: 'boolean_outcome', props: { marketTitle: 'Mind. 1 Foul' } }
			],
			[
				{ from: { nodeId: 't', pin: 'out' }, to: { nodeId: 'cnt', pin: 'trackable' } },
				{ from: { nodeId: 'cnt', pin: 'out' }, to: { nodeId: 'cmp', pin: 'a' } },
				{ from: { nodeId: 'n', pin: 'out' }, to: { nodeId: 'cmp', pin: 'b' } },
				{ from: { nodeId: 'cmp', pin: 'out' }, to: { nodeId: 'o', pin: 'result' } }
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.market.outcomes).toHaveLength(2);
		expect(res.market.outcomes[0].predicate.kind).toBe('compare_counters');
	});

	it('compiles delta(a,b) signed + compare to diff CounterExpr (Family E)', () => {
		const graph = g(
			[
				{ id: 'tg', kind: 'trackable', props: { trackableId: 'goal' } },
				{ id: 'eA', kind: 'entity', props: { entityName: 'Mario' } },
				{ id: 'eB', kind: 'entity', props: { entityName: 'Luigi' } },
				{ id: 'cA', kind: 'count' },
				{ id: 'cB', kind: 'count' },
				{ id: 'd', kind: 'delta', props: { mode: 'signed' } },
				{ id: 'k', kind: 'constant', props: { value: 2 } },
				{ id: 'cmp', kind: 'compare', props: { op: 'gte' } },
				{ id: 'o', kind: 'boolean_outcome', props: { marketTitle: 'Mario 2 Tore vorn?' } }
			],
			[
				{ from: { nodeId: 'tg', pin: 'out' }, to: { nodeId: 'cA', pin: 'trackable' } },
				{ from: { nodeId: 'eA', pin: 'out' }, to: { nodeId: 'cA', pin: 'entity' } },
				{ from: { nodeId: 'tg', pin: 'out' }, to: { nodeId: 'cB', pin: 'trackable' } },
				{ from: { nodeId: 'eB', pin: 'out' }, to: { nodeId: 'cB', pin: 'entity' } },
				{ from: { nodeId: 'cA', pin: 'out' }, to: { nodeId: 'd', pin: 'a' } },
				{ from: { nodeId: 'cB', pin: 'out' }, to: { nodeId: 'd', pin: 'b' } },
				{ from: { nodeId: 'd', pin: 'out' }, to: { nodeId: 'cmp', pin: 'a' } },
				{ from: { nodeId: 'k', pin: 'out' }, to: { nodeId: 'cmp', pin: 'b' } },
				{ from: { nodeId: 'cmp', pin: 'out' }, to: { nodeId: 'o', pin: 'result' } }
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const yes = res.market.outcomes[0].predicate;
		expect(yes.kind).toBe('compare_counters');
		if (yes.kind !== 'compare_counters') return;
		expect((yes.left as { kind: string }).kind).toBe('diff');
	});

	it('compiles if_then via or(not(cond), then) (Family G)', () => {
		const graph = g(
			[
				{ id: 'tg', kind: 'trackable', props: { trackableId: 'goal' } },
				{ id: 'tf', kind: 'trackable', props: { trackableId: 'foul' } },
				{ id: 'cg', kind: 'count' },
				{ id: 'cf', kind: 'count' },
				{ id: 'kg', kind: 'constant', props: { value: 3 } },
				{ id: 'kf', kind: 'constant', props: { value: 5 } },
				{ id: 'cmpG', kind: 'compare', props: { op: 'gte' } },
				{ id: 'cmpF', kind: 'compare', props: { op: 'gte' } },
				{ id: 'ifn', kind: 'if_then' },
				{ id: 'o', kind: 'boolean_outcome' }
			],
			[
				{ from: { nodeId: 'tg', pin: 'out' }, to: { nodeId: 'cg', pin: 'trackable' } },
				{ from: { nodeId: 'tf', pin: 'out' }, to: { nodeId: 'cf', pin: 'trackable' } },
				{ from: { nodeId: 'cg', pin: 'out' }, to: { nodeId: 'cmpG', pin: 'a' } },
				{ from: { nodeId: 'kg', pin: 'out' }, to: { nodeId: 'cmpG', pin: 'b' } },
				{ from: { nodeId: 'cf', pin: 'out' }, to: { nodeId: 'cmpF', pin: 'a' } },
				{ from: { nodeId: 'kf', pin: 'out' }, to: { nodeId: 'cmpF', pin: 'b' } },
				{ from: { nodeId: 'cmpG', pin: 'out' }, to: { nodeId: 'ifn', pin: 'cond' } },
				{ from: { nodeId: 'cmpF', pin: 'out' }, to: { nodeId: 'ifn', pin: 'then' } },
				{ from: { nodeId: 'ifn', pin: 'out' }, to: { nodeId: 'o', pin: 'result' } }
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const yes = res.market.outcomes[0].predicate;
		expect(yes.kind).toBe('or');
		if (yes.kind !== 'or') return;
		expect(yes.children[0].kind).toBe('not');
	});

	it('compiles between as and(>=min, <=max)', () => {
		const graph = g(
			[
				{ id: 'tg', kind: 'trackable', props: { trackableId: 'goal' } },
				{ id: 'cnt', kind: 'count' },
				{ id: 'lo', kind: 'constant', props: { value: 2 } },
				{ id: 'hi', kind: 'constant', props: { value: 5 } },
				{ id: 'btw', kind: 'between', props: { inclusive: true } },
				{ id: 'o', kind: 'boolean_outcome' }
			],
			[
				{ from: { nodeId: 'tg', pin: 'out' }, to: { nodeId: 'cnt', pin: 'trackable' } },
				{ from: { nodeId: 'cnt', pin: 'out' }, to: { nodeId: 'btw', pin: 'value' } },
				{ from: { nodeId: 'lo', pin: 'out' }, to: { nodeId: 'btw', pin: 'min' } },
				{ from: { nodeId: 'hi', pin: 'out' }, to: { nodeId: 'btw', pin: 'max' } },
				{ from: { nodeId: 'btw', pin: 'out' }, to: { nodeId: 'o', pin: 'result' } }
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const yes = res.market.outcomes[0].predicate;
		expect(yes.kind).toBe('and');
		if (yes.kind !== 'and') return;
		expect(yes.children).toHaveLength(2);
	});

	it('returns ok:false for unsupported shapes', () => {
		const graph = g(
			[
				{ id: 't', kind: 'trackable', props: { trackableId: 'goal' } },
				{ id: 'e', kind: 'entity', props: { entityName: 'Mario' } },
				{ id: 'fo', kind: 'first_occurrence' },
				{ id: 'o', kind: 'entity_outcome' }
			],
			[
				{ from: { nodeId: 't', pin: 'out' }, to: { nodeId: 'fo', pin: 'trackable' } },
				{ from: { nodeId: 'e', pin: 'out' }, to: { nodeId: 'fo', pin: 'entity' } }
				// fo.out is Timestamp, o.result is Entity -> mismatch anyway
			]
		);
		// validation will fail first, but compile should also bail
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(false);
	});
});

describe('previewSentence', () => {
	it('produces a German sentence for arg_max + entity_outcome', () => {
		const graph = g(
			[
				{ id: 't', kind: 'trackable', props: { trackableId: 'Tor' } },
				{ id: 'a', kind: 'all_entities' },
				{ id: 'am', kind: 'arg_max' },
				{ id: 'o', kind: 'entity_outcome', props: { marketTitle: 'Top-Scorer' } }
			],
			[
				{ from: { nodeId: 't', pin: 'out' }, to: { nodeId: 'am', pin: 'trackable' } },
				{ from: { nodeId: 'a', pin: 'out' }, to: { nodeId: 'am', pin: 'scope' } },
				{ from: { nodeId: 'am', pin: 'out' }, to: { nodeId: 'o', pin: 'result' } }
			]
		);
		const s = previewSentence(graph);
		expect(s).toContain('Top-Scorer');
		expect(s).toContain('meisten');
	});
});
