/**
 * @file /api/admin/promote — verify secret and grant admin cookie to current user.
 * Rate-limited: 5 attempts per 10 minutes per (userId, ip) — brute-force protection.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { setAdminCookie, signAdminToken, verifyAdminSecret } from '$lib/server/auth/admin';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function checkRateLimit(key: string): boolean {
	const now = Date.now();
	const b = buckets.get(key);
	if (!b || b.resetAt < now) {
		buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
		return true;
	}
	if (b.count >= MAX_ATTEMPTS) return false;
	b.count += 1;
	return true;
}

export const POST: RequestHandler = async ({ request, locals, cookies, getClientAddress }) => {
	if (!locals.user) throw error(401, 'Login erforderlich');
	const ip = (() => {
		try {
			return getClientAddress();
		} catch {
			return 'unknown';
		}
	})();
	const key = `${locals.user.id}:${ip}`;
	if (!checkRateLimit(key)) {
		throw error(429, 'Zu viele Versuche. Bitte warte 10 Minuten.');
	}
	let body: { secret?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}
	const secret = String(body.secret ?? '');
	if (!verifyAdminSecret(secret)) {
		throw error(403, 'Falsches Admin-Geheimnis');
	}
	const token = await signAdminToken(locals.user.id);
	setAdminCookie(cookies, token);
	return json({ ok: true });
};
