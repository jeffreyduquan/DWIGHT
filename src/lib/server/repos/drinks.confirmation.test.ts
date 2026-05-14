/**
 * @file drinks.confirmation.test.ts
 *
 * Phase 11.2: ConfirmationMode is `GM | PEERS` only. PEERS treats a GM
 * confirmation as a peer confirmation.
 */
import { describe, expect, it } from 'vitest';

type Mode = 'GM' | 'PEERS';

function shouldFinalize(
	mode: Mode,
	gmCount: number,
	peerCount: number,
	peersRequired: number
): boolean {
	if (mode === 'GM') return gmCount >= 1;
	// PEERS: GM also counts as a peer.
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
});
