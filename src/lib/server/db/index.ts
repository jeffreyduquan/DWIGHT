import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

// Lazy initialisation so the build/prerender phase doesn't crash when
// DATABASE_URL is not yet provided (only required at request time).
let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
	if (_db) return _db;
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
	_client = postgres(env.DATABASE_URL);
	_db = drizzle(_client, { schema });
	return _db;
}

// Proxy that defers connection until the first property/method access.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
	get(_target, prop) {
		const real = getDb() as unknown as Record<string | symbol, unknown>;
		const value = real[prop];
		return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
	}
});
