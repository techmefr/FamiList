import { foldForSearch } from './emoji';
import { scoreEntry } from './search';
import { RECIPE_TAG_CATEGORIES, type RecipeTagCategory } from './recipe-tags';

/**
 * Searching and filtering the recipes page (#315, #316), on the local cache only: a family's recipes come
 * to a few hundred rows at most, already in memory, and the search is used where the network is worst — in
 * the kitchen, in the shop.
 *
 * The domain never sees a translated word it did not receive: tag labels and option labels are handed in
 * by the caller, so everything here stays testable without bringing up the i18n.
 */

/** How long a recipe takes, all steps added up. Disjoint ranges: a recipe falls in exactly one. */
export const TIME_BUCKETS = ['upTo15', 'upTo30', 'upTo60', 'over60'] as const;
export type TimeBucket = (typeof TIME_BUCKETS)[number];

const BUCKET_LIMITS: [TimeBucket, number][] = [
	['upTo15', 15 * 60],
	['upTo30', 30 * 60],
	['upTo60', 60 * 60]
];

export type FilterCategory = RecipeTagCategory | 'ingredient' | 'time';

/** The categories of the sheet's first column, in the order they are shown. */
export const FILTER_CATEGORIES: readonly FilterCategory[] = [
	...RECIPE_TAG_CATEGORIES.map((category) => category.id),
	'ingredient',
	'time'
];

/**
 * Inside a category, a choice widens the result — "soup or dessert", "summer or spring" — since a recipe is
 * rarely two courses at once. Diets and ingredients narrow it instead: somebody ticking "vegan" and
 * "gluten free" must eat both, and "chicken" and "rice" means a recipe with both in it.
 */
const EVERY_CHOICE: ReadonlySet<FilterCategory> = new Set(['diet', 'ingredient']);

export type FilterSelection = Record<FilterCategory, string[]>;

export const emptySelection = (): FilterSelection =>
	Object.fromEntries(FILTER_CATEGORIES.map((category) => [category, []])) as unknown as FilterSelection;

export interface FilterOption {
	key: string;
	label: string;
}

export interface FilterableRecipe {
	id: string;
	name: string;
	/** Tag keys, as stored. */
	tags: readonly string[];
	/** The ingredient names, as written. */
	ingredients: readonly string[];
	/** The tags in the reader's language: a search for "soupe" must find a recipe tagged `soup`. */
	tagLabels: readonly string[];
	/** Every step's duration added up, or `null` when no step says how long it takes. */
	totalSeconds: number | null;
}

/** `null` when no step has a duration: "unknown" is not "instant", and it must not pass a time filter. */
export function totalSeconds(durations: readonly (number | null | undefined)[]): number | null {
	const known = durations.filter((seconds): seconds is number => typeof seconds === 'number' && seconds > 0);
	return known.length ? known.reduce((sum, seconds) => sum + seconds, 0) : null;
}

export function timeBucketOf(seconds: number | null): TimeBucket | null {
	if (seconds === null) return null;
	return BUCKET_LIMITS.find(([, limit]) => seconds <= limit)?.[0] ?? 'over60';
}

/** "Tomates " and "tomates" are one ingredient to filter on; the spelling shown is the first one met. */
export const ingredientKey = (name: string): string => foldForSearch(name).replaceAll(/\s+/g, ' ');

/** The household's ingredients, one row per ingredient however many recipes use it, alphabetical. */
export function ingredientOptions(names: readonly string[]): FilterOption[] {
	const byKey = new Map<string, string>();

	for (const name of names) {
		const key = ingredientKey(name);
		if (key && !byKey.has(key)) byKey.set(key, name.trim());
	}

	return [...byKey].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
}

/** The keys a category offers before labels are put on them: the catalogue, or the fixed time ranges. */
export function fixedKeys(category: Exclude<FilterCategory, 'ingredient'>): readonly string[] {
	if (category === 'time') return TIME_BUCKETS;
	return RECIPE_TAG_CATEGORIES.find((entry) => entry.id === category)!.tags;
}

export const countIn = (selection: FilterSelection, category: FilterCategory): number =>
	selection[category].length;

export const activeCount = (selection: FilterSelection): number =>
	FILTER_CATEGORIES.reduce((sum, category) => sum + countIn(selection, category), 0);

export function toggleFilter(selection: FilterSelection, category: FilterCategory, key: string): FilterSelection {
	const current = selection[category];
	const next = current.includes(key) ? current.filter((chosen) => chosen !== key) : [...current, key];
	return { ...selection, [category]: next };
}

function keysOf(recipe: FilterableRecipe, category: FilterCategory): ReadonlySet<string> {
	if (category === 'ingredient') return new Set(recipe.ingredients.map(ingredientKey));
	if (category === 'time') {
		const bucket = timeBucketOf(recipe.totalSeconds);
		return new Set(bucket ? [bucket] : []);
	}
	return new Set(recipe.tags);
}

export function matchesSelection(recipe: FilterableRecipe, selection: FilterSelection): boolean {
	return FILTER_CATEGORIES.every((category) => {
		const wanted = selection[category];
		if (wanted.length === 0) return true;

		const has = keysOf(recipe, category);
		return EVERY_CHOICE.has(category) ? wanted.every((key) => has.has(key)) : wanted.some((key) => has.has(key));
	});
}

/**
 * The recipes a search finds, best first; an empty search keeps them all, in the page's own order.
 *
 * Same scoring as the household search: every word typed must be found, in any field, the name weighing
 * more than an ingredient or a tag — "tarte" brings out "Tarte aux pommes" before a quiche whose pastry
 * line says "pâte à tarte".
 */
export function searchRecipes<T extends FilterableRecipe>(query: string, recipes: readonly T[]): T[] {
	if (!foldForSearch(query)) return [...recipes];

	return recipes
		.map((recipe) => ({
			recipe,
			score: scoreEntry(query, [
				{ value: recipe.name, weight: 1 },
				...recipe.ingredients.map((value) => ({ value, weight: 0.7 })),
				...recipe.tagLabels.map((value) => ({ value, weight: 0.6 }))
			])
		}))
		.filter((entry) => entry.score > 0)
		.sort((a, b) => b.score - a.score || a.recipe.name.localeCompare(b.recipe.name))
		.map((entry) => entry.recipe);
}

export const findRecipes = <T extends FilterableRecipe>(
	query: string,
	selection: FilterSelection,
	recipes: readonly T[]
): T[] => searchRecipes(query, recipes.filter((recipe) => matchesSelection(recipe, selection)));

/** The sheet's own search: every word typed must appear in the option's label, accents and case aside. */
export function matchOptions(query: string, options: readonly FilterOption[]): FilterOption[] {
	const needles = foldForSearch(query).split(/\s+/).filter(Boolean);
	if (needles.length === 0) return [...options];

	return options.filter((option) => {
		const label = foldForSearch(option.label);
		return needles.every((needle) => label.includes(needle));
	});
}

/** The chosen options first, in the order they were ticked, then every option: the sheet's two zones. */
export function zonesOf(
	options: readonly FilterOption[],
	chosen: readonly string[],
	query: string
): { selected: FilterOption[]; all: FilterOption[] } {
	const byKey = new Map(options.map((option) => [option.key, option]));
	const selected = chosen.flatMap((key) => {
		const option = byKey.get(key);
		return option ? [option] : [];
	});

	return { selected: matchOptions(query, selected), all: matchOptions(query, options) };
}

/**
 * How many rows of the "all" zone are drawn at first, and added each time its end scrolls into view. A
 * household's ingredients can pass five hundred, and each row is a large checkbox with its label.
 */
export const OPTIONS_PAGE = 40;
