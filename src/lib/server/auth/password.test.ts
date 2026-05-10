/**
 * @file password.test.ts
 * @implements REQ-AUTH-002, REQ-TEST-001
 */
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
	it('produces an argon2id hash that verifies for the same plaintext', async () => {
		const hash = await hashPassword('correct horse battery staple');
		expect(hash.startsWith('$argon2id$')).toBe(true);
		await expect(verifyPassword(hash, 'correct horse battery staple')).resolves.toBe(true);
	});

	it('does not verify a different plaintext against the hash', async () => {
		const hash = await hashPassword('hunter2');
		await expect(verifyPassword(hash, 'hunter3')).resolves.toBe(false);
	});

	it('returns false (never throws) for a malformed hash string', async () => {
		await expect(verifyPassword('not-a-real-hash', 'anything')).resolves.toBe(false);
	});

	it('produces a different hash for the same plaintext on each call (salt)', async () => {
		const a = await hashPassword('same');
		const b = await hashPassword('same');
		expect(a).not.toEqual(b);
		await expect(verifyPassword(a, 'same')).resolves.toBe(true);
		await expect(verifyPassword(b, 'same')).resolves.toBe(true);
	});
});
