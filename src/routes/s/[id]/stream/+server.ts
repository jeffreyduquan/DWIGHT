/**
 * @file /s/[id]/stream/+server.ts — SSE channel for a session.
 * @implements REQ-RT-001
 */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPlayer } from '$lib/server/repos/sessions';
import { subscribe } from '$lib/server/sse/broadcaster';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const me = await getPlayer(params.id, locals.user.id);
	if (!me) throw error(403, 'Not in session');

	const encoder = new TextEncoder();
	let unsub: (() => void) | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const clientId = crypto.randomUUID();
			controller.enqueue(encoder.encode(`: connected ${clientId}\n\n`));
			unsub = subscribe(params.id, { id: clientId, controller });
			heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(`: ping\n\n`));
				} catch {
					/* ignore */
				}
			}, 25000);
		},
		cancel() {
			if (unsub) unsub();
			if (heartbeat) clearInterval(heartbeat);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
