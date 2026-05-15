/**
 * @file sessions.switchMode.test.ts
 * Unit-level logic tests for the mode-switch guard conditions.
 * The actual DB transaction is in sessions.ts — these tests verify
 * the constraint logic (active-round check, entity replacement, config clearing)
 * using the same algorithm as switchSessionMode.
 * @implements REQ-MODE-015
 */
import { describe, expect, it } from 'vitest';

type RoundStatus = 'SETUP' | 'BETTING_OPEN' | 'LIVE' | 'RESOLVING' | 'SETTLED' | 'CANCELLED';
type SessionStatus = 'ACTIVE' | 'ENDED';

const TERMINAL: RoundStatus[] = ['SETTLED', 'CANCELLED'];

/** Replicates the guard logic in switchSessionMode. */
function canSwitchMode(
	sessionStatus: SessionStatus,
	roundStatuses: RoundStatus[]
): { ok: boolean; error?: string } {
	if (sessionStatus === 'ENDED') return { ok: false, error: 'SESSION_ENDED' };
	const active = roundStatuses.find((s) => !TERMINAL.includes(s));
	if (active) return { ok: false, error: 'ACTIVE_ROUND_EXISTS' };
	return { ok: true };
}

/** Entity replacement: old entities are deleted, new ones from the new mode. */
type Entity = { name: string; kind: string };
function replaceEntities(
	_oldEntities: Entity[],
	newModeEntities: Entity[]
): Entity[] {
	return newModeEntities.map((e) => ({ ...e }));
}

/** Config patching: entityOverrides are cleared. */
type Config = {
	startingMoney: number;
	drinkPrices: { SCHLUCK: number; KURZER: number; BIER_EXEN: number };
	entityOverrides?: Record<string, string>;
};
function patchConfigForModeSwitch(cfg: Config): Config {
	return { ...cfg, entityOverrides: {} };
}

describe('mode-switch guard: canSwitchMode', () => {
	it('allows switch when no rounds exist', () => {
		expect(canSwitchMode('ACTIVE', [])).toEqual({ ok: true });
	});

	it('allows switch when all rounds are SETTLED', () => {
		expect(canSwitchMode('ACTIVE', ['SETTLED', 'SETTLED'])).toEqual({ ok: true });
	});

	it('allows switch when all rounds are CANCELLED', () => {
		expect(canSwitchMode('ACTIVE', ['CANCELLED'])).toEqual({ ok: true });
	});

	it('allows switch with mix of SETTLED and CANCELLED', () => {
		expect(canSwitchMode('ACTIVE', ['SETTLED', 'CANCELLED', 'SETTLED'])).toEqual({ ok: true });
	});

	it('rejects switch when a SETUP round exists', () => {
		expect(canSwitchMode('ACTIVE', ['SETTLED', 'SETUP'])).toEqual({
			ok: false,
			error: 'ACTIVE_ROUND_EXISTS'
		});
	});

	it('rejects switch when a BETTING_OPEN round exists', () => {
		expect(canSwitchMode('ACTIVE', ['BETTING_OPEN'])).toEqual({
			ok: false,
			error: 'ACTIVE_ROUND_EXISTS'
		});
	});

	it('rejects switch when a LIVE round exists', () => {
		expect(canSwitchMode('ACTIVE', ['LIVE'])).toEqual({
			ok: false,
			error: 'ACTIVE_ROUND_EXISTS'
		});
	});

	it('rejects switch when a RESOLVING round exists', () => {
		expect(canSwitchMode('ACTIVE', ['RESOLVING'])).toEqual({
			ok: false,
			error: 'ACTIVE_ROUND_EXISTS'
		});
	});

	it('rejects switch for ENDED session', () => {
		expect(canSwitchMode('ENDED', [])).toEqual({
			ok: false,
			error: 'SESSION_ENDED'
		});
	});
});

describe('mode-switch entity replacement', () => {
	it('replaces old entities with new mode defaults', () => {
		const oldEntities = [
			{ name: 'Red Marble', kind: 'marble' },
			{ name: 'Blue Marble', kind: 'marble' }
		];
		const newEntities = [
			{ name: 'Alice', kind: 'player' },
			{ name: 'Bob', kind: 'player' },
			{ name: 'Charlie', kind: 'player' }
		];
		const result = replaceEntities(oldEntities, newEntities);
		expect(result).toEqual(newEntities);
		expect(result).toHaveLength(3);
	});

	it('handles empty new entities', () => {
		const oldEntities = [{ name: 'A', kind: 'marble' }];
		const result = replaceEntities(oldEntities, []);
		expect(result).toEqual([]);
	});
});

describe('mode-switch config patching', () => {
	it('clears entityOverrides on mode switch', () => {
		const cfg: Config = {
			startingMoney: 2000,
			drinkPrices: { SCHLUCK: 50, KURZER: 150, BIER_EXEN: 500 },
			entityOverrides: { 'Red Marble': 'Rote Murmel', 'Blue Marble': 'Blaue Murmel' }
		};
		const result = patchConfigForModeSwitch(cfg);
		expect(result.entityOverrides).toEqual({});
		expect(result.startingMoney).toBe(2000);
		expect(result.drinkPrices).toEqual({ SCHLUCK: 50, KURZER: 150, BIER_EXEN: 500 });
	});

	it('handles config without entityOverrides', () => {
		const cfg: Config = {
			startingMoney: 2000,
			drinkPrices: { SCHLUCK: 50, KURZER: 150, BIER_EXEN: 500 }
		};
		const result = patchConfigForModeSwitch(cfg);
		expect(result.entityOverrides).toEqual({});
	});
});
