/**
 * @file jwt.ts — sign/verify session JWTs (HS256)
 * @implements REQ-AUTH-003 — HttpOnly cookie session via JWT
 */
import { SignJWT, jwtVerify } from 'jose';
import { env } from '$env/dynamic/private';

const ISSUER = 'dwight';
const AUDIENCE = 'dwight-web';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

export type SessionClaims = {
	sub: string; // user id (uuid)
	username: string;
};

export async function signSession(claims: SessionClaims): Promise<string> {
	return new SignJWT({ username: claims.username })
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(claims.sub)
		.setIssuer(ISSUER)
		.setAudience(AUDIENCE)
		.setIssuedAt()
		.setExpirationTime(`${TTL_SECONDS}s`)
		.sign(getKey());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
	try {
		const { payload } = await jwtVerify(token, getKey(), {
			issuer: ISSUER,
			audience: AUDIENCE
		});
		if (typeof payload.sub !== 'string' || typeof payload.username !== 'string') return null;
		return { sub: payload.sub, username: payload.username };
	} catch {
		return null;
	}
}

export const SESSION_TTL_SECONDS = TTL_SECONDS;
