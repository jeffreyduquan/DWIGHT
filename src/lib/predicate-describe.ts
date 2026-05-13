/**
 * Human-readable German descriptions for Predicate AST nodes.
 * Used both at round-time (showing outcomes) and in the Mode-Editor
 * (live preview while authoring market templates).
 *
 * Recognized higher-level patterns (rendered prettier than the raw structure):
 *  - Strict-extreme (AND of compare_counters with same left+cmp=gt|lt)
 *    → "hat die meisten/wenigsten <trackable>"
 *  - Range pattern (AND of count gte + count lte on same counter)
 *    → "<trackable> zwischen min und max"
 *  - Direct compare_counters between two named entities
 *    → "<A> hat mehr/weniger <trackable> als <B>"
 */

import type { Predicate, Trackable, CounterExpr } from './server/db/schema';

export type LabelMaps = {
	trackableLabel: (id: string) => string;
	entityLabel: (id: string | null | undefined) => string;
};

export function cmpSymbol(c: string): string {
	return c === 'gte' ? '≥' : c === 'lte' ? '≤' : c === 'gt' ? '>' : c === 'lt' ? '<' : '=';
}

/**
 * Pretty-print a CounterExpr tree. Accepts legacy `{trackableId, entityId}` refs.
 */
export function describeExpr(
	expr: CounterExpr | { trackableId: string; entityId: string | null } | any,
	labels: LabelMaps
): string {
	if (!expr) return '?';
	// Legacy ref shape (no `kind` field)
	if (!('kind' in expr) || expr.kind === 'ref') {
		const tLabel = labels.trackableLabel(expr.trackableId);
		const eLabel = expr.entityId ? labels.entityLabel(expr.entityId) : '∑';
		return `${tLabel}(${eLabel})`;
	}
	const ex = expr as CounterExpr;
	if (ex.kind === 'const') return String(ex.value);
	if (ex.kind === 'sum')
		return `(${ex.operands.map((o) => describeExpr(o, labels)).join(' + ')})`;
	if (ex.kind === 'diff')
		return `(${ex.operands.map((o) => describeExpr(o, labels)).join(' − ')})`;
	if (ex.kind === 'mul')
		return `(${ex.operands.map((o) => describeExpr(o, labels)).join(' × ')})`;
	if (ex.kind === 'div')
		return `(${ex.operands.map((o) => describeExpr(o, labels)).join(' ÷ ')})`;
	return '?';
}

export function describePredicate(p: any, labels: LabelMaps): string {
	// Range pattern: AND of two `count` nodes on same counter (gte + lte)
	if (
		p?.kind === 'and' &&
		Array.isArray(p.children) &&
		p.children.length === 2 &&
		p.children.every((c: any) => c?.kind === 'count') &&
		p.children[0].trackableId === p.children[1].trackableId &&
		p.children[0].entityId === p.children[1].entityId &&
		((p.children[0].cmp === 'gte' && p.children[1].cmp === 'lte') ||
			(p.children[0].cmp === 'lte' && p.children[1].cmp === 'gte'))
	) {
		const lo = p.children[0].cmp === 'gte' ? p.children[0].n : p.children[1].n;
		const hi = p.children[0].cmp === 'lte' ? p.children[0].n : p.children[1].n;
		const tLabel = labels.trackableLabel(p.children[0].trackableId);
		const eId = p.children[0].entityId;
		const eLabel = eId ? ` von ${labels.entityLabel(eId)}` : '';
		return `${tLabel}${eLabel} zwischen ${lo} und ${hi}`;
	}

	// Strict-extreme: AND of compare_counters all with same left + same cmp (gt|lt)
	if (
		p?.kind === 'and' &&
		Array.isArray(p.children) &&
		p.children.length > 0 &&
		p.children.every(
			(c: any) =>
				c?.kind === 'compare_counters' &&
				(c.cmp === 'gt' || c.cmp === 'lt') &&
				c.cmp === p.children[0].cmp &&
				c.left?.trackableId &&
				c.left.trackableId === p.children[0].left?.trackableId &&
				c.left.entityId === p.children[0].left.entityId
		)
	) {
		const tLabel = labels.trackableLabel((p.children[0] as any).left.trackableId);
		const verb = (p.children[0] as any).cmp === 'lt' ? 'wenigsten' : 'meisten';
		return `hat die ${verb} "${tLabel}"`;
	}

	// Direct two-entity compare (gt|lt on same trackable)
	if (
		p?.kind === 'compare_counters' &&
		(p.cmp === 'gt' || p.cmp === 'lt') &&
		(p.left as any)?.trackableId &&
		(p.right as any)?.trackableId &&
		(p.left as any).trackableId === (p.right as any).trackableId &&
		(p.left as any).entityId &&
		(p.right as any).entityId
	) {
		const tLabel = labels.trackableLabel((p.left as any).trackableId);
		const aLabel = labels.entityLabel((p.left as any).entityId);
		const bLabel = labels.entityLabel((p.right as any).entityId);
		const verb = p.cmp === 'lt' ? 'weniger' : 'mehr';
		return `${aLabel} hat ${verb} "${tLabel}" als ${bLabel}`;
	}

	// Spread pattern: compare_counters(diff(refA, refB), const(n)) → "(A.X − B.X) cmp n"
	if (
		p?.kind === 'compare_counters' &&
		(p.left as any)?.kind === 'diff' &&
		Array.isArray((p.left as any).operands) &&
		(p.left as any).operands.length === 2 &&
		(p.right as any)?.kind === 'const'
	) {
		const ops = (p.left as any).operands;
		const a = ops[0];
		const b = ops[1];
		const sameTrack =
			!('kind' in a || a.kind === 'ref') ||
			!('kind' in b || b.kind === 'ref') ||
			a.trackableId === b.trackableId;
		if (sameTrack && a?.trackableId && b?.trackableId) {
			const tLabel = labels.trackableLabel(a.trackableId);
			const aLabel = labels.entityLabel(a.entityId);
			const bLabel = labels.entityLabel(b.entityId);
			return `(${aLabel}.${tLabel} − ${bLabel}.${tLabel}) ${cmpSymbol(p.cmp)} ${(p.right as any).value}`;
		}
	}

	// Team-Total pattern: compare_counters(sum([refs...]), const(n)) → "Team(...) hat zusammen cmp n X"
	if (
		p?.kind === 'compare_counters' &&
		(p.left as any)?.kind === 'sum' &&
		Array.isArray((p.left as any).operands) &&
		(p.right as any)?.kind === 'const'
	) {
		const ops = (p.left as any).operands;
		const firstTrack = ops[0]?.trackableId;
		const allSame = ops.every((o: any) => o?.trackableId === firstTrack);
		if (allSame && firstTrack) {
			const tLabel = labels.trackableLabel(firstTrack);
			const names = ops.map((o: any) => labels.entityLabel(o.entityId)).join(', ');
			return `Team [${names}] zusammen ${cmpSymbol(p.cmp)} ${(p.right as any).value} "${tLabel}"`;
		}
	}

	if (p?.kind === 'count') {
		const tLabel = labels.trackableLabel(p.trackableId);
		const eLabel = p.entityId ? ` von ${labels.entityLabel(p.entityId)}` : '';
		return `${tLabel}${eLabel} ${cmpSymbol(p.cmp)} ${p.n}`;
	}
	if (p?.kind === 'log_rank') {
		const tLabel = labels.trackableLabel(p.trackableId);
		const eLabel = labels.entityLabel(p.entityId);
		const pos = p.position === 1 ? '1.' : `${p.position}.`;
		return `${eLabel} war als ${pos} "${tLabel}" eingetragen`;
	}
	if (p?.kind === 'compare_counters') {
		return `${describeExpr(p.left, labels)} ${cmpSymbol(p.cmp)} ${describeExpr(p.right, labels)}`;
	}
	if (p?.kind === 'not') return `NICHT (${describePredicate(p.child, labels)})`;
	if (p?.kind === 'and')
		return p.children.map((c: Predicate) => describePredicate(c, labels)).join(' UND ');
	if (p?.kind === 'or')
		return p.children.map((c: Predicate) => describePredicate(c, labels)).join(' ODER ');
	if (p?.kind === 'count_entities_where') {
		// Top-K pattern: child is compare_counters with $self vs fixed entityId, cmp gt|lt; outer cmp=lt
		if (
			p.child?.kind === 'compare_counters' &&
			(p.child.cmp === 'gt' || p.child.cmp === 'lt') &&
			p.child.left?.entityId === '$self' &&
			p.child.right?.entityId &&
			p.child.right.entityId !== '$self' &&
			p.cmp === 'lt'
		) {
			const tLabel = labels.trackableLabel(p.child.left.trackableId);
			const eLabel = labels.entityLabel(p.child.right.entityId);
			const verb = p.child.cmp === 'gt' ? 'mehr' : 'weniger';
			return `weniger als ${p.n} andere Entities haben ${verb} "${tLabel}" als ${eLabel}`;
		}
		// count_matching pattern: child is count with $self, cmp k
		if (p.child?.kind === 'count' && p.child.entityId === '$self') {
			const tLabel = labels.trackableLabel(p.child.trackableId);
			return `${cmpSymbol(p.cmp)} ${p.n} Entities haben "${tLabel}" ${cmpSymbol(p.child.cmp)} ${p.child.n}`;
		}
		return `Anzahl Entities mit (${describePredicate(p.child, labels)}) ${cmpSymbol(p.cmp)} ${p.n}`;
	}
	return '?';
}
