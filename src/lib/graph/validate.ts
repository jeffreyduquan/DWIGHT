/**
 * @file graph/validate.ts -- Bet-graph structural + type validator.
 *
 * Checks:
 *  1. All node kinds are known
 *  2. Edges reference existing nodes and pins
 *  3. Output pin type matches input pin type (no implicit casts)
 *  4. Required input pins are connected
 *  5. Multi-edge inputs are only allowed on pins marked `multi`
 *  6. Exactly one outcome node exists
 *  7. No cycles
 */
import type { BetGraph, GraphNode, GraphEdge, GraphNodeKind } from '$lib/server/db/schema';
import { NODE_CATALOG, type PinDef, type PinType } from './catalog';

export type ValidationError = { code: string; message: string; nodeId?: string };

export type ValidationResult = { ok: boolean; errors: ValidationError[] };

function pinByName(pins: PinDef[], name: string): PinDef | undefined {
	return pins.find((p) => p.name === name);
}

function isOutcomeKind(kind: GraphNodeKind): boolean {
	return NODE_CATALOG[kind]?.family === 'outcome';
}

function buildAdjacency(graph: BetGraph): Map<string, Set<string>> {
	const adj = new Map<string, Set<string>>();
	for (const n of graph.nodes) adj.set(n.id, new Set());
	for (const e of graph.edges) {
		const set = adj.get(e.from.nodeId);
		if (set) set.add(e.to.nodeId);
	}
	return adj;
}

function hasCycle(graph: BetGraph): boolean {
	const adj = buildAdjacency(graph);
	const visited = new Set<string>();
	const stack = new Set<string>();
	function visit(id: string): boolean {
		if (stack.has(id)) return true;
		if (visited.has(id)) return false;
		visited.add(id);
		stack.add(id);
		for (const next of adj.get(id) ?? []) {
			if (visit(next)) return true;
		}
		stack.delete(id);
		return false;
	}
	for (const n of graph.nodes) if (visit(n.id)) return true;
	return false;
}

export function validateGraph(graph: BetGraph): ValidationResult {
	const errors: ValidationError[] = [];
	const nodeById = new Map<string, GraphNode>();

	for (const n of graph.nodes) {
		if (!(n.kind in NODE_CATALOG)) {
			errors.push({ code: 'UNKNOWN_KIND', message: `Unbekannter Knoten-Typ: ${n.kind}`, nodeId: n.id });
			continue;
		}
		if (nodeById.has(n.id)) {
			errors.push({ code: 'DUP_ID', message: `Doppelte Knoten-ID: ${n.id}`, nodeId: n.id });
		}
		nodeById.set(n.id, n);
	}

	const outcomes = graph.nodes.filter((n) => isOutcomeKind(n.kind));
	if (outcomes.length === 0) {
		errors.push({ code: 'NO_OUTCOME', message: 'Graph hat keinen Ergebnis-Knoten.' });
	} else if (outcomes.length > 1) {
		errors.push({
			code: 'MULTI_OUTCOME',
			message: `Graph hat ${outcomes.length} Ergebnis-Knoten, erlaubt ist genau 1.`
		});
	}

	// Track which input pins have at least one connected edge
	const connectedInputs = new Map<string, Set<string>>();
	for (const n of graph.nodes) connectedInputs.set(n.id, new Set());

	for (const e of graph.edges) {
		const from = nodeById.get(e.from.nodeId);
		const to = nodeById.get(e.to.nodeId);
		if (!from) {
			errors.push({ code: 'EDGE_BAD_FROM', message: `Edge mit unbekanntem from-Node: ${e.from.nodeId}` });
			continue;
		}
		if (!to) {
			errors.push({ code: 'EDGE_BAD_TO', message: `Edge mit unbekanntem to-Node: ${e.to.nodeId}` });
			continue;
		}
		const fromSpec = NODE_CATALOG[from.kind];
		const toSpec = NODE_CATALOG[to.kind];
		const fromPin = pinByName(fromSpec.outputs, e.from.pin);
		const toPin = pinByName(toSpec.inputs, e.to.pin);
		if (!fromPin) {
			errors.push({
				code: 'BAD_FROM_PIN',
				message: `Output-Pin "${e.from.pin}" existiert nicht auf ${from.kind}`,
				nodeId: from.id
			});
			continue;
		}
		if (!toPin) {
			errors.push({
				code: 'BAD_TO_PIN',
				message: `Input-Pin "${e.to.pin}" existiert nicht auf ${to.kind}`,
				nodeId: to.id
			});
			continue;
		}
		if (fromPin.type !== toPin.type) {
			// Phase 18b: timestamps are seconds-since-round-start numbers
			// internally, so Number→Timestamp is a legal coercion.
			const isNumberToTime = fromPin.type === 'Number' && toPin.type === 'Timestamp';
			if (!isNumberToTime) {
				errors.push({
					code: 'TYPE_MISMATCH',
					message: `Typ-Konflikt: ${from.kind}.${fromPin.name} (${fromPin.type}) -> ${to.kind}.${toPin.name} (${toPin.type})`,
					nodeId: to.id
				});
				continue;
			}
		}
		const set = connectedInputs.get(to.id);
		if (set) {
			const key = toPin.name;
			if (set.has(key) && !toPin.multi) {
				errors.push({
					code: 'MULTI_EDGE',
					message: `Input-Pin ${to.kind}.${toPin.name} akzeptiert nur eine Verbindung.`,
					nodeId: to.id
				});
			}
			set.add(key);
		}
	}

	// Required input check
	for (const n of graph.nodes) {
		const spec = NODE_CATALOG[n.kind];
		if (!spec) continue;
		const conn = connectedInputs.get(n.id) ?? new Set();
		for (const pin of spec.inputs) {
			if (pin.required && !conn.has(pin.name)) {
				errors.push({
					code: 'MISSING_INPUT',
					message: `Pflicht-Input ${n.kind}.${pin.name} ist nicht verbunden.`,
					nodeId: n.id
				});
			}
		}
	}

	if (hasCycle(graph)) {
		errors.push({ code: 'CYCLE', message: 'Graph enthält einen Zyklus.' });
	}

	return { ok: errors.length === 0, errors };
}

export type { PinType };
