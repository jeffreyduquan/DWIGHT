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
 *  boolean_outcome ← compare(sum(trackable, all_entities), constant)
 *      -> sum predicate via compare_counters
 *  boolean_outcome ← compare(count(trackable [, entity]), constant)
 *      -> count predicate
 */
import type {
	BetGraph,
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

function buildBooleanFromCompare(
	graph: BetGraph,
	outcome: GraphNode,
	cmpNode: GraphNode,
	ctx: CompileContext
): CompileResult {
	const left = inSrc(graph, cmpNode.id, 'a');
	const right = inSrc(graph, cmpNode.id, 'b');
	const op = String((cmpNode.props as { op?: string } | undefined)?.op ?? 'gte');
	const cmp = cmpFromOp(op);

	// constant on either side
	const leftConst = resolveNumber(graph, left);
	const rightConst = resolveNumber(graph, right);

	// Compute side -> Predicate building helper
	const compute = leftConst != null ? right : left;
	const constant = leftConst != null ? leftConst : rightConst;
	if (compute == null || constant == null) {
		return { ok: false, error: 'compare: braucht eine Seite als Konstante.' };
	}
	// If constant is on the LEFT, we need to flip the operator.
	const finalCmp: typeof cmp = leftConst != null ? flipCmp(cmp) : cmp;

	const yesLabel = String(
		(outcome.props as { yesLabel?: string } | undefined)?.yesLabel ?? 'Ja'
	);
	const noLabel = String(
		(outcome.props as { noLabel?: string } | undefined)?.noLabel ?? 'Nein'
	);
	const title = String(
		(outcome.props as { marketTitle?: string } | undefined)?.marketTitle ?? 'Wette'
	);

	if (compute.kind === 'count') {
		const tSrc = inSrc(graph, compute.id, 'trackable');
		const trackableId = resolveTrackableId(graph, tSrc);
		if (!trackableId) return { ok: false, error: 'count: kein Trackable verbunden' };
		const eSrc = inSrc(graph, compute.id, 'entity');
		const entityId = resolveEntityId(eSrc, ctx);
		const yes: Predicate = { kind: 'count', trackableId, entityId, cmp: finalCmp, n: constant };
		return {
			ok: true,
			market: {
				title,
				outcomes: [
					{ label: yesLabel, predicate: yes, orderIndex: 0 },
					{ label: noLabel, predicate: { kind: 'not', child: yes }, orderIndex: 1 }
				]
			}
		};
	}
	if (compute.kind === 'sum') {
		const tSrc = inSrc(graph, compute.id, 'trackable');
		const trackableId = resolveTrackableId(graph, tSrc);
		if (!trackableId) return { ok: false, error: 'sum: kein Trackable verbunden' };
		const operands = ctx.entities.map((e) => ({
			kind: 'ref' as const,
			trackableId,
			entityId: e.id
		}));
		const yes: Predicate = {
			kind: 'compare_counters',
			left: { kind: 'sum', operands },
			right: { kind: 'const', value: constant },
			cmp: finalCmp
		};
		return {
			ok: true,
			market: {
				title,
				outcomes: [
					{ label: yesLabel, predicate: yes, orderIndex: 0 },
					{ label: noLabel, predicate: { kind: 'not', child: yes }, orderIndex: 1 }
				]
			}
		};
	}
	return {
		ok: false,
		error: `boolean_outcome ← compare ← ${compute.kind} ist im Phase-6-Compiler noch nicht unterstützt.`
	};
}

function flipCmp(op: 'gte' | 'lte' | 'eq' | 'gt' | 'lt'): 'gte' | 'lte' | 'eq' | 'gt' | 'lt' {
	switch (op) {
		case 'gt':
			return 'lt';
		case 'lt':
			return 'gt';
		case 'gte':
			return 'lte';
		case 'lte':
			return 'gte';
		case 'eq':
			return 'eq';
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
		if (source.kind === 'compare') {
			return buildBooleanFromCompare(graph, outcome, source, ctx);
		}
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
