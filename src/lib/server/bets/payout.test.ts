/**
 * @file payout.test.ts — parimutuel market payout tests.
 * @implements REQ-TEST-001
 */
import { describe, expect, it } from 'vitest';
import { computeMarketPayouts } from './payout';

const t0 = new Date('2026-05-11T10:00:00Z');
const t1 = new Date('2026-05-11T10:01:00Z');
const t2 = new Date('2026-05-11T10:02:00Z');

describe('computeMarketPayouts — single winner', () => {
	it('one winning outcome takes the full pool, proportionally distributed', () => {
		const res = computeMarketPayouts([
			{
				id: 'oWin',
				isWinner: true,
				bets: [
					{ id: 'b1', stake: 100, createdAt: t0 },
					{ id: 'b2', stake: 300, createdAt: t1 }
				]
			},
			{
				id: 'oLose',
				isWinner: false,
				bets: [{ id: 'b3', stake: 200, createdAt: t0 }]
			}
		]);
		expect(res.poolTotal).toBe(600);
		expect(res.isVoid).toBe(false);
		expect(res.winningOutcomeIds).toEqual(['oWin']);

		const byId = Object.fromEntries(res.payouts.map((p) => [p.betId, p]));
		// Pool 600, single winner outcome → 600 split by stake ratio 100:300
		// b1: floor(600 * 100/400) = 150
		// b2: floor(600 * 300/400) = 450
		// distributed=600, residual=0
		expect(byId.b1.payout).toBe(150);
		expect(byId.b2.payout).toBe(450);
		expect(byId.b3.payout).toBe(0);
	});

	it('handles residual to largest stake', () => {
		// pool=33+34=67. Single winning outcome → share=67.
		// floor(67*33/67)=33, floor(67*34/67)=34. distributed=67. residual=0.
		// Force a residual via uneven pool: add a losing bet of 1 → pool=68
		const res = computeMarketPayouts([
			{
				id: 'oWin',
				isWinner: true,
				bets: [
					{ id: 'b1', stake: 33, createdAt: t0 },
					{ id: 'b2', stake: 34, createdAt: t1 }
				]
			},
			{
				id: 'oLose',
				isWinner: false,
				bets: [{ id: 'b3', stake: 1, createdAt: t2 }]
			}
		]);
		const byId = Object.fromEntries(res.payouts.map((p) => [p.betId, p]));
		// pool=68, winner share=68. floor(68*33/67)=33, floor(68*34/67)=34. sum=67. residual=1 → largest stake (b2)
		expect(byId.b1.payout).toBe(33);
		expect(byId.b2.payout).toBe(35);
		expect(byId.b3.payout).toBe(0);
		expect(byId.b1.payout + byId.b2.payout).toBe(68);
	});
});

describe('computeMarketPayouts — multi-winner split', () => {
	it('two winning outcomes split pool equally before proportional payout', () => {
		const res = computeMarketPayouts([
			{
				id: 'oA',
				isWinner: true,
				bets: [{ id: 'a1', stake: 100, createdAt: t0 }]
			},
			{
				id: 'oB',
				isWinner: true,
				bets: [{ id: 'b1', stake: 200, createdAt: t0 }]
			},
			{
				id: 'oC',
				isWinner: false,
				bets: [{ id: 'c1', stake: 300, createdAt: t0 }]
			}
		]);
		expect(res.poolTotal).toBe(600);
		expect(res.winningOutcomeIds.sort()).toEqual(['oA', 'oB']);
		const byId = Object.fromEntries(res.payouts.map((p) => [p.betId, p]));
		// pool 600, 2 winners → 300 each. each outcome has 1 bet so it gets the full 300.
		expect(byId.a1.payout).toBe(300);
		expect(byId.b1.payout).toBe(300);
		expect(byId.c1.payout).toBe(0);
	});

	it('odd pool: residual goes to first winning outcome', () => {
		const res = computeMarketPayouts([
			{ id: 'oA', isWinner: true, bets: [{ id: 'a1', stake: 50, createdAt: t0 }] },
			{ id: 'oB', isWinner: true, bets: [{ id: 'b1', stake: 51, createdAt: t0 }] }
		]);
		// pool 101, 2 winners → floor 50, residual 1 → first winning (oA) gets 51 share
		const byId = Object.fromEntries(res.payouts.map((p) => [p.betId, p]));
		expect(byId.a1.payout).toBe(51);
		expect(byId.b1.payout).toBe(50);
		expect(byId.a1.payout + byId.b1.payout).toBe(101);
	});

	it('winning outcome with no bets forfeits its share', () => {
		// pool 100, 2 winners, only oA has a bet → oA gets 50, oB share (50) forfeit
		const res = computeMarketPayouts([
			{ id: 'oA', isWinner: true, bets: [{ id: 'a1', stake: 100, createdAt: t0 }] },
			{ id: 'oB', isWinner: true, bets: [] }
		]);
		const byId = Object.fromEntries(res.payouts.map((p) => [p.betId, p]));
		// pool=100; perOutcomeFloor=50, residual=0 → oA share=50, but residual goes to first
		// winner which is oA → 50+0=50. oB share=50 forfeited.
		expect(byId.a1.payout).toBe(50);
	});
});

describe('computeMarketPayouts — void', () => {
	it('no winning outcome → all stakes refunded', () => {
		const res = computeMarketPayouts([
			{ id: 'oA', isWinner: false, bets: [{ id: 'a1', stake: 100, createdAt: t0 }] },
			{ id: 'oB', isWinner: false, bets: [{ id: 'b1', stake: 250, createdAt: t1 }] }
		]);
		expect(res.isVoid).toBe(true);
		expect(res.winningOutcomeIds).toEqual([]);
		const byId = Object.fromEntries(res.payouts.map((p) => [p.betId, p]));
		expect(byId.a1.payout).toBe(100);
		expect(byId.a1.isVoidRefund).toBe(true);
		expect(byId.b1.payout).toBe(250);
		expect(byId.b1.isVoidRefund).toBe(true);
	});

	it('empty market → poolTotal 0 and void with no payouts', () => {
		const res = computeMarketPayouts([{ id: 'oA', isWinner: false, bets: [] }]);
		expect(res.poolTotal).toBe(0);
		expect(res.isVoid).toBe(true);
		expect(res.payouts).toEqual([]);
	});
});

describe('computeMarketPayouts — invariants', () => {
	it('total non-void payout never exceeds pool', () => {
		const res = computeMarketPayouts([
			{
				id: 'oA',
				isWinner: true,
				bets: [
					{ id: 'b1', stake: 17, createdAt: t0 },
					{ id: 'b2', stake: 13, createdAt: t1 }
				]
			},
			{ id: 'oB', isWinner: false, bets: [{ id: 'b3', stake: 70, createdAt: t2 }] }
		]);
		const sum = res.payouts.reduce((s, p) => s + p.payout, 0);
		expect(sum).toBeLessThanOrEqual(res.poolTotal);
	});

	it('every winner-bet payout ≥ 0', () => {
		const res = computeMarketPayouts([
			{
				id: 'oA',
				isWinner: true,
				bets: [
					{ id: 'b1', stake: 1, createdAt: t0 },
					{ id: 'b2', stake: 1, createdAt: t1 }
				]
			}
		]);
		for (const p of res.payouts) expect(p.payout).toBeGreaterThanOrEqual(0);
	});
});
