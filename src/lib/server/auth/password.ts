/**
 * @file password.ts — argon2id password hashing
 * @implements REQ-AUTH-002 — argon2id with sane parameters
 *
 * Parameters chosen per OWASP 2024 recommendations for argon2id:
 *   - memoryCost: 64 MiB
 *   - timeCost: 3 iterations
 *   - parallelism: 4
 *   - hashLength: 32 bytes
 */
import argon2 from 'argon2';

const OPTS: argon2.Options = {
	type: argon2.argon2id,
	memoryCost: 64 * 1024,
	timeCost: 3,
	parallelism: 4,
	hashLength: 32
};

export async function hashPassword(plain: string): Promise<string> {
	return argon2.hash(plain, OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
	try {
		return await argon2.verify(hash, plain);
	} catch {
		return false;
	}
}
