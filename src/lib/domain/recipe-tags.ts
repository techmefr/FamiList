import { slugify } from './slug';

/**
 * The fixed set of recipe tags (#314): what a recipe is (course), who can eat it (diet), when it is made
 * (occasion, season). They are what the recipe filters and browsing are built on.
 *
 * Stored as stable keys, never as words: a label changes with the language and with a rewording, a key
 * does not, and a recipe tagged in French must be found by a household member reading in Arabic. The
 * labels live in the locale files under `recipeTags.tag.<key>`.
 *
 * The list is fixed on purpose (no tags of one's own): a filter only helps when everybody ticks the same
 * boxes. Adding a key later is a change to this file and the locales, nothing else — the database checks
 * the shape of a key, not the list, so an older app never refuses a recipe tagged by a newer one.
 */

export const RECIPE_TAG_CATEGORIES = [
	{
		id: 'course',
		tags: [
			'breakfast',
			'aperitif',
			'hot_starter',
			'cold_starter',
			'soup',
			'main',
			'side',
			'dessert',
			'snack',
			'drink'
		]
	},
	{
		id: 'diet',
		tags: ['vegetarian', 'vegan', 'gluten_free', 'lactose_free', 'low_salt', 'low_sugar']
	},
	{ id: 'occasion', tags: ['quick', 'kids', 'party', 'picnic', 'holiday'] },
	{ id: 'season', tags: ['spring', 'summer', 'autumn', 'winter'] }
] as const;

export type RecipeTagCategory = (typeof RECIPE_TAG_CATEGORIES)[number]['id'];
export type RecipeTag = (typeof RECIPE_TAG_CATEGORIES)[number]['tags'][number];

/** Every known key, in catalogue order: the order tags are shown and saved in. */
export const RECIPE_TAGS: readonly RecipeTag[] = RECIPE_TAG_CATEGORIES.flatMap((category) => category.tags);

const KNOWN = new Set<string>(RECIPE_TAGS);

/** The shape the database accepts for a key, known to this version of the app or not. */
export const RECIPE_TAG_PATTERN = /^[a-z][a-z_]*$/;

/** Mirrors the column's check: generous, since the catalogue itself is the real limit. */
export const MAX_STORED_TAGS = 40;

export const isRecipeTag = (value: unknown): value is RecipeTag =>
	typeof value === 'string' && KNOWN.has(value);

export function categoryOf(tag: RecipeTag): RecipeTagCategory {
	return RECIPE_TAG_CATEGORIES.find((category) => (category.tags as readonly string[]).includes(tag))!.id;
}

/**
 * The known tags in `raw`, deduplicated and in catalogue order; anything else is dropped. For what comes
 * from outside — an AI answer, a page — where an unknown word is a mistake, not a newer key.
 */
export function sanitizeTags(raw: unknown): RecipeTag[] {
	if (!Array.isArray(raw)) return [];

	const given = new Set(raw.map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : value)));
	return RECIPE_TAGS.filter((tag) => given.has(tag));
}

/**
 * The tags read back from a saved row. Keys this version does not know are kept, not dropped: they were
 * written by a newer app, and saving the recipe again from here must not erase them.
 */
export function storedTags(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];

	const kept = raw.filter((value): value is string => typeof value === 'string' && RECIPE_TAG_PATTERN.test(value));
	return [...new Set(kept)].slice(0, MAX_STORED_TAGS);
}

/** The known tags of a recipe, in catalogue order: what the card shows. */
export const knownTags = (tags: readonly string[] | undefined): RecipeTag[] => sanitizeTags(tags ?? []);

/** Adds or removes one tag, leaving every other one — unknown keys included — where it was. */
export function toggleTag(tags: readonly string[], tag: RecipeTag): string[] {
	return tags.includes(tag) ? tags.filter((current) => current !== tag) : [...tags, tag];
}

/** The known tags grouped by category, empty categories left out: for the card and the filters. */
export function tagsByCategory(
	tags: readonly string[] | undefined
): { category: RecipeTagCategory; tags: RecipeTag[] }[] {
	const wanted = new Set(tags ?? []);

	return RECIPE_TAG_CATEGORIES.map((category) => ({
		category: category.id,
		tags: category.tags.filter((tag) => wanted.has(tag)) as RecipeTag[]
	})).filter((group) => group.tags.length > 0);
}

/**
 * How cooking sites word each tag in schema.org `recipeCategory`, `recipeCuisine` and `suitableForDiet`,
 * as slugs. Mostly French and English, the rest for the languages the app speaks.
 *
 * Left out on purpose: a bare "entrée" / "starter" / "appetizer" (hot or cold? and "entrée" is the main
 * course in American English), "cake" (a French "cake" is often savoury). Never inventing is the rule of
 * the whole import (`recipe-import.ts`): an unticked chip costs one tap, a wrong one misleads a filter.
 */
const SCHEMA_ORG_WORDS: Record<RecipeTag, string[]> = {
	breakfast: ['petit-dejeuner', 'breakfast', 'brunch', 'desayuno', 'fruhstuck', 'colazione', 'pequeno-almoco', 'cafe-da-manha'],
	aperitif: ['aperitif', 'aperitifs', 'apero', 'aperitivo', 'amuse-bouche', 'amuse-bouches', 'tapas', 'finger-food', 'bouchees'],
	hot_starter: ['entree-chaude', 'entrees-chaudes', 'hot-starter', 'hot-starters', 'hot-appetizer', 'warm-starter'],
	cold_starter: ['entree-froide', 'entrees-froides', 'cold-starter', 'cold-starters', 'cold-appetizer'],
	soup: ['soupe', 'soupes', 'potage', 'potages', 'veloute', 'veloutes', 'soup', 'soups', 'sopa', 'suppe', 'zuppa', 'minestra'],
	main: [
		'plat-principal',
		'plats-principaux',
		'plat',
		'plats',
		'main',
		'mains',
		'main-course',
		'main-dish',
		'main-dishes',
		'plato-principal',
		'hauptgericht',
		'hauptspeise',
		'secondo',
		'secondi',
		'prato-principal'
	],
	side: ['accompagnement', 'accompagnements', 'garniture', 'side', 'sides', 'side-dish', 'side-dishes', 'guarnicion', 'beilage', 'contorno', 'acompanhamento'],
	dessert: ['dessert', 'desserts', 'patisserie', 'patisseries', 'postre', 'postres', 'nachspeise', 'nachtisch', 'dolce', 'dolci', 'sobremesa'],
	snack: ['gouter', 'snack', 'snacks', 'collation', 'merienda', 'merenda', 'spuntino'],
	drink: ['boisson', 'boissons', 'drink', 'drinks', 'beverage', 'beverages', 'cocktail', 'cocktails', 'bebida', 'bebidas', 'getrank', 'getranke', 'bevanda', 'bevande'],
	vegetarian: ['vegetarien', 'vegetarienne', 'vegetarian', 'vegetariano', 'vegetarisch', 'veggie', 'vegetariandiet'],
	vegan: ['vegan', 'vegane', 'vegetalien', 'vegetalienne', 'vegano', 'vegandiet'],
	gluten_free: ['sans-gluten', 'gluten-free', 'glutenfree', 'glutenfreediet', 'sin-gluten', 'glutenfrei', 'senza-glutine', 'sem-gluten'],
	lactose_free: ['sans-lactose', 'sans-lait', 'lactose-free', 'dairy-free', 'lowlactosediet', 'sin-lactosa', 'laktosefrei', 'senza-lattosio', 'sem-lactose'],
	low_salt: ['sans-sel', 'pauvre-en-sel', 'low-salt', 'low-sodium', 'lowsaltdiet'],
	low_sugar: ['sans-sucre', 'sans-sucres-ajoutes', 'low-sugar', 'sugar-free', 'diabeticdiet'],
	quick: ['rapide', 'recette-rapide', 'express', 'quick', 'quick-and-easy', 'rapido', 'schnell'],
	kids: ['enfant', 'enfants', 'pour-les-enfants', 'kids', 'kid-friendly', 'children', 'ninos', 'kinder', 'bambini', 'criancas'],
	party: ['fete', 'fetes', 'anniversaire', 'buffet', 'reception', 'party', 'birthday', 'fiesta'],
	picnic: ['pique-nique', 'piquenique', 'picnic', 'picknick'],
	holiday: ['noel', 'reveillon', 'paques', 'christmas', 'easter', 'thanksgiving', 'navidad', 'weihnachten', 'natale', 'ostern'],
	spring: ['printemps', 'spring', 'primavera', 'fruhling'],
	summer: ['ete', 'summer', 'verano', 'sommer', 'estate', 'verao'],
	autumn: ['automne', 'autumn', 'fall', 'otono', 'herbst', 'autunno', 'outono'],
	winter: ['hiver', 'winter', 'invierno', 'inverno']
};

/** Too short to be trusted inside a longer phrase ("été" is also a past participle): whole value only. */
const MIN_EMBEDDED_LENGTH = 4;

/**
 * A `suitableForDiet` is a schema.org enumeration, often written as its full URL
 * ("https://schema.org/VeganDiet"): only its last segment names the diet.
 */
const lastSegment = (value: string): string => value.replace(/^https?:\/\/[^/]+\//i, '').split('/').pop() ?? '';

/** Sites pack several categories into one string: "Dessert, Goûter", "Plat principal / Végétarien". */
const fragmentsOf = (value: string): string[] =>
	value
		.split(/[,;/|]+/)
		.map((part) => slugify(lastSegment(part.trim())))
		.filter(Boolean);

function matches(fragment: string, word: string): boolean {
	if (fragment === word) return true;
	if (word.length < MIN_EMBEDDED_LENGTH) return false;

	return `-${fragment}-`.includes(`-${word}-`);
}

/**
 * The tags a page's schema.org `Recipe` already states, from the strings of its `recipeCategory`,
 * `recipeCuisine` and `suitableForDiet`, whatever their language or their casing. Only a word we are sure
 * of becomes a tag; everything else is ignored, never guessed.
 */
export function tagsFromSchemaOrg(values: readonly unknown[] | null | undefined): RecipeTag[] {
	const fragments = (values ?? [])
		.filter((value): value is string => typeof value === 'string')
		.flatMap(fragmentsOf);

	return RECIPE_TAGS.filter((tag) =>
		SCHEMA_ORG_WORDS[tag].some((word) => fragments.some((fragment) => matches(fragment, word)))
	);
}
