import { DEFAULT_SERVINGS, MAX_SERVINGS, MIN_SERVINGS } from './recipe';
import { parseRecipeSuggestion, RECIPE_JSON_SHAPE, type SuggestedRecipe } from './ai-recipe';
import { RECIPE_TAG_CATEGORIES } from './recipe-tags';
import { UNITS } from './units';

/**
 * The "ask the AI" chat of the "Create a recipe" screen (#313): the person describes what they feel like
 * eating, the assistant may ask a short question back (how many people, how much time, which equipment),
 * then writes the recipe, which goes to the editable form and is never saved from here.
 *
 * The instructions are written in English and the answer is asked in the app's language: a prompt in French
 * made a model drift towards French answers whatever the language asked for (#313).
 */

/** Past this many questions the assistant must write the recipe: a senior should not face an interview. */
export const MAX_FOLLOW_UP_QUESTIONS = 2;

export interface ChatPromptOptions {
	/** The app's language, written in that language ("Français", "العربية"). */
	language: string;
	/** How many people eat, when the person said who is at the table; null lets the assistant ask. */
	servings: number | null;
	/**
	 * The allergies and diets of everyone at the table, household members and guests alike. Only the
	 * constraint leaves the device, never whose it is: a name teaches a recipe nothing.
	 */
	constraints: string[];
	/** False once `MAX_FOLLOW_UP_QUESTIONS` were asked: the next answer must be the recipe. */
	mayAsk: boolean;
}

/**
 * Said on every turn: the shape `{"name":""}` alone let models copy the person's sentence ("something quick
 * with leftover chicken") into the title, which is how the request became the recipe's name (#313).
 */
const NAME_RULE =
	'"name" is a short dish title you choose yourself, as a cookbook would print it (for example "Chicken curry with coconut milk"), at most 60 characters. Never copy or rephrase the person\'s message as the title.';

const RECIPE_RULES = [
	'"emoji" is a single emoji character.',
	`"unit" must be one of: ${UNITS.join(', ')}.`,
	'"qty" is a number written in digits, or an empty string when the quantity cannot be counted.',
	'"steps" holds the preparation steps, one per entry, in order.',
	'"stepIngredients" holds one list per step, in the same order as "steps": the indices (from 0) of the ingredients that step uses.',
	'"stepMinutes" holds one number per step, in the same order as "steps": the minutes when the step makes you cook, rest or wait a precise time, otherwise 0.',
	'"imagePrompt" describes, in English and in one or two sentences, the photo of the finished dish for an image generator: type of dish, visible ingredients, texture, plating, vessel, setting. No text in the image.',
	'"tags" holds the keys that fit the recipe, chosen only from these lists:',
	...RECIPE_TAG_CATEGORIES.map((category) => `${category.id}: ${category.tags.join(', ')}`),
	'Always put at least one course. Only put a diet when it is true of every ingredient.'
];

const clampServings = (value: number): number =>
	Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(value)));

function servingsLines(servings: number | null, mayAsk: boolean): string[] {
	if (servings !== null && Number.isFinite(servings)) {
		return [`The recipe is for ${clampServings(servings)} people, unless the person says otherwise.`];
	}

	return mayAsk
		? []
		: [`If the conversation does not say for how many people, plan it for ${DEFAULT_SERVINGS} people.`];
}

function constraintLines(constraints: string[]): string[] {
	const kept = constraints.map((c) => c.trim()).filter(Boolean);
	const told = kept.length
		? [
				'People at the table have these allergies or diets, which must all be respected:',
				...kept.map((c) => `- ${c}`),
				'Never use a forbidden ingredient, not even as a garnish, an option or a variant.'
			]
		: [];

	return [
		...told,
		'Also respect every allergy, intolerance or diet mentioned anywhere in the conversation, for anyone at the table.'
	];
}

function questionLines(mayAsk: boolean): string[] {
	if (!mayAsk) {
		return [
			'Do not ask any more questions: write the recipe now, choosing sensible defaults for what is still unknown.'
		];
	}

	return [
		'If something missing really changes the recipe — how many people, how much time, which equipment (oven, hob, microwave…) — you may ask ONE short, simple question instead of the recipe.',
		'Otherwise write the recipe straight away. Never ask about something the person already said.',
		'To ask a question, reply with exactly: {"question":""}'
	];
}

/**
 * The instruction wrapped around each message of the person, the first one or a later one. Every turn
 * restates the whole reply contract, since a model left without it drifts towards answering a change in
 * prose.
 */
export function recipeChatPrompt(userText: string, options: ChatPromptOptions, isFirst: boolean): string {
	return [
		isFirst
			? 'You help a family cook: in a conversation, you write a cooking recipe for what the person asks.'
			: 'The same person continues the conversation.',
		`Write every text meant for the person (question, title, ingredients, steps) in ${options.language}.`,
		isFirst ? "The person's message:" : "The person's new message:",
		userText,
		'',
		...(isFirst ? [] : ['If you already gave a recipe, give the complete updated recipe again.']),
		...servingsLines(options.servings, options.mayAsk),
		...constraintLines(options.constraints),
		...questionLines(options.mayAsk),
		'Reply only with one JSON object, with no text around it and no code block.',
		'To give the recipe, use exactly this shape:',
		RECIPE_JSON_SHAPE,
		NAME_RULE,
		...RECIPE_RULES
	].join('\n');
}

export type ChatReply =
	| { kind: 'question'; text: string }
	| { kind: 'recipe'; recipe: SuggestedRecipe };

/** Long enough for any real question, short enough that a runaway answer does not fill the screen. */
const MAX_QUESTION_LENGTH = 400;

/**
 * What the assistant answered: a recipe when there is a usable one, otherwise its question, otherwise null.
 * A recipe wins over a question sent in the same object, since it is what the person came for.
 */
export function parseChatReply(text: string): ChatReply | null {
	const recipe = parseRecipeSuggestion(text);
	if (recipe) return { kind: 'recipe', recipe };

	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start === -1 || end <= start) return null;

	try {
		const root: unknown = JSON.parse(text.slice(start, end + 1));
		const question =
			typeof root === 'object' && root !== null && 'question' in root
				? (root as { question: unknown }).question
				: null;
		if (typeof question !== 'string' || !question.trim()) return null;

		return { kind: 'question', text: question.trim().slice(0, MAX_QUESTION_LENGTH) };
	} catch {
		return null;
	}
}

/** A person at the table, as the chat screen lists them: only `notes` is ever sent. */
export interface TableGuest {
	name: string;
	notes: string;
}

/** The constraints sent for the people at the table, without duplicates and without empty notes. */
export function tableConstraints(people: TableGuest[]): string[] {
	const seen = new Set<string>();
	const kept: string[] = [];

	for (const person of people) {
		const notes = person.notes.trim();
		const key = notes.toLowerCase();
		if (!notes || seen.has(key)) continue;

		seen.add(key);
		kept.push(notes);
	}

	return kept;
}

export interface Conflict {
	ingredient: string;
	constraint: string;
}

/**
 * Words that tie an ingredient's name together and say nothing of what it is: without them "salt and
 * pepper" would clash with "no nuts and no gluten" on "and".
 */
const LINK_WORDS = new Set([
	'and', 'with', 'the', 'for', 'avec', 'pour', 'sans', 'sauf', 'les', 'des', 'aux', 'une', 'und', 'mit',
	'ohne', 'der', 'die', 'das', 'con', 'sin', 'los', 'las', 'del', 'per', 'senza', 'della', 'dei', 'com',
	'sem', 'para', 'dos', 'amin', 'ary'
]);

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

const normalize = (text: string): string =>
	text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();

/** "Tomates", "tomate", "tomatoes" and "tomato" meet on one stem, as do "choux" and "chou". */
const stemPart = (part: string): string =>
	part.length <= 3 ? part : part.replace(/[sx]$/, '').replace(/e$/, '');

const stem = (word: string): string => word.split('-').map(stemPart).join('-');

/** Words split on spaces and punctuation only, so "chou-fleur" stays one word and never meets "fleur de sel". */
const wordsOf = (text: string): string[] =>
	normalize(text)
		.split(/[^\p{L}\p{N}-]+/u)
		.map((word) => word.replace(/^-+|-+$/g, ''))
		.filter(Boolean)
		.map(stem);

/**
 * The ingredients of a recipe that one of the table's constraints names, checked on the device after the
 * answer: the prompt asks the model to respect them, and this is what shows when it did not.
 *
 * Deliberately a word match and nothing smarter: "vegetarian" does not flag the chicken. It only catches the
 * named food ("allergic to cauliflower" flags "Roasted cauliflower"), which is the case a guest's allergy
 * is written as, and a false alarm costs a second look while a missed one could cost an allergy.
 */
export function conflictingIngredients(recipe: SuggestedRecipe, constraints: string[]): Conflict[] {
	const conflicts: Conflict[] = [];

	for (const line of recipe.ingredients) {
		const ingredientWords = wordsOf(line.name).filter(
			(word) => word.length >= 3 && !LINK_WORDS.has(word)
		);
		const ingredientText = normalize(line.name).trim();

		const constraint = constraints.find((candidate) => {
			if (CJK.test(ingredientText) && ingredientText.length >= 2) {
				return normalize(candidate).includes(ingredientText);
			}
			const constraintWords = new Set(wordsOf(candidate));
			return ingredientWords.some((word) => constraintWords.has(word));
		});

		if (constraint) conflicts.push({ ingredient: line.name, constraint });
	}

	return conflicts;
}
