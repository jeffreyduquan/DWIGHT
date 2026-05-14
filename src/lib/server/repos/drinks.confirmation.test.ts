/**
 * @file drinks.confirmation.test.ts
 *
 * Phase 11: PEERS mode treats GM confirmations as peer confirmations.
 * EITHER is retained as a legacy alias and behaves like PEERS.
 */
import { describe, expect, it } from 'vitest';

type Mode = 'GM' | 'PEERS' | 'EITHER';

function shouldFinalize(
	mode: Mode,
	gmCount: number,
	peerCount: number,
	peersRequired: number
): boolean {
	if (mode === 'GM') return gmCount >= 1;
	// PEERS / EITHER: GM also counts as a peer.
	return peerCount + gmCount >= peersRequired;
}

describe('drink confirmation finalization', () => {
	it('GM mode: 1 GM finalizes', () => {
		expect(shouldFinalize('GM', 0, 0, 2)).toBe(false);
		expect(shouldFinalize('GM', 1, 0, 2)).toBe(true);
		expect(shouldFinalize('GM', 0, 5, 2)).toBe(false);
	});

	it('PEERS mode: peers required; GM counts as peer', () => {
		expect(shouldFinalize('PEERS', 0, 1, 2)).toBe(false);
		expect(shouldFinalize('PEERS', 0, 2, 2)).toBe(true);
		expect(shouldFinalize('PEERS', 1, 1, 2)).toBe(true);
		expect(shouldFinalize('PEERS', 2, 0, 2)).toBe(true);
	});

	it('EITHER (legacy) behaves like PEERS', () => {
		expect(shouldFinalize('EITHER', 0, 0, 2)).toBe(false);
		expect(shouldFinalize('EITHER', 1, 1, 2)).toBe(true);
		expect(shouldFinalize('EITHER', 0, 2, 2)).toBe(true);
		expect(shouldFinalize('EITHER', 0, 1, 2)).toBe(false);
	});
});
