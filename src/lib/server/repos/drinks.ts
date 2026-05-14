/**
 * @file drinks.ts — drink economy primitives.
 * @implements REQ-DRINK-003..010, REQ-REBUY-002..003
 *
 * Pure-ish module: all DB mutations atomic. Side-effects (SSE broadcast)
 * are done by callers (route actions), not here.
 */
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import {
	drinkConfirmations,
	drinks,
	sessionPlayers,
	sessions,
	type ConfirmationMode,
	type DrinkType
} from '../db/schema';
import { effectiveLockMode } from '../../drinks/lock';

export type DbDrink = typeof drinks.$inferSelect;
export type DbDrinkConfirmation = typeof drinkConfirmations.$inferSelect;

type SelfInput = {
	sessionId: string;
	userId: string;
	drinkType: DrinkType;
	/** When set, this drink is also a rebuy: on CONFIRM, credit userId by amount. */
	rebuyAmount?: number;
};

type ForceInput = {
	sessionId: string;
	attackerUserId: string;
	targetUserId: string;
	drinkType: DrinkType;
};

/**
 * Self-cash-out drink. Inserts PENDING SELF with priceSnapshot from session config.
 */
export async function initiateSelfDrink(input: SelfInput): Promise<DbDrink> {
	return await db.transaction(async (tx) => {
		const [s] = await tx
			.select({ config: sessions.config, status: sessions.status })
			.from(sessions)
			.where(eq(sessions.id, input.sessionId));
		if (!s) throw new Error('SESSION_NOT_FOUND');
		if (s.status !== 'ACTIVE' && s.status !== 'CREATED') throw new Error('SESSION_NOT_OPEN');
		const price = s.config.drinkPrices[input.drinkType];
		if (price == null) throw new Error('INVALID_DRINK_TYPE');

		const [me] = await tx
			.select({ userId: sessionPlayers.userId })
			.from(sessionPlayers)
			.where(
				and(
					eq(sessionPlayers.sessionId, input.sessionId),
					eq(sessionPlayers.userId, input.userId)
				)
			);
		if (!me) throw new Error('NOT_IN_SESSION');

		const [d] = await tx
			.insert(drinks)
			.values({
				sessionId: input.sessionId,
				targetUserId: input.userId,
				attackerUserId: null,
				drinkType: input.drinkType,
				origin: 'SELF',
				priceSnapshot: price,
				rebuyAmount: input.rebuyAmount ?? null,
				status: 'PENDING'
			})
			.returning();
		// Auto-lock betting only in LOCK mode. TIMER_LOCK is evaluated lazily at
		// bet-placement time via isLockedByDrinks(); NONE never locks.
		if (effectiveLockMode(s.config) === 'LOCK') {
			await tx
				.update(sessionPlayers)
				.set({ betLocked: true })
				.where(
					and(
						eq(sessionPlayers.sessionId, input.sessionId),
						eq(sessionPlayers.userId, input.userId)
					)
				);
		}
		return d;
	});
}

/**
 * Force-drink. Validates drinkType in `forceDrinkTypesAllowed`, debits attacker
 * immediately by priceSnapshot, inserts PENDING FORCE drink.
 */
export async function initiateForceDrink(input: ForceInput): Promise<DbDrink> {
	if (input.attackerUserId === input.targetUserId) throw new Error('SELF_FORCE_FORBIDDEN');
	return await db.transaction(async (tx) => {
		const [s] = await tx
			.select({ config: sessions.config, status: sessions.status })
			.from(sessions)
			.where(eq(sessions.id, input.sessionId));
		if (!s) throw new Error('SESSION_NOT_FOUND');
		if (s.status !== 'ACTIVE' && s.status !== 'CREATED') throw new Error('SESSION_NOT_OPEN');
		if (!s.config.forceDrinkTypesAllowed.includes(input.drinkType))
			throw new Error('FORCE_TYPE_NOT_ALLOWED');
		const price = s.config.drinkPrices[input.drinkType];
		if (price == null) throw new Error('INVALID_DRINK_TYPE');

		const [attacker] = await tx
			.select()
			.from(sessionPlayers)
			.where(
				and(
					eq(sessionPlayers.sessionId, input.sessionId),
					eq(sessionPlayers.userId, input.attackerUserId)
				)
			)
			.for('update');
		if (!attacker) throw new Error('ATTACKER_NOT_IN_SESSION');
		if (attacker.moneyBalance < price) throw new Error('INSUFFICIENT_FUNDS');

		const [target] = await tx
			.select({ userId: sessionPlayers.userId })
			.from(sessionPlayers)
			.where(
				and(
					eq(sessionPlayers.sessionId, input.sessionId),
					eq(sessionPlayers.userId, input.targetUserId)
				)
			);
		if (!target) throw new Error('TARGET_NOT_IN_SESSION');

		await tx
			.update(sessionPlayers)
			.set({ moneyBalance: attacker.moneyBalance - price })
			.where(
				and(
					eq(sessionPlayers.sessionId, input.sessionId),
					eq(sessionPlayers.userId, input.attackerUserId)
				)
			);

		const [d] = await tx
			.insert(drinks)
			.values({
				sessionId: input.sessionId,
				targetUserId: input.targetUserId,
				attackerUserId: input.attackerUserId,
				drinkType: input.drinkType,
				origin: 'FORCE',
				priceSnapshot: price,
				rebuyAmount: null,
				status: 'PENDING'
			})
			.returning();
		// Auto-lock betting only in LOCK mode.
		if (effectiveLockMode(s.config) === 'LOCK') {
			await tx
				.update(sessionPlayers)
				.set({ betLocked: true })
				.where(
					and(
						eq(sessionPlayers.sessionId, input.sessionId),
						eq(sessionPlayers.userId, input.targetUserId)
					)
				);
		}
		return d;
	});
}

/**
 * Add a confirmation. Threshold check uses session.config.confirmationMode.
 *   GM: 1 confirmation with role=GM finalizes.
 *   PEERS: N distinct confirmations finalize; GM confirmations count as peer.
 * Confirmer cannot be the target (REQ-DRINK-010).
 */
export type ConfirmDrinkInput = {
	drinkId: string;
	confirmerUserId: string;
	role: 'GM' | 'PEER';
};

export type ConfirmDrinkResult = {
	drink: DbDrink;
	finalized: boolean;
};

export async function confirmDrink(input: ConfirmDrinkInput): Promise<ConfirmDrinkResult> {
	return await db.transaction(async (tx) => {
		const [d] = await tx.select().from(drinks).where(eq(drinks.id, input.drinkId)).for('update');
		if (!d) throw new Error('DRINK_NOT_FOUND');
		if (d.status !== 'PENDING') throw new Error(`DRINK_NOT_PENDING:${d.status}`);

		const [s] = await tx
			.select({ config: sessions.config })
			.from(sessions)
			.where(eq(sessions.id, d.sessionId));
		if (!s) throw new Error('SESSION_NOT_FOUND');

		const cfg = s.config;
		const mode: ConfirmationMode = cfg.confirmationMode;

		// Self-confirm is forbidden EXCEPT in GM-only mode where the GM must
		// be able to confirm their own consumption (otherwise no valid path).
		if (d.targetUserId === input.confirmerUserId) {
			if (!(mode === 'GM' && input.role === 'GM')) {
				throw new Error('CANNOT_CONFIRM_OWN_DRINK');
			}
		}

		if (mode === 'GM' && input.role !== 'GM') throw new Error('GM_REQUIRED');
		// In PEERS mode any confirmer counts (GM counts as a peer too).

		// Insert confirmation (idempotent on (drinkId, confirmerUserId) via PK)
		try {
			await tx.insert(drinkConfirmations).values({
				drinkId: d.id,
				confirmerUserId: input.confirmerUserId,
				role: input.role
			});
		} catch (e) {
			throw new Error('ALREADY_CONFIRMED_BY_USER');
		}

		// Read all current confirmations
		const all = await tx
			.select()
			.from(drinkConfirmations)
			.where(eq(drinkConfirmations.drinkId, d.id));

		const gmCount = all.filter((c) => c.role === 'GM').length;
		const peerCount = all.filter((c) => c.role === 'PEER').length;
		// In PEERS mode GM confirmations count toward the peer threshold.
		const effectivePeerCount = peerCount + gmCount;

		let finalize = false;
		if (mode === 'GM') finalize = gmCount >= 1;
		else finalize = effectivePeerCount >= cfg.peerConfirmationsRequired;

		if (!finalize) {
			return { drink: d, finalized: false };
		}

		// Finalize: set CONFIRMED, credit target if SELF (incl. rebuy credit)
		const creditAmount = d.origin === 'SELF' ? d.priceSnapshot + (d.rebuyAmount ?? 0) : 0;
		if (creditAmount > 0) {
			const [sp] = await tx
				.select()
				.from(sessionPlayers)
				.where(
					and(
						eq(sessionPlayers.sessionId, d.sessionId),
						eq(sessionPlayers.userId, d.targetUserId)
					)
				)
				.for('update');
			if (sp) {
				await tx
					.update(sessionPlayers)
					.set({ moneyBalance: sp.moneyBalance + creditAmount })
					.where(
						and(
							eq(sessionPlayers.sessionId, d.sessionId),
							eq(sessionPlayers.userId, d.targetUserId)
						)
					);
			}
		}

		const [updated] = await tx
			.update(drinks)
			.set({ status: 'CONFIRMED', confirmedAt: new Date() })
			.where(eq(drinks.id, d.id))
			.returning();
		// Auto-unlock target now that the drink is confirmed.
		await tx
			.update(sessionPlayers)
			.set({ betLocked: false })
			.where(
				and(
					eq(sessionPlayers.sessionId, d.sessionId),
					eq(sessionPlayers.userId, d.targetUserId)
				)
			);
		return { drink: updated, finalized: true };
	});
}

/**
 * GM-only cancel. Refunds attacker on FORCE; no credit on SELF.
 */
export async function cancelDrink(drinkId: string, gmUserId: string): Promise<DbDrink> {
	return await db.transaction(async (tx) => {
		const [d] = await tx.select().from(drinks).where(eq(drinks.id, drinkId)).for('update');
		if (!d) throw new Error('DRINK_NOT_FOUND');
		if (d.status !== 'PENDING') throw new Error(`DRINK_NOT_PENDING:${d.status}`);

		// Verify gmUserId is HOST of the session
		const [sp] = await tx
			.select({ role: sessionPlayers.role })
			.from(sessionPlayers)
			.where(
				and(eq(sessionPlayers.sessionId, d.sessionId), eq(sessionPlayers.userId, gmUserId))
			);
		if (!sp || sp.role !== 'HOST') throw new Error('NOT_HOST');

		// Refund attacker if FORCE
		if (d.origin === 'FORCE' && d.attackerUserId) {
			const [att] = await tx
				.select()
				.from(sessionPlayers)
				.where(
					and(
						eq(sessionPlayers.sessionId, d.sessionId),
						eq(sessionPlayers.userId, d.attackerUserId)
					)
				)
				.for('update');
			if (att) {
				await tx
					.update(sessionPlayers)
					.set({ moneyBalance: att.moneyBalance + d.priceSnapshot })
					.where(
						and(
							eq(sessionPlayers.sessionId, d.sessionId),
							eq(sessionPlayers.userId, d.attackerUserId)
						)
					);
			}
		}

		const [updated] = await tx
			.update(drinks)
			.set({ status: 'CANCELLED', cancelledAt: new Date() })
			.where(eq(drinks.id, drinkId))
			.returning();
		// Auto-unlock target now that the drink is cancelled.
		await tx
			.update(sessionPlayers)
			.set({ betLocked: false })
			.where(
				and(
					eq(sessionPlayers.sessionId, d.sessionId),
					eq(sessionPlayers.userId, d.targetUserId)
				)
			);
		return updated;
	});
}

export async function listDrinksForSession(sessionId: string): Promise<DbDrink[]> {
	return await db.select().from(drinks).where(eq(drinks.sessionId, sessionId));
}

export async function listConfirmationsForDrink(
	drinkId: string
): Promise<DbDrinkConfirmation[]> {
	return await db
		.select()
		.from(drinkConfirmations)
		.where(eq(drinkConfirmations.drinkId, drinkId));
}
