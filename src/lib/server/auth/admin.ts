/**
 * @file admin.ts — admin promotion via shared secret, cookie-based.
 *
 * Easter-egg flow: client clicks version 9× → modal with secret input →
 * POST /api/admin/promote → if secret matches env.ADMIN_SECRET → signed cookie set.
 *
 * The admin cookie is a short JWT bound to the user's session subject so that
 * a leaked cookie cannot be used by another user.
 */
import { SignJWT, jwtVerify } from 'jose';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

export const ADMIN_COOKIE = 'dwight_admin';
const ADMIN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const ISSUER = 'dwight';
const AUDIENCE = 'dwight-admin';

let cachedKey: Uint8Array | null = null;
function getKey(): Uint8Array {
	if (cachedKey) return cachedKey;
	const secret = env.AUTH_SECRET;
	if (!secret || secret.length < 32) {
		throw new Error('AUTH_SECRET must be set to a strong value (>= 32 chars).');
	}
	cachedKey = new TextEncoder().encode(secret);
	return cachedKey;
}

/** Compare two strings in constant time to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

/** Verify the supplied secret against ADMIN_SECRET env var. */
export function verifyAdminSecret(secret: string): boolean {
	const expected = env.ADMIN_SECRET;
	if (!expected || expected.length < 8) return false;
	return timingSafeEqual(secret, expected);
}

/** Sign an admin token bound to a user id. */
export async function signAdminToken(userId: string): Promise<string> {
	return new SignJWT({})
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(userId)
		.setIssuer(ISSUER)
		.setAudience(AUDIENCE)
		.setIssuedAt()
		.setExpirationTime(`${ADMIN_TTL_SECONDS}s`)
		.sign(getKey());
}

/** Verify an admin token — returns the user id it was issued to, or null. */
export async function verifyAdminToken(token: string): Promise<string | null> {
	try {
		const { payload } = await jwtVerify(token, getKey(), { issuer: ISSUER, audience: AUDIENCE });
		return typeof payload.sub === 'string' ? payload.sub : null;
	} catch {
		return null;
	}
}

export function setAdminCookie(cookies: Cookies, token: string): void {
	cookies.set(ADMIN_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: ADMIN_TTL_SECONDS
	});
}

export function clearAdminCookie(cookies: Cookies): void {
	cookies.delete(ADMIN_COOKIE, { path: '/' });
}
