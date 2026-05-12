/**
 * @file events.ts — RoundEvent proposal/confirmation lifecycle.
 * @implements REQ-EVENT-001..004, REQ-TRACK-003
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { roundEvents, rounds, sessions, type Trackable } from '../db/schema';
import { counterKey, type CounterSnapshot } from '../bets/predicate';

export type DbRoundEvent = typeof roundEvents.$inferSelect;

type ProposeInput = {
	roundId: string;
	trackableId: string;
	entityId: string | null;
	proposedByUserId: string;
	delta?: number;
};

/**
 * Propose an event. Validates the trackable exists in the session, scope vs
 * entityId, and that the round is in a state where events are allowed
 * (BETTING_OPEN or LIVE).
 */
export async function proposeEvent(input: ProposeInput): Promise<DbRoundEvent> {
	return await db.transaction(async (tx) => {
		const [r] = await tx
			.select({
				id: rounds.id,
				status: rounds.status,
				sessionId: rounds.sessionId
			})
			.from(rounds)
			.where(eq(rounds.id, input.roundId));
		if (!r) throw new Error('ROUND_NOT_FOUND');
		if (r.status !== 'LIVE') {
			throw new Error(`ROUND_NOT_LIVE:${r.status}`);
		}

		const [s] = await tx
			.select({ trackables: sessions.trackables })
			.from(sessions)
			.where(eq(sessions.id, r.sessionId));
		if (!s) throw new Error('SESSION_NOT_FOUND');

		const tr = (s.trackables as Trackable[]).find((t) => t.id === input.trackableId);
		if (!tr) throw new Error('TRACKABLE_NOT_FOUND');
		if (tr.scope === 'global' && input.entityId != null)
			throw new Error('TRACKABLE_GLOBAL_NO_ENTITY');
		if (tr.scope === 'entity' && input.entityId == null)
			throw new Error('TRACKABLE_ENTITY_REQUIRED');

		const [ev] = await tx
			.insert(roundEvents)
			.values({
				roundId: input.roundId,
				trackableId: input.trackableId,
				entityId: input.entityId,
				delta: input.delta ?? 1,
				status: 'PENDING',
				proposedByUserId: input.proposedByUserId
			})
			.returning();
		return ev;
	});
}

async function decide(
	eventId: string,
	decidedByUserId: string,
	next: 'CONFIRMED' | 'CANCELLED'
): Promise<DbRoundEvent> {
	return await db.transaction(async (tx) => {
		const [ev] = await tx
			.select()
			.from(roundEvents)
			.where(eq(roundEvents.id, eventId))
			.for('update');
		if (!ev) throw new Error('EVENT_NOT_FOUND');
		if (ev.status !== 'PENDING') throw new Error(`EVENT_ALREADY_DECIDED:${ev.status}`);

		const [updated] = await tx
			.update(roundEvents)
			.set({ status: next, decidedByUserId, decidedAt: new Date() })
			.where(eq(roundEvents.id, eventId))
			.returning();
		return updated;
	});
}

export const confirmEvent = (eventId: string, decidedByUserId: string) =>
	decide(eventId, decidedByUserId, 'CONFIRMED');

export const cancelEvent = (eventId: string, decidedByUserId: string) =>
	decide(eventId, decidedByUserId, 'CANCELLED');

/**
 * Aggregate all CONFIRMED events of a round into a CounterSnapshot ready for
 * predicate evaluation.
 */
export async function getCounterSnapshot(roundId: string): Promise<CounterSnapshot> {
	const rows = await db
		.select({
			trackableId: roundEvents.trackableId,
			entityId: roundEvents.entityId,
			delta: roundEvents.delta,
			decidedAt: roundEvents.decidedAt,
			id: roundEvents.id
		})
		.from(roundEvents)
		.where(and(eq(roundEvents.roundId, roundId), eq(roundEvents.status, 'CONFIRMED')));

	const snap: Record<string, number> = {};
	for (const row of rows) {
		const key = counterKey(row.trackableId, row.entityId);
		snap[key] = (snap[key] ?? 0) + row.delta;
	}

	// Compute log_rank: for each entity-scoped trackable, rank entities by their
	// first CONFIRMED event (decidedAt asc, then id asc for tiebreak).
	// Stored as `rank:<trackableId>:<entityId>` = 1-indexed position.
	type FirstSeen = { entityId: string; at: number; id: string };
	const firstByTrackable = new Map<string, Map<string, FirstSeen>>();
	for (const row of rows) {
		if (!row.entityId) continue;
		if (!firstByTrackable.has(row.trackableId)) {
			firstByTrackable.set(row.trackableId, new Map());
		}
		const byEntity = firstByTrackable.get(row.trackableId)!;
		const at = row.decidedAt ? row.decidedAt.getTime() : 0;
		const existing = byEntity.get(row.entityId);
		if (!existing || at < existing.at || (at === existing.at && row.id < existing.id)) {
			byEntity.set(row.entityId, { entityId: row.entityId, at, id: row.id });
		}
	}
	for (const [trackableId, byEntity] of firstByTrackable) {
		const sorted = Array.from(byEntity.values()).sort(
			(a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)
		);
		sorted.forEach((item, idx) => {
			snap[`rank:${trackableId}:${item.entityId}`] = idx + 1;
		});
	}

	return snap;
}

export async function listEvents(roundId: string): Promise<DbRoundEvent[]> {
	return await db.select().from(roundEvents).where(eq(roundEvents.roundId, roundId));
}

/**
 * Delete an own PENDING event. The proposer may take back their own buffered
 * report as long as it hasn't been decided yet. Returns true on success.
 */
export async function deleteOwnPendingEvent(
	eventId: string,
	requestingUserId: string
): Promise<boolean> {
	return await db.transaction(async (tx) => {
		const [ev] = await tx
			.select()
			.from(roundEvents)
			.where(eq(roundEvents.id, eventId))
			.for('update');
		if (!ev) throw new Error('EVENT_NOT_FOUND');
		if (ev.status !== 'PENDING') throw new Error(`EVENT_ALREADY_DECIDED:${ev.status}`);
		if (ev.proposedByUserId !== requestingUserId) throw new Error('NOT_PROPOSER');
		await tx.delete(roundEvents).where(eq(roundEvents.id, eventId));
		return true;
	});
}

/**
 * Update the delta of a PENDING event (host adjustment before confirming).
 */
export async function updateEventDelta(eventId: string, newDelta: number): Promise<DbRoundEvent> {
	return await db.transaction(async (tx) => {
		const [ev] = await tx
			.select()
			.from(roundEvents)
			.where(eq(roundEvents.id, eventId))
			.for('update');
		if (!ev) throw new Error('EVENT_NOT_FOUND');
		if (ev.status !== 'PENDING') throw new Error(`EVENT_ALREADY_DECIDED:${ev.status}`);
		const [updated] = await tx
			.update(roundEvents)
			.set({ delta: newDelta })
			.where(eq(roundEvents.id, eventId))
			.returning();
		return updated;
	});
}
