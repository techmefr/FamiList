import { describe, it, expect } from 'vitest';
import {
	conflictingIngredients,
	parseChatReply,
	recipeChatPrompt,
	tableConstraints,
	type ChatPromptOptions
} from './ai-recipe-chat';
import { RECIPE_JSON_SHAPE, type SuggestedRecipe } from './ai-recipe';

const options = (over: Partial<ChatPromptOptions> = {}): ChatPromptOptions => ({
	language: 'English',
	servings: null,
	constraints: [],
	mayAsk: true,
	...over
});

const recipe = (ingredients: string[]): SuggestedRecipe => ({
	name: 'Gratin',
	emoji: '🥘',
	servings: 4,
	ingredients: ingredients.map((name) => ({ name, qty: '', unit: 'piece' })),
	steps: [''],
	stepIngredients: [[]],
	tags: [],
	stepDurations: [null]
});

describe('recipeChatPrompt', () => {
	it('carries the message and asks for the app language, not French', () => {
		const prompt = recipeChatPrompt('quelque chose de rapide avec du poulet', options({ language: 'العربية' }), true);

		expect(prompt).toContain('quelque chose de rapide avec du poulet');
		expect(prompt).toContain('in العربية');
		expect(prompt).not.toContain('Voici une demande');
	});

	it('tells the model to choose the title itself and never copy the message (#313)', () => {
		const prompt = recipeChatPrompt('quelque chose de rapide', options(), true);

		expect(prompt).toContain('"name" is a short dish title you choose yourself');
		expect(prompt).toContain("Never copy or rephrase the person's message as the title.");
	});

	it('asks for the full recipe shape with tags, image prompt, step minutes and links', () => {
		const prompt = recipeChatPrompt('soup', options(), true);

		expect(prompt).toContain(RECIPE_JSON_SHAPE);
		expect(prompt).toContain('"tags"');
		expect(prompt).toContain('"imagePrompt"');
		expect(prompt).toContain('"stepMinutes"');
		expect(prompt).toContain('"stepIngredients"');
	});

	it('allows one question while questions are left, then forbids them', () => {
		expect(recipeChatPrompt('soup', options(), true)).toContain('{"question":""}');

		const last = recipeChatPrompt('soup', options({ mayAsk: false }), false);
		expect(last).not.toContain('{"question":""}');
		expect(last).toContain('Do not ask any more questions');
		expect(last).toContain('plan it for 4 people');
	});

	it('gives the number of people when the table is known', () => {
		expect(recipeChatPrompt('soup', options({ servings: 6 }), true)).toContain('for 6 people');
		expect(recipeChatPrompt('soup', options({ servings: 500 }), true)).toContain('for 99 people');
	});

	it('sends every constraint of the table, and only the constraint', () => {
		const prompt = recipeChatPrompt(
			'un gratin',
			options({ constraints: tableConstraints([{ name: 'Marie', notes: 'allergique au chou-fleur' }]) }),
			true
		);

		expect(prompt).toContain('- allergique au chou-fleur');
		expect(prompt).toContain('Never use a forbidden ingredient');
		expect(prompt).not.toContain('Marie');
	});

	it('restates the whole contract on a later turn', () => {
		const prompt = recipeChatPrompt('4 people', options(), false);

		expect(prompt).toContain("The person's new message:");
		expect(prompt).toContain('give the complete updated recipe again');
		expect(prompt).toContain(RECIPE_JSON_SHAPE);
	});
});

describe('parseChatReply', () => {
	it('reads a question', () => {
		expect(parseChatReply('{"question":" For how many people? "}')).toEqual({
			kind: 'question',
			text: 'For how many people?'
		});
	});

	it('reads a recipe, even wrapped in chatter', () => {
		const reply = parseChatReply(
			'Here: ```json {"name":"Omelette","ingredients":[{"name":"Eggs","qty":"4","unit":"piece"}],"steps":["Beat."]} ```'
		);

		expect(reply?.kind).toBe('recipe');
		expect(reply?.kind === 'recipe' && reply.recipe.name).toBe('Omelette');
	});

	it('prefers the recipe when both come back', () => {
		const reply = parseChatReply(
			'{"question":"Oven?","name":"Soup","ingredients":[{"name":"Leek","qty":"","unit":"piece"}]}'
		);

		expect(reply?.kind).toBe('recipe');
	});

	it('returns null on anything unusable', () => {
		expect(parseChatReply('Sure, how many people?')).toBeNull();
		expect(parseChatReply('{"question":""}')).toBeNull();
		expect(parseChatReply('{"question":')).toBeNull();
	});
});

describe('tableConstraints', () => {
	it('keeps each non-empty note once', () => {
		expect(
			tableConstraints([
				{ name: 'A', notes: ' sans gluten ' },
				{ name: 'B', notes: '' },
				{ name: 'C', notes: 'Sans gluten' },
				{ name: 'D', notes: 'végétarien' }
			])
		).toEqual(['sans gluten', 'végétarien']);
	});
});

describe('conflictingIngredients', () => {
	it('flags the ingredient a guest is allergic to, whatever its plural or accents', () => {
		const found = conflictingIngredients(recipe(['Choux-fleurs rôtis', 'Crème', 'Fleur de sel']), [
			'allergique au chou-fleur'
		]);

		expect(found).toEqual([{ ingredient: 'Choux-fleurs rôtis', constraint: 'allergique au chou-fleur' }]);
	});

	it('works in English and with singular and plural', () => {
		expect(conflictingIngredients(recipe(['Cherry tomatoes']), ['no tomato'])).toHaveLength(1);
		expect(conflictingIngredients(recipe(['Roasted cauliflower']), ['allergic to cauliflower'])).toHaveLength(
			1
		);
	});

	it('does not match on linking words', () => {
		expect(conflictingIngredients(recipe(['Salt and pepper']), ['no nuts and no gluten'])).toEqual([]);
	});

	it('finds a CJK ingredient inside a constraint written without spaces', () => {
		expect(conflictingIngredients(recipe(['花椰菜']), ['对花椰菜过敏'])).toHaveLength(1);
	});

	it('finds nothing when the recipe respects the table', () => {
		expect(conflictingIngredients(recipe(['Poireaux', 'Pommes de terre']), ['allergique au chou-fleur'])).toEqual(
			[]
		);
	});
});
