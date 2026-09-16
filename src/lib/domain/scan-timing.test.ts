import { describe, expect, it } from 'vitest';
import { SCAN_SUGGEST_MS, SCAN_TIMEOUT_MS, scanOutcome } from './scan-timing';

describe('delais du scan', () => {
	it('propose la photo avant d abandonner', () => {
		expect(SCAN_SUGGEST_MS).toBeLessThan(SCAN_TIMEOUT_MS);
	});

	// Sous deux secondes, la suggestion tomberait sur une carte simplement pas encore cadree.
	it('laisse le temps de cadrer avant de suggerer', () => {
		expect(SCAN_SUGGEST_MS).toBeGreaterThanOrEqual(2_000);
	});

	it('finit par rendre la camera', () => {
		expect(Number.isFinite(SCAN_TIMEOUT_MS)).toBe(true);
	});
});

describe('scanOutcome', () => {
	it('ne reproche rien a un arret demande', () => {
		expect(scanOutcome(true)).toBe('stopped');
	});

	it('signale la recherche restee vaine', () => {
		expect(scanOutcome(false)).toBe('timeout');
	});
});
