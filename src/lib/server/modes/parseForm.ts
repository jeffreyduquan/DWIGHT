/**
 * @file modes/parseForm.ts — parse FormData → Mode payload.
 * Phase 18a: slug column removed; description/terminology/defaultConfig kept
 * with hardcoded defaults so existing DB columns stay valid.
 */
import type {
	ModeDefaultConfig,
	ModeDefaultEntity,
	ModeTerminology,
	Trackable
} from '../db/schema';
import { freshModeDefaultConfig, slugifyTrackableId } from './defaults';

export type ParsedModeForm = {
	name: string;
	description: string;
	terminology: ModeTerminology;
	defaultEntities: ModeDefaultEntity[];
	trackables: Trackable[];
	defaultConfig: ModeDefaultConfig;
};

export type ParseResult = { ok: true; data: ParsedModeForm } | { ok: false; error: string };

function toStr(v: FormDataEntryValue | null): string {
	return v == null ? '' : String(v).trim();
}

const TRACKABLE_SCOPES = ['global', 'entity'] as const;

/**
 * Fixed terminology used as DB filler since Phase 17 (mode form no longer
 * exposes a terminology editor). UI now uses hardcoded German labels.
 */
export const DEFAULT_TERMINOLOGY: ModeTerminology = {
	round: 'Runde',
	entity: 'Spieler',
	startedVerb: 'läuft'
};

export function parseModeForm(form: FormData): ParseResult {
	const name = toStr(form.get('name'));
	if (name.length < 2 || name.length > 64) {
		return { ok: false, error: 'Name muss 2-64 Zeichen lang sein' };
	}

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

	return {
		ok: true,
		data: {
			name,
			description: '',
			terminology: { ...DEFAULT_TERMINOLOGY },
			defaultEntities,
			trackables,
			defaultConfig: freshModeDefaultConfig()
		}
	};
}
