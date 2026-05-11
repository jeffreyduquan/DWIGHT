/**
 * @file /s/[id]/stats/+page.server.ts — post-game stats view.
 * @implements REQ-STAT-001..004, REQ-UI-002
 */
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { findById as findSession, getPlayer } from '$lib/server/repos/sessions';
import {
	getSessionLeaderboard,
	getMySessionStats,
	getRoundHistory
} from '$lib/server/repos/stats';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');
	const session = await findSession(params.id);
	if (!session) throw error(404, 'Session nicht gefunden');
	const me = await getPlayer(session.id, locals.user.id);
	if (!me) throw error(403, 'Nicht in Session');

	const startingMoney = session.config.startingMoney;
	const [leaderboard, myStats, roundHistory] = await Promise.all([
		getSessionLeaderboard(session.id, startingMoney),
		getMySessionStats(session.id, locals.user.id, startingMoney),
		getRoundHistory(session.id)
	]);

	return {
		session: { id: session.id, name: session.name, config: session.config },
		me: { userId: locals.user.id, username: locals.user.username },
		leaderboard,
		myStats,
		roundHistory
	};
};
