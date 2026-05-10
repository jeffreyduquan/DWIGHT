/**
 * @file s/[id]/+page.server.ts — lobby placeholder
 * @implements REQ-UI-001, REQ-DATA-005
 */
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';
import { findById, listPlayers, getPlayer } from '$lib/server/repos/sessions';
import { findById as findModeById } from '$lib/server/repos/modes';
import { listForSession as listEntities } from '$lib/server/repos/entities';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');

	const session = await findById(params.id);
	if (!session) throw error(404, 'Session nicht gefunden');

	const me = await getPlayer(session.id, locals.user.id);
	if (!me) throw error(403, 'Du bist nicht in dieser Session');

	const [mode, players, entities] = await Promise.all([
		findModeById(session.modeId),
		listPlayers(session.id),
		listEntities(session.id)
	]);

	const userIds = players.map((p) => p.userId);
	const userRows = await db
		.select({ id: users.id, username: users.username })
		.from(users)
		.where(inArray(users.id, userIds));
	const usernames = new Map(userRows.map((u) => [u.id, u.username]));

	return {
		session: {
			id: session.id,
			name: session.name,
			inviteCode: session.inviteCode,
			status: session.status,
			config: session.config
		},
		mode: mode
			? {
					name: mode.name,
					terminology: mode.terminology
				}
			: null,
		me: {
			userId: me.userId,
			role: me.role,
			moneyBalance: me.moneyBalance,
			betLocked: me.betLocked
		},
		players: players.map((p) => ({
			userId: p.userId,
			username: usernames.get(p.userId) ?? '?',
			role: p.role,
			moneyBalance: p.moneyBalance,
			betLocked: p.betLocked
		})),
		entities: entities.map((e) => ({
			id: e.id,
			name: e.name,
			kind: e.kind,
			attributes: e.attributes
		}))
	};
};
