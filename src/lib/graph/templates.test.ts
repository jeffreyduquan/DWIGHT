/**
 * @file graph/templates.test.ts -- Smoke tests for all Graph 2.0 templates.
 * Each template must:
 *  - produce a structurally valid graph (validator)
 *  - compile to a runtime market (compiler)
 */
import { describe, it, expect } from 'vitest';
import { TEMPLATES, buildGraph, type TemplateId } from './templates';
import { validateGraph } from './validate';
import { compileGraph } from './compile';

const CTX = {
	entities: [
		{ id: 'e1', name: 'Mario' },
		{ id: 'e2', name: 'Luigi' },
		{ id: 'e3', name: 'Peach' }
	],
	trackables: [{ id: 'goal', label: 'Tor', scope: 'entity' as const }]
};

const BASE = {
	trackable: 'goal',
	entity: 'Mario',
	threshold: 3,
	topK: 2,
	seconds: 60
};

const LABELS = { trackable: 'Tor', entity: 'Mario' };

const ALL_IDS: TemplateId[] = TEMPLATES.map((t) => t.id);

describe('bet-graph templates', () => {
	it('lists exactly the 7 expected templates', () => {
		expect(ALL_IDS.sort()).toEqual(
			['champion', 'loser', 'podium', 'race', 'race_vs_time', 'will_happen', 'will_player'].sort()
		);
	});

	for (const id of ALL_IDS) {
		it(`${id}: builds, validates, compiles`, () => {
			const res = buildGraph(id, BASE, LABELS);
			expect(res.ok, JSON.stringify(res)).toBe(true);
			if (!res.ok) return;
			expect(res.graph.version).toBe(2);
			expect(res.graph.grid).toBeDefined();
			for (const n of res.graph.nodes) {
				expect(n.pos).toBeDefined();
			}
			const v = validateGraph(res.graph);
			expect(v.ok, JSON.stringify(v.errors)).toBe(true);
			const c = compileGraph(res.graph, CTX);
			expect(c.ok, !c.ok ? c.error : '').toBe(true);
		});
	}
});
