import { describe, expect, it } from 'vitest';
import { groupByAisle, learnedItemOrder, type OrderableItem } from './aisle-order';

const item = (id: string, name: string, aisleId: string): OrderableItem => ({
	id,
	name,
	aisleId,
	checked: false
});

const items = [
	item('1', 'Baguette tradition', 'boulangerie'),
	item('2', 'Tomates grappe', 'fruits'),
	item('3', 'Lait demi-écrémé', 'laitier'),
	item('4', 'Pommes Gala', 'fruits'),
	item('5', 'Croissants', 'boulangerie')
];

describe('groupByAisle', () => {
	it('suit l’ordre de marche du magasin', () => {
		const groups = groupByAisle(items, ['fruits', 'boulangerie', 'laitier']);
		expect(groups.map((g) => g.aisleId)).toEqual(['fruits', 'boulangerie', 'laitier']);
	});

	it('change d’ordre quand on change de magasin', () => {
		const groups = groupByAisle(items, ['laitier', 'boulangerie', 'fruits']);
		expect(groups.map((g) => g.aisleId)).toEqual(['laitier', 'boulangerie', 'fruits']);
	});

	it('place les rayons inconnus du parcours à la fin plutôt que de les masquer', () => {
		const groups = groupByAisle(items, ['laitier']);
		expect(groups[0].aisleId).toBe('laitier');
		expect(groups.map((g) => g.aisleId)).toHaveLength(3);
		expect(groups.flatMap((g) => g.items)).toHaveLength(items.length);
	});

	it('ne perd jamais un article', () => {
		const groups = groupByAisle(items, []);
		expect(groups.flatMap((g) => g.items).map((i) => i.id).sort()).toEqual([
			'1',
			'2',
			'3',
			'4',
			'5'
		]);
	});

	it('applique l’ordre appris à l’intérieur d’un rayon', () => {
		const groups = groupByAisle(items, ['fruits'], {
			fruits: ['pommes-gala', 'tomates-grappe']
		});
		expect(groups[0].items.map((i) => i.name)).toEqual(['Pommes Gala', 'Tomates grappe']);
	});

	it('range les produits inconnus après ceux déjà appris', () => {
		const withNew = [...items, item('6', 'Bananes', 'fruits')];
		const groups = groupByAisle(withNew, ['fruits'], { fruits: ['pommes-gala'] });
		expect(groups[0].items.map((i) => i.name)).toEqual([
			'Pommes Gala',
			'Tomates grappe',
			'Bananes'
		]);
	});

	it('retrouve un produit racheté, puisque l’ordre est indexé par slug et non par identifiant', () => {
		const learned = learnedItemOrder([
			item('a', 'Pommes Gala', 'fruits'),
			item('b', 'Tomates grappe', 'fruits')
		]);

		const rebought = [
			item('nouvel-id-1', 'Tomates grappe', 'fruits'),
			item('nouvel-id-2', 'Pommes Gala', 'fruits')
		];

		const groups = groupByAisle(rebought, ['fruits'], { fruits: learned });
		expect(groups[0].items.map((i) => i.name)).toEqual(['Pommes Gala', 'Tomates grappe']);
	});
});

describe('learnedItemOrder', () => {
	it('retient des slugs, pas des identifiants', () => {
		expect(learnedItemOrder([item('1', 'Lait demi-écrémé', 'laitier')])).toEqual([
			'lait-demi-ecreme'
		]);
	});
});
