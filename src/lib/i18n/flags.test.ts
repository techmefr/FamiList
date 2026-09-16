import { describe, expect, it } from 'vitest';
import { flagForLocale } from './flags';
import type { Locale } from './index.svelte';

/**
 * La liste est recopiée plutôt qu'importée de `index.svelte.ts`, qui tire `$app/environment` et ne
 * se charge pas hors du navigateur. Une langue ajoutée là-bas et oubliée ici sortira du typage.
 */
const CODES: Locale[] = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ru', 'ar', 'zh', 'mg'];
const SANS_DRAPEAU: Locale[] = ['en', 'ar'];

describe('flagForLocale', () => {
	it("rend le drapeau du pays d'origine de la langue", () => {
		expect(flagForLocale('fr')).toBe('🇫🇷');
		expect(flagForLocale('pt')).toBe('🇵🇹');
		expect(flagForLocale('mg')).toBe('🇲🇬');
	});

	it("ne choisit pas de pays pour l'anglais et l'arabe", () => {
		for (const code of SANS_DRAPEAU) {
			expect(flagForLocale(code)).toBeNull();
		}
	});

	it('répond pour chaque langue proposée, drapeau ou non', () => {
		for (const code of CODES) {
			const flag = flagForLocale(code);
			const attendu = SANS_DRAPEAU.includes(code);
			expect(flag === null).toBe(attendu);
		}
	});

	// Un drapeau en double signalerait une langue rattachée au mauvais pays par recopie.
	it('ne rattache pas deux langues au même pays', () => {
		const flags = CODES.map(flagForLocale).filter((flag) => flag !== null);
		expect(new Set(flags).size).toBe(flags.length);
	});
});
