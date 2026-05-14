/**
 * @file modes/parseForm.ts — parse FormData → Mode payload (with validation).
 * Used by both /modes/new and /modes/[id] edit actions.
 */
import type {
	ConfirmationMode,
	DrinkType,
	ModeDefaultConfig,
	ModeDefaultEntity,
	ModeTerminology,
	Trackable
} from '../db/schema';
import { slugify, slugifyTrackableId } from './defaults';

export type ParsedModeForm = {
	slug: string;
	name: string;
	description: string;
	terminology: ModeTerminology;
	defaultEntities: ModeDefaultEntity[];
	trackables: Trackable[];
	defaultConfig: ModeDefaultConfig;
};

export type ParseResult = { ok: true; data: ParsedModeForm } | { ok: false; error: string };

function toInt(v: FormDataEntryValue | null, fallback: number): number {
	if (v == null) return fallback;
	const n = Number(v);
	return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function toStr(v: FormDataEntryValue | null): string {
	return v == null ? '' : String(v).trim();
}

const DRINK_TYPES: DrinkType[] = ['SCHLUCK', 'KURZER', 'BIER_EXEN'];
const CONFIRMATION_MODES: ConfirmationMode[] = ['GM', 'PEERS'];
const LOCK_MODES = ['TIMER_LOCK', 'LOCK', 'NONE'] as const;
const TRACKABLE_SCOPES = ['global', 'entity'] as const;

export function parseModeForm(form: FormData): ParseResult {
	const name = toStr(form.get('name'));
	if (name.length < 2 || name.length > 64) {
		return { ok: false, error: 'Name muss 2-64 Zeichen lang sein' };
	}

	const slug = slugify(toStr(form.get('slug')) || name);
	if (slug.length < 2) return { ok: false, error: 'Slug ungültig' };

	const description = toStr(form.get('description')).slice(0, 500);

	const terminology: ModeTerminology = {
		round: toStr(form.get('term_round')) || 'Runde',
		entity: toStr(form.get('term_entity')) || 'Entität',
		startedVerb: toStr(form.get('term_startedVerb')) || 'läuft'
	};

	// Entities: form has entityName[], entityKind[], entityColor[], entityEmoji[]
	const names = form.getAll('entityName').map(String);
	const kinds = form.getAll('entityKind').map(String);
	const colors = form.getAll('entityColor').map(String);
	const emojis = form.getAll('entityEmoji').map(String);
	const defaultEntities: ModeDefaultEntity[] = [];
	for (let i = 0; i < names.length; i++) {
		const n = names[i]?.trim();
		if (!n) continue;
		defaultEntities.push({
			kind: kinds[i]?.trim() || 'entity',
			name: n,
			attributes: {
				color: colors[i]?.trim() || '#7c7c7c',
				emoji: emojis[i]?.trim() || ''
			}
		});
	}

	// Trackables: form has trackableLabel[], trackableScope[], trackableEmoji[], trackableColor[]
	const tLabels = form.getAll('trackableLabel').map(String);
	const tScopes = form.getAll('trackableScope').map(String);
	const tEmojis = form.getAll('trackableEmoji').map(String);
	const tColors = form.getAll('trackableColor').map(String);
	const trackables: Trackable[] = [];
	const seenIds = new Set<string>();
	for (let i = 0; i < tLabels.length; i++) {
		const label = tLabels[i]?.trim();
		if (!label) continue;
		const scopeRaw = tScopes[i]?.trim() || 'entity';
		const scope = (TRACKABLE_SCOPES as readonly string[]).includes(scopeRaw)
			? (scopeRaw as 'global' | 'entity')
			: 'entity';
		let id = slugifyTrackableId(label);
		if (!id) id = `t_${i}`;
		let dedup = id;
		let k = 2;
		while (seenIds.has(dedup)) dedup = `${id}_${k++}`;
		seenIds.add(dedup);
		trackables.push({
			id: dedup,
			label,
			scope,
			emoji: tEmojis[i]?.trim() || undefined,
			color: tColors[i]?.trim() || undefined
		});
	}

	const confirmationModeRaw = toStr(form.get('confirmationMode'));
	const confirmationMode: ConfirmationMode = (CONFIRMATION_MODES as string[]).includes(
		confirmationModeRaw
	)
		? (confirmationModeRaw as ConfirmationMode)
		: 'PEERS';

	const lockModeRaw = toStr(form.get('lockMode'));
	const lockMode = (LOCK_MODES as readonly string[]).includes(lockModeRaw)
		? (lockModeRaw as (typeof LOCK_MODES)[number])
		: 'TIMER_LOCK';
	const lockTimerSeconds = Math.max(30, toInt(form.get('lockTimerSeconds'), 600));

	const rebuyDrinkRaw = toStr(form.get('rebuyDrinkType'));
	const rebuyDrinkType: DrinkType = (DRINK_TYPES as string[]).includes(rebuyDrinkRaw)
		? (rebuyDrinkRaw as DrinkType)
		: 'BIER_EXEN';

	const defaultConfig: ModeDefaultConfig = {
		startingMoney: toInt(form.get('startingMoney'), 2000),
		minStake: toInt(form.get('minStake'), 10),
		drinkPrices: {
			SCHLUCK: toInt(form.get('priceSchluck'), 50),
			KURZER: toInt(form.get('priceKurzer'), 150),
			BIER_EXEN: toInt(form.get('priceBier'), 500)
		},
		confirmationMode,
		peerConfirmationsRequired: toInt(form.get('peerConfirmationsRequired'), 2),
		forceDrinkTypesAllowed: ['SCHLUCK', 'KURZER', 'BIER_EXEN'],
		rebuy: {
			enabled: form.get('rebuyEnabled') === 'on',
			drinkType: rebuyDrinkType,
			amount: toInt(form.get('rebuyAmount'), 1500)
		},
		lockMode,
		lockTimerSeconds,
		showOdds: form.get('showOdds') === 'on',
		maxStakePctOfStart: Math.max(1, Math.min(100, toInt(form.get('maxStakePctOfStart'), 50)))
	};

	if (defaultConfig.startingMoney <= 0) {
		return { ok: false, error: 'Startgeld muss > 0 sein' };
	}
	if (defaultConfig.minStake < 1) {
		return { ok: false, error: 'Mindesteinsatz muss ≥ 1 sein' };
	}

	return {
		ok: true,
		data: {
			slug,
			name,
			description,
			terminology,
			defaultEntities,
			trackables,
			defaultConfig
		}
	};
}
