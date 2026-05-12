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

import type { Predicate, MarketTemplate, Trackable, CounterExpr } from './server/db/schema';

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

/**
 * Live-preview text for a MarketTemplate (used in the Mode-Editor).
 * Produces 1-3 sample-outcome lines so the user can sanity-check the wager.
 */
export function describeTemplate(
	tpl: Partial<MarketTemplate> & { kind?: string },
	opts: {
		trackables: Pick<Trackable, 'id' | 'label'>[];
		/** Entity names known so far (mode default-entities). */
		entityNames: string[];
	}
): string[] {
	const tLabel =
		opts.trackables.find((t) => t.id === tpl.trackableId)?.label ?? tpl.trackableId ?? '?';
	const cmpWord = (c?: string) =>
		c === 'gte'
			? 'mindestens'
			: c === 'lte'
				? 'höchstens'
				: c === 'gt'
					? 'mehr als'
					: c === 'lt'
						? 'weniger als'
						: 'genau';

	if (tpl.kind === 'binary_count') {
		const t = tpl as Extract<MarketTemplate, { kind: 'binary_count' }>;
		if (t.entityScope === 'global') {
			return [`Ja/Nein: "${tLabel}" gesamt ${cmpWord(t.cmp)} ${t.n}`];
		}
		if (opts.entityNames.length === 0)
			return [`Ja/Nein-Wette pro Entity: "${tLabel}" ${cmpWord(t.cmp)} ${t.n}`];
		return opts.entityNames
			.slice(0, 3)
			.map((n) => `Ja/Nein: ${n} hat "${tLabel}" ${cmpWord(t.cmp)} ${t.n}`)
			.concat(
				opts.entityNames.length > 3 ? [`… +${opts.entityNames.length - 3} weitere Märkte`] : []
			);
	}
	if (tpl.kind === 'compare_entities') {
		const t = tpl as Extract<MarketTemplate, { kind: 'compare_entities' }>;
		const verb = t.direction === 'min' ? 'wenigsten' : 'meisten';
		const lines = [`Wer hat am ${verb} "${tLabel}"?`];
		if (opts.entityNames.length >= 2) {
			lines.push(`Outcomes: ${opts.entityNames.join(' / ')}`);
		}
		if (t.tieBehavior === 'tie_outcome') lines.push(`+ "Gleichstand" als Outcome`);
		else lines.push(`Bei Gleichstand → Einsätze zurück`);
		return lines;
	}
	if (tpl.kind === 'range_count') {
		const t = tpl as Extract<MarketTemplate, { kind: 'range_count' }>;
		const lo = Math.min(t.nMin, t.nMax);
		const hi = Math.max(t.nMin, t.nMax);
		if (t.entityScope === 'global')
			return [`Ja/Nein: "${tLabel}" gesamt zwischen ${lo} und ${hi}`];
		if (opts.entityNames.length === 0)
			return [`Ja/Nein pro Entity: "${tLabel}" zwischen ${lo} und ${hi}`];
		return opts.entityNames
			.slice(0, 3)
			.map((n) => `Ja/Nein: ${n} hat "${tLabel}" zwischen ${lo} und ${hi}`)
			.concat(
				opts.entityNames.length > 3 ? [`… +${opts.entityNames.length - 3} weitere Märkte`] : []
			);
	}
	if (tpl.kind === 'head_to_head') {
		const t = tpl as Extract<MarketTemplate, { kind: 'head_to_head' }>;
		const lines = [
			`Direkt-Duell: Wer hat mehr "${tLabel}", ${t.entityNameA || '?'} oder ${t.entityNameB || '?'}?`
		];
		if (t.tieBehavior === 'tie_outcome') lines.push(`+ "Gleichstand" als Outcome`);
		else lines.push(`Bei Gleichstand → Einsätze zurück`);
		return lines;
	}
	if (tpl.kind === 'top_k') {
		const t = tpl as Extract<MarketTemplate, { kind: 'top_k' }>;
		const verb = t.direction === 'min' ? 'Bottom' : 'Top';
		const lines = [`Wer landet in den ${verb}-${t.k} bei "${tLabel}"?`];
		if (opts.entityNames.length >= 2)
			lines.push(`Outcomes: ${opts.entityNames.join(' / ')} (${t.k} Gewinner pro Markt)`);
		lines.push(`Pot wird parimutuel auf alle ${t.k} Gewinner verteilt`);
		return lines;
	}
	if (tpl.kind === 'count_matching') {
		const t = tpl as Extract<MarketTemplate, { kind: 'count_matching' }>;
		const inner =
			t.perEntityCmp === 'gte'
				? `mindestens ${t.perEntityN}`
				: t.perEntityCmp === 'gt'
					? `mehr als ${t.perEntityN}`
					: t.perEntityCmp === 'eq'
						? `genau ${t.perEntityN}`
						: t.perEntityCmp === 'lt'
							? `weniger als ${t.perEntityN}`
							: `höchstens ${t.perEntityN}`;
		const outer =
			t.cmp === 'gte'
				? `mindestens ${t.k}`
				: t.cmp === 'gt'
					? `mehr als ${t.k}`
					: t.cmp === 'eq'
						? `genau ${t.k}`
						: t.cmp === 'lt'
							? `weniger als ${t.k}`
							: `höchstens ${t.k}`;
		return [
			`Ja/Nein: Haben ${outer} Entities ${inner} "${tLabel}"?`,
			`(Beispiel: ${opts.entityNames.slice(0, 3).join(', ') || '…'})`
		];
	}
	if (tpl.kind === 'team_total') {
		const t = tpl as Extract<MarketTemplate, { kind: 'team_total' }>;
		const word =
			t.cmp === 'gte'
				? `mindestens ${t.n}`
				: t.cmp === 'gt'
					? `mehr als ${t.n}`
					: t.cmp === 'eq'
						? `genau ${t.n}`
						: t.cmp === 'lt'
							? `weniger als ${t.n}`
							: `höchstens ${t.n}`;
		return [
			`Ja/Nein: Hat Team [${t.entityNames.join(', ')}] zusammen ${word} "${tLabel}"?`
		];
	}
	if (tpl.kind === 'spread') {
		const t = tpl as Extract<MarketTemplate, { kind: 'spread' }>;
		const word =
			t.cmp === 'gte'
				? `≥ ${t.n}`
				: t.cmp === 'gt'
					? `> ${t.n}`
					: t.cmp === 'eq'
						? `= ${t.n}`
						: t.cmp === 'lt'
							? `< ${t.n}`
							: `≤ ${t.n}`;
		return [
			`Ja/Nein: Ist (${t.entityNameA || '?'}.${tLabel} − ${t.entityNameB || '?'}.${tLabel}) ${word}?`
		];
	}
	if (tpl.kind === 'ordered_finish') {
		const t = tpl as Extract<MarketTemplate, { kind: 'ordered_finish' }>;
		const pos = t.position === 0 ? 'Letzter' : t.position === 1 ? '1.' : `${t.position}.`;
		const lines = [`Reihenfolge: Wer war als ${pos} "${tLabel}" eingetragen?`];
		if (opts.entityNames.length >= 2) {
			lines.push(`Outcomes: ${opts.entityNames.join(' / ')}`);
		}
		lines.push(`Settlement: Reihenfolge der ersten bestätigten Events (Duplikate ignoriert)`);
		return lines;
	}
	return ['(unvollständiges Template)'];
}
