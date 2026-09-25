import { DEFAULT_SERVINGS, type RecipeLine } from './recipe';
import { DEFAULT_EMOJI, type RecipeDraft } from './recipe-draft';
import { parseImportedServings, parseIngredientLine } from './recipe-import';
import { detectDuration } from './step-duration';
import { guessLinks } from './step-ingredients';
import { tagsFromSchemaOrg } from './recipe-tags';
import { DEFAULT_UNIT } from './units';

/**
 * From the text read on a photographed recipe (#312) — a cookbook page, a handwritten card, several pages
 * in a row — to the recipe form. The recognition itself happens elsewhere (`$lib/native/ocr`); this file
 * only receives lines of text, in page order, and splits them into a title, ingredients, steps and their
 * durations. No network, no database, nothing saved: the result is a draft the person reads in the form.
 *
 * OCR text is noisier than a web page: stray marks, digits read as letters, lines cut in the middle of a
 * sentence, no reliable punctuation on a handwritten card. The rule is the one of `recipe-import.ts`:
 * **never invent**. A line we cannot split lands whole in the ingredient name; a section we cannot find
 * falls back to the simplest layout, ingredients first then steps, which is how nearly every recipe is
 * written in the ten languages of the app.
 */

export interface ScannedRecipe {
	name: string;
	servings: number | null;
	lines: RecipeLine[];
	steps: string[];
	stepDurations: (number | null)[];
	tags: string[];
}

/** The section headings of the ten app languages, compared folded (lower case, no accents, no punctuation). */
const INGREDIENT_HEADINGS = [
	'ingredients',
	'ingredient',
	'il vous faut',
	'ce qu il vous faut',
	'you will need',
	'ingredientes',
	'zutaten',
	'ingredienti',
	'ингредиенты',
	'продукты',
	'المكونات',
	'مكونات',
	'المقادير',
	'مقادير',
	'材料',
	'配料',
	'食材',
	'原料',
	'用料',
	'akora',
	'ireo akora',
	'fitaovana'
];

const STEP_HEADINGS = [
	'preparation',
	'etapes',
	'etape',
	'realisation',
	'deroulement',
	'recette',
	'instructions',
	'method',
	'directions',
	'steps',
	'preparacion',
	'elaboracion',
	'pasos',
	'zubereitung',
	'anleitung',
	'preparazione',
	'procedimento',
	'modo de preparo',
	'modo de fazer',
	'preparacao',
	'приготовление',
	'способ приготовления',
	'طريقة التحضير',
	'التحضير',
	'طريقة العمل',
	'الطريقة',
	'做法',
	'步骤',
	'制作方法',
	'制作步骤',
	'fomba fanamboarana',
	'fomba fanaovana',
	'fanomanana',
	'dingana'
];

/**
 * "for 4 people", "serves 6", "4 Personen", "на 4 порции", "4人份"… A number is required next to it, and a
 * whole word: "pers" inside "persil" is parsley, not a number of guests.
 */
const SERVINGS_WORDS =
	/(?<!\p{L})(?:personnes?|pers|parts?|couverts?|serves?|servings?|people|portions?|personas?|raciones|personen|portionen|persone|porzioni|pessoas|porções|porcoes|человека?|персон|порци[йия]|أشخاص|شخص|أفراد|人份|olona)(?!\p{L})/iu;

/** Numbered steps: "1.", "2)", "3、", "Étape 4", "Step 5:", "①". */
const WORD_MARKER =
	/^(?:étape|etape|step|paso|schritt|passo|шаг|خطوة|步骤|dingana)\s*(\d{1,2})\s*[.):\-–]?\s*/iu;
const NUMBER_MARKER = /^(\d{1,2})(?:\s*[.)、]\s*(?=\p{L})|[.)]\s+(?=\d))/u;
const CIRCLED_MARKER = /^[①-⑳]\s*/u;

const BULLET = /^(?:[•·●◦▪▫■□►▸‣∙*–—-]|[oe°>](?=\s+\d))\s*/u;

const TERMINAL = /[.!?。！？؟]$/u;

/** Words after which an ingredient line obviously goes on: the photo cut it, not the author. */
const DANGLING = /(?:[,(]|\s(?:de|du|des|d['’]|à|au|aux|en|et|ou|la|le|les|of|and|or|with|the|a|con|y|mit|und|di|e|com)\s*)$/iu;

const MAX_TITLE_WORDS = 10;
const MAX_META_WORDS = 6;
/** Long enough to be a sentence: on a card with no heading, where the steps begin. */
const MIN_STEP_WORDS = 7;

const wordsOf = (line: string): number => line.split(/\s+/).filter(Boolean).length;

/** For comparing headings: lower case, no accents, punctuation turned into spaces. */
const fold = (value: string): string =>
	value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();

const FOLDED_INGREDIENT_HEADINGS = INGREDIENT_HEADINGS.map(fold);
const FOLDED_STEP_HEADINGS = STEP_HEADINGS.map(fold);

/**
 * A digit misread as a letter where only a number can stand — "l00 g", "2O0 g", "1O" — is put back; so is a
 * unit glued to its number, "250g", which a card written by hand almost always has.
 */
function repairQuantity(line: string): string {
	// "1l" stays one litre: a letter is only a digit when a digit follows it, or when it is an O closing one.
	const repaired = line
		.replace(/^[\dOoIl|/]{2,}(?=\s|$|\p{L})/u, (token) =>
			/\d/.test(token) && /[\dOo]$/.test(token) ? token.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1') : token
		)
		// A lone "l" opening a line is never a French, Spanish or Italian word: it is a handwritten 1.
		.replace(/^[l|](?=\s+\p{L})/u, '1');

	return repaired.replace(/^(\d+(?:[.,]\d+)?)(\p{L}{1,6})(?=\s|$)/u, '$1 $2');
}

/** A line of text, and whether a bullet opened it: in a bulleted list, a line without one goes on the last. */
interface Line {
	text: string;
	bullet: boolean;
}

const BLANK: Line = { text: '', bullet: false };

/** One OCR line made usable: spacing, fraction slash, bullets. Blank for a line that carries nothing. */
function cleanLine(raw: string): Line {
	const spaced = raw
		.replace(/[⁄∕]/g, '/')
		.replace(/[‘’`´]/g, '’')
		.replace(/\s+/g, ' ')
		.trim();
	const text = spaced.replace(BULLET, '');

	const meaningful = (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
	if (meaningful < 2 || meaningful < text.replace(/\s/g, '').length / 2) return BLANK;
	if (/^\d{1,3}$/.test(text)) return BLANK;

	return { text: repairQuantity(text), bullet: text !== spaced };
}

/**
 * The lines of every page, in order, a blank line where a page or a paragraph ends. A word hyphenated at
 * the end of a line ("mélan-" / "ger") is joined back, as the reader would.
 */
function linesOf(pages: readonly string[]): Line[] {
	const lines: Line[] = [];

	for (const page of pages) {
		const raws = String(page ?? '').split(/\r?\n/);
		for (let index = 0; index < raws.length; index++) {
			let raw = raws[index];
			while (/\p{Ll}-\s*$/u.test(raw) && /^\s*\p{Ll}/u.test(raws[index + 1] ?? '')) {
				raw = raw.replace(/-\s*$/, '') + raws[++index].trim();
			}
			lines.push(cleanLine(raw));
		}
		lines.push(BLANK);
	}

	return lines;
}

function headingOf(line: string): 'ingredients' | 'steps' | null {
	// "Préparation : 20 min" at the top of a page is a time, not the start of the steps.
	if (detectDuration(line) !== null) return null;

	const folded = fold(line);
	const matches = (headings: string[]) =>
		headings.some(
			(heading) =>
				folded === heading ||
				(folded.startsWith(`${heading} `) && wordsOf(folded) - wordsOf(heading) <= 4)
		);

	if (matches(FOLDED_INGREDIENT_HEADINGS)) return 'ingredients';
	if (matches(FOLDED_STEP_HEADINGS)) return 'steps';
	return null;
}

function servingsOf(line: string): number | null {
	if (wordsOf(line) > 8 || !SERVINGS_WORDS.test(line)) return null;
	return parseImportedServings(line);
}

const startsWithQuantity = (line: string): boolean => /^(?:\d|[½⅓⅔¼¾⅛])/u.test(line);

const stepMarkerOf = (line: string): RegExp | null =>
	[WORD_MARKER, NUMBER_MARKER, CIRCLED_MARKER].find((marker) => marker.test(line)) ?? null;

/** On a page with no "Preparation" heading, the first line that reads as a sentence starts the steps. */
const looksLikeStep = (line: string): boolean =>
	stepMarkerOf(line) !== null ||
	(!startsWithQuantity(line) && (wordsOf(line) >= MIN_STEP_WORDS || (TERMINAL.test(line) && wordsOf(line) >= 3)));

/** A time or a label near the title — "Cuisson : 30 min", "Végétarien" — rather than the title itself. */
const isMeta = (line: string): boolean =>
	wordsOf(line) <= MAX_META_WORDS && (detectDuration(line) !== null || servingsOf(line) !== null);

const isTitle = (line: string): boolean =>
	Boolean(line) &&
	!startsWithQuantity(line) &&
	!isMeta(line) &&
	headingOf(line) === null &&
	wordsOf(line) <= MAX_TITLE_WORDS &&
	(line.match(/\p{L}/gu) ?? []).length >= 2;

/** "TARTE AUX POMMES" printed in capitals reads better, and is found better, as "Tarte aux pommes". */
function titleCase(title: string): string {
	const letters = title.replace(/[^\p{L}]/gu, '');
	if (!letters || letters !== letters.toUpperCase() || letters === letters.toLowerCase()) return title;

	const lower = title.toLocaleLowerCase();
	return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}

/** Wrapped ingredient lines put back together, sub-headings ("Pour la pâte :") left out. */
function ingredientLinesOf(raws: Line[]): RecipeLine[] {
	const bulleted = raws.some((line) => line.bullet);
	const joined: string[] = [];

	for (const { text: line, bullet } of raws) {
		if (!line) continue;
		if (/[:：]$/.test(line) && wordsOf(line) <= 5) continue;

		const previous = joined.at(-1);
		const continues = bulleted
			? !bullet && !startsWithQuantity(line)
			: /^\p{Ll}/u.test(line) && DANGLING.test(` ${previous}`);
		if (previous && continues) {
			joined[joined.length - 1] = `${previous} ${line}`;
		} else {
			joined.push(line);
		}
	}

	return joined.map(parseIngredientLine).filter((line): line is RecipeLine => line !== null);
}

const glue = (text: string, line: string): string =>
	!text ? line : /\p{L}-$/u.test(text) ? text.slice(0, -1) + line : `${text} ${line}`;

/**
 * Steps from their lines. Numbered steps are split on their numbers, whatever the blank lines; otherwise
 * on blank lines (paragraphs); otherwise — a card with neither — at each line ending a sentence.
 */
function stepsOf(raws: string[]): string[] {
	const numbered = raws.some((line) => stepMarkerOf(line) !== null);
	const paragraphs = !numbered && raws.some((line, index) => !line && raws.slice(0, index).some(Boolean) && raws.slice(index).some(Boolean));

	const steps: string[] = [];
	let current = '';
	const close = () => {
		if (current.trim()) steps.push(current.trim());
		current = '';
	};

	for (const line of raws) {
		if (!line) {
			if (paragraphs) close();
			continue;
		}

		const marker = numbered ? stepMarkerOf(line) : null;
		if (marker) {
			close();
			current = line.replace(marker, '');
			continue;
		}

		current = glue(current, line);
		if (!numbered && !paragraphs && TERMINAL.test(line)) close();
	}
	close();

	return steps;
}

/**
 * The recipe written on the photographed pages, in page order, or null when nothing in the text looks like
 * a recipe — no ingredient and no step — for the screen to say so instead of opening an empty form.
 */
export function structureRecipeText(pages: readonly string[]): ScannedRecipe | null {
	const lines = linesOf(pages);
	const ingredientsHeaded = lines.some(({ text }) => text && headingOf(text) === 'ingredients');

	let name = '';
	let servings: number | null = null;
	const meta: string[] = [];
	const ingredients: Line[] = [];
	const steps: string[] = [];

	let section: 'head' | 'ingredients' | 'steps' = 'head';
	const stepsHeadingAt = lines.findIndex(({ text }) => text && headingOf(text) === 'steps');

	lines.forEach((entry, index) => {
		const line = entry.text;
		const heading = line ? headingOf(line) : null;
		if (heading) {
			section = heading;
			servings ??= servingsOf(line);
			return;
		}

		if (section !== 'steps' && line) {
			const found = servingsOf(line);
			if (found !== null) {
				servings ??= found;
				return;
			}
		}

		if (section === 'head') {
			if (!line) return;
			if (isMeta(line)) {
				meta.push(line);
				return;
			}
			if (!name && isTitle(line)) {
				name = titleCase(line);
				// Without an "Ingredients" heading, what follows the title is the ingredient list.
				if (!ingredientsHeaded) section = 'ingredients';
				return;
			}
			if (ingredientsHeaded) {
				// A subtitle or an introduction before the list: only its short labels are kept, for the tags.
				if (wordsOf(line) <= MAX_META_WORDS) meta.push(line);
				return;
			}
			section = 'ingredients';
		}

		if (section === 'ingredients') {
			const stepsFollow = stepsHeadingAt > index;
			if (!stepsFollow && line && looksLikeStep(line)) {
				section = 'steps';
			} else {
				ingredients.push(entry);
				return;
			}
		}

		steps.push(line);
	});

	const recipeLines = ingredientLinesOf(ingredients);
	const recipeSteps = stepsOf(steps);
	if (recipeLines.length === 0 && recipeSteps.length === 0) return null;

	return {
		name,
		servings,
		lines: recipeLines,
		steps: recipeSteps,
		stepDurations: recipeSteps.map((step) => detectDuration(step)),
		tags: tagsFromSchemaOrg([name, ...meta])
	};
}

/** The scanned recipe as the draft every "Create a recipe" source hands to the form (#311). */
export function draftFromScan(recipe: ScannedRecipe): RecipeDraft {
	const lines = recipe.lines.length ? recipe.lines : [{ name: '', qty: '', unit: DEFAULT_UNIT }];
	const steps = recipe.steps.length ? recipe.steps : [''];

	return {
		name: recipe.name,
		emoji: DEFAULT_EMOJI,
		servings: recipe.servings ?? DEFAULT_SERVINGS,
		lines,
		steps,
		stepIngredients: recipe.steps.length
			? guessLinks(
					recipe.lines.map((line) => line.name),
					recipe.steps
				)
			: [[]],
		stepDurations: recipe.steps.length ? recipe.stepDurations : [null],
		tags: [...recipe.tags],
		image: null,
		reviewed: true
	};
}

/** How far the reading has gone over every page, from 0 to 1, for one progress bar across the pages. */
export function scanProgress(pageIndex: number, pageCount: number, pageRatio: number): number {
	if (pageCount <= 0) return 0;
	const ratio = Math.min(1, Math.max(0, Number.isFinite(pageRatio) ? pageRatio : 0));
	return Math.min(1, Math.max(0, (pageIndex + ratio) / pageCount));
}

/** A line found on the image, where it sits: some engines give boxes rather than text in reading order. */
export interface PlacedLine {
	text: string;
	top: number;
	left: number;
	height: number;
}

/** A gap taller than this many line heights separates two paragraphs: two steps, or a heading and a list. */
const PARAGRAPH_GAP = 1.2;

/**
 * Boxes turned into the text `structureRecipeText` reads: top to bottom, left to right on a same line,
 * and a blank line wherever the gap between two lines says a paragraph ended.
 */
export function textOfLines(lines: readonly PlacedLine[]): string {
	const sorted = lines
		.filter((line) => line.text.trim())
		.sort((a, b) => {
			const sameRow = Math.abs(a.top - b.top) < Math.min(a.height, b.height) / 2;
			return sameRow ? a.left - b.left : a.top - b.top;
		});

	const out: string[] = [];
	sorted.forEach((line, index) => {
		const previous = sorted[index - 1];
		if (previous) {
			const gap = line.top - (previous.top + previous.height);
			if (gap > PARAGRAPH_GAP * Math.max(previous.height, line.height)) out.push('');
		}
		out.push(line.text.trim());
	});

	return out.join('\n');
}

/** A recipe spread over a whole chapter is not one photo too many; a camera roll swept by mistake is. */
export const MAX_SCAN_PAGES = 8;
