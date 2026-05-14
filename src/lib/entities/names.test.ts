/**
 * @file names.test.ts — entity-name override helpers.
 */
import { describe, expect, it } from 'vitest';
import { applyOverrides, applyOverridesToText, displayEntityName } from './names';

const cfg = { entityOverrides: { Mario: 'Klaus', Luigi: 'Hans' } };

describe('displayEntityName', () => {
	it('returns override when present', () => {
		expect(displayEntityName(cfg, 'Mario')).toBe('Klaus');
	});
	it('returns original when no override', () => {
		expect(displayEntityName(cfg, 'Peach')).toBe('Peach');
		expect(displayEntityName(null, 'Mario')).toBe('Mario');
	});
});

describe('applyOverrides (list)', () => {
	it('rewrites name field', () => {
		expect(applyOverrides(cfg, [{ name: 'Mario' }, { name: 'Peach' }])).toEqual([
			{ name: 'Klaus' },
			{ name: 'Peach' }
		]);
	});
});

describe('applyOverridesToText', () => {
	it('replaces standalone names', () => {
		expect(applyOverridesToText(cfg, 'Mario gewinnt')).toBe('Klaus gewinnt');
		expect(applyOverridesToText(cfg, 'Wer gewinnt: Mario oder Luigi?')).toBe(
			'Wer gewinnt: Klaus oder Hans?'
		);
	});
	it('does not replace inside larger words', () => {
		expect(applyOverridesToText(cfg, 'Marioland')).toBe('Marioland');
	});
	it('passes through when no overrides', () => {
		expect(applyOverridesToText(null, 'Mario gewinnt')).toBe('Mario gewinnt');
		expect(applyOverridesToText({}, 'Mario gewinnt')).toBe('Mario gewinnt');
	});
});
