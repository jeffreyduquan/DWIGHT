/**
 * @file payout.ts — pure parimutuel pool distribution for a settled BetMarket.
 *
 * Rules (REQ-MARKET-006, REQ-BET-004, REQ-BET-005, REQ-ECON-004):
 *   - Market pool = sum of all stakes across all outcomes.
 *   - Winning outcomes = those whose predicate evaluated true.
 *   - If 0 winning outcomes: market VOID — refund each bet its stake.
 *   - If ≥1 winning outcomes:
 *       - Pool is split equally across winning outcomes (integer floor),
 *         residual goes to the first winning outcome.
 *       - Within each winning outcome, its pool share is split proportionally
 *         by stake among that outcome's bettors (integer floor + residual to
 *         the largest stake; ties broken by earliest createdAt then by bet id).
 *   - No house edge in V1 (REQ-MARKET-006).
 */

export type BetForPayout = {
	id: string;
	stake: number;
	createdAt: Date | string;
};

export type OutcomeForPayout = {
	id: string;
	isWinner: boolean;
	bets: ReadonlyArray<BetForPayout>;
};

export type PayoutEntry = {
	betId: string;
	stake: number;
	payout: number; // total credited to the bettor for this bet (refund or share)
	isVoidRefund: boolean;
};

export type MarketPayoutResult = {
	poolTotal: number;
	winningOutcomeIds: string[];
	isVoid: boolean;
	payouts: PayoutEntry[];
};

function totalStakeOf(bets: ReadonlyArray<BetForPayout>): number {
	let s = 0;
	for (const b of bets) s += b.stake;
	return s;
}

function compareForResidual(a: BetForPayout, b: BetForPayout): number {
	// Largest stake first, then earliest createdAt, then bet id asc.
	if (b.stake !== a.stake) return b.stake - a.stake;
	const aT = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : a.createdAt.getTime();
	const bT = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : b.createdAt.getTime();
	if (aT !== bT) return aT - bT;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Compute payouts for one market.
 */
export function computeMarketPayouts(outcomes: ReadonlyArray<OutcomeForPayout>): MarketPayoutResult {
	const allBets: BetForPayout[] = [];
	for (const o of outcomes) for (const b of o.bets) allBets.push(b);

	const poolTotal = totalStakeOf(allBets);
	const winners = outcomes.filter((o) => o.isWinner);
	const winningOutcomeIds = winners.map((w) => w.id);

	// VOID — refund all stakes
	if (winners.length === 0) {
		return {
			poolTotal,
			winningOutcomeIds: [],
			isVoid: true,
			payouts: allBets.map((b) => ({
				betId: b.id,
				stake: b.stake,
				payout: b.stake,
				isVoidRefund: true
			}))
		};
	}

	const payouts: PayoutEntry[] = [];

	// 1) Split pool equally across winning outcomes (integer floor + residual)
	const perOutcomeFloor = Math.floor(poolTotal / winners.length);
	const poolResidual = poolTotal - perOutcomeFloor * winners.length;
	const winnerShares = winners.map((_, i) => perOutcomeFloor + (i === 0 ? poolResidual : 0));

	// 2) Losing outcomes — all bets lose, payout 0
	for (const o of outcomes) {
		if (o.isWinner) continue;
		for (const b of o.bets) {
			payouts.push({ betId: b.id, stake: b.stake, payout: 0, isVoidRefund: false });
		}
	}

	// 3) Winning outcomes — split share proportionally by stake
	for (let i = 0; i < winners.length; i++) {
		const o = winners[i];
		const share = winnerShares[i];
		const outcomeStake = totalStakeOf(o.bets);

		// Edge case: a winning outcome with no bets — its share is forfeited
		// (no one to pay). The forfeited share simply doesn't get distributed.
		// To respect REQ-ECON: it stays in nobody's pocket. We log it as zero
		// payouts for nonexistent bets — nothing to emit.
		if (outcomeStake === 0 || o.bets.length === 0) continue;

		const entries: { bet: BetForPayout; payout: number }[] = [];
		let distributed = 0;
		for (const b of o.bets) {
			const p = Math.floor((share * b.stake) / outcomeStake);
			entries.push({ bet: b, payout: p });
			distributed += p;
		}
		// Residual to the bet ranked first by compareForResidual
		const residual = share - distributed;
		if (residual !== 0) {
			const sorted = [...entries].sort((x, y) => compareForResidual(x.bet, y.bet));
			sorted[0].payout += residual;
		}
		for (const e of entries) {
			payouts.push({
				betId: e.bet.id,
				stake: e.bet.stake,
				payout: e.payout,
				isVoidRefund: false
			});
		}
	}

	return {
		poolTotal,
		winningOutcomeIds,
		isVoid: false,
		payouts
	};
}
