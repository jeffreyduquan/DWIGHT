/**
 * @file broadcaster.ts — in-process SSE broadcaster.
 * @implements REQ-RT-001, REQ-RT-002, REQ-RT-003, REQ-RT-004
 */

export type SseEventType =
	| 'round_opened'
	| 'round_live'
	| 'round_settled'
	| 'round_cancelled'
	| 'round_event_proposed'
	| 'round_event_confirmed'
	| 'round_event_cancelled'
	| 'round_event_undone'
	| 'round_event_edited'
	| 'market_created'
	| 'market_locked'
	| 'market_settled'
	| 'bet_placed'
	| 'market_metrics_updated'
	| 'drink_initiated'
	| 'drink_confirmed'
	| 'drink_cancelled'
	| 'balance_updated'
	| 'bet_lock_changed'
	| 'session_ended'
	| 'mode_switched';

export type SseMessage = {
	type: SseEventType;
	payload: Record<string, unknown>;
	ts: number;
};

type Client = {
	id: string;
	controller: ReadableStreamDefaultController<Uint8Array>;
};

const channels = new Map<string, Set<Client>>();
const encoder = new TextEncoder();

export function subscribe(sessionId: string, client: Client): () => void {
	let set = channels.get(sessionId);
	if (!set) {
		set = new Set();
		channels.set(sessionId, set);
	}
	set.add(client);
	return () => {
		const s = channels.get(sessionId);
		if (!s) return;
		s.delete(client);
		if (s.size === 0) channels.delete(sessionId);
	};
}

export function emit(sessionId: string, type: SseEventType, payload: Record<string, unknown>) {
	const set = channels.get(sessionId);
	if (!set || set.size === 0) return;
	const msg: SseMessage = { type, payload, ts: Date.now() };
	const data = `event: ${type}\ndata: ${JSON.stringify(msg)}\n\n`;
	const bytes = encoder.encode(data);
	for (const client of set) {
		try {
			client.controller.enqueue(bytes);
		} catch {
			// client disconnected; cleanup happens in unsubscribe
		}
	}
}

export function clientCount(sessionId: string): number {
	return channels.get(sessionId)?.size ?? 0;
}
