/**
 * @file s/create/+page.server.ts — Mode picker + session creation
 * @implements REQ-MODE-001, REQ-MODE-006, REQ-ENT-001, REQ-ECON-001, REQ-REBUY-001
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listAvailableForUser, findById as findModeById } from '$lib/server/repos/modes';
import { createSession } from '$lib/server/repos/sessions';
import { snapshotForMode } from '$lib/server/repos/betGraphs';
import { freshModeDefaultConfig } from '$lib/server/modes/defaults';
import type { ConfirmationMode, DrinkType, SessionConfig } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	const modes = await listAvailableForUser(locals.user.id);
	return {
		modes: modes.map((m) => ({
			id: m.id,
			name: m.name,
			defaultEntities: m.defaultEntities
		}))
	};
};

const CONFIRMATION_MODES: ConfirmationMode[] = ['GM', 'PEERS'];
const LOCK_MODES = ['TIMER_LOCK', 'LOCK', 'NONE'] as const;
const DRINK_TYPES: DrinkType[] = ['SCHLUCK', 'KURZER', 'BIER_EXEN'];

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		// Any logged-in user may create a session and becomes its GM (host).

		const form = await request.formData();
		const modeId = String(form.get('modeId') ?? '').trim();
		const name = String(form.get('name') ?? '').trim();
		const startingMoney = Number(form.get('startingMoney') ?? 0);
		const minStake = Number(form.get('minStake') ?? 1);
		const showOdds = form.get('showOdds') === 'on';
		const maxStakePctOfStart = Math.max(1, Math.min(100, Number(form.get('maxStakePctOfStart') ?? 50)));
		const priceSchluck = Number(form.get('priceSchluck') ?? 0);
		const priceKurzer = Number(form.get('priceKurzer') ?? 0);
		const priceBier = Number(form.get('priceBier') ?? 0);
		const confirmationModeRaw = String(form.get('confirmationMode') ?? 'PEERS');
		const peerConfirmationsRequired = Math.max(1, Number(form.get('peerConfirmationsRequired') ?? 1));
		const lockModeRaw = String(form.get('lockMode') ?? 'TIMER_LOCK');
		const lockTimerSeconds = Math.max(30, Number(form.get('lockTimerSeconds') ?? 600));
		const rebuyEnabled = form.get('rebuyEnabled') === 'on';
		const rebuyDrinkRaw = String(form.get('rebuyDrinkType') ?? 'BIER_EXEN');
		const rebuyAmount = Number(form.get('rebuyAmount') ?? 0);

		if (!modeId) return fail(400, { error: 'Mode fehlt' });
		if (name.length < 2 || name.length > 64) return fail(400, { error: 'Name 2–64 Zeichen' });
		if (!Number.isFinite(startingMoney) || startingMoney <= 0)
			return fail(400, { error: 'Startgeld ungültig' });
		if (!(CONFIRMATION_MODES as string[]).includes(confirmationModeRaw))
			return fail(400, { error: 'Bestätigungs-Modus ungültig' });
		if (!(LOCK_MODES as readonly string[]).includes(lockModeRaw))
			return fail(400, { error: 'Sperr-Modus ungültig' });
		if (!(DRINK_TYPES as string[]).includes(rebuyDrinkRaw))
			return fail(400, { error: 'Rebuy-Drink ungültig' });
		if (rebuyEnabled && (!Number.isFinite(rebuyAmount) || rebuyAmount <= 0))
			return fail(400, { error: 'Rebuy-Betrag muss > 0 sein' });

		const mode = await findModeById(modeId);
		if (!mode) throw error(404, 'Mode nicht gefunden');

		// Phase 17: Mode no longer carries session defaults — fall back to factory.
		const baseDefaults = freshModeDefaultConfig();

		const entityOverrides: Record<string, string> = {};
		for (const e of mode.defaultEntities) {
			const v = String(form.get(`entityOverride__${e.name}`) ?? '').trim();
			if (v && v !== e.name) entityOverrides[e.name] = v;
		}

		const config: SessionConfig = {
			...baseDefaults,
			startingMoney,
			minStake: Math.max(1, minStake),
			showOdds,
			maxStakePctOfStart,
			drinkPrices: {
				SCHLUCK: priceSchluck > 0 ? priceSchluck : baseDefaults.drinkPrices.SCHLUCK,
				KURZER: priceKurzer > 0 ? priceKurzer : baseDefaults.drinkPrices.KURZER,
				BIER_EXEN: priceBier > 0 ? priceBier : baseDefaults.drinkPrices.BIER_EXEN
			},
			confirmationMode: confirmationModeRaw as ConfirmationMode,
			peerConfirmationsRequired,
			rebuy: {
				enabled: rebuyEnabled,
				drinkType: rebuyDrinkRaw as DrinkType,
				amount: rebuyEnabled ? rebuyAmount : baseDefaults.rebuy.amount
			},
			lockMode: lockModeRaw as (typeof LOCK_MODES)[number],
			lockTimerSeconds,
			autoLockOnDrink: undefined,
			entityOverrides
		};

		const session = await createSession({
			hostUserId: locals.user.id,
			modeId: mode.id,
			name,
			config,
			trackables: mode.trackables,
			betGraphsSnapshot: await snapshotForMode(mode.id),
			defaultEntities: mode.defaultEntities
		});

		throw redirect(303, `/s/${session.id}`);
	}
};
