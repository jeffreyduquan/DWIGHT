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
		// flip a char in the signature part
		const parts = token.split('.');
		const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}${parts[2].slice(-1) === 'a' ? 'b' : 'a'}`;
		const claims = await verifySession(tampered);
		expect(claims).toBeNull();
	});
});
