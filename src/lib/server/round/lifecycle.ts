/**
 * @file lifecycle.ts — round lifecycle orchestrator that combines status
 * transitions with market settlement.
 * @implements REQ-ROUND-004, REQ-ROUND-006, REQ-MARKET-006, REQ-BET-004
 */
import { transitionStatus, getRound } from '../repos/rounds';
import { settleRoundMarkets } from '../repos/markets';

/**
 * Move a round through RESOLVING → SETTLED and settle all its markets.
 */
export async function settleRound(roundId: string): Promise<void> {
	const r = await getRound(roundId);
	if (!r) throw new Error('ROUND_NOT_FOUND');
	if (r.status === 'BETTING_OPEN' || r.status === 'LIVE') {
		await transitionStatus(roundId, 'RESOLVING');
	}
	await settleRoundMarkets(roundId);
	const r2 = await getRound(roundId);
	if (r2 && r2.status === 'RESOLVING') {
		await transitionStatus(roundId, 'SETTLED');
	}
}

/**
 * Cancel a round and refund all stakes (all markets become VOID).
 */
export async function cancelRoundWithRefund(roundId: string): Promise<void> {
	await transitionStatus(roundId, 'CANCELLED');
	await settleRoundMarkets(roundId);
}
