/**
 * @file modes/defaults.ts — sane factory for new Mode default config + utilities.
 */
import type { ModeDefaultConfig, Trackable } from '../db/schema';

export function freshModeDefaultConfig(): ModeDefaultConfig {
	return {
		startingMoney: 1000,
		minStake: 10,
		drinkPrices: { SCHLUCK: 50, KURZER: 150, BIER_EXEN: 500 },
		confirmationMode: 'PEERS',
		peerConfirmationsRequired: 1,
		forceDrinkTypesAllowed: ['SCHLUCK', 'KURZER', 'BIER_EXEN'],
		rebuy: {
			enabled: true,
			drinkType: 'BIER_EXEN',
			amount: 1500
		},
		lockMode: 'TIMER_LOCK',
		lockTimerSeconds: 600,
		showOdds: true,
		entityOverrides: {}
	};
}

export function freshTrackables(): Trackable[] {
	return [];
}

/** Convert a name into a URL-safe slug fragment. */
export function slugify(input: string): string {
	return input
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
}

/** Slugify a trackable id input. Same rules as mode slug but allows shorter results. */
export function slugifyTrackableId(input: string): string {
	return input
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 32);
}
