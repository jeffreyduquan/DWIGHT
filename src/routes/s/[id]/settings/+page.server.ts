/**
 * @file s/[id]/settings/+page.server.ts — GM-only session settings editor.
 * @implements REQ-SESS-CONFIG-001, REQ-UI-013
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findById, getPlayer, updateSessionConfig } from '$lib/server/repos/sessions';
import { listForSession as listEntities } from '$lib/server/repos/entities';
import type { ConfirmationMode, DrinkType, LockMode } from '$lib/server/db/schema';

const CONFIRMATION_MODES = ['GM', 'PEERS'] as const;
const LOCK_MODES = ['TIMER_LOCK', 'LOCK', 'NONE'] as const;
const DRINK_TYPES: DrinkType[] = ['SCHLUCK', 'KURZER', 'BIER_EXEN'];

function toInt(v: FormDataEntryValue | null, fallback: number): number {
	const n = Number(v);
	return Number.isFinite(n) ? Math.floor(n) : fallback;
}
function toStr(v: FormDataEntryValue | null): string {
	return typeof v === 'string' ? v.trim() : '';
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');
	const session = await findById(params.id);
	if (!session) throw error(404, 'Session nicht gefunden');
	const me = await getPlayer(session.id, locals.user.id);
	if (!me) throw error(403, 'Nicht in der Session');
	if (me.role !== 'HOST') throw error(403, 'Nur der GM darf Einstellungen ändern');

	const entities = await listEntities(session.id);
	return {
		session: {
			id: session.id,
			name: session.name,
			inviteCode: session.inviteCode,
			config: session.config
		},
		entities: entities.map((e) => ({ id: e.id, name: e.name }))
	};
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const session = await findById(params.id);
		if (!session) throw error(404, 'Session nicht gefunden');
		const me = await getPlayer(session.id, locals.user.id);
		if (!me || me.role !== 'HOST') throw error(403, 'Nur GM');

		const form = await request.formData();
		const cfg = session.config;

		const confirmationModeRaw = toStr(form.get('confirmationMode'));
		const confirmationMode = (CONFIRMATION_MODES as readonly string[]).includes(confirmationModeRaw)
			? (confirmationModeRaw as ConfirmationMode)
			: cfg.confirmationMode;

		const peerConfirmationsRequired = Math.max(
			1,
			toInt(form.get('peerConfirmationsRequired'), cfg.peerConfirmationsRequired)
		);

		const lockModeRaw = toStr(form.get('lockMode'));
		const lockMode = (LOCK_MODES as readonly string[]).includes(lockModeRaw)
			? (lockModeRaw as LockMode)
			: (cfg.lockMode ?? 'TIMER_LOCK');
		const lockTimerSeconds = Math.max(30, toInt(form.get('lockTimerSeconds'), cfg.lockTimerSeconds ?? 600));

		const drinkPrices = {
			SCHLUCK: Math.max(0, toInt(form.get('priceSchluck'), cfg.drinkPrices.SCHLUCK)),
			KURZER: Math.max(0, toInt(form.get('priceKurzer'), cfg.drinkPrices.KURZER)),
			BIER_EXEN: Math.max(0, toInt(form.get('priceBier'), cfg.drinkPrices.BIER_EXEN))
		};

		const rebuyDrinkRaw = toStr(form.get('rebuyDrinkType'));
		const rebuyDrinkType: DrinkType = (DRINK_TYPES as string[]).includes(rebuyDrinkRaw)
			? (rebuyDrinkRaw as DrinkType)
			: cfg.rebuy.drinkType;
		const rebuy = {
			enabled: form.get('rebuyEnabled') === 'on',
			drinkType: rebuyDrinkType,
			amount: Math.max(0, toInt(form.get('rebuyAmount'), cfg.rebuy.amount))
		};

		// Entity overrides: dynamic fields like override__<entityName>
		const entities = await listEntities(session.id);
		const entityOverrides: Record<string, string> = {};
		for (const e of entities) {
			const v = toStr(form.get(`override__${e.name}`));
			if (v && v !== e.name) entityOverrides[e.name] = v;
		}

		try {
			await updateSessionConfig(session.id, {
				confirmationMode,
				peerConfirmationsRequired,
				lockMode,
				lockTimerSeconds,
				drinkPrices,
				rebuy,
				entityOverrides,
				autoLockOnDrink: undefined
			});
		} catch (e) {
			return fail(500, { error: 'Speichern fehlgeschlagen' });
		}

		throw redirect(303, `/s/${session.id}`);
	}
};
