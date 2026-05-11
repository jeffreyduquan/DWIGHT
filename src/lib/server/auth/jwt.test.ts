/**
 * @file jwt.test.ts
 * @implements REQ-AUTH-003, REQ-TEST-001
 */
import { describe, expect, it, vi } from 'vitest';

// Stub the SvelteKit `$env/dynamic/private` module before importing the SUT,
// so `getKey()` reads our test secret.
vi.mock('$env/dynamic/private', () => ({
	env: { AUTH_SECRET: 'test-secret-test-secret-test-secret-test-secret' }
}));

const { signSession, verifySession } = await import('./jwt');

describe('jwt', () => {
	it('signs a token that verifies back to the same claims', async () => {
		const token = await signSession({ sub: 'user-1', username: 'alice' });
		const claims = await verifySession(token);
		expect(claims).toEqual({ sub: 'user-1', username: 'alice' });
	});

	it('rejects a malformed token', async () => {
		const claims = await verifySession('not.a.jwt');
		expect(claims).toBeNull();
	});

	it('rejects a token signed with a different key (tamper)', async () => {
		const token = await signSession({ sub: 'user-1', username: 'alice' });
		const parts = token.split('.');
		// Flip the first char of the signature (middle bytes of base64url decode
		// fully without trailing-bit ambiguity, so any change here truly mutates
		// the signature bytes).
		const sig = parts[2];
		const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
		const tampered = `${parts[0]}.${parts[1]}.${flipped}`;
		const claims = await verifySession(tampered);
		expect(claims).toBeNull();
	});
});
