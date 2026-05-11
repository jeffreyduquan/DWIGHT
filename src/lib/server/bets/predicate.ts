/**
 * @file predicate.ts — pure boolean predicate evaluator over round counters.
 *
 * @implements REQ-TRACK-003, REQ-TRACK-004, REQ-BET-003
 */
import type { CounterExpr, Predicate } from '../db/schema';

/**
 * Counter snapshot for one round.
 * Key format:
 *   - global counter:  `<trackableId>`
 *   - entity counter:  `<trackableId>:<entityId>`
 * Missing keys are treated as 0.
 */
export type CounterSnapshot = Readonly<Record<string, number>>;

export function counterKey(trackableId: string, entityId: string | null): string {
	return entityId == null ? trackableId : `${trackableId}:${entityId}`;
}

export function getCount(snap: CounterSnapshot, trackableId: string, entityId: string | null): number {
	return snap[counterKey(trackableId, entityId)] ?? 0;
}

/**
 * Evaluate a CounterExpr arithmetic tree against a counter snapshot.
 * Accepts legacy `{ trackableId, entityId }` refs without a `kind` field
 * (treated as `kind:'ref'`).
 */
export function evalCounterExpr(
	expr: CounterExpr | { trackableId: string; entityId: string | null },
	snap: CounterSnapshot
): number {
	// Legacy refs without kind
	if (!('kind' in expr) || expr.kind === 'ref') {
		const e = expr as { trackableId: string; entityId: string | null };
		return getCount(snap, e.trackableId, e.entityId);
	}
	switch (expr.kind) {
		case 'const':
			return expr.value;
		case 'sum':
			return expr.operands.reduce((acc, o) => acc + evalCounterExpr(o, snap), 0);
		case 'diff': {
			if (expr.operands.length === 0) return 0;
			const [first, ...rest] = expr.operands;
			return rest.reduce((acc, o) => acc - evalCounterExpr(o, snap), evalCounterExpr(first, snap));
		}
		case 'mul':
			return expr.operands.reduce((acc, o) => acc * evalCounterExpr(o, snap), 1);
		case 'div': {
			if (expr.operands.length === 0) return 0;
			const [first, ...rest] = expr.operands;
			let acc = evalCounterExpr(first, snap);
			for (const o of rest) {
				const d = evalCounterExpr(o, snap);
				acc = d === 0 ? 0 : Math.trunc(acc / d);
			}
			return acc;
		}
	}
}

/** Evaluate a Predicate AST against a counter snapshot. */
export function evalPredicate(pred: Predicate, snap: CounterSnapshot): boolean {
	switch (pred.kind) {
		case 'count': {
			const v = getCount(snap, pred.trackableId, pred.entityId);
			return cmpInt(v, pred.cmp, pred.n);
		}
		case 'compare_counters': {
			const l = evalCounterExpr(pred.left, snap);
			const r = evalCounterExpr(pred.right, snap);
			return cmpInt(l, pred.cmp, r);
		}
		case 'and':
			return pred.children.every((c) => evalPredicate(c, snap));
		case 'or':
			return pred.children.some((c) => evalPredicate(c, snap));
		case 'not':
			return !evalPredicate(pred.child, snap);
		case 'count_entities_where': {
			let matches = 0;
			for (const eid of pred.candidates) {
				const bound = bindSelf(pred.child, eid);
				if (evalPredicate(bound, snap)) matches++;
			}
			return cmpInt(matches, pred.cmp, pred.n);
		}
	}
}

/**
 * Replace the sentinel entityId '$self' in a predicate template with `eid`.
 * Used for per-entity expansion inside count_entities_where.
 */
export function bindSelf(pred: Predicate, eid: string): Predicate {
	switch (pred.kind) {
		case 'count':
			return pred.entityId === '$self' ? { ...pred, entityId: eid } : pred;
		case 'compare_counters':
			return {
				...pred,
				left: bindSelfExpr(pred.left, eid),
				right: bindSelfExpr(pred.right, eid)
			};
		case 'and':
			return { kind: 'and', children: pred.children.map((c) => bindSelf(c, eid)) };
		case 'or':
			return { kind: 'or', children: pred.children.map((c) => bindSelf(c, eid)) };
		case 'not':
			return { kind: 'not', child: bindSelf(pred.child, eid) };
		case 'count_entities_where':
			// Nested count_entities_where keeps its own $self scope — do not rewrite.
			return pred;
	}
}

/** Bind `$self` inside a CounterExpr (or legacy ref shape). */
export function bindSelfExpr(
	expr: CounterExpr | { trackableId: string; entityId: string | null },
	eid: string
): CounterExpr | { trackableId: string; entityId: string | null } {
	if (!('kind' in expr) || expr.kind === 'ref') {
		const e = expr as { trackableId: string; entityId: string | null } & { kind?: 'ref' };
		return e.entityId === '$self' ? { ...e, entityId: eid } : e;
	}
	switch (expr.kind) {
		case 'const':
			return expr;
		case 'sum':
		case 'diff':
		case 'mul':
		case 'div':
			return {
				kind: expr.kind,
				operands: expr.operands.map((o) => bindSelfExpr(o, eid) as CounterExpr)
			};
	}
}

function cmpInt(a: number, cmp: 'gte' | 'lte' | 'eq' | 'gt' | 'lt', b: number): boolean {
	switch (cmp) {
		case 'gte':
			return a >= b;
		case 'lte':
			return a <= b;
		case 'eq':
			return a === b;
		case 'gt':
			return a > b;
		case 'lt':
			return a < b;
	}
}

/** Negate a predicate (used to auto-generate JA/NEIN counter outcomes). */
export function negate(pred: Predicate): Predicate {
	return { kind: 'not', child: pred };
}

/** Validate predicate shape and trackable references. Returns null if valid, error string otherwise. */
export function validatePredicate(
	pred: Predicate,
	validTrackables: ReadonlyMap<string, 'global' | 'entity'>,
	validEntities: ReadonlySet<string>,
	allowSelf: boolean = false
): string | null {
	const VALID_CMP = ['gte', 'lte', 'eq', 'gt', 'lt'];
	switch (pred.kind) {
		case 'count': {
			const err = checkCounterRef(
				pred.trackableId,
				pred.entityId,
				validTrackables,
				validEntities,
				allowSelf
			);
			if (err) return err;
			if (!Number.isInteger(pred.n)) return `Predicate n must be integer`;
			if (!VALID_CMP.includes(pred.cmp)) return `Invalid cmp: ${pred.cmp}`;
			return null;
		}
		case 'compare_counters': {
			const l = validateCounterExpr(pred.left, validTrackables, validEntities, allowSelf);
			if (l) return l;
			const r = validateCounterExpr(pred.right, validTrackables, validEntities, allowSelf);
			if (r) return r;
			if (!VALID_CMP.includes(pred.cmp)) return `Invalid cmp: ${pred.cmp}`;
			return null;
		}
		case 'and':
		case 'or': {
			if (!Array.isArray(pred.children) || pred.children.length === 0) {
				return `${pred.kind} requires at least one child`;
			}
			for (const c of pred.children) {
				const e = validatePredicate(c, validTrackables, validEntities, allowSelf);
				if (e) return e;
			}
			return null;
		}
		case 'not':
			return validatePredicate(pred.child, validTrackables, validEntities, allowSelf);
		case 'count_entities_where': {
			if (!Array.isArray(pred.candidates) || pred.candidates.length === 0)
				return `count_entities_where requires at least one candidate`;
			for (const c of pred.candidates) {
				if (!validEntities.has(c)) return `Unknown candidate entity: ${c}`;
			}
			if (!Number.isInteger(pred.n)) return `Predicate n must be integer`;
			if (!VALID_CMP.includes(pred.cmp)) return `Invalid cmp: ${pred.cmp}`;
			// Inside child: '$self' is permitted as entity placeholder.
			return validatePredicate(pred.child, validTrackables, validEntities, true);
		}
	}
}

function checkCounterRef(
	trackableId: string,
	entityId: string | null,
	validTrackables: ReadonlyMap<string, 'global' | 'entity'>,
	validEntities: ReadonlySet<string>,
	allowSelf: boolean
): string | null {
	const scope = validTrackables.get(trackableId);
	if (!scope) return `Unknown trackable: ${trackableId}`;
	if (scope === 'global' && entityId != null) {
		return `Trackable ${trackableId} is global, entityId must be null`;
	}
	if (scope === 'entity') {
		if (entityId == null) return `Trackable ${trackableId} requires entityId`;
		if (entityId === '$self') {
			if (!allowSelf) return `'$self' placeholder only allowed inside count_entities_where`;
			return null;
		}
		if (!validEntities.has(entityId)) return `Unknown entity in predicate: ${entityId}`;
	}
	return null;
}

/** Validate a CounterExpr tree (accepts legacy ref shape without `kind`). */
function validateCounterExpr(
	expr: CounterExpr | { trackableId: string; entityId: string | null },
	validTrackables: ReadonlyMap<string, 'global' | 'entity'>,
	validEntities: ReadonlySet<string>,
	allowSelf: boolean
): string | null {
	if (!('kind' in expr) || (expr as { kind?: string }).kind === 'ref') {
		const e = expr as { trackableId: string; entityId: string | null };
		return checkCounterRef(e.trackableId, e.entityId, validTrackables, validEntities, allowSelf);
	}
	const ex = expr as CounterExpr;
	switch (ex.kind) {
		case 'const':
			if (!Number.isFinite(ex.value)) return `CounterExpr const must be finite`;
			return null;
		case 'sum':
		case 'diff':
		case 'mul':
		case 'div': {
			if (!Array.isArray(ex.operands) || ex.operands.length === 0)
				return `CounterExpr ${ex.kind} requires at least one operand`;
			for (const o of ex.operands) {
				const e = validateCounterExpr(o, validTrackables, validEntities, allowSelf);
				if (e) return e;
			}
			return null;
		}
		case 'ref':
			// Already handled above; defensive
			return null;
	}
}
