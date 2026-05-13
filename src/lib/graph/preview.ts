/**
 * @file graph/preview.ts -- Generate a human-readable German sentence describing
 * what a bet-graph evaluates to. Used as live preview above the editor.
 *
 * Best-effort: unknown shapes fall back to a generic description.
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

function describeSource(graph: BetGraph, node: GraphNode | undefined): string {
	if (!node) return '???';
	const spec = NODE_CATALOG[node.kind];
	switch (node.kind) {
		case 'trackable':
			return String((node.props as { trackableId?: string } | undefined)?.trackableId ?? 'Trackable');
		case 'entity':
			return String((node.props as { entityName?: string } | undefined)?.entityName ?? 'Entity');
		case 'constant':
			return String((node.props as { value?: number } | undefined)?.value ?? 0);
		case 'all_entities':
			return 'alle Entities';
		default:
			return spec?.label ?? node.kind;
	}
}

function describeNumber(graph: BetGraph, node: GraphNode | undefined): string {
	if (!node) return '???';
	switch (node.kind) {
		case 'constant':
			return String((node.props as { value?: number } | undefined)?.value ?? 0);
		case 'count': {
			const t = inputSource(graph, node.id, 'trackable');
			const e = inputSource(graph, node.id, 'entity');
			return e ? `Anzahl ${describeSource(graph, t)} von ${describeSource(graph, e)}` : `Anzahl ${describeSource(graph, t)}`;
		}
		case 'sum': {
			const t = inputSource(graph, node.id, 'trackable');
			return `Summe ${describeSource(graph, t)} aller`;
		}
		case 'delta': {
			const a = inputSource(graph, node.id, 'a');
			const b = inputSource(graph, node.id, 'b');
			return `(${describeNumber(graph, a)} − ${describeNumber(graph, b)})`;
		}
		default:
			return NODE_CATALOG[node.kind]?.label ?? node.kind;
	}
}

const CMP_DE: Record<string, string> = {
	eq: '=',
	neq: '≠',
	gt: '>',
	lt: '<',
	gte: '≥',
	lte: '≤'
};

function describeBoolean(graph: BetGraph, node: GraphNode | undefined): string {
	if (!node) return '???';
	switch (node.kind) {
		case 'compare': {
			const a = inputSource(graph, node.id, 'a');
			const b = inputSource(graph, node.id, 'b');
			const op = String((node.props as { op?: string } | undefined)?.op ?? 'gte');
			return `${describeNumber(graph, a)} ${CMP_DE[op] ?? op} ${describeNumber(graph, b)}`;
		}
		case 'between': {
			const v = inputSource(graph, node.id, 'value');
			const lo = inputSource(graph, node.id, 'min');
			const hi = inputSource(graph, node.id, 'max');
			return `${describeNumber(graph, v)} zwischen ${describeNumber(graph, lo)} und ${describeNumber(graph, hi)}`;
		}
		case 'and':
			return 'alle Bedingungen wahr';
		case 'or':
			return 'mind. eine Bedingung wahr';
		case 'not':
			return 'NICHT (…)';
		case 'if_then':
			return 'wenn A dann B';
		default:
			return NODE_CATALOG[node.kind]?.label ?? node.kind;
	}
}

function describeEntity(graph: BetGraph, node: GraphNode | undefined): string {
	if (!node) return '???';
	switch (node.kind) {
		case 'arg_max': {
			const t = inputSource(graph, node.id, 'trackable');
			return `Entity mit den meisten ${describeSource(graph, t)}`;
		}
		case 'arg_min': {
			const t = inputSource(graph, node.id, 'trackable');
			return `Entity mit den wenigsten ${describeSource(graph, t)}`;
		}
		case 'race_to_threshold': {
			const t = inputSource(graph, node.id, 'trackable');
			const n = inputSource(graph, node.id, 'threshold');
			return `Wer erreicht zuerst ${describeNumber(graph, n)} × ${describeSource(graph, t)}`;
		}
		case 'entity':
			return describeSource(graph, node);
		default:
			return NODE_CATALOG[node.kind]?.label ?? node.kind;
	}
}

/** Build a German one-liner from the outcome backwards. */
export function previewSentence(graph: BetGraph): string {
	const outcome = graph.nodes.find((n) => NODE_CATALOG[n.kind]?.family === 'outcome');
	if (!outcome) return 'Kein Ergebnis-Knoten.';
	const result = inputSource(graph, outcome.id, 'result');
	const title = String(
		(outcome.props as { marketTitle?: string } | undefined)?.marketTitle ?? 'Wette'
	);
	switch (outcome.kind) {
		case 'entity_outcome':
			return `${title}: ${describeEntity(graph, result)}.`;
		case 'boolean_outcome':
			return `${title}: ${describeBoolean(graph, result)}?`;
		case 'ranking_outcome': {
			const k = Number((outcome.props as { topK?: number } | undefined)?.topK ?? 3);
			return `${title}: Top-${k} der Entities (Reihenfolge).`;
		}
		default:
			return title;
	}
}
