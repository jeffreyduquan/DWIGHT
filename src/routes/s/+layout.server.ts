/**
 * @file (auth)/+layout.server.ts — guard for protected /s/* etc. (already redirected by hooks)
 *
 * Wait — there is no `(auth)` group around /s/*. We rely on hooks.server.ts
 * to redirect. This file is a placeholder noted in the comment of +layout.svelte.
 */
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return { user: locals.user };
};
