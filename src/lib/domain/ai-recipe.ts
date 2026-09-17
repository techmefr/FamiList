import { DEFAULT_SERVINGS, MAX_SERVINGS, MIN_SERVINGS, type RecipeLine } from './recipe';
import { slugify } from './slug';
import { DEFAULT_UNIT, resolveUnit, UNITS } from './units';

/**
 * Une idee de recette a partir de ce que le foyer achete, et surtout : ce qui sort de l'appareil
 * pour l'obtenir.
 *
 * Ce depot a refuse le geocodage pour ne pas faire sortir une adresse
 * (`20260908170000_shop_place.sql`). Demander une recette a un tiers renverse ce principe, et il
 * n'y a pas de demi-mesure possible : ou bien on envoie quelque chose, ou bien il n'y a pas de
 * fonctionnalite. Ce que ce fichier peut faire, c'est rendre ce « quelque chose » aussi petit que
 * possible et entierement montrable — `shoppedProducts` rend une liste de chaines que l'ecran
 * affiche telle quelle avant l'envoi, et c'est litteralement tout ce qui part.
 */

/** Ce que la fonction a besoin de savoir d'un article. Volontairement pas `Item` en entier. */
export interface Purchase {
	name: string;
	checked: boolean;
	createdAt: number;
}

/**
 * Au-dela, la liste cesse d'etre lisible d'un coup d'oeil avant l'envoi, et le consentement
 * devient une case cochee sans avoir rien lu.
 */
export const MAX_PRODUCTS = 40;

/**
 * Les produits deja achetes, du plus recent au plus ancien, sans doublon.
 *
 * Ce qui part : le nom du produit. Ce qui ne part pas, et dont l'absence est la fonctionnalite :
 * les quantites, les notes, a qui l'article etait assigne, le nom des listes, celui des membres,
 * le magasin, les prix, les dates. « Couches taille 2 » et « 3 bouteilles de whisky assignees a
 * papa le 14 » ne disent pas la meme chose sur un foyer, et seule la premiere forme est utile a
 * une suggestion de recette.
 *
 * Seuls les articles coches sont retenus : un article non coche est une intention, un article
 * coche est un achat. L'issue parle bien de ce qui a ete achete.
 *
 * Le doublon se juge sur le slug, comme partout ailleurs ici : « Tomates » et « tomates » sont le
 * meme produit, et l'envoyer deux fois coute deux fois sans rien apprendre a personne.
 */
export function shoppedProducts(purchases: Purchase[], limit = MAX_PRODUCTS): string[] {
	const seen = new Set<string>();
	const kept: string[] = [];

	for (const purchase of purchases.toSorted((a, b) => b.createdAt - a.createdAt)) {
		if (!purchase.checked) continue;

		const name = purchase.name.trim();
		const slug = slugify(name);
		if (!slug || seen.has(slug)) continue;

		seen.add(slug);
		kept.push(name);
		if (kept.length >= limit) break;
	}

	return kept;
}

export interface PromptOptions {
	/** La langue dans laquelle la recette doit etre ecrite, ecrite dans cette langue-la. */
	language: string;
	servings: number;
}

/**
 * La demande envoyee au fournisseur, en entier.
 *
 * Elle est construite ici et nulle part ailleurs pour que l'ecran puisse en montrer le contenu
 * avant l'envoi : ce qui est affiche et ce qui part sont alors le meme texte, et non deux
 * redactions qu'une modification ulterieure ferait diverger.
 *
 * Les unites acceptees sont dictees plutot que laissees libres : elles retombent dans les colonnes
 * de `recipe_ingredients`, dont `unit` doit parler le meme langage que `items.unit` pour que la
 * generation de liste ne traduise rien.
 */
export function recipePrompt(products: string[], options: PromptOptions): string {
	const servings = clampServings(options.servings);

	return [
		`Tu proposes une recette de cuisine familiale, ecrite en ${options.language}.`,
		`Elle doit se faire principalement avec ces produits, deja achetes par le foyer :`,
		products.join(', ') || '(aucun)',
		'',
		`La recette est pour ${servings} personnes.`,
		'Reponds uniquement par un objet JSON, sans texte autour et sans bloc de code.',
		'Forme exacte attendue :',
		'{"name":"","emoji":"","servings":0,"ingredients":[{"name":"","qty":"","unit":""}],"steps":[""]}',
		`"emoji" est un seul caractere emoji. "servings" vaut ${servings}.`,
		`"unit" vaut obligatoirement l'une de ces valeurs : ${UNITS.join(', ')}.`,
		'"qty" est un nombre ecrit en chiffres, ou une chaine vide si la quantite ne se compte pas.',
		'"steps" contient les etapes de preparation, une par entree, dans l ordre.'
	].join('\n');
}

const clampServings = (value: number): number => {
	if (!Number.isFinite(value)) return DEFAULT_SERVINGS;

	return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(value)));
};

export interface SuggestedRecipe {
	name: string;
	emoji: string;
	servings: number;
	ingredients: RecipeLine[];
	steps: string[];
}

/** Ce qu'on affiche a defaut d'emoji rendu par le fournisseur, comme le formulaire de saisie. */
const FALLBACK_EMOJI = '🍲';

/**
 * Le JSON cache dans la reponse, quoi qu'il arrive autour.
 *
 * Un modele repond regulierement « Voici votre recette : ```json … ``` » malgre la consigne. On ne
 * retire donc pas les balises une par une : on prend ce qui va de la premiere accolade ouvrante a
 * la derniere fermante, ce qui couvre aussi bien le bloc de code que la phrase d'introduction sans
 * dependre de leur forme exacte.
 */
function extractJson(text: string): unknown {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start === -1 || end <= start) return null;

	try {
		return JSON.parse(text.slice(start, end + 1));
	} catch {
		return null;
	}
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
	typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * La recette proposee, ou null si la reponse n'en contient pas une exploitable.
 *
 * Tout est revalide plutot que fait confiance : ce texte vient d'un tiers, il finit dans des
 * colonnes contraintes cote base, et un `servings` a 0 ou une unite inventee ferait echouer
 * l'ecriture apres que la personne a accepte la recette — donc au pire moment. Une recette sans
 * nom ou sans le moindre ingredient rend null : il n'y a rien a montrer, et afficher une carte
 * vide ferait croire a une reponse utile.
 */
export function parseRecipeSuggestion(text: string): SuggestedRecipe | null {
	const root = asRecord(extractJson(text));
	if (!root) return null;

	const name = asText(root.name);
	if (!name) return null;

	const ingredients = (Array.isArray(root.ingredients) ? root.ingredients : [])
		.map(asRecord)
		.map(line => ({
			name: asText(line?.name),
			qty: asText(line?.qty).replace(/\s+/g, ''),
			// `resolveUnit` connait deja les alias et les pluriels ecrits a la main : un modele qui
			// repond « grammes » malgre la consigne retombe sur `g` au lieu d'etre ramene a la piece.
			unit: resolveUnit(line?.unit as string) ?? DEFAULT_UNIT
		}))
		.filter(line => line.name !== '');

	if (ingredients.length === 0) return null;

	const emoji = [...asText(root.emoji)][0] ?? FALLBACK_EMOJI;

	const steps = (Array.isArray(root.steps) ? root.steps : []).map(asText).filter(Boolean);

	return {
		name,
		emoji,
		servings: clampServings(Number(root.servings)),
		ingredients,
		// Une recette sans etape reste une recette — la liste de courses, qui est le but, n'en a
		// pas besoin. On garde une entree vide pour que le formulaire de relecture ait sa rangee.
		steps: steps.length > 0 ? steps : ['']
	};
}
