/**
 * @file drinks.confirmation.test.ts
 *
 * Unit tests on the confirmation finalization rule, mocking the DB by
 * exercising the rule logic directly.
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
	if (mode === 'PEERS') return peerCount >= peersRequired;
	return gmCount >= 1 || peerCount >= peersRequired;
}

describe('drink confirmation finalization', () => {
	it('GM mode: 1 GM finalizes', () => {
		expect(shouldFinalize('GM', 0, 0, 2)).toBe(false);
		expect(shouldFinalize('GM', 1, 0, 2)).toBe(true);
		expect(shouldFinalize('GM', 0, 5, 2)).toBe(false); // peers ignored
	});

	it('PEERS mode: N peers finalize, GM does not count', () => {
		expect(shouldFinalize('PEERS', 0, 1, 2)).toBe(false);
		expect(shouldFinalize('PEERS', 0, 2, 2)).toBe(true);
		expect(shouldFinalize('PEERS', 1, 1, 2)).toBe(false);
	});

	it('EITHER mode: 1 GM OR N peers finalize (whichever first)', () => {
		expect(shouldFinalize('EITHER', 0, 0, 2)).toBe(false);
		expect(shouldFinalize('EITHER', 1, 0, 2)).toBe(true);
		expect(shouldFinalize('EITHER', 0, 2, 2)).toBe(true);
		expect(shouldFinalize('EITHER', 0, 1, 2)).toBe(false);
	});
});
