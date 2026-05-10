/**
 * @file +layout.server.ts — expose user to all pages
 * @implements REQ-AUTH-003
 */
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return { user: locals.user };
};
