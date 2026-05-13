/**
 * @file graph/compile.ts -- Compile a `BetGraph` into one ready-to-spawn market
 * description with `Predicate` AST outcomes (consumed by `repos/markets.ts` at
 * round-betting-open time).
 *
 * Phase 6 foundation: covers the most common bet shapes. Unsupported graphs
 * return `{ ok: false, error: ... }` and are simply skipped at spawn time.
 *
 * Supported shapes (outcome kind + result-source kind):
 *
 *  entity_outcome ← arg_max(trackable, all_entities)
 *      -> compare_entities (one outcome per entity, x > all others), tie -> void
 *  entity_outcome ← arg_min(trackable, all_entities)
 *      -> compare_entities min direction
 *  entity_outcome ← race_to_threshold(trackable, all_entities, constant=1)
 *      -> log_rank position=1 (one outcome per entity)
 *  boolean_outcome ← <boolean-tree>
 *      Recursive composition over: compare, between, and, or, not, if_then.
 *      Number leaves: count(trackable[, entity]), sum(trackable, all_entities),
 *                     delta(a, b), constant.
 */
import type {
	BetGraph,
	CounterExpr,
	GraphNode,
	Predicate,
	SessionBetGraph,
	Trackable
} from '$lib/server/db/schema';

export type CompileEntity = { id: string; name: string };

export type CompileContext = {
	entities: CompileEntity[];
	trackables: Trackable[];
};

export type CompiledOutcome = {
	label: string;
	predicate: Predicate;
	orderIndex: number;
};

export type CompiledMarket = {
	title: string;
	description?: string | null;
	outcomes: CompiledOutcome[];
};

export type CompileResult =
	| { ok: true; market: CompiledMarket }
	| { ok: false; error: string };

function inSrc(graph: BetGraph, nodeId: string, pin: string): GraphNode | undefined {
	const edge = graph.edges.find((e) => e.to.nodeId === nodeId && e.to.pin === pin);
	if (!edge) return undefined;
	return graph.nodes.find((n) => n.id === edge.from.nodeId);
}

function resolveTrackableId(graph: BetGraph, srcNode: GraphNode | undefined): string | null {
	if (!srcNode || srcNode.kind !== 'trackable') return null;
	const id = (srcNode.props as { trackableId?: string } | undefined)?.trackableId;
	return id ?? null;
}

function resolveEntityId(
	srcNode: GraphNode | undefined,
	ctx: CompileContext
): string | null {
	if (!srcNode || srcNode.kind !== 'entity') return null;
	const name = (srcNode.props as { entityName?: string } | undefined)?.entityName;
	if (!name) return null;
	const ent = ctx.entities.find((e) => e.name === name);
	return ent?.id ?? null;
}

function resolveNumber(graph: BetGraph, srcNode: GraphNode | undefined): number | null {
	if (!srcNode) return null;
	if (srcNode.kind === 'constant') {
		const v = (srcNode.props as { value?: number } | undefined)?.value;
		return typeof v === 'number' ? v : null;
	}
	return null;
}

function cmpFromOp(op: string): 'gte' | 'lte' | 'eq' | 'gt' | 'lt' {
	switch (op) {
		case 'gte':
			return 'gte';
		case 'lte':
			return 'lte';
		case 'gt':
			return 'gt';
		case 'lt':
			return 'lt';
		case 'eq':
			return 'eq';
		case 'neq':
			// Engine has no 'neq'; caller wraps with NOT(eq).
			return 'eq';
		default:
			return 'gte';
	}
}

function buildArgMaxOutcomes(
	graph: BetGraph,
	outcome: GraphNode,
	argNode: GraphNode,
	ctx: CompileContext,
	direction: 'max' | 'min'
): CompileResult {
	const trackableSrc = inSrc(graph, argNode.id, 'trackable');
	const trackableId = resolveTrackableId(graph, trackableSrc);
	if (!trackableId) return { ok: false, error: 'arg_max/min: kein Trackable verbunden' };
	if (ctx.entities.length < 2) {
		return { ok: false, error: 'arg_max/min braucht mindestens 2 Entities.' };
	}
	const outcomes: CompiledOutcome[] = ctx.entities.map((self, idx) => {
		const others = ctx.entities.filter((e) => e.id !== self.id);
		const children: Predicate[] = others.map((o) => ({
			kind: 'compare_counters',
			left: { kind: 'ref', trackableId, entityId: self.id },
			right: { kind: 'ref', trackableId, entityId: o.id },
			cmp: direction === 'max' ? 'gt' : 'lt'
		}));
		const predicate: Predicate =
			children.length === 1 ? children[0] : { kind: 'and', children };
		return { label: self.name, predicate, orderIndex: idx };
	});
	return {
		ok: true,
		market: {
			title: String(
				(outcome.props as { marketTitle?: string } | undefined)?.marketTitle ?? 'Wette'
			),
			outcomes
		}
	};
}

function buildRaceOutcomes(
	graph: BetGraph,
	outcome: GraphNode,
	raceNode: GraphNode,
	ctx: CompileContext
): CompileResult {
	const trackableSrc = inSrc(graph, raceNode.id, 'trackable');
	const trackableId = resolveTrackableId(graph, trackableSrc);
	if (!trackableId) return { ok: false, error: 'race: kein Trackable verbunden' };
	const thresholdSrc = inSrc(graph, raceNode.id, 'threshold');
	const threshold = resolveNumber(graph, thresholdSrc);
	if (threshold !== 1) {
		return {
			ok: false,
			error: 'race_to_threshold ist im Phase-6-Compiler nur für N=1 unterstützt.'
		};
	}
	const outcomes: CompiledOutcome[] = ctx.entities.map((self, idx) => ({
		label: self.name,
		predicate: {
			kind: 'log_rank',
			trackableId,
			entityId: self.id,
			position: 1
		},
		orderIndex: idx
	}));
	return {
		ok: true,
		market: {
			title: String(
				(outcome.props as { marketTitle?: string } | undefined)?.marketTitle ?? 'Erster'
			),
			outcomes
		}
	};
}

function buildBooleanFromTree(
	graph: BetGraph,
	outcome: GraphNode,
	root: GraphNode,
	ctx: CompileContext
): CompileResult {
	const pr = compileBoolean(graph, root, ctx);
	if (!pr.ok) return { ok: false, error: pr.error };
	const yesLabel = String(
		(outcome.props as { yesLabel?: string } | undefined)?.yesLabel ?? 'Ja'
	);
	const noLabel = String(
		(outcome.props as { noLabel?: string } | undefined)?.noLabel ?? 'Nein'
	);
	const title = String(
		(outcome.props as { marketTitle?: string } | undefined)?.marketTitle ?? 'Wette'
	);
	return {
		ok: true,
		market: {
			title,
			outcomes: [
				{ label: yesLabel, predicate: pr.value, orderIndex: 0 },
				{ label: noLabel, predicate: { kind: 'not', child: pr.value }, orderIndex: 1 }
			]
		}
	};
}

type PredResult = { ok: true; value: Predicate } | { ok: false; error: string };
type ExprResult = { ok: true; value: CounterExpr } | { ok: false; error: string };

/**
 * Recursively compile a node whose output type is `Boolean` into a `Predicate`.
 * Supports: compare, between, and, or, not, if_then.
 */
function compileBoolean(graph: BetGraph, node: GraphNode, ctx: CompileContext): PredResult {
	switch (node.kind) {
		case 'compare': {
			const left = inSrc(graph, node.id, 'a');
			const right = inSrc(graph, node.id, 'b');
			const op = String((node.props as { op?: string } | undefined)?.op ?? 'gte');
			const cmp = cmpFromOp(op);
			if (!left || !right) return { ok: false, error: 'compare: a oder b nicht verbunden' };
			const leftE = compileCounterExpr(graph, left, ctx);
			if (!leftE.ok) return { ok: false, error: leftE.error };
			const rightE = compileCounterExpr(graph, right, ctx);
			if (!rightE.ok) return { ok: false, error: rightE.error };
			let value: Predicate = {
				kind: 'compare_counters',
				left: leftE.value,
				right: rightE.value,
				cmp
			};
			if (op === 'neq') value = { kind: 'not', child: value };
			return { ok: true, value };
		}
		case 'between': {
			const v = inSrc(graph, node.id, 'value');
			const lo = inSrc(graph, node.id, 'min');
			const hi = inSrc(graph, node.id, 'max');
			if (!v || !lo || !hi) {
				return { ok: false, error: 'between: value/min/max nicht verbunden' };
			}
			const vE = compileCounterExpr(graph, v, ctx);
			const loE = compileCounterExpr(graph, lo, ctx);
			const hiE = compileCounterExpr(graph, hi, ctx);
			if (!vE.ok) return { ok: false, error: vE.error };
			if (!loE.ok) return { ok: false, error: loE.error };
			if (!hiE.ok) return { ok: false, error: hiE.error };
			const inclusive =
				((node.props as { inclusive?: boolean } | undefined)?.inclusive ?? true) === true;
			return {
				ok: true,
				value: {
					kind: 'and',
					children: [
						{
							kind: 'compare_counters',
							left: vE.value,
							right: loE.value,
							cmp: inclusive ? 'gte' : 'gt'
						},
						{
							kind: 'compare_counters',
							left: vE.value,
							right: hiE.value,
							cmp: inclusive ? 'lte' : 'lt'
						}
					]
				}
			};
		}
		case 'and':
		case 'or': {
			const edges = graph.edges.filter((e) => e.to.nodeId === node.id && e.to.pin === 'inputs');
			if (edges.length < 2) {
				return { ok: false, error: `${node.kind}: braucht mindestens 2 Eingänge` };
			}
			const children: Predicate[] = [];
			for (const e of edges) {
				const src = graph.nodes.find((n) => n.id === e.from.nodeId);
				if (!src) return { ok: false, error: `${node.kind}: Eingang fehlt` };
				const r = compileBoolean(graph, src, ctx);
				if (!r.ok) return { ok: false, error: r.error };
				children.push(r.value);
			}
			return { ok: true, value: { kind: node.kind, children } };
		}
		case 'not': {
			const src = inSrc(graph, node.id, 'in');
			if (!src) return { ok: false, error: 'not: kein Eingang' };
			const r = compileBoolean(graph, src, ctx);
			if (!r.ok) return r;
			return { ok: true, value: { kind: 'not', child: r.value } };
		}
		case 'if_then': {
			// cond -> then  ≡  ¬cond ∨ then
			const condSrc = inSrc(graph, node.id, 'cond');
			const thenSrc = inSrc(graph, node.id, 'then');
			if (!condSrc || !thenSrc) {
				return { ok: false, error: 'if_then: cond/then nicht verbunden' };
			}
			const c = compileBoolean(graph, condSrc, ctx);
			if (!c.ok) return c;
			const t = compileBoolean(graph, thenSrc, ctx);
			if (!t.ok) return t;
			return {
				ok: true,
				value: { kind: 'or', children: [{ kind: 'not', child: c.value }, t.value] }
			};
		}
		case 'entity_equals':
			return {
				ok: false,
				error: 'entity_equals → Boolean: noch nicht im Compiler unterstützt'
			};
		case 'time_compare':
			return {
				ok: false,
				error: 'time_compare: braucht Timestamp-Predicate (Phase 8.5)'
			};
		default:
			return {
				ok: false,
				error: `compileBoolean: Knoten "${node.kind}" liefert kein Boolean`
			};
	}
}

/**
 * Recursively compile a node whose output type is `Number` into a `CounterExpr`.
 * Supports: count, sum, delta, constant.
 */
function compileCounterExpr(
	graph: BetGraph,
	node: GraphNode,
	ctx: CompileContext
): ExprResult {
	switch (node.kind) {
		case 'constant': {
			const v = (node.props as { value?: number } | undefined)?.value;
			if (typeof v !== 'number') return { ok: false, error: 'constant: kein Wert' };
			return { ok: true, value: { kind: 'const', value: v } };
		}
		case 'count': {
			const tSrc = inSrc(graph, node.id, 'trackable');
			const trackableId = resolveTrackableId(graph, tSrc);
			if (!trackableId) return { ok: false, error: 'count: kein Trackable verbunden' };
			const eSrc = inSrc(graph, node.id, 'entity');
			const entityId = resolveEntityId(eSrc, ctx);
			return { ok: true, value: { kind: 'ref', trackableId, entityId } };
		}
		case 'sum': {
			const tSrc = inSrc(graph, node.id, 'trackable');
			const trackableId = resolveTrackableId(graph, tSrc);
			if (!trackableId) return { ok: false, error: 'sum: kein Trackable verbunden' };
			// scope is "all_entities" only at the moment
			const operands: CounterExpr[] = ctx.entities.map((e) => ({
				kind: 'ref',
				trackableId,
				entityId: e.id
			}));
			return { ok: true, value: { kind: 'sum', operands } };
		}
		case 'delta': {
			const aSrc = inSrc(graph, node.id, 'a');
			const bSrc = inSrc(graph, node.id, 'b');
			if (!aSrc || !bSrc) return { ok: false, error: 'delta: a oder b fehlt' };
			const aE = compileCounterExpr(graph, aSrc, ctx);
			if (!aE.ok) return aE;
			const bE = compileCounterExpr(graph, bSrc, ctx);
			if (!bE.ok) return bE;
			// `abs` mode is not directly expressible in CounterExpr; engine has no abs.
			// For abs we'd need predicate-level handling. Skip for now.
			const mode = (node.props as { mode?: string } | undefined)?.mode ?? 'signed';
			if (mode === 'abs') {
				return { ok: false, error: 'delta(abs): nicht im Compiler unterstützt (Phase 8.5)' };
			}
			return { ok: true, value: { kind: 'diff', operands: [aE.value, bE.value] } };
		}
		default:
			return {
				ok: false,
				error: `compileCounterExpr: Knoten "${node.kind}" liefert keine Zahl`
			};
	}
}

/** Public entry point. */
export function compileGraph(graph: BetGraph, ctx: CompileContext): CompileResult {
	const outcome = graph.nodes.find((n) =>
		['entity_outcome', 'boolean_outcome', 'ranking_outcome'].includes(n.kind)
	);
	if (!outcome) return { ok: false, error: 'Kein Outcome-Knoten' };
	const source = inSrc(graph, outcome.id, 'result');
	if (!source) return { ok: false, error: 'Outcome.result nicht verbunden' };

	if (outcome.kind === 'entity_outcome') {
		if (source.kind === 'arg_max') {
			return buildArgMaxOutcomes(graph, outcome, source, ctx, 'max');
		}
		if (source.kind === 'arg_min') {
			return buildArgMaxOutcomes(graph, outcome, source, ctx, 'min');
		}
		if (source.kind === 'race_to_threshold') {
			return buildRaceOutcomes(graph, outcome, source, ctx);
		}
	}

	if (outcome.kind === 'boolean_outcome') {
		return buildBooleanFromTree(graph, outcome, source, ctx);
	}

	return {
		ok: false,
		error: `Shape (${outcome.kind} ← ${source.kind}) ist im Phase-6-Compiler noch nicht unterstützt.`
	};
}

/** Compile every graph attached to a session snapshot; skip the unsupported ones. */
export function compileSessionGraphs(
	graphs: SessionBetGraph[],
	ctx: CompileContext
): CompiledMarket[] {
	const out: CompiledMarket[] = [];
	for (const g of graphs) {
		const res = compileGraph(g.graph, ctx);
		if (res.ok) {
			out.push({ ...res.market, title: g.name || res.market.title, description: g.description ?? null });
		}
	}
	return out;
}
