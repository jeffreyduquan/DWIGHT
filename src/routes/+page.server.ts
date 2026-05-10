/**
 * @file +page.server.ts — landing page loader
 * @implements REQ-UI-001, REQ-DATA-005
 */
import type { PageServerLoad } from './$types';
import { listForUser } from '$lib/server/repos/sessions';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { user: null, sessions: [] };
	}
	const sessions = await listForUser(locals.user.id);
	return {
		user: locals.user,
		sessions: sessions.map((s) => ({
			id: s.id,
			name: s.name,
			inviteCode: s.inviteCode,
			status: s.status
		}))
	};
};
