/**
 * @file modes/new/+page.server.ts — create new Mode.
 */
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createMode, findBySlug } from '$lib/server/repos/modes';
import { parseModeForm } from '$lib/server/modes/parseForm';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {
		initial: {
			name: '',
			defaultEntities: [],
			trackables: []
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const parsed = parseModeForm(form);
		if (!parsed.ok) return fail(400, { error: parsed.error });

		// Auto-suffix slug if a collision exists (Phase 17: user no longer edits slug).
		let slug = parsed.data.slug;
		for (let i = 2; i < 100; i++) {
			const conflict = await findBySlug(slug);
			if (!conflict) break;
			slug = `${parsed.data.slug}-${i}`;
		}

		const created = await createMode({
			ownerUserId: locals.user.id,
			...parsed.data,
			slug
		});
		const next = url.searchParams.get('next');
		if (next && next.startsWith('/') && !next.startsWith('//')) {
			throw redirect(303, next);
		}
		throw redirect(303, `/modes/${created.id}`);
	}
};
