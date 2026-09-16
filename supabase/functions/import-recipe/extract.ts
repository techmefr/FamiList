/**
 * Ce qu on sait lire dans une page de recette : le schema.org `Recipe` que la quasi-totalite des
 * sites de cuisine publie en JSON-LD, parce que c est ce que Google leur demande pour afficher
 * leurs fiches. C est une donnee structuree, deposee la exprès pour etre lue par une machine :
 * l extraction est donc deterministe, et non un devinage sur du HTML de mise en page.
 *
 * On ne regarde rien d autre. Pas de microdonnees, pas de repli sur les balises de titre, pas
 * d heuristique sur les listes a puces : une page sans JSON-LD rend null, et la personne saisit sa
 * recette a la main comme avant. Un a-peu-pres tire du corps de la page ressemblerait a une
 * recette sans en etre une, et le tri coute plus cher que la saisie.
 *
 * Aucune dependance Deno, aucun analyseur HTML : la reconnaissance des blocs `<script>` se fait a
 * l expression reguliere, ce qui rend tout ce fichier testable par vitest.
 */

export type ImportedRecipe = {
	name: string | null;
	/** Lignes d ingredients telles qu ecrites par le site, non decoupees : « 2 c. a soupe d huile ». */
	ingredients: string[];
	steps: string[];
	/** Le nombre de parts tel qu ecrit : « 4 personnes », « 6 ». L interpretation est cliente. */
	servings: string | null;
};

const SCRIPT = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

const text = (value: unknown): string | null => {
	if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	if (typeof value !== 'string') return null;

	// Les sites laissent passer des entites et des balises dans leurs champs JSON-LD.
	const cleaned = value
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/\s+/g, ' ')
		.trim();

	return cleaned === '' ? null : cleaned;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

function hasRecipeType(node: Record<string, unknown>): boolean {
	const type = node['@type'];
	const types = Array.isArray(type) ? type : [type];
	return types.some((entry) => typeof entry === 'string' && entry.toLowerCase() === 'recipe');
}

/** Descend dans les tableaux, les `@graph` et les enveloppes pour trouver le premier `Recipe`. */
function findRecipe(node: unknown, depth = 0): Record<string, unknown> | null {
	if (depth > 6) return null;

	if (Array.isArray(node)) {
		for (const entry of node) {
			const found = findRecipe(entry, depth + 1);
			if (found) return found;
		}
		return null;
	}

	if (!isRecord(node)) return null;
	if (hasRecipeType(node)) return node;

	for (const value of Object.values(node)) {
		if (Array.isArray(value) || isRecord(value)) {
			const found = findRecipe(value, depth + 1);
			if (found) return found;
		}
	}

	return null;
}

function flatten(value: unknown, depth = 0): string[] {
	if (depth > 4) return [];
	if (Array.isArray(value)) return value.flatMap((entry) => flatten(entry, depth + 1));

	if (isRecord(value)) {
		// Une `HowToSection` regroupe ses etapes dans `itemListElement`; une `HowToStep` porte son
		// texte dans `text`, et parfois seulement dans `name`.
		if (value.itemListElement !== undefined) return flatten(value.itemListElement, depth + 1);
		const body = text(value.text) ?? text(value.name);
		return body ? [body] : [];
	}

	const single = text(value);
	return single ? [single] : [];
}

/** La recette portee par une page, ou null si elle n en publie pas. */
export function extractRecipe(html: string): ImportedRecipe | null {
	SCRIPT.lastIndex = 0;

	for (const match of html.matchAll(SCRIPT)) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(match[1].trim());
		} catch {
			// Un bloc illisible n empeche pas les suivants : une page en porte souvent plusieurs.
			continue;
		}

		const recipe = findRecipe(parsed);
		if (!recipe) continue;

		const ingredients = flatten(recipe.recipeIngredient);
		const steps = flatten(recipe.recipeInstructions);
		const name = text(recipe.name);

		// Un `Recipe` sans nom ni ingredient n a rien a pre-remplir : autant dire qu on n a rien
		// trouve plutot que d ouvrir un formulaire vide en pretendant l avoir importe.
		if (!name && ingredients.length === 0) continue;

		return {
			name,
			ingredients,
			steps,
			servings: flatten(recipe.recipeYield)[0] ?? null
		};
	}

	return null;
}
