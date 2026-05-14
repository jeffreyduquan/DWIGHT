/**
 * @file s/[id]/info/+page.server.ts — Wettinfos: entities + trackables overview.
 * @implements REQ-UI-011
 */
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { findById, getPlayer } from '$lib/server/repos/sessions';
import { findById as findModeById } from '$lib/server/repos/modes';
import { listForSession as listEntities } from '$lib/server/repos/entities';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');

	const session = await findById(params.id);
	if (!session) throw error(404, 'Session nicht gefunden');

	const me = await getPlayer(session.id, locals.user.id);
	if (!me) throw error(403, 'Du bist nicht in dieser Session');

	const [mode, entities] = await Promise.all([
		findModeById(session.modeId),
		listEntities(session.id)
	]);

	return {
		mode: mode ? { name: mode.name, terminology: mode.terminology } : null,
		trackables: session.trackables,
		entities: entities.map((e) => ({
			...e,
			name: session.config.entityOverrides?.[e.name] || e.name
		}))
	};
};
