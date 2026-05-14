/**
 * @file lock.ts — shared lock-mode helpers (server + client).
 *
 * Translates `SessionConfig.lockMode` (+ legacy `autoLockOnDrink`) into a
 * concrete decision: should a player be considered "locked" right now?
 */
import type { LockMode, SessionConfig } from '../server/db/schema';

export const DEFAULT_LOCK_TIMER_SECONDS = 600;

/**
 * Resolve the effective lock mode from a session config, honouring the legacy
 * `autoLockOnDrink` field for sessions created before Phase 11.
 */
export function effectiveLockMode(config: Pick<SessionConfig, 'lockMode' | 'autoLockOnDrink'>): LockMode {
	if (config.lockMode) return config.lockMode;
	if (config.autoLockOnDrink === false) return 'NONE';
	return 'TIMER_LOCK';
}

export function effectiveLockTimerSeconds(
	config: Pick<SessionConfig, 'lockTimerSeconds'>
): number {
	const v = config.lockTimerSeconds;
	return typeof v === 'number' && v > 0 ? v : DEFAULT_LOCK_TIMER_SECONDS;
}

/**
 * Decide whether the player should be locked given a pending-drink list.
 * `LOCK`: any pending drink → locked.
 * `TIMER_LOCK`: any pending drink whose age >= lockTimerSeconds → locked.
 * `NONE`: never.
 */
export function isLockedByDrinks(
	config: Pick<SessionConfig, 'lockMode' | 'autoLockOnDrink' | 'lockTimerSeconds'>,
	pendingDrinkCreatedAts: Array<Date | string>,
	now: Date = new Date()
): boolean {
	const mode = effectiveLockMode(config);
	if (mode === 'NONE') return false;
	if (pendingDrinkCreatedAts.length === 0) return false;
	if (mode === 'LOCK') return true;
	const timerMs = effectiveLockTimerSeconds(config) * 1000;
	for (const t of pendingDrinkCreatedAts) {
		const created = typeof t === 'string' ? new Date(t) : t;
		if (now.getTime() - created.getTime() >= timerMs) return true;
	}
	return false;
}

/**
 * For UI: return the remaining seconds until the oldest pending drink expires.
 * Returns null if not in TIMER_LOCK or no pending drinks.
 */
export function timerSecondsRemaining(
	config: Pick<SessionConfig, 'lockMode' | 'autoLockOnDrink' | 'lockTimerSeconds'>,
	pendingDrinkCreatedAts: Array<Date | string>,
	now: Date = new Date()
): number | null {
	const mode = effectiveLockMode(config);
	if (mode !== 'TIMER_LOCK' || pendingDrinkCreatedAts.length === 0) return null;
	const timerMs = effectiveLockTimerSeconds(config) * 1000;
	let oldest = Infinity;
	for (const t of pendingDrinkCreatedAts) {
		const created = typeof t === 'string' ? new Date(t) : t;
		const age = now.getTime() - created.getTime();
		if (age < oldest) oldest = age;
	}
	if (!isFinite(oldest)) return null;
	return Math.max(0, Math.ceil((timerMs - oldest) / 1000));
}
