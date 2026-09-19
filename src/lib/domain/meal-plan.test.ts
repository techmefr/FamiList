import { describe, expect, it } from 'vitest';
import { generatedItemsForPlan, type MealPlanRecipeLines } from './meal-plan';
import type { RecipeLine } from './recipe';

const line = (name: string, qty = '', unit = 'piece'): RecipeLine => ({ name, qty, unit });
const source = (lines: RecipeLine[], factor = 1): MealPlanRecipeLines => ({ lines, factor });

describe('generatedItemsForPlan', () => {
	it('somme deux lignes de même produit et de même unité', () => {
		const produced = generatedItemsForPlan(
			[source([line('Tomates', '300', 'g')]), source([line('Tomates', '200', 'g')])],
			[]
		);

		expect(produced).toEqual([{ name: 'Tomates', qty: '500', unit: 'g' }]);
	});

	it('garde deux lignes séparées quand l unité diffère', () => {
		const produced = generatedItemsForPlan(
			[source([line('Tomates', '3', 'piece')]), source([line('Tomates', '500', 'g')])],
			[]
		);

		expect(produced).toEqual(
			expect.arrayContaining([
				{ name: 'Tomates', qty: '3', unit: 'piece' },
				{ name: 'Tomates', qty: '500', unit: 'g' }
			])
		);
		expect(produced).toHaveLength(2);
	});

	it('concatène simplement quand les recettes ne se recoupent pas', () => {
		const produced = generatedItemsForPlan(
			[source([line('Pâtes', '400', 'g')]), source([line('Œufs', '4')])],
			[]
		);

		expect(produced).toEqual([
			{ name: 'Pâtes', qty: '400', unit: 'g' },
			{ name: 'Œufs', qty: '4', unit: 'piece' }
		]);
	});

	it('met chaque recette à l échelle avant de sommer', () => {
		const produced = generatedItemsForPlan(
			[source([line('Farine', '200', 'g')], 2), source([line('Farine', '100', 'g')], 0.5)],
			[]
		);

		expect(produced).toEqual([{ name: 'Farine', qty: '450', unit: 'g' }]);
	});

	it('compte une ligne sans quantité comme une pièce', () => {
		const produced = generatedItemsForPlan(
			[source([line('Sel')]), source([line('Sel')])],
			[]
		);

		expect(produced).toEqual([{ name: 'Sel', qty: '2', unit: 'piece' }]);
	});

	it('ignore un produit déjà présent dans la liste ciblée', () => {
		const produced = generatedItemsForPlan(
			[source([line('Tomates', '300', 'g')])],
			['Tomates']
		);

		expect(produced).toEqual([]);
	});

	it('ignore les lignes sans nom', () => {
		const produced = generatedItemsForPlan([source([line('  ', '1')])], []);

		expect(produced).toEqual([]);
	});
});
