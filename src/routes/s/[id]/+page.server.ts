/**
 * @file s/[id]/+page.server.ts — lobby placeholder
 * @implements REQ-UI-001, REQ-DATA-005
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, sessionPlayers, drinkConfirmations, type DrinkType } from '$lib/server/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { findById, listPlayers, getPlayer, endSession, deleteSession } from '$lib/server/repos/sessions';
import { findById as findModeById } from '$lib/server/repos/modes';
import { listForSession as listEntities } from '$lib/server/repos/entities';
import {
	initiateSelfDrink,
	initiateForceDrink,
	confirmDrink,
	cancelDrink,
	listDrinksForSession
} from '$lib/server/repos/drinks';
import { emit } from '$lib/server/sse/broadcaster';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');

	const session = await findById(params.id);
	if (!session) throw error(404, 'Session nicht gefunden');

	const me = await getPlayer(session.id, locals.user.id);
	if (!me) throw error(403, 'Du bist nicht in dieser Session');

	const [mode, players, entities, drinkRows] = await Promise.all([
		findModeById(session.modeId),
		listPlayers(session.id),
		listEntities(session.id),
		listDrinksForSession(session.id)
	]);

	const userIds = Array.from(
		new Set([
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
			inviteCode: session.inviteCode,
			status: session.status,
			config: session.config
		},
		mode: mode
			? {
					name: mode.name,
					terminology: mode.terminology
				}
			: null,
		me: {
			userId: me.userId,
			role: me.role,
			moneyBalance: me.moneyBalance,
			betLocked: me.betLocked
		},
		players: players.map((p) => ({
			userId: p.userId,
			username: usernames.get(p.userId) ?? '?',
			role: p.role,
			moneyBalance: p.moneyBalance,
			betLocked: p.betLocked
		})),
		entities: entities.map((e) => ({
			id: e.id,
			name: e.name,
			kind: e.kind,
			attributes: e.attributes
		})),
		drinks
	};
};

export const actions: Actions = {
	toggleBetLock: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const me = await getPlayer(params.id, locals.user.id);
		if (!me || me.role !== 'HOST') return fail(403, { error: 'Nur Host' });

		const fd = await request.formData();
		const targetUserId = String(fd.get('userId') ?? '');
		if (!targetUserId) return fail(400, { error: 'userId fehlt' });

		const target = await getPlayer(params.id, targetUserId);
		if (!target) return fail(404, { error: 'Spieler nicht in Session' });

		await db
			.update(sessionPlayers)
			.set({ betLocked: !target.betLocked })
			.where(
				and(
					eq(sessionPlayers.sessionId, params.id),
					eq(sessionPlayers.userId, targetUserId)
				)
			);
		emit(params.id, 'balance_updated', { userId: targetUserId });
		return { ok: true };
	},

	endSession: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const me = await getPlayer(params.id, locals.user.id);
		if (!me || me.role !== 'HOST') return fail(403, { error: 'Nur Host' });
		try {
			await endSession(params.id);
			emit(params.id, 'session_ended', { sessionId: params.id });
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
		throw redirect(303, '/');
	},

	deleteSession: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const me = await getPlayer(params.id, locals.user.id);
		if (!me || me.role !== 'HOST') return fail(403, { error: 'Nur Host' });
		try {
			await deleteSession(params.id);
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
		throw redirect(303, '/');
	},

	drinkSelf: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const fd = await request.formData();
		const drinkType = String(fd.get('drinkType') ?? '') as DrinkType;
		const wantsRebuy = String(fd.get('rebuy') ?? '') === '1';
		try {
			const session = await findById(params.id);
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
				userId: locals.user.id,
				drinkType,
				rebuyAmount
			});
			emit(params.id, 'drink_initiated', { drinkId: d.id, origin: 'SELF', targetUserId: locals.user.id });
			emit(params.id, 'balance_updated', { userId: locals.user.id });
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
		return { ok: true };
	},

	drinkForce: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const fd = await request.formData();
		const targetUserId = String(fd.get('targetUserId') ?? '');
		const drinkType = String(fd.get('drinkType') ?? '') as DrinkType;
		try {
			const d = await initiateForceDrink({
				sessionId: params.id,
				attackerUserId: locals.user.id,
				targetUserId,
				drinkType
			});
			emit(params.id, 'drink_initiated', {
				drinkId: d.id,
				origin: 'FORCE',
				attackerUserId: locals.user.id,
				targetUserId
			});
			emit(params.id, 'balance_updated', { userId: locals.user.id });
			emit(params.id, 'balance_updated', { userId: targetUserId });
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
		return { ok: true };
	},

	drinkConfirm: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const fd = await request.formData();
		const drinkId = String(fd.get('drinkId') ?? '');
		const me = await getPlayer(params.id, locals.user.id);
		if (!me) return fail(403, { error: 'Nicht in Session' });
		const role: 'GM' | 'PEER' = me.role === 'HOST' ? 'GM' : 'PEER';
		try {
			const res = await confirmDrink({ drinkId, confirmerUserId: locals.user.id, role });
			emit(params.id, 'drink_confirmed', { drinkId, finalized: res.finalized });
			if (res.finalized) {
				emit(params.id, 'balance_updated', { userId: res.drink.targetUserId });
			}
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
		return { ok: true };
	},

	drinkCancel: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const fd = await request.formData();
		const drinkId = String(fd.get('drinkId') ?? '');
		try {
			const d = await cancelDrink(drinkId, locals.user.id);
			emit(params.id, 'drink_cancelled', { drinkId });
			emit(params.id, 'balance_updated', { userId: d.targetUserId });
			if (d.origin === 'FORCE' && d.attackerUserId) {
				emit(params.id, 'balance_updated', { userId: d.attackerUserId });
			}
		} catch (e) {
			return fail(400, { error: (e as Error).message });
		}
		return { ok: true };
	}
};
