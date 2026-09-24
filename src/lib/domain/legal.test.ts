import { describe, expect, it } from 'vitest';
import {
	LEGAL_DOCUMENTS,
	isLegalRoute,
	legalLanguage,
	legalPath,
	legalText,
	splitPlaceholders
} from './legal';

describe('legal routes', () => {
	it('recognises every legal document path as public', () => {
		for (const id of LEGAL_DOCUMENTS) expect(isLegalRoute(legalPath(id))).toBe(true);
	});

	it('does not open other paths', () => {
		expect(isLegalRoute('/legal')).toBe(false);
		expect(isLegalRoute('/legal/other')).toBe(false);
		expect(isLegalRoute('/profile')).toBe(false);
		expect(isLegalRoute('/legal/terms/extra')).toBe(false);
	});
});

describe('legal texts', () => {
	it('serves french to french and english to every other locale', () => {
		expect(legalLanguage('fr')).toBe('fr');
		for (const locale of ['en', 'de', 'es', 'it', 'pt', 'ru', 'ar', 'zh', 'mg']) {
			expect(legalLanguage(locale)).toBe('en');
		}
	});

	it.each(LEGAL_DOCUMENTS)('has the same structure in french and english for %s', (id) => {
		const fr = legalText(id, 'fr');
		const en = legalText(id, 'en');

		expect(fr.title).not.toBe('');
		expect(en.title).not.toBe('');
		expect(fr.sections.length).toBeGreaterThan(0);
		expect(en.sections.map((s) => [s.paragraphs?.length ?? 0, s.items?.length ?? 0])).toEqual(
			fr.sections.map((s) => [s.paragraphs?.length ?? 0, s.items?.length ?? 0])
		);
	});

	it('covers the rights and the supervisory authority in the privacy policy', () => {
		const body = JSON.stringify(legalText('privacy', 'fr'));

		for (const word of ['accès', 'rectification', 'effacement', 'portabilité', 'opposition', 'CNIL']) {
			expect(body).toContain(word);
		}
	});
});

describe('splitPlaceholders', () => {
	it('isolates the values still to confirm', () => {
		expect(splitPlaceholders('Contact: [TO CONFIRM: email].')).toEqual([
			{ text: 'Contact: ', placeholder: false },
			{ text: '[TO CONFIRM: email]', placeholder: true },
			{ text: '.', placeholder: false }
		]);
	});
});
