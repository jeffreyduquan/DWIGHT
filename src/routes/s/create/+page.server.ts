/**
 * @file s/create/+page.server.ts — Mode picker + session creation
 * @implements REQ-MODE-001, REQ-MODE-006, REQ-ENT-001, REQ-ECON-001, REQ-REBUY-001
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { listAvailableForUser, findById as findModeById } from '$lib/server/repos/modes';
import { createSession } from '$lib/server/repos/sessions';
import type { ConfirmationMode, DrinkType, SessionConfig } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	const modes = await listAvailableForUser(locals.user.id);
	return {
		modes: modes.map((m) => ({
			id: m.id,
			slug: m.slug,
			name: m.name,
			description: m.description,
			terminology: m.terminology,
			defaultConfig: m.defaultConfig,
			defaultEntities: m.defaultEntities
		}))
	};
};

const CONFIRMATION_MODES: ConfirmationMode[] = ['GM', 'PEERS', 'EITHER'];
const DRINK_TYPES: DrinkType[] = ['SCHLUCK', 'KURZER', 'BIER_EXEN'];

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');

		const form = await request.formData();
		const modeId = String(form.get('modeId') ?? '').trim();
		const name = String(form.get('name') ?? '').trim();
		const startingMoney = Number(form.get('startingMoney') ?? 0);
		const priceSchluck = Number(form.get('priceSchluck') ?? 0);
		const priceKurzer = Number(form.get('priceKurzer') ?? 0);
		const priceBier = Number(form.get('priceBier') ?? 0);
		const confirmationModeRaw = String(form.get('confirmationMode') ?? 'EITHER');
		const rebuyEnabled = form.get('rebuyEnabled') === 'on';
		const rebuyDrinkRaw = String(form.get('rebuyDrinkType') ?? 'BIER_EXEN');
		const rebuyAmount = Number(form.get('rebuyAmount') ?? 0);

		if (!modeId) return fail(400, { error: 'Mode fehlt' });
		if (name.length < 2 || name.length > 64) return fail(400, { error: 'Name 2–64 Zeichen' });
		if (!Number.isFinite(startingMoney) || startingMoney <= 0)
			return fail(400, { error: 'Startgeld ungültig' });
		if (!(CONFIRMATION_MODES as string[]).includes(confirmationModeRaw))
			return fail(400, { error: 'Bestätigungs-Modus ungültig' });
		if (!(DRINK_TYPES as string[]).includes(rebuyDrinkRaw))
			return fail(400, { error: 'Rebuy-Drink ungültig' });
		if (rebuyEnabled && (!Number.isFinite(rebuyAmount) || rebuyAmount <= 0))
			return fail(400, { error: 'Rebuy-Betrag muss > 0 sein' });

		const mode = await findModeById(modeId);
		if (!mode) throw error(404, 'Mode nicht gefunden');

		const config: SessionConfig = {
			...mode.defaultConfig,
			startingMoney,
			drinkPrices: {
				SCHLUCK: priceSchluck > 0 ? priceSchluck : mode.defaultConfig.drinkPrices.SCHLUCK,
				KURZER: priceKurzer > 0 ? priceKurzer : mode.defaultConfig.drinkPrices.KURZER,
				BIER_EXEN: priceBier > 0 ? priceBier : mode.defaultConfig.drinkPrices.BIER_EXEN
			},
			confirmationMode: confirmationModeRaw as ConfirmationMode,
			rebuy: {
				enabled: rebuyEnabled,
				drinkType: rebuyDrinkRaw as DrinkType,
				amount: rebuyEnabled ? rebuyAmount : mode.defaultConfig.rebuy.amount
			}
		};

		const session = await createSession({
			hostUserId: locals.user.id,
			modeId: mode.id,
			name,
			config,
			defaultEntities: mode.defaultEntities
		});

		throw redirect(303, `/s/${session.id}`);
	}
};
