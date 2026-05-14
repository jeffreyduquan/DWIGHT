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
