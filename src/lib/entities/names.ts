/**
 * @file entity-names.ts — apply per-session entity-name overrides.
 */
import type { SessionConfig } from '../server/db/schema';

export function displayEntityName(
	cfg: Pick<SessionConfig, 'entityOverrides'> | null | undefined,
	original: string
): string {
	const o = cfg?.entityOverrides?.[original];
	return o && o.trim().length > 0 ? o : original;
}

export function applyOverrides<T extends { name: string }>(
	cfg: Pick<SessionConfig, 'entityOverrides'> | null | undefined,
	items: T[]
): T[] {
	if (!cfg?.entityOverrides) return items;
	return items.map((it) => ({ ...it, name: displayEntityName(cfg, it.name) }));
}

/**
 * Substring-replace original entity names in arbitrary text (market titles,
 * outcome labels, etc.) so that GM session-level overrides also affect the
 * mode-compiled bet graphs. Longest-key first to avoid partial collisions.
 */
export function applyOverridesToText(
	cfg: Pick<SessionConfig, 'entityOverrides'> | null | undefined,
	text: string
): string {
	const map = cfg?.entityOverrides;
	if (!map) return text;
	const keys = Object.keys(map)
		.filter((k) => map[k] && map[k].trim().length > 0 && map[k] !== k)
		.sort((a, b) => b.length - a.length);
	let out = text;
	for (const k of keys) {
		// word-boundary-ish replace; avoid replacing inside larger identifiers.
		const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRe(k)}(?=$|[^\\p{L}\\p{N}_])`, 'gu');
		out = out.replace(re, (_m, pre) => `${pre}${map[k]}`);
	}
	return out;
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

