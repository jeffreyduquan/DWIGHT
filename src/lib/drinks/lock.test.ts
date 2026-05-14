/**
 * @file lock.test.ts — Phase 11 lock-policy tests.
 */
import { describe, expect, it } from 'vitest';
import {
	effectiveLockMode,
	effectiveLockTimerSeconds,
	isLockedByDrinks,
	timerSecondsRemaining,
	DEFAULT_LOCK_TIMER_SECONDS
} from './lock';

const NOW = new Date('2025-01-01T12:00:00Z');
const SECS_AGO = (s: number) => new Date(NOW.getTime() - s * 1000);

describe('effectiveLockMode', () => {
	it('returns explicit lockMode when set', () => {
		expect(effectiveLockMode({ lockMode: 'LOCK' })).toBe('LOCK');
		expect(effectiveLockMode({ lockMode: 'NONE' })).toBe('NONE');
		expect(effectiveLockMode({ lockMode: 'TIMER_LOCK' })).toBe('TIMER_LOCK');
	});
	it('legacy autoLockOnDrink=false → NONE', () => {
		expect(effectiveLockMode({ autoLockOnDrink: false })).toBe('NONE');
	});
	it('default is TIMER_LOCK', () => {
		expect(effectiveLockMode({})).toBe('TIMER_LOCK');
		expect(effectiveLockMode({ autoLockOnDrink: true })).toBe('TIMER_LOCK');
	});
});

describe('effectiveLockTimerSeconds', () => {
	it('returns explicit value', () => {
		expect(effectiveLockTimerSeconds({ lockTimerSeconds: 120 })).toBe(120);
	});
	it('falls back to 600s default', () => {
		expect(effectiveLockTimerSeconds({})).toBe(DEFAULT_LOCK_TIMER_SECONDS);
		expect(effectiveLockTimerSeconds({ lockTimerSeconds: 0 })).toBe(DEFAULT_LOCK_TIMER_SECONDS);
	});
});

describe('isLockedByDrinks', () => {
	it('NONE never locks', () => {
		expect(isLockedByDrinks({ lockMode: 'NONE' }, [SECS_AGO(9999)], NOW)).toBe(false);
	});
	it('LOCK locks immediately when any pending drink exists', () => {
		expect(isLockedByDrinks({ lockMode: 'LOCK' }, [], NOW)).toBe(false);
		expect(isLockedByDrinks({ lockMode: 'LOCK' }, [SECS_AGO(5)], NOW)).toBe(true);
	});
	it('TIMER_LOCK only locks once timer elapsed', () => {
		const cfg = { lockMode: 'TIMER_LOCK' as const, lockTimerSeconds: 60 };
		expect(isLockedByDrinks(cfg, [SECS_AGO(30)], NOW)).toBe(false);
		expect(isLockedByDrinks(cfg, [SECS_AGO(60)], NOW)).toBe(true);
		expect(isLockedByDrinks(cfg, [SECS_AGO(120)], NOW)).toBe(true);
		expect(isLockedByDrinks(cfg, [], NOW)).toBe(false);
	});
});

describe('timerSecondsRemaining', () => {
	it('returns null outside TIMER_LOCK', () => {
		expect(timerSecondsRemaining({ lockMode: 'LOCK' }, [SECS_AGO(10)], NOW)).toBeNull();
		expect(timerSecondsRemaining({ lockMode: 'NONE' }, [SECS_AGO(10)], NOW)).toBeNull();
	});
	it('counts down based on the oldest pending drink (new drinks do not reset)', () => {
		const cfg = { lockMode: 'TIMER_LOCK' as const, lockTimerSeconds: 60 };
		expect(timerSecondsRemaining(cfg, [SECS_AGO(30), SECS_AGO(50)], NOW)).toBe(10);
		expect(timerSecondsRemaining(cfg, [SECS_AGO(60)], NOW)).toBe(0);
	});
});
