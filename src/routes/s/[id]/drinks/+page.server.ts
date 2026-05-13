/**
 * @file s/[id]/drinks/+page.server.ts — redirect-only.
 * Drinks live exclusively in the lobby now (REQ-UI-010); old links route there.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	throw redirect(303, `/s/${params.id}`);
};
