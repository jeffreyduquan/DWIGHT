/**
 * @file modes/parseForm.ts — parse FormData → Mode payload (with validation).
 * Used by both /modes/new and /modes/[id] edit actions.
 */
import type {
	ConfirmationMode,
	DrinkType,
	MarketTemplate,
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
	marketTemplates: MarketTemplate[];
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
const CONFIRMATION_MODES: ConfirmationMode[] = ['GM', 'PEERS', 'EITHER'];
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
		: 'EITHER';

	const rebuyDrinkRaw = toStr(form.get('rebuyDrinkType'));
	const rebuyDrinkType: DrinkType = (DRINK_TYPES as string[]).includes(rebuyDrinkRaw)
		? (rebuyDrinkRaw as DrinkType)
		: 'BIER_EXEN';

	const defaultConfig: ModeDefaultConfig = {
		startingMoney: toInt(form.get('startingMoney'), 1000),
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
			amount: toInt(form.get('rebuyAmount'), 500)
		},
		autoLockOnDrink: form.get('autoLockOnDrink') === 'on',
		showOdds: form.get('showOdds') === 'on'
	};

	if (defaultConfig.startingMoney <= 0) {
		return { ok: false, error: 'Startgeld muss > 0 sein' };
	}
	if (defaultConfig.minStake < 1) {
		return { ok: false, error: 'Mindesteinsatz muss ≥ 1 sein' };
	}

	// Market templates: form has parallel arrays mtKind[], mtTitle[], mtTrackable[],
	// mtScope[] (binary only), mtCmp[] (binary only), mtN[] (binary only),
	// mtTieBehavior[] (compare only). Empty title rows are skipped.
	const mtKinds = form.getAll('mtKind').map(String);
	const mtTitles = form.getAll('mtTitle').map(String);
	const mtTracks = form.getAll('mtTrackable').map(String);
	const mtScopes = form.getAll('mtScope').map(String);
	const mtCmps = form.getAll('mtCmp').map(String);
	const mtNs = form.getAll('mtN').map(String);
	const mtTies = form.getAll('mtTieBehavior').map(String);
	const mtDirs = form.getAll('mtDirection').map(String);
	const mtNMins = form.getAll('mtNMin').map(String);
	const mtNMaxs = form.getAll('mtNMax').map(String);
	const mtEntA = form.getAll('mtEntityA').map(String);
	const mtEntB = form.getAll('mtEntityB').map(String);
	const mtKs = form.getAll('mtK').map(String);
	const mtPerEntityCmps = form.getAll('mtPerEntityCmp').map(String);
	const mtPerEntityNs = form.getAll('mtPerEntityN').map(String);
	const mtTeamNames = form.getAll('mtTeamNames').map(String);
	const trackableIds = new Set(trackables.map((t) => t.id));
	const trackableScopeMap = new Map(trackables.map((t) => [t.id, t.scope]));
	const marketTemplates: MarketTemplate[] = [];
	const VALID_CMP = ['gte', 'lte', 'eq', 'gt', 'lt'] as const;
	for (let i = 0; i < mtKinds.length; i++) {
		const title = mtTitles[i]?.trim() ?? '';
		const trackableId = mtTracks[i]?.trim() ?? '';
		if (!title || !trackableId) continue;
		if (!trackableIds.has(trackableId)) {
			return { ok: false, error: `Wetten-Template referenziert unbekanntes Trackable: ${trackableId}` };
		}
		const kind = mtKinds[i];
		const id = `mt_${i}_${Math.random().toString(36).slice(2, 8)}`;
		if (kind === 'binary_count') {
			const entityScope = mtScopes[i] === 'each' ? 'each' : 'global';
			if (entityScope === 'each' && trackableScopeMap.get(trackableId) !== 'entity') {
				return {
					ok: false,
					error: `Binär-Template "${title}" mit Scope 'each' braucht ein Entity-Trackable`
				};
			}
			const cmpRaw = mtCmps[i] ?? 'gte';
			const cmp = (VALID_CMP as readonly string[]).includes(cmpRaw)
				? (cmpRaw as (typeof VALID_CMP)[number])
				: 'gte';
			const n = toInt(mtNs[i] ?? null, 1);
			marketTemplates.push({
				kind: 'binary_count',
				id,
				title,
				trackableId,
				entityScope,
				cmp,
				n
			});
		} else if (kind === 'compare_entities') {
			if (trackableScopeMap.get(trackableId) !== 'entity') {
				return {
					ok: false,
					error: `Vergleichs-Template "${title}" braucht ein Entity-Trackable`
				};
			}
			const tieBehavior = mtTies[i] === 'void' ? 'void' : 'tie_outcome';
			const direction = mtDirs[i] === 'min' ? 'min' : 'max';
			marketTemplates.push({
				kind: 'compare_entities',
				id,
				title,
				trackableId,
				tieBehavior,
				direction
			});
		} else if (kind === 'range_count') {
			const entityScope = mtScopes[i] === 'each' ? 'each' : 'global';
			if (entityScope === 'each' && trackableScopeMap.get(trackableId) !== 'entity') {
				return {
					ok: false,
					error: `Range-Template "${title}" mit Scope 'each' braucht ein Entity-Trackable`
				};
			}
			const rawMin = toInt(mtNMins[i] ?? null, 0);
			const rawMax = toInt(mtNMaxs[i] ?? null, rawMin);
			const nMin = Math.min(rawMin, rawMax);
			const nMax = Math.max(rawMin, rawMax);
			marketTemplates.push({
				kind: 'range_count',
				id,
				title,
				trackableId,
				entityScope,
				nMin,
				nMax
			});
		} else if (kind === 'head_to_head') {
			if (trackableScopeMap.get(trackableId) !== 'entity') {
				return {
					ok: false,
					error: `Head-to-Head-Template "${title}" braucht ein Entity-Trackable`
				};
			}
			const entityNameA = (mtEntA[i] ?? '').trim();
			const entityNameB = (mtEntB[i] ?? '').trim();
			if (!entityNameA || !entityNameB) {
				return {
					ok: false,
					error: `Head-to-Head-Template "${title}" braucht beide Entity-Namen`
				};
			}
			if (entityNameA === entityNameB) {
				return {
					ok: false,
					error: `Head-to-Head-Template "${title}": Entities müssen unterschiedlich sein`
				};
			}
			const tieBehavior = mtTies[i] === 'void' ? 'void' : 'tie_outcome';
			marketTemplates.push({
				kind: 'head_to_head',
				id,
				title,
				trackableId,
				entityNameA,
				entityNameB,
				tieBehavior
			});
		} else if (kind === 'top_k') {
			if (trackableScopeMap.get(trackableId) !== 'entity') {
				return {
					ok: false,
					error: `Top-K-Template "${title}" braucht ein Entity-Trackable`
				};
			}
			const k = Math.max(1, toInt(mtKs[i] ?? null, 1));
			const direction = mtDirs[i] === 'min' ? 'min' : 'max';
			marketTemplates.push({
				kind: 'top_k',
				id,
				title,
				trackableId,
				k,
				direction
			});
		} else if (kind === 'count_matching') {
			if (trackableScopeMap.get(trackableId) !== 'entity') {
				return {
					ok: false,
					error: `Mind.-K-Template "${title}" braucht ein Entity-Trackable`
				};
			}
			const k = Math.max(1, toInt(mtKs[i] ?? null, 1));
			const cmpRawOuter = mtCmps[i] ?? 'gte';
			const cmpOuter = (VALID_CMP as readonly string[]).includes(cmpRawOuter)
				? (cmpRawOuter as (typeof VALID_CMP)[number])
				: 'gte';
			const cmpRawInner = mtPerEntityCmps[i] ?? 'gte';
			const perEntityCmp = (VALID_CMP as readonly string[]).includes(cmpRawInner)
				? (cmpRawInner as (typeof VALID_CMP)[number])
				: 'gte';
			const perEntityN = toInt(mtPerEntityNs[i] ?? null, 1);
			marketTemplates.push({
				kind: 'count_matching',
				id,
				title,
				trackableId,
				k,
				cmp: cmpOuter,
				perEntityCmp,
				perEntityN
			});
		} else if (kind === 'team_total') {
			if (trackableScopeMap.get(trackableId) !== 'entity') {
				return {
					ok: false,
					error: `Team-Total-Template "${title}" braucht ein Entity-Trackable`
				};
			}
			const raw = (mtTeamNames[i] ?? '').trim();
			const names = raw
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			if (names.length === 0) {
				return {
					ok: false,
					error: `Team-Total-Template "${title}" braucht mindestens einen Team-Namen`
				};
			}
			const cmpRaw = mtCmps[i] ?? 'gte';
			const cmp = (VALID_CMP as readonly string[]).includes(cmpRaw)
				? (cmpRaw as (typeof VALID_CMP)[number])
				: 'gte';
			const n = toInt(mtNs[i] ?? null, 1);
			marketTemplates.push({
				kind: 'team_total',
				id,
				title,
				trackableId,
				entityNames: names,
				cmp,
				n
			});
		} else if (kind === 'spread') {
			if (trackableScopeMap.get(trackableId) !== 'entity') {
				return {
					ok: false,
					error: `Spread-Template "${title}" braucht ein Entity-Trackable`
				};
			}
			const entityNameA = (mtEntA[i] ?? '').trim();
			const entityNameB = (mtEntB[i] ?? '').trim();
			if (!entityNameA || !entityNameB) {
				return {
					ok: false,
					error: `Spread-Template "${title}" braucht beide Entity-Namen`
				};
			}
			if (entityNameA === entityNameB) {
				return {
					ok: false,
					error: `Spread-Template "${title}": Entities müssen unterschiedlich sein`
				};
			}
			const cmpRaw = mtCmps[i] ?? 'gte';
			const cmp = (VALID_CMP as readonly string[]).includes(cmpRaw)
				? (cmpRaw as (typeof VALID_CMP)[number])
				: 'gte';
			const n = toInt(mtNs[i] ?? null, 0);
			marketTemplates.push({
				kind: 'spread',
				id,
				title,
				trackableId,
				entityNameA,
				entityNameB,
				cmp,
				n
			});
		} else if (kind === 'ordered_finish') {
			if (trackableScopeMap.get(trackableId) !== 'entity') {
				return {
					ok: false,
					error: `Reihenfolge-Template "${title}" braucht ein Entity-Trackable`
				};
			}
			const position = toInt(mtNs[i] ?? null, 1);
			marketTemplates.push({
				kind: 'ordered_finish',
				id,
				title,
				trackableId,
				position
			});
		}
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
			marketTemplates,
			defaultConfig
		}
	};
}
