import { slugify } from './slug';
import { DEFAULT_UNIT } from './units';

/**
 * Passer d'une recette à une liste de courses.
 *
 * Le mot « ingrédient » est déjà pris ailleurs dans l'application — `poll_options.ingredients`
 * désigne ce que chacun ramène à un repas partagé. Ici il s'agit d'autre chose : la ligne d'une
 * recette, avec sa quantité et son unité. Les deux ne se rencontrent jamais.
 */
export interface RecipeLine {
	name: string;
	/** Saisie au clavier, donc une chaîne : « 1,5 » est une réponse valable. Vide = sans quantité. */
	qty: string;
	unit: string;
}

/** Le plus petit nombre de parts qui ait un sens, et le plus grand qu'on accepte de saisir. */
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 99;
export const DEFAULT_SERVINGS = 4;

/**
 * Le nombre écrit dans un champ de quantité, ou null.
 *
 * La virgule décimale est acceptée : c'est celle du clavier français, et `mapping.ts` fait déjà la
 * même conversion avant d'écrire en base. Un texte qui n'est pas un nombre — « une pincée » —
 * rend null plutôt que zéro : une quantité absente et une quantité nulle ne disent pas la même
 * chose, et la mise à l'échelle doit laisser la première tranquille.
 */
export function parseQty(raw: string | null | undefined): number | null {
	const written = (raw ?? '').trim();
	if (written === '') return null;

	const parsed = Number(written.replace(/,/g, '.'));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * De combien multiplier les quantités pour passer des parts écrites aux parts voulues.
 *
 * Des parts absurdes — zéro, négatif, illisible — rendent 1 plutôt qu'une erreur : la recette est
 * alors générée telle qu'elle est écrite, ce qui reste utile, là où un échec ne laisserait rien.
 */
export function scalingFactor(servings: number, people: number): number {
	if (!Number.isFinite(servings) || !Number.isFinite(people)) return 1;
	if (servings <= 0 || people <= 0) return 1;

	return people / servings;
}

/**
 * La quantité une fois mise à l'échelle, telle qu'on l'écrit dans un article.
 *
 * Trois décimales au maximum, et les zéros de fin retirés : un tiers de 400 g donne 133.333 et non
 * 133.33333333333334, et la moitié de 2 pièces reste « 1 » plutôt que « 1.0 ». On écrit un point
 * décimal et non une virgule parce que c'est ce que `toNumber` attend côté base — la virgule y
 * passerait aussi, mais l'article s'affiche tel quel dans la liste avant la première
 * synchronisation, et deux écritures différentes du même nombre se verraient.
 */
export function scaleQty(qty: string, factor: number): string {
	const base = parseQty(qty);
	if (base === null) return '';

	const scaled = base * factor;
	return String(Math.round(scaled * 1000) / 1000);
}

/** Une ligne de recette prête à devenir un article. */
export interface GeneratedItem {
	name: string;
	qty: string;
	unit: string;
}

/**
 * Les articles à créer pour une recette, à l'échelle demandée, sans ceux que la liste contient
 * déjà.
 *
 * La comparaison passe par le slug, comme `pushIngredients` : « Tomates » et « tomates » sont le
 * même produit, et quelqu'un qui génère deux recettes dans la même liste ne veut pas deux lignes
 * de tomates. On ne cumule pas les quantités pour autant — additionner « 3 pièces » et « 500 g »
 * n'a pas de résultat juste, et deviner lequel garder trahirait la recette. Le doublon écarté,
 * c'est la quantité déjà présente qui reste, et la personne la corrige devant le rayon.
 *
 * Les lignes sans nom sont ignorées : un formulaire laisse toujours traîner une rangée vide.
 *
 * Le rayon n'est pas décidé ici. L'ajout d'un article devine déjà le sien depuis son nom
 * (`guessAisleKind`), donc la liste générée arrive rangée sans que la recette ait à s'en occuper.
 */
export function generatedItems(
	lines: RecipeLine[],
	factor: number,
	existingNames: string[]
): GeneratedItem[] {
	const taken = new Set(existingNames.map(slugify).filter(Boolean));
	const produced: GeneratedItem[] = [];

	for (const line of lines) {
		const name = line.name.trim();
		const slug = slugify(name);
		if (!slug || taken.has(slug)) continue;

		taken.add(slug);
		produced.push({
			name,
			// Une ligne sans quantité devient un article à l'unité : la liste de courses n'a pas de
			// case vide, et « sel » sans rien à côté se lit très bien comme « du sel ».
			qty: scaleQty(line.qty, factor) || '1',
			unit: line.unit || DEFAULT_UNIT
		});
	}

	return produced;
}
