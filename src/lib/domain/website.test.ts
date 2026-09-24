import { describe, expect, it } from 'vitest';
import { safeWebsiteUrl } from './website';

describe('safeWebsiteUrl', () => {
	it('garde une adresse http ou https', () => {
		expect(safeWebsiteUrl('https://www.carrefour.fr/compte')).toBe('https://www.carrefour.fr/compte');
		expect(safeWebsiteUrl('http://example.org')).toBe('http://example.org/');
	});

	it('ajoute https à une adresse tapée sans protocole', () => {
		expect(safeWebsiteUrl('  leclerc.fr ')).toBe('https://leclerc.fr/');
	});

	it('refuse tout autre protocole', () => {
		expect(safeWebsiteUrl('javascript:alert(1)')).toBeNull();
		expect(safeWebsiteUrl('data:text/html,<b>x</b>')).toBeNull();
		expect(safeWebsiteUrl('ftp://example.org')).toBeNull();
	});

	it('refuse une saisie vide ou qui n’est pas une adresse', () => {
		expect(safeWebsiteUrl('')).toBeNull();
		expect(safeWebsiteUrl(undefined)).toBeNull();
		expect(safeWebsiteUrl('pas une adresse')).toBeNull();
		expect(safeWebsiteUrl('localhost')).toBeNull();
	});
});
