/**
 * @file graph/compile.ts -- Compile a Graph 2.0 `BetGraph` into a ready-to-spawn
 * market with `Predicate` AST outcomes (consumed by `repos/markets.ts` at
 * round-betting-open time).
 *
 * Graph 2.0 uses 12 core + 5 advanced node kinds (see `catalog.ts`). This
 * compiler maps the *visual* graph (kinds: entities/event/aggregate/rank/etc.)
 * down to the *runtime* `Predicate` AST (kinds: count/sum/compare_counters/etc.)
 * which is unchanged from before. The runtime engine doesn't care about the
 * editor representation.
 *
 * Supported shapes (outcome ← source):
 *
 *  winner ← rank(event, scope=entities)
 *      threshold=0 + direction=desc → arg_max semantics (compare_counters)
 *      threshold=0 + direction=asc  → arg_min semantics
 *      threshold>0                  → race_to_threshold (per-entity count gte N)
 *  truth  ← <boolean-tree>
 *      Recursive composition over compare, between, condition, combine, sequence_match, time_compare.
 *      Number leaves: aggregate, delta, number.
 *      Timestamp leaves: first_occurrence, number (seconds), time.
 *  podium ← rank(event, scope=entities)
 *      Top-K, with or without order.
 */
import type {
	BetGraph,
	CounterExpr,
	GraphNode,
	Predicate,
	SessionBetGraph,
	TimestampExpr,
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

// ---------- helpers ----------

function inSrc(graph: BetGraph, nodeId: string, pin: string): GraphNode | undefined {
	const edge = graph.edges.find((e) => e.to.nodeId === nodeId && e.to.pin === pin);
	if (!edge) return undefined;
	return graph.nodes.find((n) => n.id === edge.from.nodeId);
}

function inEdges(graph: BetGraph, nodeId: string, pin: string): GraphNode[] {
	return graph.edges
		.filter((e) => e.to.nodeId === nodeId && e.to.pin === pin)
		.map((e) => graph.nodes.find((n) => n.id === e.from.nodeId))
		.filter((n): n is GraphNode => !!n);
}

function resolveTrackableId(srcNode: GraphNode | undefined): string | null {
	if (!srcNode || srcNode.kind !== 'event') return null;
	const id = (srcNode.props as { trackableId?: string } | undefined)?.trackableId;
	return id ?? null;
}

function resolveNumber(srcNode: GraphNode | undefined): number | null {
	if (!srcNode || srcNode.kind !== 'number') return null;
	const v = (srcNode.props as { value?: number } | undefined)?.value;
	return typeof v === 'number' ? v : null;
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
			return 'eq'; // engine has no 'neq'; caller wraps with NOT(eq)
		default:
			return 'gte';
	}
}

function propNum(node: GraphNode, key: string, fallback: number): number {
	const v = (node.props as Record<string, unknown> | undefined)?.[key];
	return typeof v === 'number' ? v : fallback;
}

function propStr(node: GraphNode, key: string, fallback: string): string {
	const v = (node.props as Record<string, unknown> | undefined)?.[key];
	return typeof v === 'string' ? v : fallback;
}

function propBool(node: GraphNode, key: string, fallback: boolean): boolean {
	const v = (node.props as Record<string, unknown> | undefined)?.[key];
	return typeof v === 'boolean' ? v : fallback;
}

// ---------- winner / rank ----------

function buildWinnerFromRank(
	graph: BetGraph,
	outcome: GraphNode,
	rankNode: GraphNode,
	ctx: CompileContext
): CompileResult {
	const eventSrc = inSrc(graph, rankNode.id, 'event');
	const trackableId = resolveTrackableId(eventSrc);
	if (!trackableId) {
		return { ok: false, error: 'Ranking: kein Event verbunden' };
	}
	if (ctx.entities.length < 2) {
		return { ok: false, error: 'Ranking braucht mindestens 2 Entitäten.' };
	}
	const direction = propStr(rankNode, 'direction', 'desc');
	const threshold = propNum(rankNode, 'threshold', 0);

	if (threshold > 0) {
		// Race semantics: per-entity `count(event, entity, gte, threshold)`.
		const outcomes: CompiledOutcome[] = ctx.entities.map((self, idx) => ({
			label: self.name,
			predicate: {
				kind: 'count',
				trackableId,
				entityId: self.id,
				cmp: 'gte',
				n: threshold
			},
			orderIndex: idx
		}));
		return {
			ok: true,
			market: {
				title: propStr(outcome, 'marketTitle', 'Erster zu N'),
				outcomes
			}
		};
	}

	// Pure ranking (champion/loser): per-entity "self > all others" or "self < all others".
	const cmp = direction === 'asc' ? 'lt' : 'gt';
	const outcomes: CompiledOutcome[] = ctx.entities.map((self, idx) => {
		const others = ctx.entities.filter((e) => e.id !== self.id);
		const children: Predicate[] = others.map((o) => ({
			kind: 'compare_counters',
			left: { kind: 'ref', trackableId, entityId: self.id },
			right: { kind: 'ref', trackableId, entityId: o.id },
			cmp
		}));
		const predicate: Predicate =
			children.length === 1 ? children[0] : { kind: 'and', children };
		return { label: self.name, predicate, orderIndex: idx };
	});
	return {
		ok: true,
		market: {
			title: propStr(outcome, 'marketTitle', 'Gewinner'),
			outcomes
		}
	};
}

// ---------- podium / rank ----------

function buildPodiumFromRank(
	graph: BetGraph,
	outcome: GraphNode,
	rankNode: GraphNode,
	ctx: CompileContext
): CompileResult {
	const eventSrc = inSrc(graph, rankNode.id, 'event');
	const trackableId = resolveTrackableId(eventSrc);
	if (!trackableId) return { ok: false, error: 'Podium: kein Event verbunden' };
	if (ctx.entities.length < 2) {
		return { ok: false, error: 'Podium braucht mindestens 2 Entitäten.' };
	}
	const topK = Math.max(1, Math.min(propNum(outcome, 'topK', 3), ctx.entities.length));
	const withOrder = propBool(outcome, 'withOrder', true);
	const outcomes: CompiledOutcome[] = [];
	if (withOrder) {
		for (let pos = 1; pos <= topK; pos++) {
			for (const ent of ctx.entities) {
				outcomes.push({
					label: `${ent.name} auf Platz ${pos}`,
					predicate: { kind: 'log_rank', trackableId, entityId: ent.id, position: pos },
					orderIndex: outcomes.length
				});
			}
		}
	} else {
		for (let i = 0; i < ctx.entities.length; i++) {
			const ent = ctx.entities[i];
			const positionPreds: Predicate[] = [];
			for (let pos = 1; pos <= topK; pos++) {
				positionPreds.push({
					kind: 'log_rank',
					trackableId,
					entityId: ent.id,
					position: pos
				});
			}
			outcomes.push({
				label: `${ent.name} (Top-${topK})`,
				predicate:
					positionPreds.length === 1
						? positionPreds[0]
						: { kind: 'or', children: positionPreds },
				orderIndex: i
			});
		}
	}
	return {
		ok: true,
		market: {
			title: propStr(outcome, 'marketTitle', `Top-${topK}`),
			outcomes
		}
	};
}

// ---------- truth / boolean tree ----------

function buildTruthFromBoolean(
	graph: BetGraph,
	outcome: GraphNode,
	root: GraphNode,
	ctx: CompileContext
): CompileResult {
	const pr = compileBoolean(graph, root, ctx);
	if (!pr.ok) return { ok: false, error: pr.error };
	const yesLabel = propStr(outcome, 'yesLabel', 'Ja');
	const noLabel = propStr(outcome, 'noLabel', 'Nein');
	const title = propStr(outcome, 'marketTitle', 'Wette');
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
type TsResult = { ok: true; value: TimestampExpr } | { ok: false; error: string };

function compileBoolean(graph: BetGraph, node: GraphNode, ctx: CompileContext): PredResult {
	switch (node.kind) {
		case 'compare': {
			const left = inSrc(graph, node.id, 'a');
			const right = inSrc(graph, node.id, 'b');
			const op = propStr(node, 'op', 'gte');
			const cmp = cmpFromOp(op);
			if (!left || !right) return { ok: false, error: 'Vergleich: a oder b nicht verbunden' };
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
				return { ok: false, error: 'Zwischen: value/min/max nicht verbunden' };
			}
			const vE = compileCounterExpr(graph, v, ctx);
			const loE = compileCounterExpr(graph, lo, ctx);
			const hiE = compileCounterExpr(graph, hi, ctx);
			if (!vE.ok) return { ok: false, error: vE.error };
			if (!loE.ok) return { ok: false, error: loE.error };
			if (!hiE.ok) return { ok: false, error: hiE.error };
			const inclusive = propBool(node, 'inclusive', true);
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
		case 'combine': {
			const op = propStr(node, 'combine', 'and');
			const incoming = inEdges(graph, node.id, 'inputs');
			if (op === 'not') {
				if (incoming.length !== 1) {
					return { ok: false, error: 'NICHT: braucht genau einen Eingang' };
				}
				const r = compileBoolean(graph, incoming[0], ctx);
				if (!r.ok) return r;
				return { ok: true, value: { kind: 'not', child: r.value } };
			}
			if (incoming.length < 2) {
				return { ok: false, error: 'Verknüpfung: braucht mindestens 2 Eingänge' };
			}
			const children: Predicate[] = [];
			for (const src of incoming) {
				const r = compileBoolean(graph, src, ctx);
				if (!r.ok) return r;
				children.push(r.value);
			}
			return { ok: true, value: { kind: op === 'or' ? 'or' : 'and', children } };
		}
		case 'condition': {
			// cond → result  ≡  ¬cond ∨ result
			const condSrc = inSrc(graph, node.id, 'cond');
			const thenSrc = inSrc(graph, node.id, 'result');
			if (!condSrc || !thenSrc) {
				return { ok: false, error: 'Bedingung: cond/result nicht verbunden' };
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
		case 'sequence_match': {
			const incoming = inEdges(graph, node.id, 'steps');
			if (incoming.length < 1) {
				return { ok: false, error: 'Reihenfolge: keine Steps verbunden' };
			}
			const steps: string[] = [];
			for (const src of incoming) {
				const tid = resolveTrackableId(src);
				if (!tid) {
					return { ok: false, error: 'Reihenfolge: jeder Schritt braucht ein Event' };
				}
				steps.push(tid);
			}
			const allowOthersBetween = propBool(node, 'allowOthersBetween', false);
			return { ok: true, value: { kind: 'events_in_order', steps, allowOthersBetween } };
		}
		case 'time_compare': {
			const a = inSrc(graph, node.id, 'a');
			const b = inSrc(graph, node.id, 'b');
			if (!a || !b) return { ok: false, error: 'Zeitvergleich: a oder b nicht verbunden' };
			const aT = compileTimestampExpr(graph, a, ctx);
			if (!aT.ok) return { ok: false, error: aT.error };
			const bT = compileTimestampExpr(graph, b, ctx);
			if (!bT.ok) return { ok: false, error: bT.error };
			const op = propStr(node, 'op', 'lt');
			const cmp = cmpFromOp(op);
			return {
				ok: true,
				value: { kind: 'timestamp_compare', left: aT.value, right: bT.value, cmp }
			};
		}
		default:
			return { ok: false, error: `compileBoolean: Knoten "${node.kind}" liefert kein Boolean` };
	}
}

function compileCounterExpr(
	graph: BetGraph,
	node: GraphNode,
	ctx: CompileContext
): ExprResult {
	switch (node.kind) {
		case 'number': {
			const v = propNum(node, 'value', NaN);
			if (!Number.isFinite(v)) return { ok: false, error: 'Zahl: kein Wert' };
			return { ok: true, value: { kind: 'const', value: v } };
		}
		case 'aggregate': {
			const eSrc = inSrc(graph, node.id, 'event');
			const trackableId = resolveTrackableId(eSrc);
			if (!trackableId) return { ok: false, error: 'Aggregat: kein Event verbunden' };
			const scopeSrc = inSrc(graph, node.id, 'scope');
			if (!scopeSrc) return { ok: false, error: 'Aggregat: scope nicht verbunden' };
			if (scopeSrc.kind === 'entities') {
				// All entities — sum across all (== count for counter-trackables).
				const operands: CounterExpr[] = ctx.entities.map((e) => ({
					kind: 'ref',
					trackableId,
					entityId: e.id
				}));
				return { ok: true, value: { kind: 'sum', operands } };
			}
			if (scopeSrc.kind === 'entity') {
				const entityName = propStr(scopeSrc, 'entityName', '');
				const ent = ctx.entities.find((e) => e.name === entityName);
				if (!ent) {
					return { ok: false, error: `Aggregat: Entität "${entityName}" nicht gefunden` };
				}
				return { ok: true, value: { kind: 'ref', trackableId, entityId: ent.id } };
			}
			return { ok: false, error: `Aggregat: scope-Knoten "${scopeSrc.kind}" nicht unterstützt` };
		}
		case 'delta': {
			const aSrc = inSrc(graph, node.id, 'a');
			const bSrc = inSrc(graph, node.id, 'b');
			if (!aSrc || !bSrc) return { ok: false, error: 'Differenz: a oder b fehlt' };
			const aE = compileCounterExpr(graph, aSrc, ctx);
			if (!aE.ok) return aE;
			const bE = compileCounterExpr(graph, bSrc, ctx);
			if (!bE.ok) return bE;
			const mode = propStr(node, 'mode', 'signed');
			if (mode === 'abs') {
				return { ok: false, error: 'Differenz (absolut): nicht im Compiler unterstützt' };
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

function compileTimestampExpr(
	graph: BetGraph,
	node: GraphNode,
	ctx: CompileContext
): TsResult {
	switch (node.kind) {
		case 'first_occurrence': {
			const tSrc = inSrc(graph, node.id, 'event');
			const trackableId = resolveTrackableId(tSrc);
			if (!trackableId) {
				return { ok: false, error: 'Erstes Vorkommen: kein Event verbunden' };
			}
			const eSrc = inSrc(graph, node.id, 'entity');
			let entityId: string | null = null;
			if (eSrc) {
				// no `entity` source kind in Graph 2.0 — entity must come from a single-element rank or future picker.
				// For now: not supported.
				return { ok: false, error: 'Erstes Vorkommen: entity-Pin noch nicht unterstützt' };
			}
			return { ok: true, value: { kind: 'first_occurrence', trackableId, entityId } };
		}
		case 'number': {
			const v = propNum(node, 'value', NaN);
			if (!Number.isFinite(v) || v < 0) {
				return { ok: false, error: 'Zahl (Timestamp): nicht-negative Zahl nötig' };
			}
			return { ok: true, value: { kind: 'const_seconds', value: v } };
		}
		case 'time': {
			return { ok: true, value: { kind: 'round_now' } };
		}
		default:
			return {
				ok: false,
				error: `compileTimestampExpr: Knoten "${node.kind}" liefert keinen Timestamp`
			};
	}
}

// ---------- public entry ----------

export function compileGraph(graph: BetGraph, ctx: CompileContext): CompileResult {
	const outcome = graph.nodes.find((n) =>
		(['winner', 'truth', 'podium'] as const).includes(n.kind as 'winner' | 'truth' | 'podium')
	);
	if (!outcome) return { ok: false, error: 'Kein Ergebnis-Knoten' };
	const source = inSrc(graph, outcome.id, 'result');
	if (!source) return { ok: false, error: 'Ergebnis.result nicht verbunden' };

	if (outcome.kind === 'winner') {
		if (source.kind === 'rank') {
			return buildWinnerFromRank(graph, outcome, source, ctx);
		}
		return {
			ok: false,
			error: `Gewinner-Wette braucht "Ranking" als Quelle (gefunden: ${source.kind}).`
		};
	}

	if (outcome.kind === 'truth') {
		return buildTruthFromBoolean(graph, outcome, source, ctx);
	}

	if (outcome.kind === 'podium') {
		if (source.kind === 'rank') {
			return buildPodiumFromRank(graph, outcome, source, ctx);
		}
		return {
			ok: false,
			error: `Podium-Wette braucht "Ranking" als Quelle (gefunden: ${source.kind}).`
		};
	}

	return {
		ok: false,
		error: `Shape (${outcome.kind} ← ${source.kind}) ist im Compiler nicht unterstützt.`
	};
}

/** Compile every graph attached to a session snapshot; skip the unsupported ones. */
export function compileSessionGraphs(
	graphs: SessionBetGraph[],
	ctx: CompileContext
): CompiledMarket[] {
	const out: CompiledMarket[] = [];
	for (const g of graphs) {
		const r = compileGraph(g.graph, ctx);
		if (r.ok) out.push(r.market);
	}
	return out;
}
