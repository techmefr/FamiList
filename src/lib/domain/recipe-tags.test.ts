import { describe, expect, it } from 'vitest';
import {
	categoryOf,
	isRecipeTag,
	knownTags,
	RECIPE_TAG_CATEGORIES,
	RECIPE_TAG_PATTERN,
	RECIPE_TAGS,
	sanitizeTags,
	storedTags,
	tagsByCategory,
	tagsFromSchemaOrg,
	toggleTag
} from './recipe-tags';
import fr from '../i18n/locales/fr.json';
import en from '../i18n/locales/en.json';
import de from '../i18n/locales/de.json';
import es from '../i18n/locales/es.json';
import itLocale from '../i18n/locales/it.json';
import pt from '../i18n/locales/pt.json';
import ru from '../i18n/locales/ru.json';
import ar from '../i18n/locales/ar.json';
import zh from '../i18n/locales/zh.json';
import mg from '../i18n/locales/mg.json';

const LOCALES = { fr, en, de, es, it: itLocale, pt, ru, ar, zh, mg };

describe('catalogue', () => {
	it('donne des cles uniques, au format accepte par la base', () => {
		expect(new Set(RECIPE_TAGS).size).toBe(RECIPE_TAGS.length);
		for (const tag of RECIPE_TAGS) expect(tag).toMatch(RECIPE_TAG_PATTERN);
	});

	it('range chaque cle dans sa categorie', () => {
		expect(categoryOf('dessert')).toBe('course');
		expect(categoryOf('vegan')).toBe('diet');
		expect(categoryOf('picnic')).toBe('occasion');
		expect(categoryOf('winter')).toBe('season');
	});

	it('traduit chaque categorie et chaque cle dans les 10 langues', () => {
		for (const [code, locale] of Object.entries(LOCALES)) {
			const block = locale.recipeTags as {
				title: string;
				hint: string;
				listLabel: string;
				category: Record<string, string>;
				tag: Record<string, string>;
			};
			expect(block.title, `recipeTags.title in ${code}`).toBeTruthy();
			expect(block.hint, `recipeTags.hint in ${code}`).toBeTruthy();
			expect(block.listLabel, `recipeTags.listLabel in ${code}`).toBeTruthy();
			for (const category of RECIPE_TAG_CATEGORIES) {
				expect(block.category[category.id], `recipeTags.category.${category.id} in ${code}`).toBeTruthy();
			}
			for (const tag of RECIPE_TAGS) expect(block.tag[tag], `recipeTags.tag.${tag} in ${code}`).toBeTruthy();
			expect(Object.keys(block.tag).sort()).toEqual([...RECIPE_TAGS].sort());
		}
	});
});

describe('sanitizeTags', () => {
	it('ne garde que les cles connues, sans doublon, dans l ordre du catalogue', () => {
		expect(sanitizeTags(['vegan', 'dessert', 'Dessert', 'gourmand', 42, null, 'vegan'])).toEqual([
			'dessert',
			'vegan'
		]);
	});

	it('rend une liste vide pour ce qui n est pas un tableau', () => {
		expect(sanitizeTags('dessert')).toEqual([]);
		expect(sanitizeTags(undefined)).toEqual([]);
	});

	it('reconnait une cle connue et refuse les autres', () => {
		expect(isRecipeTag('gluten_free')).toBe(true);
		expect(isRecipeTag('glutenfree')).toBe(false);
		expect(isRecipeTag(3)).toBe(false);
	});
});

describe('storedTags', () => {
	it('garde une cle qu une version plus recente a ajoutee', () => {
		expect(storedTags(['main', 'brunch_sunday'])).toEqual(['main', 'brunch_sunday']);
	});

	it('ecarte ce qui n a pas la forme d une cle', () => {
		expect(storedTags(['main', 'Main', 'a b', '', null, 'main'])).toEqual(['main']);
		expect(storedTags(null)).toEqual([]);
	});

	it('n affiche que les cles connues', () => {
		expect(knownTags(['brunch_sunday', 'winter', 'main'])).toEqual(['main', 'winter']);
		expect(knownTags(undefined)).toEqual([]);
	});
});

describe('toggleTag', () => {
	it('ajoute puis retire une cle sans toucher aux autres', () => {
		const once = toggleTag(['brunch_sunday'], 'dessert');
		expect(once).toEqual(['brunch_sunday', 'dessert']);
		expect(toggleTag(once, 'dessert')).toEqual(['brunch_sunday']);
	});
});

describe('tagsByCategory', () => {
	it('regroupe par categorie et saute les categories vides', () => {
		expect(tagsByCategory(['winter', 'main', 'soup', 'unknown_key'])).toEqual([
			{ category: 'course', tags: ['soup', 'main'] },
			{ category: 'season', tags: ['winter'] }
		]);
	});
});

describe('tagsFromSchemaOrg', () => {
	it('lit les categories francaises et anglaises, accents et casse compris', () => {
		expect(tagsFromSchemaOrg(['Plat principal'])).toEqual(['main']);
		expect(tagsFromSchemaOrg(['DESSERT'])).toEqual(['dessert']);
		expect(tagsFromSchemaOrg(['Entrée froide'])).toEqual(['cold_starter']);
		expect(tagsFromSchemaOrg(['Side Dish'])).toEqual(['side']);
		expect(tagsFromSchemaOrg(['Goûter'])).toEqual(['snack']);
	});

	it('lit un regime ecrit en URL schema.org ou en nom court', () => {
		expect(tagsFromSchemaOrg(['https://schema.org/VeganDiet'])).toEqual(['vegan']);
		expect(tagsFromSchemaOrg(['http://schema.org/GlutenFreeDiet', 'LowLactoseDiet'])).toEqual([
			'gluten_free',
			'lactose_free'
		]);
		expect(tagsFromSchemaOrg(['DiabeticDiet'])).toEqual(['low_sugar']);
	});

	it('decoupe une chaine qui porte plusieurs categories', () => {
		expect(tagsFromSchemaOrg(['Dessert, Goûter / Végétarien'])).toEqual(['dessert', 'snack', 'vegetarian']);
	});

	it('reconnait un mot au sein d une expression plus longue', () => {
		expect(tagsFromSchemaOrg(['Recette de Noël'])).toEqual(['holiday']);
		expect(tagsFromSchemaOrg(['Soupe d hiver'])).toEqual(['soup', 'winter']);
	});

	it('ne devine rien sur une entree sans precision ni sur une cuisine', () => {
		expect(tagsFromSchemaOrg(['Entrée', 'Starter', 'Appetizer', 'Française', 'Italian', 'Gratin'])).toEqual([]);
	});

	it('ne prend un mot court que seul, jamais au milieu d une phrase', () => {
		expect(tagsFromSchemaOrg(['Été'])).toEqual(['summer']);
		expect(tagsFromSchemaOrg(['A ete teste'])).toEqual([]);
	});

	it('ignore ce qui n est pas une chaine', () => {
		expect(tagsFromSchemaOrg([null, 3, { name: 'Dessert' }])).toEqual([]);
		expect(tagsFromSchemaOrg(undefined)).toEqual([]);
	});
});
