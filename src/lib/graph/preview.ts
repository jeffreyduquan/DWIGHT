/**
 * @file graph/preview.ts -- German one-liner describing what a Graph 2.0
 * BetGraph evaluates to. Used as live preview in the SlotGraphEditor status bar.
 *
 * Best-effort: unknown shapes / missing inputs fall back to "?" placeholders.
 */
import type { BetGraph, GraphNode } from '$lib/server/db/schema';
import { NODE_CATALOG } from './catalog';

function nodeById(graph: BetGraph, id: string): GraphNode | undefined {
	return graph.nodes.find((n) => n.id === id);
}

function inputSource(graph: BetGraph, nodeId: string, pin: string): GraphNode | undefined {
	const edge = graph.edges.find((e) => e.to.nodeId === nodeId && e.to.pin === pin);
	if (!edge) return undefined;
	return nodeById(graph, edge.from.nodeId);
}

const CMP_DE: Record<string, string> = {
	eq: '=',
	neq: '≠',
	gt: '>',
	lt: '<',
	gte: '≥',
	lte: '≤'
};

function describeEntities(graph: BetGraph, n: GraphNode | undefined): string {
	if (!n) return '?';
	if (n.kind === 'entities') return 'alle Spieler';
	if (n.kind === 'entity')
		return String((n.props as { entityName?: string } | undefined)?.entityName ?? 'Spieler');
	return NODE_CATALOG[n.kind]?.label ?? n.kind;
}

function describeEvent(graph: BetGraph, n: GraphNode | undefined): string {
	if (!n) return '?';
	if (n.kind === 'event') {
		const tid = (n.props as { trackableId?: string } | undefined)?.trackableId;
		return tid ? `„${tid}"` : 'Event';
	}
	return NODE_CATALOG[n.kind]?.label ?? n.kind;
}

function describeNumber(graph: BetGraph, n: GraphNode | undefined): string {
	if (!n) return '?';
	switch (n.kind) {
		case 'number':
			return String((n.props as { value?: number } | undefined)?.value ?? 0);
		case 'aggregate': {
			const agg = String((n.props as { agg?: string } | undefined)?.agg ?? 'count');
			const ev = inputSource(graph, n.id, 'event');
			const scope = inputSource(graph, n.id, 'scope');
			const evStr = describeEvent(graph, ev);
			const scopeStr = describeEntities(graph, scope);
			return agg === 'sum' ? `Summe ${evStr} von ${scopeStr}` : `Anzahl ${evStr} von ${scopeStr}`;
		}
		case 'delta': {
			const a = inputSource(graph, n.id, 'a');
			const b = inputSource(graph, n.id, 'b');
			return `(${describeNumber(graph, a)} − ${describeNumber(graph, b)})`;
		}
		default:
			return NODE_CATALOG[n.kind]?.label ?? n.kind;
	}
}

function describeTime(graph: BetGraph, n: GraphNode | undefined): string {
	if (!n) return '?';
	if (n.kind === 'time') {
		const sec = Number((n.props as { seconds?: number } | undefined)?.seconds ?? 0);
		return `${sec}s`;
	}
	if (n.kind === 'first_occurrence') {
		const ev = inputSource(graph, n.id, 'event');
		return `Zeitpunkt von ${describeEvent(graph, ev)}`;
	}
	return NODE_CATALOG[n.kind]?.label ?? n.kind;
}

function describeBoolean(graph: BetGraph, n: GraphNode | undefined): string {
	if (!n) return '?';
	switch (n.kind) {
		case 'compare': {
			const a = inputSource(graph, n.id, 'a');
			const b = inputSource(graph, n.id, 'b');
			const op = String((n.props as { op?: string } | undefined)?.op ?? 'gte');
			return `${describeNumber(graph, a)} ${CMP_DE[op] ?? op} ${describeNumber(graph, b)}`;
		}
		case 'between': {
			const v = inputSource(graph, n.id, 'value');
			const lo = inputSource(graph, n.id, 'min');
			const hi = inputSource(graph, n.id, 'max');
			return `${describeNumber(graph, v)} zwischen ${describeNumber(graph, lo)} und ${describeNumber(graph, hi)}`;
		}
		case 'combine': {
			const op = String((n.props as { combine?: string } | undefined)?.combine ?? 'and');
			if (op === 'and') return 'alle Bedingungen wahr';
			if (op === 'or') return 'mind. eine Bedingung wahr';
			return 'nicht (…)';
		}
		case 'condition':
			return 'wenn cond → result';
		case 'time_compare': {
			const a = inputSource(graph, n.id, 'a');
			const b = inputSource(graph, n.id, 'b');
			const op = String((n.props as { op?: string } | undefined)?.op ?? 'before');
			return `${describeTime(graph, a)} ${op === 'before' ? 'vor' : 'nach'} ${describeTime(graph, b)}`;
		}
		case 'sequence_match':
			return 'Reihenfolge passt';
		default:
			return NODE_CATALOG[n.kind]?.label ?? n.kind;
	}
}

function describeRank(graph: BetGraph, n: GraphNode | undefined): string {
	if (!n) return '?';
	if (n.kind !== 'rank') return NODE_CATALOG[n.kind]?.label ?? n.kind;
	const dir = String((n.props as { direction?: string } | undefined)?.direction ?? 'desc');
	const thr = Number((n.props as { threshold?: number } | undefined)?.threshold ?? 0);
	const event = inputSource(graph, n.id, 'event');
	const scope = inputSource(graph, n.id, 'scope');
	const evStr = describeEvent(graph, event);
	const scopeStr = describeEntities(graph, scope);
	if (thr > 0) return `Wer erreicht zuerst ${thr}× ${evStr} (${scopeStr})`;
	return dir === 'asc'
		? `Spieler mit den wenigsten ${evStr} von ${scopeStr}`
		: `Spieler mit den meisten ${evStr} von ${scopeStr}`;
}

/** Build a German one-liner from the outcome node backwards. */
export function previewSentence(graph: BetGraph): string {
	const outcome = graph.nodes.find(
		(n) => n.kind === 'winner' || n.kind === 'truth' || n.kind === 'podium'
	);
	if (!outcome) return 'Kein Ergebnis-Knoten.';
	const result = inputSource(graph, outcome.id, 'result');
	const title = String(
		(outcome.props as { marketTitle?: string } | undefined)?.marketTitle ?? 'Wette'
	);
	if (outcome.kind === 'winner') {
		return `${title}: ${describeRank(graph, result)}.`;
	}
	if (outcome.kind === 'truth') {
		return `${title}: ${describeBoolean(graph, result)}?`;
	}
	if (outcome.kind === 'podium') {
		const k = Number((outcome.props as { topK?: number } | undefined)?.topK ?? 3);
		return `${title} (Top-${k}): ${describeRank(graph, result)}.`;
	}
	return 'Wette';
}
