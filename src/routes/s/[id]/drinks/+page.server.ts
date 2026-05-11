/**
 * @file /s/[id]/drinks/+page.server.ts — drinks dashboard.
 * @implements REQ-DRINK-***, REQ-UI-002
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, drinkConfirmations, type DrinkType } from '$lib/server/db/schema';
import { inArray, eq, desc } from 'drizzle-orm';
import { findById as findSession, listPlayers, getPlayer } from '$lib/server/repos/sessions';
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
	const session = await findSession(params.id);
	if (!session) throw error(404, 'Session nicht gefunden');
	const me = await getPlayer(session.id, locals.user.id);
	if (!me) throw error(403, 'Nicht in Session');

	const [players, drinkRows] = await Promise.all([
		listPlayers(session.id),
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

	const dDtos = drinkRows
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
			config: session.config
		},
		me: {
			userId: me.userId,
			role: me.role,
			moneyBalance: me.moneyBalance
		},
		players: players.map((p) => ({
			userId: p.userId,
			username: usernames.get(p.userId) ?? '?',
			role: p.role,
			moneyBalance: p.moneyBalance
		})),
		drinks: dDtos
	};
};

function requireUser(locals: App.Locals) {
	if (!locals.user) throw redirect(303, '/login');
	return locals.user;
}

function friendlyError(msg: string): string {
	if (msg === 'SESSION_NOT_FOUND') return 'Session nicht gefunden.';
	if (msg === 'SESSION_NOT_OPEN') return 'Session ist nicht offen.';
	if (msg === 'INVALID_DRINK_TYPE') return 'Ungültiger Drink-Typ.';
	if (msg === 'NOT_IN_SESSION') return 'Du bist nicht in dieser Session.';
	if (msg === 'SELF_FORCE_FORBIDDEN') return 'Du kannst dich nicht selbst zwingen.';
	if (msg === 'FORCE_TYPE_NOT_ALLOWED') return 'Dieser Drink darf nicht erzwungen werden.';
	if (msg === 'ATTACKER_NOT_IN_SESSION') return 'Angreifer ist nicht in dieser Session.';
	if (msg === 'TARGET_NOT_IN_SESSION') return 'Zielspieler ist nicht in dieser Session.';
	if (msg === 'INSUFFICIENT_FUNDS') return 'Nicht genug Guthaben.';
	if (msg === 'DRINK_NOT_FOUND') return 'Drink nicht gefunden.';
	if (msg.startsWith('DRINK_NOT_PENDING:'))
		return 'Drink ist nicht mehr offen — schon bestätigt oder abgebrochen.';
	if (msg === 'CANNOT_CONFIRM_OWN_DRINK')
		return 'Du kannst deinen eigenen Drink nicht bestätigen.';
	if (msg === 'GM_REQUIRED') return 'Nur der Host darf bestätigen.';
	if (msg === 'PEER_REQUIRED') return 'Nur Mitspieler dürfen bestätigen.';
	if (msg === 'ALREADY_CONFIRMED_BY_USER') return 'Du hast bereits bestätigt.';
	if (msg === 'NOT_HOST') return 'Nur der Host darf das.';
	return msg;
}

export const actions: Actions = {
	self: async ({ locals, params, request }) => {
		const user = requireUser(locals);
		const fd = await request.formData();
		const drinkType = String(fd.get('drinkType') ?? '') as DrinkType;
		const wantsRebuy = String(fd.get('rebuy') ?? '') === '1';
		try {
			const session = await findSession(params.id);
			if (!session) throw new Error('SESSION_NOT_FOUND');
			let rebuyAmount: number | undefined;
			if (wantsRebuy && session.config.rebuy.enabled && session.config.rebuy.drinkType === drinkType) {
				rebuyAmount = session.config.rebuy.amount;
			}
			const d = await initiateSelfDrink({
				sessionId: params.id,
				userId: user.id,
				drinkType,
				rebuyAmount
			});
			emit(params.id, 'drink_initiated', { drinkId: d.id, origin: 'SELF', targetUserId: user.id });
			emit(params.id, 'balance_updated', { userId: user.id });
		} catch (e) {
			return fail(400, { error: friendlyError((e as Error).message) });
		}
		return { ok: true };
	},

	force: async ({ locals, params, request }) => {
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

	confirm: async ({ locals, params, request }) => {
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

	cancel: async ({ locals, params, request }) => {
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
