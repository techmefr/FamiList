import { describe, expect, it } from 'vitest';
import {
	activeCount,
	countIn,
	emptySelection,
	findRecipes,
	fixedKeys,
	FILTER_CATEGORIES,
	ingredientKey,
	ingredientOptions,
	matchesSelection,
	matchOptions,
	searchRecipes,
	timeBucketOf,
	toggleFilter,
	totalSeconds,
	zonesOf,
	TIME_BUCKETS,
	type FilterableRecipe
} from './recipe-filter';

const recipe = (overrides: Partial<FilterableRecipe> & { id: string }): FilterableRecipe => ({
	name: overrides.id,
	tags: [],
	ingredients: [],
	tagLabels: [],
	totalSeconds: null,
	...overrides
});

const soupe = recipe({
	id: 'soupe',
	name: 'Soupe de poireaux',
	tags: ['soup', 'vegetarian', 'winter'],
	tagLabels: ['Soupe', 'Végétarien', 'Hiver'],
	ingredients: ['Poireaux', 'Pommes de terre', 'Crème'],
	totalSeconds: 40 * 60
});

const tarte = recipe({
	id: 'tarte',
	name: 'Tarte aux pommes',
	tags: ['dessert', 'vegetarian'],
	tagLabels: ['Dessert', 'Végétarien'],
	ingredients: ['Pâte brisée', 'Pommes'],
	totalSeconds: 10 * 60
});

const quiche = recipe({
	id: 'quiche',
	name: 'Quiche lorraine',
	tags: ['main'],
	tagLabels: ['Plat principal'],
	ingredients: ['Pâte à tarte', 'Lardons', 'Crème']
});

const all = [soupe, tarte, quiche];
const ids = (recipes: FilterableRecipe[]) => recipes.map((entry) => entry.id);

describe('totalSeconds', () => {
	it('additionne les durees connues', () => {
		expect(totalSeconds([600, null, undefined, 300])).toBe(900);
	});

	it('vaut null quand aucune etape ne donne de duree', () => {
		expect(totalSeconds([null, undefined])).toBeNull();
		expect(totalSeconds([])).toBeNull();
	});
});

describe('timeBucketOf', () => {
	it('range chaque duree dans une seule tranche, bornes incluses', () => {
		expect(timeBucketOf(15 * 60)).toBe('upTo15');
		expect(timeBucketOf(15 * 60 + 1)).toBe('upTo30');
		expect(timeBucketOf(60 * 60)).toBe('upTo60');
		expect(timeBucketOf(3 * 60 * 60)).toBe('over60');
	});

	it('ne range pas une recette sans duree', () => {
		expect(timeBucketOf(null)).toBeNull();
	});
});

describe('ingredientOptions', () => {
	it('fusionne les orthographes a accents, casse et espaces pres, et trie', () => {
		expect(ingredientOptions(['Crème', ' creme ', 'Beurre', 'Pâte  brisée', 'pate brisee', ''])).toEqual([
			{ key: 'beurre', label: 'Beurre' },
			{ key: 'creme', label: 'Crème' },
			{ key: 'pate brisee', label: 'Pâte  brisée' }
		]);
	});

	it('donne la meme cle au nom saisi et a l option', () => {
		expect(ingredientKey('  Pâte   Brisée')).toBe('pate brisee');
	});
});

describe('fixedKeys', () => {
	it('reprend le catalogue des categories et les tranches de temps', () => {
		expect(fixedKeys('season')).toEqual(['spring', 'summer', 'autumn', 'winter']);
		expect(fixedKeys('time')).toEqual(TIME_BUCKETS);
	});

	it('met les categories du catalogue avant ingredient et temps', () => {
		expect(FILTER_CATEGORIES).toEqual(['course', 'diet', 'occasion', 'season', 'ingredient', 'time']);
	});
});

describe('selection', () => {
	it('compte les filtres par categorie et en tout', () => {
		let selection = emptySelection();
		selection = toggleFilter(selection, 'course', 'soup');
		selection = toggleFilter(selection, 'course', 'dessert');
		selection = toggleFilter(selection, 'time', 'upTo15');

		expect(countIn(selection, 'course')).toBe(2);
		expect(countIn(selection, 'diet')).toBe(0);
		expect(activeCount(selection)).toBe(3);
	});

	it('retire un filtre coche une seconde fois, sans toucher la selection d origine', () => {
		const once = toggleFilter(emptySelection(), 'diet', 'vegan');
		const twice = toggleFilter(once, 'diet', 'vegan');

		expect(once.diet).toEqual(['vegan']);
		expect(twice.diet).toEqual([]);
	});
});

describe('matchesSelection', () => {
	it('laisse tout passer sans filtre', () => {
		expect(all.every((entry) => matchesSelection(entry, emptySelection()))).toBe(true);
	});

	it('elargit au sein d un type de plat', () => {
		const selection = { ...emptySelection(), course: ['soup', 'dessert'] };
		expect(ids(all.filter((entry) => matchesSelection(entry, selection)))).toEqual(['soupe', 'tarte']);
	});

	it('exige chaque regime coche', () => {
		const selection = { ...emptySelection(), diet: ['vegetarian', 'gluten_free'] };
		expect(all.filter((entry) => matchesSelection(entry, selection))).toEqual([]);
	});

	it('exige chaque ingredient coche, accents et casse a part', () => {
		const selection = { ...emptySelection(), ingredient: ['creme', 'lardons'] };
		expect(ids(all.filter((entry) => matchesSelection(entry, selection)))).toEqual(['quiche']);
	});

	it('filtre sur le temps total, et ecarte une recette sans duree', () => {
		const selection = { ...emptySelection(), time: ['upTo15', 'upTo60'] };
		expect(ids(all.filter((entry) => matchesSelection(entry, selection)))).toEqual(['soupe', 'tarte']);
	});

	it('croise les categories', () => {
		const selection = { ...emptySelection(), diet: ['vegetarian'], season: ['winter'] };
		expect(ids(all.filter((entry) => matchesSelection(entry, selection)))).toEqual(['soupe']);
	});
});

describe('searchRecipes', () => {
	it('garde tout, dans l ordre de la page, pour une recherche vide', () => {
		expect(ids(searchRecipes('  ', all))).toEqual(['soupe', 'tarte', 'quiche']);
	});

	it('cherche dans le nom sans accents ni casse', () => {
		expect(ids(searchRecipes('LORRAINE', all))).toEqual(['quiche']);
		expect(ids(searchRecipes('poireaux', all))).toEqual(['soupe']);
	});

	it('cherche dans les ingredients, le nom passant devant', () => {
		expect(ids(searchRecipes('tarte', all))).toEqual(['tarte', 'quiche']);
		expect(ids(searchRecipes('lardons', all))).toEqual(['quiche']);
	});

	it('cherche dans les categories traduites', () => {
		expect(ids(searchRecipes('vegetarien', all))).toEqual(['soupe', 'tarte']);
	});

	it('demande chaque mot tape, dans n importe quel champ', () => {
		expect(ids(searchRecipes('creme hiver', all))).toEqual(['soupe']);
		expect(searchRecipes('creme dessert', all)).toEqual([]);
	});

	it('combine recherche et filtres', () => {
		const selection = { ...emptySelection(), course: ['main'] };
		expect(ids(findRecipes('creme', selection, all))).toEqual(['quiche']);
	});
});

describe('zones de la feuille', () => {
	const options = [
		{ key: 'soup', label: 'Soupe' },
		{ key: 'main', label: 'Plat principal' },
		{ key: 'side', label: 'Accompagnement' }
	];

	it('met les choix en tete, dans l ordre ou ils ont ete coches', () => {
		const zones = zonesOf(options, ['side', 'soup', 'unknown'], '');
		expect(zones.selected.map((option) => option.key)).toEqual(['side', 'soup']);
		expect(zones.all).toEqual(options);
	});

	it('filtre les deux zones avec la meme recherche', () => {
		const zones = zonesOf(options, ['side', 'soup'], 'SOU');
		expect(zones.selected.map((option) => option.key)).toEqual(['soup']);
		expect(zones.all.map((option) => option.key)).toEqual(['soup']);
	});

	it('cherche sans accents, chaque mot', () => {
		expect(matchOptions('pl princ', options).map((option) => option.key)).toEqual(['main']);
		expect(matchOptions('épice', options)).toEqual([]);
	});
});
