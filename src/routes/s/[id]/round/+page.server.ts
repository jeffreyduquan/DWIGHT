/**
 * @file s/[id]/round/+page.server.ts — round lifecycle + markets + bets.
 * @implements REQ-ROUND-001..006, REQ-EVENT-001..004, REQ-MARKET-001..006,
 *             REQ-BET-001..006, REQ-TRACK-001..004
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	users,
	drinkConfirmations,
	type Predicate,
	type DrinkType
} from '$lib/server/db/schema';
import { eq, inArray, asc } from 'drizzle-orm';
import { findById as findSession, getPlayer, listPlayers } from '$lib/server/repos/sessions';
import { listForSession as listEntities } from '$lib/server/repos/entities';
import {
	initiateSelfDrink,
	initiateForceDrink,
	confirmDrink,
	cancelDrink,
	listDrinksForSession
} from '$lib/server/repos/drinks';
import {
	createRound,
	getCurrentRound,
	getRound,
	transitionStatus
} from '$lib/server/repos/rounds';
import {
	proposeEvent,
	confirmEvent,
	cancelEvent,
	listEvents,
	getCounterSnapshot,
	deleteOwnPendingEvent,
	updateEventDelta
} from '$lib/server/repos/events';
import { getRoundHistory } from '$lib/server/repos/stats';
import {
	createBinaryMarket,
	instantiateBetGraphs,
	lockMarket,
	listMarketsByRound,
	listOutcomesByMarket
} from '$lib/server/repos/markets';
import { placeBet } from '$lib/server/repos/bets';
import { bets as betsTable, betOutcomes, sessions as sessionsTable } from '$lib/server/db/schema';
import { snapshotForMode } from '$lib/server/repos/betGraphs';
import { settleRound, cancelRoundWithRefund } from '$lib/server/round/lifecycle';
import { evalPredicate } from '$lib/server/bets/predicate';
import { emit } from '$lib/server/sse/broadcaster';
import { applyOverridesToText } from '$lib/entities/names';

function requireUser(locals: App.Locals) {
	if (!locals.user) throw redirect(303, '/login');
	return locals.user;
}

/** Map internal error codes to user-readable German strings. */
function friendlyError(msg: string): string {
	if (msg.startsWith('ROUND_NOT_LIVE:'))
		return 'Runde nicht offen — erst Wetten öffnen oder live schalten.';
	if (msg.startsWith('INVALID_TRANSITION:'))
		return `Falscher Schritt in diesem Status (${msg.split(':')[1]}).`;
	if (msg.startsWith('MARKET_NOT_OPEN:')) return 'Wetten sind nicht mehr offen für diesen Markt.';
	if (msg.startsWith('ROUND_NOT_OPEN_FOR_BETS:'))
		return 'Runde ist nicht offen für neue Wetten.';
	if (msg === 'ROUND_NOT_FOUND') return 'Runde nicht gefunden.';
	if (msg === 'SESSION_NOT_FOUND') return 'Session nicht gefunden.';
	if (msg === 'MARKET_NOT_FOUND') return 'Markt nicht gefunden.';
	if (msg === 'OUTCOME_NOT_FOUND') return 'Wett-Ausgang nicht gefunden.';
	if (msg === 'EVENT_NOT_FOUND') return 'Ereignis nicht gefunden.';
	if (msg.startsWith('EVENT_ALREADY_DECIDED:'))
		return 'Ereignis wurde bereits entschieden.';
	if (msg === 'TRACKABLE_NOT_FOUND') return 'Trackable existiert nicht in dieser Session.';
	if (msg === 'TRACKABLE_GLOBAL_NO_ENTITY') return 'Globales Trackable braucht keine Entität.';
	if (msg === 'TRACKABLE_ENTITY_REQUIRED') return 'Wähle eine Entität.';
	if (msg === 'BET_LOCKED') return 'Du bist gesperrt (musst trinken) — keine Wetten möglich.';
	if (msg === 'NOT_IN_SESSION') return 'Du bist nicht in dieser Session.';
	if (msg === 'INSUFFICIENT_FUNDS') return 'Nicht genug Guthaben.';
	if (msg === 'INVALID_STAKE') return 'Ungültiger Einsatz.';
	if (msg === 'STAKE_BELOW_MIN') return 'Einsatz liegt unter dem Minimum.';
	if (msg === 'STAKE_ABOVE_MAX') return 'Einsatz übersteigt das Maximum pro Wette.';
	if (msg.startsWith('MODE_INVALID:')) {
		const parts = msg.split(':');
		const detail = parts.slice(2).join(':');
		return `Mode/Wetten-Konfiguration fehlerhaft: ${detail} (Bitte Mode korrigieren und neu starten.)`;
	}
	return msg;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = requireUser(locals);

	const session = await findSession(params.id);
	if (!session) throw error(404, 'Session nicht gefunden');

	const me = await getPlayer(session.id, user.id);
	if (!me) throw error(403, 'Du bist nicht in dieser Session');

	const [round, entities, roundHistory, players, drinkRows] = await Promise.all([
		getCurrentRound(session.id),
		listEntities(session.id),
		getRoundHistory(session.id),
		listPlayers(session.id),
		listDrinksForSession(session.id)
	]);

	let eventRows: Awaited<ReturnType<typeof listEvents>> = [];
	let markets: Awaited<ReturnType<typeof listMarketsByRound>> = [];
	let outcomesByMarket: Record<string, Awaited<ReturnType<typeof listOutcomesByMarket>>> = {};
	let betsByOutcome: Record<
		string,
		{ id: string; userId: string; stake: number; payoutAmount: number | null }[]
	> = {};
	let counters: Record<string, number> = {};

	if (round) {
		eventRows = await listEvents(round.id);
		markets = await listMarketsByRound(round.id);
		for (const m of markets) {
			outcomesByMarket[m.id] = await listOutcomesByMarket(m.id);
		}
		const allOutcomeIds = Object.values(outcomesByMarket).flatMap((arr) => arr.map((o) => o.id));
		if (allOutcomeIds.length > 0) {
			const allBets = await db
				.select({
					id: betsTable.id,
					userId: betsTable.userId,
					stake: betsTable.stake,
					outcomeId: betsTable.outcomeId,
					payoutAmount: betsTable.payoutAmount
				})
				.from(betsTable)
				.where(inArray(betsTable.outcomeId, allOutcomeIds));
			for (const b of allBets) {
				(betsByOutcome[b.outcomeId] ||= []).push({
					id: b.id,
					userId: b.userId,
					stake: b.stake,
					payoutAmount: b.payoutAmount
				});
			}
		}
		counters = await getCounterSnapshot(round.id);
	}

	// Fetch usernames for displayed users (pending event proposers + drink participants + players)
	const userIds = Array.from(
		new Set([
			...eventRows.map((e) => e.proposedByUserId),
			...players.map((p) => p.userId),
			...drinkRows.map((d) => d.targetUserId),
			...drinkRows.flatMap((d) => (d.attackerUserId ? [d.attackerUserId] : []))
		])
	);
	const userRows = userIds.length
		? await db
				.select({ id: users.id, username: users.username })
				.from(users)
				.where(inArray(users.id, userIds))
		: [];
	const usernames = new Map(userRows.map((u) => [u.id, u.username]));

	// Confirmations per drink
	const drinkIds = drinkRows.map((d) => d.id);
	const confs = drinkIds.length
		? await db
				.select()
				.from(drinkConfirmations)
				.where(inArray(drinkConfirmations.drinkId, drinkIds))
		: [];
	const confByDrink = new Map<string, typeof confs>();
	for (const c of confs) {
		if (!confByDrink.has(c.drinkId)) confByDrink.set(c.drinkId, []);
		confByDrink.get(c.drinkId)!.push(c);
	}
	const drinks = drinkRows
		.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
		.map((d) => ({
			id: d.id,
			targetUserId: d.targetUserId,
			targetName: usernames.get(d.targetUserId) ?? '?',
			attackerUserId: d.attackerUserId,
			attackerName: d.attackerUserId ? (usernames.get(d.attackerUserId) ?? '?') : null,
			drinkType: d.drinkType,
			origin: d.origin,
			status: d.status,
			priceSnapshot: d.priceSnapshot,
			rebuyAmount: d.rebuyAmount,
			createdAt: d.createdAt,
			confirmations: (confByDrink.get(d.id) ?? []).map((c) => ({
				userId: c.confirmerUserId,
				username: usernames.get(c.confirmerUserId) ?? '?',
				role: c.role
			}))
		}));

	return {
		session: {
			id: session.id,
			name: session.name,
			config: session.config,
			trackables: session.trackables,
			modeId: session.modeId,
			hasBetGraphsSnapshot: (session.betGraphsSnapshot ?? []).length > 0
		},
		me: {
			userId: me.userId,
			role: me.role,
			moneyBalance: me.moneyBalance,
			betLocked: me.betLocked
		},
		entities: entities.map((e) => ({
			id: e.id,
			name: session.config.entityOverrides?.[e.name] || e.name,
			attributes: e.attributes
		})),
		players: players.map((p) => ({
			userId: p.userId,
			username: usernames.get(p.userId) ?? '?',
			role: p.role,
			moneyBalance: p.moneyBalance
		})),
		drinks,
		round: round
			? {
					id: round.id,
					roundNumber: round.roundNumber,
					status: round.status,
					startedAt: round.startedAt,
					lockedAt: round.lockedAt,
					settledAt: round.settledAt
				}
			: null,
		events: eventRows.map((e) => ({
			id: e.id,
			trackableId: e.trackableId,
			entityId: e.entityId,
			delta: e.delta,
			status: e.status,
			proposedBy: usernames.get(e.proposedByUserId) ?? '?',
			proposedByUserId: e.proposedByUserId,
			createdAt: e.createdAt
		})),
		roundHistory,
		counters,
		markets: markets.map((m) => {
			const outs = outcomesByMarket[m.id] ?? [];
			const poolTotal = outs.reduce(
				(sum, o) => sum + (betsByOutcome[o.id] ?? []).reduce((s, b) => s + b.stake, 0),
				0
			);
			return {
				id: m.id,
				title: applyOverridesToText(session.config, m.title),
				description: m.description ? applyOverridesToText(session.config, m.description) : m.description,
				status: m.status,
				outcomes: outs.map((o) => {
					const bs = betsByOutcome[o.id] ?? [];
					const stakeTotal = bs.reduce((s, b) => s + b.stake, 0);
					const myBets = bs.filter((b) => b.userId === user.id);
					const myStake = myBets.reduce((s, b) => s + b.stake, 0);
					const myPayout = myBets.reduce((s, b) => s + (b.payoutAmount ?? 0), 0);
					return {
						id: o.id,
						label: applyOverridesToText(session.config, o.label),
						predicate: o.predicate as Predicate,
						orderIndex: o.orderIndex,
						isWinner: o.isWinner,
						stakeTotal,
						myStake,
						myPayout,
						currentTruth: round ? evalPredicate(o.predicate as Predicate, counters) : false
					};
				}),
				poolTotal
			};
		})
	};
};

async function getRole(sessionId: string, userId: string) {
	const me = await getPlayer(sessionId, userId);
	return me?.role ?? null;
}

export const actions: Actions = {
	createRound: async ({ locals, params }) => {
		const user = requireUser(locals);
		if ((await getRole(params.id, user.id)) !== 'HOST')
			return fail(403, { error: 'Nur Host darf das' });
		try {
			const r = await createRound(params.id);
			// Also instantiate markets from bet-graphs (Phase 6, side-by-side).
			try {
				const n = await instantiateBetGraphs({
					roundId: r.id,
					sessionId: params.id,
					createdByUserId: user.id
				});
				if (n > 0) emit(params.id, 'market_created', { roundId: r.id, count: n });
			} catch (e) {
				console.error('instantiateBetGraphs failed', e);
			}
			// Skip SETUP: open betting immediately so players can place bets.
			await transitionStatus(r.id, 'BETTING_OPEN');
			emit(params.id, 'round_opened', { roundId: r.id, roundNumber: r.roundNumber });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	openBetting: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		if ((await getRole(params.id, user.id)) !== 'HOST') return fail(403, { error: 'Nur Host' });
		const fd = await request.formData();
		const roundId = String(fd.get('roundId') ?? '');
		try {
			await transitionStatus(roundId, 'BETTING_OPEN');
			emit(params.id, 'round_opened', { roundId });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	goLive: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		if ((await getRole(params.id, user.id)) !== 'HOST') return fail(403, { error: 'Nur Host' });
		const fd = await request.formData();
		const roundId = String(fd.get('roundId') ?? '');
		try {
			const ms = await listMarketsByRound(roundId);
			for (const m of ms)
				if (m.status === 'OPEN') {
					await lockMarket(m.id);
					emit(params.id, 'market_locked', { marketId: m.id });
				}
			await transitionStatus(roundId, 'LIVE');
			emit(params.id, 'round_live', { roundId });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	settle: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		if ((await getRole(params.id, user.id)) !== 'HOST') return fail(403, { error: 'Nur Host' });
		const fd = await request.formData();
		const roundId = String(fd.get('roundId') ?? '');
		const r = await getRound(roundId);
		if (!r) return fail(404, { error: 'Runde nicht gefunden' });
		if (r.status === 'SETUP') {
			return fail(400, {
				error: 'Runde noch nicht gestartet. Klicke erst "Wetten öffnen" und dann "Lock + Live".'
			});
		}
		// Block settle if any pending player-reported events still need review.
		const allEvs = await listEvents(roundId);
		const pendingCount = allEvs.filter((e) => e.status === 'PENDING').length;
		if (pendingCount > 0) {
			return fail(400, {
				error: `Es gibt noch ${pendingCount} unentschiedene Spieler-Ereignisse. Bitte erst akzeptieren oder ablehnen.`
			});
		}
		try {
			await settleRound(roundId);
			emit(params.id, 'round_settled', { roundId });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	cancel: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		if ((await getRole(params.id, user.id)) !== 'HOST') return fail(403, { error: 'Nur Host' });
		const fd = await request.formData();
		const roundId = String(fd.get('roundId') ?? '');
		try {
			await cancelRoundWithRefund(roundId);
			emit(params.id, 'round_cancelled', { roundId });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	proposeEvent: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		const fd = await request.formData();
		const roundId = String(fd.get('roundId') ?? '');
		const trackableId = String(fd.get('trackableId') ?? '');
		const entityIdRaw = String(fd.get('entityId') ?? '');
		const entityId = entityIdRaw && entityIdRaw !== 'null' ? entityIdRaw : null;
		try {
			const ev = await proposeEvent({ roundId, trackableId, entityId, proposedByUserId: user.id });
			emit(params.id, 'round_event_proposed', { eventId: ev.id, roundId });
			// All events are buffered (PENDING) — host reviews them via "Runde abrechnen".
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	confirmEvent: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		if ((await getRole(params.id, user.id)) !== 'HOST') return fail(403, { error: 'Nur Host' });
		const fd = await request.formData();
		const eventId = String(fd.get('eventId') ?? '');
		try {
			await confirmEvent(eventId, user.id);
			emit(params.id, 'round_event_confirmed', { eventId });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	cancelEvent: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		if ((await getRole(params.id, user.id)) !== 'HOST') return fail(403, { error: 'Nur Host' });
		const fd = await request.formData();
		const eventId = String(fd.get('eventId') ?? '');
		try {
			await cancelEvent(eventId, user.id);
			emit(params.id, 'round_event_cancelled', { eventId });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	undoOwnEvent: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		const fd = await request.formData();
		const eventId = String(fd.get('eventId') ?? '');
		try {
			await deleteOwnPendingEvent(eventId, user.id);
			emit(params.id, 'round_event_undone', { eventId });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	editEventDelta: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		if ((await getRole(params.id, user.id)) !== 'HOST') return fail(403, { error: 'Nur Host' });
		const fd = await request.formData();
		const eventId = String(fd.get('eventId') ?? '');
		const newDelta = Number(fd.get('delta') ?? 1);
		if (!Number.isFinite(newDelta) || !Number.isInteger(newDelta))
			return fail(400, { error: 'Delta muss eine ganze Zahl sein' });
		try {
			await updateEventDelta(eventId, newDelta);
			emit(params.id, 'round_event_edited', { eventId, delta: newDelta });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	bulkDecideByProposer: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		if ((await getRole(params.id, user.id)) !== 'HOST') return fail(403, { error: 'Nur Host' });
		const fd = await request.formData();
		const roundId = String(fd.get('roundId') ?? '');
		const proposerUserId = String(fd.get('proposerUserId') ?? '');
		const action = String(fd.get('decision') ?? '');
		if (action !== 'CONFIRMED' && action !== 'CANCELLED')
			return fail(400, { error: 'Ungültige Entscheidung' });
		try {
			const allEvs = await listEvents(roundId);
			const targets = allEvs.filter(
				(e) => e.status === 'PENDING' && e.proposedByUserId === proposerUserId
			);
			for (const ev of targets) {
				if (action === 'CONFIRMED') await confirmEvent(ev.id, user.id);
				else await cancelEvent(ev.id, user.id);
			}
			emit(params.id, action === 'CONFIRMED' ? 'round_event_confirmed' : 'round_event_cancelled', {
				bulk: true,
				proposerUserId,
				count: targets.length
			});
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	/**
	 * Phase 12 ghost-workflow settle: GM submits per-bucket choices (mine vs others)
	 * for each (trackable, entity) where both sources have proposed events.
	 * Buckets with only one source are auto-decided. Then settles the round.
	 *
	 * Form fields:
	 *   - roundId
	 *   - choice__<trackableId>__<entityIdOrNull> = "mine" | "others"
	 */
	decideAndSettle: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		if ((await getRole(params.id, user.id)) !== 'HOST') return fail(403, { error: 'Nur Host' });
		const fd = await request.formData();
		const roundId = String(fd.get('roundId') ?? '');
		const r = await getRound(roundId);
		if (!r) return fail(404, { error: 'Runde nicht gefunden' });
		if (r.status === 'SETUP') {
			return fail(400, { error: 'Runde noch nicht gestartet.' });
		}
		try {
			const allEvs = await listEvents(roundId);
			const pending = allEvs.filter((e) => e.status === 'PENDING');
			// Group by bucket.
			const buckets = new Map<string, typeof pending>();
			for (const ev of pending) {
				const key = `${ev.trackableId}__${ev.entityId ?? 'null'}`;
				const arr = buckets.get(key) ?? [];
				arr.push(ev);
				buckets.set(key, arr);
			}
			for (const [key, evs] of buckets) {
				const mine = evs.filter((e) => e.proposedByUserId === user.id);
				const others = evs.filter((e) => e.proposedByUserId !== user.id);
				let pick: 'mine' | 'others';
				if (mine.length > 0 && others.length === 0) pick = 'mine';
				else if (others.length > 0 && mine.length === 0) pick = 'others';
				else {
					const raw = String(fd.get(`choice__${key}`) ?? '');
					if (raw !== 'mine' && raw !== 'others') {
						return fail(400, { error: `Auswahl fehlt für ${key}` });
					}
					pick = raw;
				}
				const toConfirm = pick === 'mine' ? mine : others;
				const toCancel = pick === 'mine' ? others : mine;
				for (const ev of toConfirm) await confirmEvent(ev.id, user.id);
				for (const ev of toCancel) await cancelEvent(ev.id, user.id);
			}
			await settleRound(roundId);
			emit(params.id, 'round_settled', { roundId });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	syncBetGraphs: async ({ locals, params }) => {
		const user = requireUser(locals);
		if ((await getRole(params.id, user.id)) !== 'HOST') return fail(403, { error: 'Nur Host' });
		try {
			const session = await findSession(params.id);
			if (!session) return fail(404, { error: 'Session nicht gefunden' });
			const snapshot = await snapshotForMode(session.modeId);
			await db
				.update(sessionsTable)
				.set({ betGraphsSnapshot: snapshot })
				.where(eq(sessionsTable.id, params.id));

			// Auto-instantiate into the current round if one is open and has no markets yet.
			const current = await getCurrentRound(params.id);
			if (current && (current.status === 'SETUP' || current.status === 'BETTING_OPEN')) {
				const existing = await listMarketsByRound(current.id);
				if (existing.length === 0) {
					const n = await instantiateBetGraphs({
						roundId: current.id,
						sessionId: params.id,
						createdByUserId: user.id
					});
					if (n > 0) emit(params.id, 'market_created', { roundId: current.id, count: n });
				}
			}
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	createMarket: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		if ((await getRole(params.id, user.id)) !== 'HOST') return fail(403, { error: 'Nur Host' });
		const fd = await request.formData();
		const roundId = String(fd.get('roundId') ?? '');
		const title = String(fd.get('title') ?? '').trim();
		const trackableId = String(fd.get('trackableId') ?? '');
		const entityIdRaw = String(fd.get('entityId') ?? '');
		const entityId = entityIdRaw && entityIdRaw !== 'null' ? entityIdRaw : null;
		const cmp = String(fd.get('cmp') ?? 'gte') as 'gte' | 'lte' | 'eq';
		const n = Number(fd.get('n') ?? 1);
		if (!title) return fail(400, { error: 'Titel fehlt' });
		if (!trackableId) return fail(400, { error: 'Trackable fehlt' });
		if (!Number.isFinite(n) || n < 0) return fail(400, { error: 'Ungültige Zahl' });

		const predicate: Predicate = {
			kind: 'count',
			trackableId,
			entityId,
			cmp,
			n
		};
		try {
			const res = await createBinaryMarket({
				roundId,
				title,
				createdByUserId: user.id,
				predicate
			});
			emit(params.id, 'market_created', { marketId: res.market.id, roundId });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	placeBet: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		const fd = await request.formData();
		const outcomeId = String(fd.get('outcomeId') ?? '');
		const stake = Number(fd.get('stake') ?? 0);
		try {
			const b = await placeBet({ outcomeId, userId: user.id, stake });
			emit(params.id, 'bet_placed', { betId: b.id, outcomeId, userId: user.id });
			emit(params.id, 'balance_updated', { userId: user.id });
			emit(params.id, 'market_metrics_updated', { outcomeId });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	drinkSelf: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		const fd = await request.formData();
		const drinkType = String(fd.get('drinkType') ?? '') as DrinkType;
		const wantsRebuy = String(fd.get('rebuy') ?? '') === '1';
		try {
			const session = await findSession(params.id);
			if (!session) throw new Error('SESSION_NOT_FOUND');
			let rebuyAmount: number | undefined;
			if (
				wantsRebuy &&
				session.config.rebuy.enabled &&
				session.config.rebuy.drinkType === drinkType
			) {
				rebuyAmount = session.config.rebuy.amount;
			}
			const d = await initiateSelfDrink({
				sessionId: params.id,
				userId: user.id,
				drinkType,
				rebuyAmount
			});
			emit(params.id, 'drink_initiated', {
				drinkId: d.id,
				origin: 'SELF',
				targetUserId: user.id
			});
			emit(params.id, 'balance_updated', { userId: user.id });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	drinkForce: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		const fd = await request.formData();
		const targetUserId = String(fd.get('targetUserId') ?? '');
		const drinkType = String(fd.get('drinkType') ?? '') as DrinkType;
		try {
			const d = await initiateForceDrink({
				sessionId: params.id,
				attackerUserId: user.id,
				targetUserId,
				drinkType
			});
			emit(params.id, 'drink_initiated', {
				drinkId: d.id,
				origin: 'FORCE',
				attackerUserId: user.id,
				targetUserId
			});
			emit(params.id, 'balance_updated', { userId: user.id });
			emit(params.id, 'balance_updated', { userId: targetUserId });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	drinkConfirm: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		const fd = await request.formData();
		const drinkId = String(fd.get('drinkId') ?? '');
		const me = await getPlayer(params.id, user.id);
		if (!me) return fail(403, { error: 'Nicht in Session' });
		const role: 'GM' | 'PEER' = me.role === 'HOST' ? 'GM' : 'PEER';
		try {
			const res = await confirmDrink({ drinkId, confirmerUserId: user.id, role });
			emit(params.id, 'drink_confirmed', { drinkId, finalized: res.finalized });
			if (res.finalized) {
				emit(params.id, 'balance_updated', { userId: res.drink.targetUserId });
			}
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	drinkCancel: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		const fd = await request.formData();
		const drinkId = String(fd.get('drinkId') ?? '');
		try {
			const d = await cancelDrink(drinkId, user.id);
			emit(params.id, 'drink_cancelled', { drinkId });
			emit(params.id, 'balance_updated', { userId: d.targetUserId });
			if (d.origin === 'FORCE' && d.attackerUserId) {
				emit(params.id, 'balance_updated', { userId: d.attackerUserId });
			}
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	}
};
