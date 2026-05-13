/**
 * @file predicate.test.ts — predicate evaluator tests.
 * @implements REQ-TEST-001
 */
import { describe, expect, it } from 'vitest';
import type { Predicate } from '../db/schema';
import { evalCounterExpr, evalPredicate, negate, validatePredicate } from './predicate';

describe('evalPredicate — count leaf', () => {
	const snap = { foul: 5, 'foul:e1': 3, 'foul:e2': 0, overtake: 2 };

	it('global gte', () => {
		expect(
			evalPredicate({ kind: 'count', trackableId: 'foul', entityId: null, cmp: 'gte', n: 5 }, snap)
		).toBe(true);
		expect(
			evalPredicate({ kind: 'count', trackableId: 'foul', entityId: null, cmp: 'gte', n: 6 }, snap)
		).toBe(false);
	});

	it('entity gte', () => {
		expect(
			evalPredicate({ kind: 'count', trackableId: 'foul', entityId: 'e1', cmp: 'gte', n: 3 }, snap)
		).toBe(true);
		expect(
			evalPredicate({ kind: 'count', trackableId: 'foul', entityId: 'e2', cmp: 'gte', n: 1 }, snap)
		).toBe(false);
	});

	it('missing key counts as 0', () => {
		expect(
			evalPredicate({ kind: 'count', trackableId: 'nope', entityId: null, cmp: 'eq', n: 0 }, snap)
		).toBe(true);
	});

	it('lte and eq', () => {
		expect(
			evalPredicate({ kind: 'count', trackableId: 'overtake', entityId: null, cmp: 'lte', n: 2 }, snap)
		).toBe(true);
		expect(
			evalPredicate({ kind: 'count', trackableId: 'overtake', entityId: null, cmp: 'eq', n: 2 }, snap)
		).toBe(true);
		expect(
			evalPredicate({ kind: 'count', trackableId: 'overtake', entityId: null, cmp: 'eq', n: 3 }, snap)
		).toBe(false);
	});
});

describe('evalPredicate — combinators', () => {
	const snap = { a: 3, b: 1 };
	const aGte3: Predicate = { kind: 'count', trackableId: 'a', entityId: null, cmp: 'gte', n: 3 };
	const bGte2: Predicate = { kind: 'count', trackableId: 'b', entityId: null, cmp: 'gte', n: 2 };

	it('and', () => {
		expect(evalPredicate({ kind: 'and', children: [aGte3, bGte2] }, snap)).toBe(false);
		expect(evalPredicate({ kind: 'and', children: [aGte3, aGte3] }, snap)).toBe(true);
	});

	it('or', () => {
		expect(evalPredicate({ kind: 'or', children: [aGte3, bGte2] }, snap)).toBe(true);
		expect(evalPredicate({ kind: 'or', children: [bGte2, bGte2] }, snap)).toBe(false);
	});

	it('not', () => {
		expect(evalPredicate({ kind: 'not', child: aGte3 }, snap)).toBe(false);
		expect(evalPredicate(negate(aGte3), snap)).toBe(false);
		expect(evalPredicate({ kind: 'not', child: bGte2 }, snap)).toBe(true);
	});

	it('nested AND/OR/NOT', () => {
		// (a≥3 AND NOT b≥2) OR (b≥5)
		const nested: Predicate = {
			kind: 'or',
			children: [
				{ kind: 'and', children: [aGte3, { kind: 'not', child: bGte2 }] },
				{ kind: 'count', trackableId: 'b', entityId: null, cmp: 'gte', n: 5 }
			]
		};
		expect(evalPredicate(nested, snap)).toBe(true);
	});
});

describe('validatePredicate', () => {
	const tracks = new Map<string, 'global' | 'entity'>([
		['foul', 'entity'],
		['overtake', 'global']
	]);
	const ents = new Set(['e1', 'e2']);

	it('accepts valid entity-scope predicate', () => {
		expect(
			validatePredicate(
				{ kind: 'count', trackableId: 'foul', entityId: 'e1', cmp: 'gte', n: 3 },
				tracks,
				ents
			)
		).toBeNull();
	});

	it('rejects unknown trackable', () => {
		const err = validatePredicate(
			{ kind: 'count', trackableId: 'ghost', entityId: null, cmp: 'gte', n: 1 },
			tracks,
			ents
		);
		expect(err).toContain('Unknown trackable');
	});

	it('rejects entity scope without entityId', () => {
		const err = validatePredicate(
			{ kind: 'count', trackableId: 'foul', entityId: null, cmp: 'gte', n: 1 },
			tracks,
			ents
		);
		expect(err).toMatch(/requires entityId/);
	});

	it('rejects global scope with entityId', () => {
		const err = validatePredicate(
			{ kind: 'count', trackableId: 'overtake', entityId: 'e1', cmp: 'gte', n: 1 },
			tracks,
			ents
		);
		expect(err).toMatch(/global, entityId must be null/);
	});

	it('rejects empty AND', () => {
		const err = validatePredicate({ kind: 'and', children: [] }, tracks, ents);
		expect(err).toMatch(/at least one child/);
	});

	it('rejects unknown entity', () => {
		const err = validatePredicate(
			{ kind: 'count', trackableId: 'foul', entityId: 'eX', cmp: 'gte', n: 1 },
			tracks,
			ents
		);
		expect(err).toMatch(/Unknown entity/);
	});
});

describe('evalPredicate — count gt / lt', () => {
	const snap = { a: 3 };
	it('gt strict', () => {
		expect(
			evalPredicate({ kind: 'count', trackableId: 'a', entityId: null, cmp: 'gt', n: 2 }, snap)
		).toBe(true);
		expect(
			evalPredicate({ kind: 'count', trackableId: 'a', entityId: null, cmp: 'gt', n: 3 }, snap)
		).toBe(false);
	});
	it('lt strict', () => {
		expect(
			evalPredicate({ kind: 'count', trackableId: 'a', entityId: null, cmp: 'lt', n: 4 }, snap)
		).toBe(true);
		expect(
			evalPredicate({ kind: 'count', trackableId: 'a', entityId: null, cmp: 'lt', n: 3 }, snap)
		).toBe(false);
	});
});

describe('evalPredicate — compare_counters', () => {
	const snap = { 'goal:jonas': 2, 'goal:marco': 2, 'goal:lukas': 1, 'foul:jonas': 5 };

	it('gt: jonas > lukas (goal)', () => {
		expect(
			evalPredicate(
				{
					kind: 'compare_counters',
					left: { trackableId: 'goal', entityId: 'jonas' },
					right: { trackableId: 'goal', entityId: 'lukas' },
					cmp: 'gt'
				},
				snap
			)
		).toBe(true);
	});

	it('gt: jonas vs marco is tie -> false (strict)', () => {
		expect(
			evalPredicate(
				{
					kind: 'compare_counters',
					left: { trackableId: 'goal', entityId: 'jonas' },
					right: { trackableId: 'goal', entityId: 'marco' },
					cmp: 'gt'
				},
				snap
			)
		).toBe(false);
	});

	it('eq: tie detection', () => {
		expect(
			evalPredicate(
				{
					kind: 'compare_counters',
					left: { trackableId: 'goal', entityId: 'jonas' },
					right: { trackableId: 'goal', entityId: 'marco' },
					cmp: 'eq'
				},
				snap
			)
		).toBe(true);
	});

	it('cross-trackable: foul(jonas) > goal(lukas)', () => {
		expect(
			evalPredicate(
				{
					kind: 'compare_counters',
					left: { trackableId: 'foul', entityId: 'jonas' },
					right: { trackableId: 'goal', entityId: 'lukas' },
					cmp: 'gt'
				},
				snap
			)
		).toBe(true);
	});

	it('validate: ok with valid entities', () => {
		const tracks = new Map<string, 'global' | 'entity'>([['goal', 'entity']]);
		const ents = new Set(['jonas', 'marco']);
		const err = validatePredicate(
			{
				kind: 'compare_counters',
				left: { trackableId: 'goal', entityId: 'jonas' },
				right: { trackableId: 'goal', entityId: 'marco' },
				cmp: 'gt'
			},
			tracks,
			ents
		);
		expect(err).toBeNull();
	});

	it('validate: rejects unknown entity on either side', () => {
		const tracks = new Map<string, 'global' | 'entity'>([['goal', 'entity']]);
		const ents = new Set(['jonas']);
		const err = validatePredicate(
			{
				kind: 'compare_counters',
				left: { trackableId: 'goal', entityId: 'jonas' },
				right: { trackableId: 'goal', entityId: 'ghost' },
				cmp: 'gt'
			},
			tracks,
			ents
		);
		expect(err).toMatch(/Unknown entity/);
	});
});


describe('evalPredicate -- count_entities_where', () => {
	const snap = { 'goal:a': 3, 'goal:b': 1, 'goal:c': 2 };

	it('Top-1: only one entity has more goals than reference', () => {
		// counts entities whose goal > a; should be 0 -> lt 1 = true (so 'a' is top-1)
		const pred: Predicate = { kind: 'count_entities_where', candidates: ['b','c'], child: { kind: 'compare_counters', left: { trackableId:'goal', entityId:'$self' }, right: { trackableId:'goal', entityId:'a' }, cmp:'gt' }, cmp:'lt', n:1 };
		expect(evalPredicate(pred, snap)).toBe(true);
	});

	it('count_matching: at least 2 entities have >= 2 goals', () => {
		const pred: Predicate = { kind: 'count_entities_where', candidates: ['a','b','c'], child: { kind: 'count', trackableId:'goal', entityId:'$self', cmp:'gte', n:2 }, cmp:'gte', n:2 };
		expect(evalPredicate(pred, snap)).toBe(true);
	});

	it('validate: allows $self only inside count_entities_where', () => {
		const tracks = new Map<string, 'global' | 'entity'>([['goal','entity']]);
		const ents = new Set(['a','b']);
		const bad: Predicate = { kind:'count', trackableId:'goal', entityId:'$self', cmp:'gte', n:1 };
		expect(validatePredicate(bad, tracks, ents)).toMatch(/self/i);
		const good: Predicate = { kind: 'count_entities_where', candidates: ['a','b'], child: bad, cmp:'gte', n:1 };
		expect(validatePredicate(good, tracks, ents)).toBeNull();
	});
});


describe('evalCounterExpr -- arithmetic', () => {
	const snap = { 'goal:a': 3, 'goal:b': 5, 'goal:c': 2, 'foul': 7 };

	it('sum of refs', () => {
		const e = { kind:'sum' as const, operands: [ { kind:'ref' as const, trackableId:'goal', entityId:'a' }, { kind:'ref' as const, trackableId:'goal', entityId:'b' } ] };
		expect(evalCounterExpr(e, snap)).toBe(8);
	});

	it('diff left-to-right', () => {
		const e = { kind:'diff' as const, operands: [ { kind:'ref' as const, trackableId:'goal', entityId:'b' }, { kind:'ref' as const, trackableId:'goal', entityId:'a' }, { kind:'const' as const, value: 1 } ] };
		expect(evalCounterExpr(e, snap)).toBe(1);
	});

	it('div by zero -> 0', () => {
		const e = { kind:'div' as const, operands: [ { kind:'ref' as const, trackableId:'foul', entityId:null }, { kind:'const' as const, value: 0 } ] };
		expect(evalCounterExpr(e, snap)).toBe(0);
	});

	it('legacy ref shape (no kind) works in compare_counters', () => {
		const pred: Predicate = { kind:'compare_counters', left: { trackableId:'goal', entityId:'b' } as any, right: { trackableId:'goal', entityId:'a' } as any, cmp:'gt' };
		expect(evalPredicate(pred, snap)).toBe(true);
	});

	it('spread expr in compare_counters', () => {
		const pred: Predicate = { kind:'compare_counters', left: { kind:'diff', operands:[ { kind:'ref', trackableId:'goal', entityId:'b' }, { kind:'ref', trackableId:'goal', entityId:'a' } ] }, right: { kind:'const', value: 1 }, cmp:'gte' };
		expect(evalPredicate(pred, snap)).toBe(true);
	});
});

describe('evalPredicate -- timestamp_compare', () => {
	// firstAt key format: `firstAt:<trackableId>:<entityId|''>`
	const snap = {
		'firstAt:goal:a': 30,
		'firstAt:goal:b': 90,
		'firstAt:foul:': 60
	};

	it('A scores before B', () => {
		const pred: Predicate = {
			kind: 'timestamp_compare',
			left: { kind: 'first_occurrence', trackableId: 'goal', entityId: 'a' },
			right: { kind: 'first_occurrence', trackableId: 'goal', entityId: 'b' },
			cmp: 'lt'
		};
		expect(evalPredicate(pred, snap)).toBe(true);
	});

	it('first foul within 120s (const_seconds)', () => {
		const pred: Predicate = {
			kind: 'timestamp_compare',
			left: { kind: 'first_occurrence', trackableId: 'foul', entityId: null },
			right: { kind: 'const_seconds', value: 120 },
			cmp: 'lte'
		};
		expect(evalPredicate(pred, snap)).toBe(true);
	});

	it('missing event -> predicate is false (never satisfied)', () => {
		const pred: Predicate = {
			kind: 'timestamp_compare',
			left: { kind: 'first_occurrence', trackableId: 'goal', entityId: 'c' },
			right: { kind: 'const_seconds', value: 999 },
			cmp: 'lt'
		};
		expect(evalPredicate(pred, snap)).toBe(false);
	});
});
