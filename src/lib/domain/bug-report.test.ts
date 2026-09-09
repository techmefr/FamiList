import { describe, expect, it } from 'vitest';
import { isReportKind } from './bug-report';

describe('isReportKind', () => {
	it('accepte "bug"', () => {
		expect(isReportKind('bug')).toBe(true);
	});

	it('accepte "suggestion"', () => {
		expect(isReportKind('suggestion')).toBe(true);
	});

	it('refuse une valeur inconnue', () => {
		expect(isReportKind('idee')).toBe(false);
	});

	it('refuse une valeur non textuelle', () => {
		expect(isReportKind(null)).toBe(false);
		expect(isReportKind(undefined)).toBe(false);
		expect(isReportKind(3)).toBe(false);
	});
});
