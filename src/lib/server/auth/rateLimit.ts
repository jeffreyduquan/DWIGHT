/**
 * @file rateLimit.ts — simple in-memory token-bucket rate limiter
 * @implements REQ-AUTH-005 — login throttling (5 attempts / 5 min per key)
 *
 * NOTE: in-memory only. Single-process. For Sprint 9 production we may move this
 * to Redis (REDIS_URL is already configured) or use a packet-level limiter at
 * the proxy. MVP scope is fine with in-memory since Node app is one process.
 */

type Bucket = {
	count: number;
	resetAt: number;
};

const store = new Map<string, Bucket>();

export type RateLimitOptions = {
	windowMs: number;
	max: number;
};

export type RateLimitResult = {
	allowed: boolean;
	retryAfterSeconds: number;
};

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
	const now = Date.now();
	const bucket = store.get(key);
	if (!bucket || bucket.resetAt <= now) {
		store.set(key, { count: 1, resetAt: now + opts.windowMs });
		return { allowed: true, retryAfterSeconds: 0 };
	}
	if (bucket.count >= opts.max) {
		return {
			allowed: false,
			retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000)
		};
	}
	bucket.count += 1;
	return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimit(key: string): void {
	store.delete(key);
}

// Periodic cleanup so the map doesn't grow forever in long-lived processes.
if (typeof setInterval !== 'undefined') {
	setInterval(() => {
		const now = Date.now();
		for (const [k, v] of store) {
			if (v.resetAt <= now) store.delete(k);
		}
	}, 60_000).unref?.();
}
