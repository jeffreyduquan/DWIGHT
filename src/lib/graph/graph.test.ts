/**
 * @file graph.test.ts -- Validator + compiler tests for the Graph 2.0 engine.
 *
 * Graph 2.0 kinds: entities/entity/event/number/time, aggregate/rank,
 * compare/condition/combine, winner/truth/podium, first_occurrence/delta/
 * between/time_compare/sequence_match.
 *
 * Predicate AST kinds (count/and/or/not/compare_counters/log_rank/
 * timestamp_compare/events_in_order/ref/sum/diff/const/const_seconds/
 * first_occurrence/round_now) are runtime-engine-stable and unchanged.
 */
import { describe, expect, it } from 'vitest';
import type { BetGraph, GraphNode, GraphEdge, Trackable } from '$lib/server/db/schema';
import { GRAPH_GRID_COLS, GRAPH_GRID_ROWS } from '$lib/graph/grid';
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

let _nextCol = 0;
function pos(col?: number, row = 0) {
	return { col: col ?? _nextCol++, row };
}

function node(id: string, kind: GraphNode['kind'], props?: Record<string, unknown>, p?: { col: number; row: number }): GraphNode {
	return { id, kind, pos: p ?? pos(), props };
}

function g(nodes: GraphNode[], edges: GraphEdge[]): BetGraph {
	_nextCol = 0;
	return { version: 2, grid: { cols: GRAPH_GRID_COLS, rows: GRAPH_GRID_ROWS }, nodes, edges };
}

function edge(fromId: string, fromPin: string, toId: string, toPin: string): GraphEdge {
	return { from: { nodeId: fromId, pin: fromPin }, to: { nodeId: toId, pin: toPin } };
}

// ============================================================
// validateGraph
// ============================================================
describe('validateGraph', () => {
	it('passes a minimal rank → winner graph', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('all', 'entities'),
				node('rk', 'rank', { direction: 'desc' }),
				node('w', 'winner', { marketTitle: 'Top-Scorer' })
			],
			[
				edge('ev', 'out', 'rk', 'event'),
				edge('all', 'out', 'rk', 'scope'),
				edge('rk', 'out', 'w', 'result')
			]
		);
		expect(validateGraph(graph)).toEqual({ ok: true, errors: [] });
	});

	it('catches missing required input pins', () => {
		const graph = g(
			[node('rk', 'rank'), node('w', 'winner')],
			[edge('rk', 'out', 'w', 'result')]
		);
		const res = validateGraph(graph);
		expect(res.ok).toBe(false);
		expect(res.errors.some((e) => e.code === 'MISSING_INPUT')).toBe(true);
	});

	it('catches type mismatch on connection', () => {
		const graph = g(
			[node('n', 'number', { value: 5 }), node('w', 'winner')],
			[edge('n', 'out', 'w', 'result')]
		);
		const res = validateGraph(graph);
		expect(res.ok).toBe(false);
		expect(res.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true);
	});

	it('requires exactly one outcome', () => {
		const graph = g([node('n', 'number', { value: 5 })], []);
		const res = validateGraph(graph);
		expect(res.errors.some((e) => e.code === 'NO_OUTCOME')).toBe(true);
	});

	it('rejects cycles', () => {
		const graph = g(
			[
				node('c1', 'combine', { combine: 'and' }),
				node('c2', 'combine', { combine: 'not' }),
				node('t', 'truth')
			],
			[
				edge('c1', 'out', 'c2', 'inputs'),
				edge('c2', 'out', 'c1', 'inputs'),
				edge('c1', 'out', 't', 'result')
			]
		);
		expect(validateGraph(graph).errors.some((e) => e.code === 'CYCLE')).toBe(true);
	});

	it('accepts EntityList → Entity coercion (rank.out → winner.result)', () => {
		// rank emits EntityList; winner.result expects Entity. Coercion is allowed.
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('all', 'entities'),
				node('rk', 'rank'),
				node('w', 'winner')
			],
			[
				edge('ev', 'out', 'rk', 'event'),
				edge('all', 'out', 'rk', 'scope'),
				edge('rk', 'out', 'w', 'result')
			]
		);
		expect(validateGraph(graph).ok).toBe(true);
	});

	it('accepts Entity → EntityList coercion (entity → aggregate.scope)', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('e', 'entity', { entityName: 'Mario' }),
				node('agg', 'aggregate', { agg: 'count' }),
				node('n', 'number', { value: 1 }),
				node('cmp', 'compare', { op: 'gte' }),
				node('t', 'truth')
			],
			[
				edge('ev', 'out', 'agg', 'event'),
				edge('e', 'out', 'agg', 'scope'),
				edge('agg', 'out', 'cmp', 'a'),
				edge('n', 'out', 'cmp', 'b'),
				edge('cmp', 'out', 't', 'result')
			]
		);
		expect(validateGraph(graph).ok).toBe(true);
	});
});

// ============================================================
// compileGraph — Winner / Rank
// ============================================================
describe('compileGraph: winner', () => {
	it('rank(desc) → winner = per-entity compare_counters(self > other)', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('all', 'entities'),
				node('rk', 'rank', { direction: 'desc' }),
				node('w', 'winner', { marketTitle: 'Top-Scorer' })
			],
			[
				edge('ev', 'out', 'rk', 'event'),
				edge('all', 'out', 'rk', 'scope'),
				edge('rk', 'out', 'w', 'result')
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.market.title).toBe('Top-Scorer');
		expect(res.market.outcomes).toHaveLength(3);
		expect(res.market.outcomes.map((o) => o.label).sort()).toEqual(['Luigi', 'Mario', 'Peach']);
		expect(res.market.outcomes[0].predicate.kind).toBe('and');
	});

	it('rank with threshold>0 (race) → per-entity count(gte,N) outcomes', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('all', 'entities'),
				node('rk', 'rank', { direction: 'desc', threshold: 3 }),
				node('w', 'winner', { marketTitle: 'Drei Tore' })
			],
			[
				edge('ev', 'out', 'rk', 'event'),
				edge('all', 'out', 'rk', 'scope'),
				edge('rk', 'out', 'w', 'result')
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.market.outcomes).toHaveLength(3);
		for (const o of res.market.outcomes) {
			expect(o.predicate.kind).toBe('count');
			if (o.predicate.kind === 'count') {
				expect(o.predicate.cmp).toBe('gte');
				expect(o.predicate.n).toBe(3);
				expect(o.predicate.trackableId).toBe('goal');
			}
		}
	});

	it('rank(asc) → winner = per-entity compare_counters(self < other)', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('all', 'entities'),
				node('rk', 'rank', { direction: 'asc' }),
				node('w', 'winner', { marketTitle: 'Loser' })
			],
			[
				edge('ev', 'out', 'rk', 'event'),
				edge('all', 'out', 'rk', 'scope'),
				edge('rk', 'out', 'w', 'result')
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const yes = res.market.outcomes[0].predicate;
		expect(yes.kind).toBe('and');
		if (yes.kind !== 'and') return;
		expect(yes.children[0].kind).toBe('compare_counters');
		if (yes.children[0].kind !== 'compare_counters') return;
		expect(yes.children[0].cmp).toBe('lt');
	});
});

// ============================================================
// compileGraph — Podium
// ============================================================
describe('compileGraph: podium', () => {
	it('podium withOrder=true → N*K log_rank outcomes', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('all', 'entities'),
				node('rk', 'rank'),
				node('p', 'podium', { marketTitle: 'Podium', topK: 2, withOrder: true })
			],
			[
				edge('ev', 'out', 'rk', 'event'),
				edge('all', 'out', 'rk', 'scope'),
				edge('rk', 'out', 'p', 'result')
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.market.title).toBe('Podium');
		// 3 entities × topK=2 = 6 outcomes
		expect(res.market.outcomes).toHaveLength(6);
		expect(res.market.outcomes[0].predicate.kind).toBe('log_rank');
		const labels = res.market.outcomes.map((o) => o.label);
		expect(labels).toContain('Mario auf Platz 1');
		expect(labels).toContain('Peach auf Platz 2');
	});

	it('podium withOrder=false → per-entity OR(log_rank...)', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('all', 'entities'),
				node('rk', 'rank'),
				node('p', 'podium', { topK: 2, withOrder: false })
			],
			[
				edge('ev', 'out', 'rk', 'event'),
				edge('all', 'out', 'rk', 'scope'),
				edge('rk', 'out', 'p', 'result')
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.market.outcomes).toHaveLength(3);
		expect(res.market.outcomes[0].predicate.kind).toBe('or');
	});
});

// ============================================================
// compileGraph — Truth (Boolean tree)
// ============================================================
describe('compileGraph: truth', () => {
	it('aggregate(count) on entities + compare → compare_counters with sum(ref)', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('all', 'entities'),
				node('agg', 'aggregate', { agg: 'count' }),
				node('n', 'number', { value: 5 }),
				node('cmp', 'compare', { op: 'gt' }),
				node('t', 'truth', { marketTitle: 'Über 5 Tore total' })
			],
			[
				edge('ev', 'out', 'agg', 'event'),
				edge('all', 'out', 'agg', 'scope'),
				edge('agg', 'out', 'cmp', 'a'),
				edge('n', 'out', 'cmp', 'b'),
				edge('cmp', 'out', 't', 'result')
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.market.outcomes).toHaveLength(2);
		expect(res.market.outcomes[0].predicate.kind).toBe('compare_counters');
	});

	it('aggregate(count) on single entity + compare → compare_counters with ref', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'foul' }),
				node('e', 'entity', { entityName: 'Mario' }),
				node('agg', 'aggregate', { agg: 'count' }),
				node('n', 'number', { value: 1 }),
				node('cmp', 'compare', { op: 'gte' }),
				node('t', 'truth', { marketTitle: 'Mind. 1 Foul' })
			],
			[
				edge('ev', 'out', 'agg', 'event'),
				edge('e', 'out', 'agg', 'scope'),
				edge('agg', 'out', 'cmp', 'a'),
				edge('n', 'out', 'cmp', 'b'),
				edge('cmp', 'out', 't', 'result')
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const yes = res.market.outcomes[0].predicate;
		expect(yes.kind).toBe('compare_counters');
		if (yes.kind !== 'compare_counters') return;
		expect('kind' in yes.left && yes.left.kind).toBe('ref');
	});

	it('delta(signed) + compare → diff CounterExpr', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('eA', 'entity', { entityName: 'Mario' }),
				node('eB', 'entity', { entityName: 'Luigi' }),
				node('aA', 'aggregate', { agg: 'count' }),
				node('aB', 'aggregate', { agg: 'count' }),
				node('d', 'delta', { mode: 'signed' }),
				node('k', 'number', { value: 2 }),
				node('cmp', 'compare', { op: 'gte' }),
				node('t', 'truth', { marketTitle: 'Mario 2 vorn?' })
			],
			[
				edge('ev', 'out', 'aA', 'event'),
				edge('eA', 'out', 'aA', 'scope'),
				edge('ev', 'out', 'aB', 'event'),
				edge('eB', 'out', 'aB', 'scope'),
				edge('aA', 'out', 'd', 'a'),
				edge('aB', 'out', 'd', 'b'),
				edge('d', 'out', 'cmp', 'a'),
				edge('k', 'out', 'cmp', 'b'),
				edge('cmp', 'out', 't', 'result')
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const yes = res.market.outcomes[0].predicate;
		expect(yes.kind).toBe('compare_counters');
		if (yes.kind !== 'compare_counters') return;
		expect('kind' in yes.left && yes.left.kind).toBe('diff');
	});

	it('condition (cond → result) compiles to or(not(cond), result)', () => {
		const graph = g(
			[
				node('eg', 'event', { trackableId: 'goal' }),
				node('ef', 'event', { trackableId: 'foul' }),
				node('all1', 'entities'),
				node('all2', 'entities'),
				node('aG', 'aggregate', { agg: 'count' }),
				node('aF', 'aggregate', { agg: 'count' }),
				node('kG', 'number', { value: 3 }),
				node('kF', 'number', { value: 5 }),
				node('cmpG', 'compare', { op: 'gte' }),
				node('cmpF', 'compare', { op: 'gte' }),
				node('cond', 'condition'),
				node('t', 'truth')
			],
			[
				edge('eg', 'out', 'aG', 'event'),
				edge('all1', 'out', 'aG', 'scope'),
				edge('ef', 'out', 'aF', 'event'),
				edge('all2', 'out', 'aF', 'scope'),
				edge('aG', 'out', 'cmpG', 'a'),
				edge('kG', 'out', 'cmpG', 'b'),
				edge('aF', 'out', 'cmpF', 'a'),
				edge('kF', 'out', 'cmpF', 'b'),
				edge('cmpG', 'out', 'cond', 'cond'),
				edge('cmpF', 'out', 'cond', 'result'),
				edge('cond', 'out', 't', 'result')
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

	it('between compiles to and(>=min, <=max)', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('all', 'entities'),
				node('agg', 'aggregate', { agg: 'count' }),
				node('lo', 'number', { value: 2 }),
				node('hi', 'number', { value: 5 }),
				node('btw', 'between', { inclusive: true }),
				node('t', 'truth')
			],
			[
				edge('ev', 'out', 'agg', 'event'),
				edge('all', 'out', 'agg', 'scope'),
				edge('agg', 'out', 'btw', 'value'),
				edge('lo', 'out', 'btw', 'min'),
				edge('hi', 'out', 'btw', 'max'),
				edge('btw', 'out', 't', 'result')
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

	it('combine(and) of two compares compiles to and', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('all1', 'entities'),
				node('all2', 'entities'),
				node('a1', 'aggregate', { agg: 'count' }),
				node('a2', 'aggregate', { agg: 'sum' }),
				node('n1', 'number', { value: 1 }),
				node('n2', 'number', { value: 2 }),
				node('cmp1', 'compare', { op: 'gte' }),
				node('cmp2', 'compare', { op: 'gte' }),
				node('cmb', 'combine', { combine: 'and' }),
				node('t', 'truth')
			],
			[
				edge('ev', 'out', 'a1', 'event'),
				edge('all1', 'out', 'a1', 'scope'),
				edge('ev', 'out', 'a2', 'event'),
				edge('all2', 'out', 'a2', 'scope'),
				edge('a1', 'out', 'cmp1', 'a'),
				edge('n1', 'out', 'cmp1', 'b'),
				edge('a2', 'out', 'cmp2', 'a'),
				edge('n2', 'out', 'cmp2', 'b'),
				edge('cmp1', 'out', 'cmb', 'inputs'),
				edge('cmp2', 'out', 'cmb', 'inputs'),
				edge('cmb', 'out', 't', 'result')
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.market.outcomes[0].predicate.kind).toBe('and');
	});

	it('time_compare with first_occurrence → timestamp_compare', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('foA', 'first_occurrence'),
				node('foB', 'first_occurrence'),
				node('tc', 'time_compare', { op: 'lt' }),
				node('t', 'truth')
			],
			[
				edge('ev', 'out', 'foA', 'event'),
				edge('ev', 'out', 'foB', 'event'),
				edge('foA', 'out', 'tc', 'a'),
				edge('foB', 'out', 'tc', 'b'),
				edge('tc', 'out', 't', 'result')
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const yes = res.market.outcomes[0].predicate;
		expect(yes.kind).toBe('timestamp_compare');
		if (yes.kind !== 'timestamp_compare') return;
		expect(yes.left.kind).toBe('first_occurrence');
		expect(yes.cmp).toBe('lt');
	});

	it('time(now) vs first_occurrence via time_compare → round_now timestamp', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('fo', 'first_occurrence'),
				node('now', 'time'),
				node('tc', 'time_compare', { op: 'gt' }),
				node('t', 'truth')
			],
			[
				edge('ev', 'out', 'fo', 'event'),
				edge('now', 'out', 'tc', 'a'),
				edge('fo', 'out', 'tc', 'b'),
				edge('tc', 'out', 't', 'result')
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const yes = res.market.outcomes[0].predicate;
		expect(yes.kind).toBe('timestamp_compare');
		if (yes.kind !== 'timestamp_compare') return;
		expect(yes.left.kind).toBe('round_now');
	});

	it('sequence_match compiles to events_in_order', () => {
		const graph = g(
			[
				node('eg', 'event', { trackableId: 'goal' }),
				node('ef', 'event', { trackableId: 'foul' }),
				node('sm', 'sequence_match', { allowOthersBetween: true }),
				node('t', 'truth')
			],
			[
				edge('eg', 'out', 'sm', 'steps'),
				edge('ef', 'out', 'sm', 'steps'),
				edge('sm', 'out', 't', 'result')
			]
		);
		const res = compileGraph(graph, CTX);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const yes = res.market.outcomes[0].predicate;
		expect(yes.kind).toBe('events_in_order');
		if (yes.kind !== 'events_in_order') return;
		expect(yes.steps).toEqual(['goal', 'foul']);
		expect(yes.allowOthersBetween).toBe(true);
	});
});

// ============================================================
// previewSentence
// ============================================================
describe('previewSentence', () => {
	it('produces a German sentence for rank → winner', () => {
		const graph = g(
			[
				node('ev', 'event', { trackableId: 'goal' }),
				node('all', 'entities'),
				node('rk', 'rank', { direction: 'desc' }),
				node('w', 'winner', { marketTitle: 'Top-Scorer' })
			],
			[
				edge('ev', 'out', 'rk', 'event'),
				edge('all', 'out', 'rk', 'scope'),
				edge('rk', 'out', 'w', 'result')
			]
		);
		const s = previewSentence(graph);
		expect(s).toContain('Top-Scorer');
		expect(s).toContain('meisten');
	});

	it('returns "Kein Ergebnis-Knoten" for empty graph', () => {
		const graph = g([], []);
		expect(previewSentence(graph)).toBe('Kein Ergebnis-Knoten.');
	});
});
