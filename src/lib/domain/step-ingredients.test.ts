import { describe, expect, it } from 'vitest';
import { guessLinks, ingredientsOfStep, sanitizeLinks, toggleLink, withoutIngredient } from './step-ingredients';

describe('ingredientsOfStep', () => {
	const ingredients = [
		{ id: 'a', name: 'Farine' },
		{ id: 'b', name: 'Oeufs' },
		{ id: 'c', name: 'Lait' }
	];

	it("garde l'ordre de la recette, pas celui des liens", () => {
		expect(ingredientsOfStep(['c', 'a'], ingredients).map((line) => line.id)).toEqual(['a', 'c']);
	});

	it('ignore un ingredient retire depuis', () => {
		expect(ingredientsOfStep(['z'], ingredients)).toEqual([]);
	});
});

describe('withoutIngredient', () => {
	it('retire la ligne et decale les suivantes', () => {
		expect(withoutIngredient([[0, 1, 2], [2]], 1)).toEqual([[0, 1], [1]]);
	});
});

describe('toggleLink', () => {
	it('coche puis decoche un ingredient pour une seule etape', () => {
		const ticked = toggleLink([[], [0]], 0, 2);
		expect(ticked).toEqual([[2], [0]]);
		expect(toggleLink(ticked, 0, 2)).toEqual([[], [0]]);
	});

	it('garde les indices tries', () => {
		expect(toggleLink([[3]], 0, 1)).toEqual([[1, 3]]);
	});
});

describe('sanitizeLinks', () => {
	it('aligne sur le nombre d etapes et ne garde que des lignes reelles', () => {
		expect(sanitizeLinks([[0, 0, 5, -1, 1.5, 'x', 1]], 2, 3)).toEqual([[0, 1], []]);
	});

	it('supporte une reponse sans liens', () => {
		expect(sanitizeLinks(undefined, 2, 3)).toEqual([[], []]);
	});
});

describe('guessLinks', () => {
	it("relie une etape aux ingredients qu'elle nomme, au singulier comme au pluriel", () => {
		const links = guessLinks(
			['Pommes de terre', 'Oeufs', 'Crème fraîche', 'Sel'],
			['Éplucher la pomme de terre.', 'Battre les oeufs avec la creme.', 'Enfourner 30 minutes.']
		);

		expect(links).toEqual([[0], [1, 2], []]);
	});

	it('ne relie rien sur un mot vide', () => {
		expect(guessLinks(['1 de'], ['Ajouter 1 de chaque'])).toEqual([[]]);
	});
});
