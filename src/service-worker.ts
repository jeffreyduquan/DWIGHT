/**
 * @file service-worker.ts — SvelteKit service worker (REQ-INFRA-PWA).
 *
 * Strategy:
 *  - precache app shell + built assets at install
 *  - cache-first for built static assets (versioned)
 *  - network-first for navigation requests (HTML) with offline fallback to '/'
 *  - never cache API/POST/SSE
 */
/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `dwight-cache-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	(event as ExtendableEvent).waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			await cache.addAll(ASSETS);
		})()
	);
});

self.addEventListener('activate', (event) => {
	(event as ExtendableEvent).waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await (self as unknown as ServiceWorkerGlobalScope).clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const fetchEvent = event as FetchEvent;
	const req = fetchEvent.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);
	// Never intercept SSE or API streaming endpoints
	if (url.pathname.endsWith('/stream')) return;
	if (req.headers.get('accept')?.includes('text/event-stream')) return;

	// Cache-first for known static assets
	if (ASSETS.includes(url.pathname)) {
		fetchEvent.respondWith(
			(async () => {
				const cached = await caches.match(req);
				if (cached) return cached;
				const res = await fetch(req);
				return res;
			})()
		);
		return;
	}

	// Network-first for navigations with offline fallback to cached '/'
	if (req.mode === 'navigate') {
		fetchEvent.respondWith(
			(async () => {
				try {
					return await fetch(req);
				} catch {
					const cache = await caches.open(CACHE);
					return (await cache.match('/')) ?? new Response('offline', { status: 503 });
				}
			})()
		);
	}
});

export {};
