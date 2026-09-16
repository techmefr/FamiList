import { MAX_SERVINGS, MIN_SERVINGS, type RecipeLine } from './recipe';
import { DEFAULT_UNIT, resolveUnit, type UnitId } from './units';

/**
 * Passer d'une recette publiée sur le web au formulaire de saisie.
 *
 * Un site écrit ses ingrédients en toutes lettres — « 600 g de courgettes », « 2 œufs », « une
 * pincée de sel » — alors que le modèle en attend trois champs séparés : un nom, une quantité, une
 * unité. Tout ce fichier est ce découpage-là, et rien d'autre : pas d'appel réseau, pas d'accès à
 * la base. Ce qu'il produit est un brouillon posé dans le formulaire, que la personne relit et
 * corrige avant d'enregistrer.
 *
 * Le principe qui décide de tous les cas limites : **ne jamais inventer**. Quand la ligne n'est pas
 * comprise avec certitude, elle repart entière dans le champ « nom », sans quantité. Une ligne
 * illisible qu'on relit est un désagrément; une quantité fausse qu'on ne relit pas devient une
 * course ratée, et c'est le contraire de ce que l'import doit apporter.
 */

/** Ce que la fonction edge rend : les champs du schema.org `Recipe`, non interprétés. */
export interface ImportedRecipe {
	name: string | null;
	ingredients: string[];
	steps: string[];
	servings: string | null;
}

/** Les raisons de refus que la fonction edge sait renvoyer, et la clef de message associée. */
export const IMPORT_ERRORS = [
	'invalid',
	'scheme',
	'credentials',
	'port',
	'private_host',
	'unreachable',
	'not_html',
	'too_large',
	'no_recipe'
] as const;

export type ImportError = (typeof IMPORT_ERRORS)[number];

const KNOWN_ERRORS = new Set<string>(IMPORT_ERRORS);

/** Rend un motif connu, ou `unreachable` : un code inattendu reste une panne, pas une page blanche. */
export function importErrorOf(raw: unknown): ImportError {
	return typeof raw === 'string' && KNOWN_ERRORS.has(raw) ? (raw as ImportError) : 'unreachable';
}

/**
 * Les fractions que les sites écrivent en un seul caractère. Les convertir ici évite que « ½ » ne
 * soit pris pour un mot et fasse basculer toute la ligne en repli.
 */
const FRACTIONS: Record<string, string> = {
	'½': '1/2',
	'⅓': '1/3',
	'⅔': '2/3',
	'¼': '1/4',
	'¾': '3/4',
	'⅕': '1/5',
	'⅙': '1/6',
	'⅛': '1/8',
	'⅜': '3/8',
	'⅝': '5/8',
	'⅞': '7/8'
};

/**
 * Unités écrites sur les sites de cuisine qui n'ont pas d'alias en base, et celles qui demandent
 * une conversion. Le facteur est exact — 1 cl vaut 10 ml, ce n'est pas une estimation — et il n'y
 * a donc rien d'inventé à l'appliquer.
 */
const IMPORT_UNITS: Record<string, { unit: UnitId; factor: number }> = {
	cl: { unit: 'ml', factor: 10 },
	dl: { unit: 'ml', factor: 100 },
	mg: { unit: 'g', factor: 0.001 },
	grammes: { unit: 'g', factor: 1 },
	millilitres: { unit: 'ml', factor: 1 },
	centilitres: { unit: 'ml', factor: 10 }
};

/**
 * Mesures qu'on reconnaît sans pouvoir les écrire : le modèle n'a ni cuillère, ni pincée, ni
 * gousse. Les rencontrer fait basculer la ligne en repli plutôt que de laisser tomber le mot.
 *
 * Sans cette liste, « 2 cuillères à soupe d'huile » deviendrait « 2 pièces de cuillères à soupe
 * d'huile » — une ligne qui a l'air remplie, et qu'on ne relit donc pas.
 */
const UNMEASURABLE = new Set([
	'cuillere',
	'cuilleres',
	'cuillère',
	'cuillères',
	'c',
	'cas',
	'cac',
	'cc',
	'càs',
	'càc',
	'cuil',
	'pincee',
	'pincée',
	'pincees',
	'pincées',
	'gousse',
	'gousses',
	'brin',
	'brins',
	'feuille',
	'feuilles',
	'filet',
	'trait',
	'poignee',
	'poignée',
	'verre',
	'verres',
	'bol',
	'bols',
	'tasse',
	'tasses',
	'noix',
	'noisette',
	'morceau',
	'morceaux',
	'louche',
	'louches',
	'branche',
	'branches',
	'zeste',
	'zestes'
]);

/** Les mots de liaison entre la mesure et le produit, retirés du nom. */
const LINKERS = /^(?:de\s+la\s+|de\s+l['’]|du\s+|des\s+|de\s+|d['’])/i;

const cleanup = (value: string): string =>
	value
		.replace(/\s+/g, ' ')
		.replace(/^[\s,;:.•·-]+/, '')
		.replace(/[\s,;:]+$/, '')
		.trim();

/** « 1/2 » → 0.5, « 1,5 » → 1.5, « 2 » → 2, le reste null. */
function toNumber(token: string): number | null {
	const fraction = token.match(/^(\d+)\s*\/\s*(\d+)$/);
	if (fraction) {
		const denominator = Number(fraction[2]);
		return denominator > 0 ? Number(fraction[1]) / denominator : null;
	}

	const plain = Number(token.replace(',', '.'));
	return Number.isFinite(plain) && plain > 0 ? plain : null;
}

/** Trois décimales au plus, zéros de fin retirés : la même écriture que `scaleQty`. */
const writeQty = (value: number): string => String(Math.round(value * 1000) / 1000);

const stripAccents = (value: string): string =>
	value.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * Découpe une ligne d'ingrédient en nom, quantité et unité.
 *
 * Trois issues, et le repli n'est pas un échec mais le cas nominal d'une ligne qu'on ne comprend
 * pas : elle revient entière dans le nom, sans quantité, exactement telle que le site l'a écrite.
 * Le champ reste juste, il est simplement moins découpé.
 *
 * Rend null pour une ligne vide : un site laisse traîner des séparateurs dans ses listes.
 */
export function parseIngredientLine(raw: string): RecipeLine | null {
	const line = cleanup(
		String(raw ?? '').replace(
			/[½⅓⅔¼¾⅕⅙⅛⅜⅝⅞]/g,
			(character) => ` ${FRACTIONS[character]} `
		)
	);
	if (!line) return null;

	const fallback: RecipeLine = { name: line, qty: '', unit: DEFAULT_UNIT };

	const tokens = line.split(' ');
	const first = toNumber(tokens[0]);
	if (first === null) return fallback;

	// « 1 1/2 litre » : un entier suivi d'une fraction s'additionnent avant d'être une quantité.
	let consumed = 1;
	let amount = first;
	if (Number.isInteger(first) && tokens[1] && /^\d+\s*\/\s*\d+$/.test(tokens[1])) {
		const extra = toNumber(tokens[1]);
		if (extra !== null) {
			amount += extra;
			consumed = 2;
		}
	}

	const rest = tokens.slice(consumed);
	const measure = stripAccents((rest[0] ?? '').replace(/[.,]$/, '').toLowerCase());

	if (UNMEASURABLE.has(measure) || UNMEASURABLE.has(rest[0]?.toLowerCase() ?? '')) return fallback;

	const converted = IMPORT_UNITS[measure];
	if (converted) {
		const name = cleanup(rest.slice(1).join(' ').replace(LINKERS, ''));
		if (!name) return fallback;
		return { name, qty: writeQty(amount * converted.factor), unit: converted.unit };
	}

	const known = resolveUnit(rest[0]?.replace(/[.,]$/, ''));
	if (known) {
		const name = cleanup(rest.slice(1).join(' ').replace(LINKERS, ''));
		if (!name) return fallback;
		return { name, qty: writeQty(amount), unit: known };
	}

	// Un nombre seul devant un produit — « 2 œufs », « 3 tomates » — se compte en pièces.
	const name = cleanup(rest.join(' ').replace(LINKERS, ''));
	if (!name) return fallback;
	return { name, qty: writeQty(amount), unit: DEFAULT_UNIT };
}

/** Les lignes du formulaire pour une liste d'ingrédients importée, les vides écartées. */
export function importedLines(raws: string[]): RecipeLine[] {
	return raws
		.map(parseIngredientLine)
		.filter((line): line is RecipeLine => line !== null);
}

/**
 * Le nombre de parts lisible dans un `recipeYield`, ou null.
 *
 * « 4 personnes », « Pour 6 », « 4 à 6 parts » : on prend le premier nombre entier, et le plus
 * petit d'un intervalle — cuisiner pour quatre quand la recette en propose quatre à six ne met
 * personne en difficulté, l'inverse si.
 */
export function parseImportedServings(raw: string | null | undefined): number | null {
	const found = String(raw ?? '').match(/\d+/);
	if (!found) return null;

	const count = Number(found[0]);
	if (!Number.isInteger(count) || count < MIN_SERVINGS || count > MAX_SERVINGS) return null;

	return count;
}
