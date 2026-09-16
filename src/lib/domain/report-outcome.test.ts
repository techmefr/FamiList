import { describe, expect, it } from 'vitest';
import { readReportOutcome } from './report-outcome';

describe('readReportOutcome', () => {
	it('rend le signalement déposé', () => {
		expect(readReportOutcome({ status: 'submitted', id: 'r1' })).toEqual({
			sent: true,
			errorKey: null
		});
	});

	it('sépare le plafond de signalements du plafond de captures', () => {
		expect(readReportOutcome({ status: 'rate_limited' }).errorKey).toBe('bugReport.errorTooMany');
		expect(readReportOutcome({ status: 'storage_limited' }).errorKey).toBe(
			'bugReport.errorTooMuchStorage'
		);
	});

	it('ne déclare rien envoyé quand un plafond est atteint', () => {
		expect(readReportOutcome({ status: 'rate_limited' }).sent).toBe(false);
		expect(readReportOutcome({ status: 'storage_limited' }).sent).toBe(false);
	});

	it("retombe sur l'échec générique pour une réponse inattendue", () => {
		expect(readReportOutcome(null).errorKey).toBe('bugReport.errorUnknown');
		expect(readReportOutcome('envoye').errorKey).toBe('bugReport.errorUnknown');
		expect(readReportOutcome({ status: 'autre' }).errorKey).toBe('bugReport.errorUnknown');
	});
});
