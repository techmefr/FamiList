import { describe, expect, it } from 'vitest';
import { DEFAULT_EMOJI, draftFromImport, draftFromSuggestion, emptyDraft } from './recipe-draft';
import { DEFAULT_SERVINGS } from './recipe';
import { DEFAULT_UNIT } from './units';

describe('emptyDraft', () => {
	it('ouvre sur une ligne et une étape vides, sans demander de relecture', () => {
		expect(emptyDraft()).toEqual({
			name: '',
			emoji: DEFAULT_EMOJI,
			servings: DEFAULT_SERVINGS,
			lines: [{ name: '', qty: '', unit: DEFAULT_UNIT }],
			steps: [''],
			stepIngredients: [[]],
			stepDurations: [null],
			image: null,
			reviewed: false
		});
	});

	it('rend un brouillon neuf à chaque appel', () => {
		const first = emptyDraft();
		first.lines[0].name = 'Farine';
		expect(emptyDraft().lines[0].name).toBe('');
	});
});

describe('draftFromImport', () => {
	it('découpe les lignes, lit les portions et garde la photo de la page', () => {
		const draft = draftFromImport({
			name: 'Crêpes',
			ingredients: ['250 g de farine', '3 oeufs'],
			steps: ['Mélanger la farine et les oeufs.', 'Laisser reposer 30 minutes.'],
			servings: '6 personnes',
			image: 'https://exemple.fr/crepes.jpg'
		});

		expect(draft.name).toBe('Crêpes');
		expect(draft.servings).toBe(6);
		expect(draft.lines[0]).toEqual({ name: 'farine', qty: '250', unit: 'g' });
		expect(draft.steps).toHaveLength(2);
		expect(draft.stepIngredients).toHaveLength(2);
		expect(draft.stepDurations).toEqual([null, 30 * 60]);
		expect(draft.image).toBe('https://exemple.fr/crepes.jpg');
		expect(draft.reviewed).toBe(true);
	});

	it('garde un formulaire remplissable quand la page ne donne presque rien', () => {
		const draft = draftFromImport({ name: null, ingredients: [], steps: [], servings: null, image: null });

		expect(draft.name).toBe('');
		expect(draft.servings).toBe(DEFAULT_SERVINGS);
		expect(draft.lines).toEqual([{ name: '', qty: '', unit: DEFAULT_UNIT }]);
		expect(draft.steps).toEqual(['']);
		expect(draft.stepIngredients).toEqual([[]]);
	});
});

describe('draftFromSuggestion', () => {
	it('reprend la proposition telle quelle, à relire', () => {
		const draft = draftFromSuggestion({
			name: 'Curry',
			emoji: '🍛',
			servings: 4,
			ingredients: [{ name: 'Poulet', qty: '500', unit: 'g' }],
			steps: ['Cuire le poulet.'],
			stepIngredients: [[0]],
			stepDurations: [600],
			imagePrompt: 'un curry fumant'
		});

		expect(draft).toEqual({
			name: 'Curry',
			emoji: '🍛',
			servings: 4,
			lines: [{ name: 'Poulet', qty: '500', unit: 'g' }],
			steps: ['Cuire le poulet.'],
			stepIngredients: [[0]],
			stepDurations: [600],
			imagePrompt: 'un curry fumant',
			image: null,
			reviewed: true
		});
	});

	it('ne laisse jamais le formulaire sans ligne ni étape', () => {
		const draft = draftFromSuggestion({
			name: 'Vide',
			emoji: '🍲',
			servings: 2,
			ingredients: [],
			steps: [],
			stepIngredients: [],
			stepDurations: []
		});

		expect(draft.lines).toHaveLength(1);
		expect(draft.steps).toEqual(['']);
		expect(draft.stepIngredients).toEqual([[]]);
		expect(draft.stepDurations).toEqual([null]);
	});
});
