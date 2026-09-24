import { describe, expect, it } from 'vitest';
import fr from './locales/fr.json';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import itLocale from './locales/it.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';
import zh from './locales/zh.json';
import mg from './locales/mg.json';

const ALL_LOCALES = { en, de, es, it: itLocale, pt, ru, ar, zh, mg };

describe('locales completeness', () => {
	it('définit mealPlanSuggestion dans toutes les langues pour la suggestion de menu (#223)', () => {
		expect(fr.lists.mealPlanSuggestion).toBeTruthy();
		for (const [code, locale] of Object.entries(ALL_LOCALES)) {
			expect(locale.lists.mealPlanSuggestion, `missing lists.mealPlanSuggestion in ${code}`).toBeTruthy();
		}
	});

	it('définit les clés de fallback unreachable et collage manuel dans toutes les langues (#222)', () => {
		expect(fr.recipes.import.ai.unreachableOffer).toBeTruthy();
		expect(fr.recipes.import.ai.pasteLabel).toBeTruthy();
		expect(fr.recipes.import.ai.pastePlaceholder).toBeTruthy();

		for (const [code, locale] of Object.entries(ALL_LOCALES)) {
			expect(
				locale.recipes.import.ai.unreachableOffer,
				`missing recipes.import.ai.unreachableOffer in ${code}`
			).toBeTruthy();
			expect(
				locale.recipes.import.ai.pasteLabel,
				`missing recipes.import.ai.pasteLabel in ${code}`
			).toBeTruthy();
			expect(
				locale.recipes.import.ai.pastePlaceholder,
				`missing recipes.import.ai.pastePlaceholder in ${code}`
			).toBeTruthy();
		}
	});

	it('définit les clés du compte et du partage de carte dans toutes les langues (#248)', () => {
		const keys = [
			'tabCard',
			'tabAccount',
			'accountOpen',
			'accountNeedsMfa',
			'shareTitle',
			'requestsTitle',
			'websiteOpen',
			'offlineUnlock',
			'offlineWiped'
		] as const;
		for (const key of keys) expect(fr.cards[key], `missing cards.${key} in fr`).toBeTruthy();
		for (const [code, locale] of Object.entries(ALL_LOCALES)) {
			for (const key of keys) expect(locale.cards[key], `missing cards.${key} in ${code}`).toBeTruthy();
			for (const status of ['pending', 'accepted', 'declined'] as const) {
				expect(locale.cards.shareStatus[status], `missing cards.shareStatus.${status} in ${code}`).toBeTruthy();
			}
		}
	});
});
