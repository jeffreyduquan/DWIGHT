/**
 * @file s/[id]/+layout.server.ts — shared chrome data for all /s/:id/* pages.
 * Loads: session basics, my-player snapshot, mode name, pending drinks count.
 * This is what the SessionTopBar and BottomDock need; individual pages still
 * load their full data.
 */
import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { findById, getPlayer } from '$lib/server/repos/sessions';
import { findById as findModeById } from '$lib/server/repos/modes';
import { listDrinksForSession } from '$lib/server/repos/drinks';

export const load: LayoutServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) throw redirect(303, '/login');

	const session = await findById(params.id);
	if (!session) throw error(404, 'Session nicht gefunden');

	const me = await getPlayer(session.id, locals.user.id);
	if (!me) throw error(403, 'Du bist nicht in dieser Session');

	// ENDED sessions are read-only: force all non-stats routes to the stats
	// recap so closed sessions only ever surface their statistics.
	if (session.status === 'ENDED') {
		const statsPath = `/s/${session.id}/stats`;
		if (url.pathname !== statsPath) {
			throw redirect(303, statsPath);
		}
	}

	const [mode, drinks] = await Promise.all([
		findModeById(session.modeId),
		listDrinksForSession(session.id)
	]);

	const pendingDrinks = drinks.filter((d) => d.status === 'PENDING').length;

	return {
		chrome: {
			sessionId: session.id,
			sessionName: session.name,
			modeName: mode?.name ?? null,
			balance: me.moneyBalance,
			betLocked: me.betLocked,
			isHost: me.role === 'HOST',
			isEnded: session.status === 'ENDED',
			pendingDrinks
		}
	};
};
