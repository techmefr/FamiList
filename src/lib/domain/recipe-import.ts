import { MAX_SERVINGS, MIN_SERVINGS, type RecipeLine } from './recipe';
import { DEFAULT_UNIT, resolveUnit, type UnitId } from './units';

/**
 * Going from a recipe published on the web to the entry form.
 *
 * A site writes its ingredients in words — "600 g of courgettes", "2 eggs", "a pinch of salt" — whereas
 * the model expects three separate fields: a name, a quantity, a unit. This whole file is that splitting,
 * and nothing else: no network call, no database access. What it produces is a draft placed in the form,
 * which the person reads and corrects before saving.
 *
 * The principle deciding every edge case: **never invent**. When the line is not understood with
 * certainty, it goes back whole into the "name" field, with no quantity. An unsplit line you read again
 * is an inconvenience; a wrong quantity you do not read again becomes a failed shopping trip, and that is
 * the opposite of what the import should bring.
 */

/** What the edge function returns: the schema.org `Recipe` fields, uninterpreted. */
export interface ImportedRecipe {
	name: string | null;
	ingredients: string[];
	steps: string[];
	servings: string | null;
	image: string | null;
}

/** The refusal reasons the edge function can return, and the matching message key. */
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

/** Returns a known reason, or `unreachable`: an unexpected code stays a failure, not a blank page. */
export function importErrorOf(raw: unknown): ImportError {
	return typeof raw === 'string' && KNOWN_ERRORS.has(raw) ? (raw as ImportError) : 'unreachable';
}

/**
 * The fractions sites write as a single character. Converting them here stops "½" being taken for a word
 * and tipping the whole line into the fallback.
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
 * Units written on cooking sites that have no alias in the database, and those needing a conversion. The
 * factor is exact — 1 cl is 10 ml, that is not an estimate — so there is nothing invented in applying it.
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
 * Measures we recognise without being able to write them: the model has no spoon, no pinch, no clove.
 * Meeting one tips the line into the fallback rather than dropping the word.
 *
 * Without this list, "2 tablespoons of oil" would become "2 pieces of tablespoons of oil" — a line that
 * looks filled in, and which therefore does not get read again.
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

/** The linking words between the measure and the product, removed from the name. */
const LINKERS = /^(?:de\s+la\s+|de\s+l['’]|du\s+|des\s+|de\s+|d['’])/i;

const cleanup = (value: string): string =>
	value
		.replace(/\s+/g, ' ')
		.replace(/^[\s,;:.•·-]+/, '')
		.replace(/[\s,;:]+$/, '')
		.trim();

/** "1/2" → 0.5, "1,5" → 1.5, "2" → 2, everything else null. */
function toNumber(token: string): number | null {
	const fraction = token.match(/^(\d+)\s*\/\s*(\d+)$/);
	if (fraction) {
		const denominator = Number(fraction[2]);
		return denominator > 0 ? Number(fraction[1]) / denominator : null;
	}

	const plain = Number(token.replace(',', '.'));
	return Number.isFinite(plain) && plain > 0 ? plain : null;
}

/** Three decimals at most, trailing zeros removed: the same notation as `scaleQty`. */
const writeQty = (value: number): string => String(Math.round(value * 1000) / 1000);

const stripAccents = (value: string): string =>
	value.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/**
 * Splits an ingredient line into name, quantity and unit.
 *
 * Three outcomes, and the fallback is not a failure but the nominal case of a line we do not understand:
 * it comes back whole in the name, with no quantity, exactly as the site wrote it. The field stays right,
 * it is simply less split.
 *
 * Returns null for an empty line: a site leaves separators lying around in its lists.
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

	// "1 1/2 litre": a whole number followed by a fraction are added before becoming a quantity.
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

	// A bare number in front of a product — "2 eggs", "3 tomatoes" — is counted in pieces.
	const name = cleanup(rest.join(' ').replace(LINKERS, ''));
	if (!name) return fallback;
	return { name, qty: writeQty(amount), unit: DEFAULT_UNIT };
}

/** The form rows for an imported ingredient list, empty ones dropped. */
export function importedLines(raws: string[]): RecipeLine[] {
	return raws
		.map(parseIngredientLine)
		.filter((line): line is RecipeLine => line !== null);
}

/**
 * The number of servings readable in a `recipeYield`, or null.
 *
 * "4 people", "For 6", "4 to 6 servings": we take the first whole number, and the smaller one of a range —
 * cooking for four when the recipe offers four to six puts nobody in difficulty, the other way round
 * does.
 */
export function parseImportedServings(raw: string | null | undefined): number | null {
	const found = String(raw ?? '').match(/\d+/);
	if (!found) return null;

	const count = Number(found[0]);
	if (!Number.isInteger(count) || count < MIN_SERVINGS || count > MAX_SERVINGS) return null;

	return count;
}
