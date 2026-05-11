/**
 * @file /healthz/+server.ts — liveness + DB readiness probe.
 * @implements REQ-INFRA-001 (deploy smoke)
 */
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	try {
		await db.execute(sql`select 1`);
		return new Response(JSON.stringify({ ok: true, db: 'up' }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
			status: 503,
			headers: { 'content-type': 'application/json' }
		});
	}
};
