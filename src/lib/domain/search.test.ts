import { describe, expect, it } from 'vitest';
import {
	flattenHits,
	searchAll,
	scoreEntry,
	HITS_PER_KIND,
	MIN_QUERY_LENGTH,
	type SearchSource
} from './search';

const source: SearchSource = {
	lists: [
		{ id: 'l1', name: 'Courses de la semaine', emoji: '🛒' },
		{ id: 'l2', name: 'Anniversaire Léa', emoji: '🎂' }
	],
	items: [
		{ id: 'i1', listId: 'l1', name: 'Lait demi-écrémé', checked: false },
		{ id: 'i2', listId: 'l1', name: 'Café', note: 'celui avec du lait', checked: true },
		{ id: 'i3', listId: 'l2', name: 'Bougies', checked: false },
		{ id: 'i4', listId: 'inconnue', name: 'Orphelin', checked: false }
	],
	shops: [
		{ id: 's1', name: 'Carrefour Meximieux', brand: 'Carrefour' },
		{ id: 's2', name: 'Boucherie du marché', brand: '' }
	],
	cards: [{ id: 'c1', name: 'Fidélité maison', brand: 'Carrefour' }]
};

const idsOf = (query: string) => flattenHits(searchAll(query, source)).map((hit) => hit.id);

describe('scoreEntry', () => {
	it('ignore les accents et la casse', () => {
		expect(scoreEntry('ecreme', [{ value: 'Écrémé', weight: 1 }])).toBeGreaterThan(0);
	});

	it('note une correspondance exacte au-dessus d’un simple début', () => {
		const exact = scoreEntry('cafe', [{ value: 'Café', weight: 1 }]);
		const start = scoreEntry('cafe', [{ value: 'Cafetière', weight: 1 }]);

		expect(exact).toBeGreaterThan(start);
	});

	it('note un début de mot au-dessus d’un fragment au milieu', () => {
		const word = scoreEntry('lait', [{ value: 'Chocolat lait', weight: 1 }]);
		const middle = scoreEntry('lait', [{ value: 'Allaitement', weight: 1 }]);

		expect(word).toBeGreaterThan(middle);
		expect(middle).toBeGreaterThan(0);
	});

	it('abaisse la note d’un champ secondaire', () => {
		const name = scoreEntry('lait', [{ value: 'Lait', weight: 1 }]);
		const note = scoreEntry('lait', [{ value: 'Lait', weight: 0.5 }]);

		expect(note).toBeLessThan(name);
	});

	it('exige que chaque mot tapé se retrouve', () => {
		expect(scoreEntry('lait bio', [{ value: 'Lait demi-écrémé', weight: 1 }])).toBe(0);
		expect(scoreEntry('lait bio', [{ value: 'Lait bio de ferme', weight: 1 }])).toBeGreaterThan(0);
	});

	it('accepte que les mots tapés viennent de champs différents', () => {
		const score = scoreEntry('cafe lait', [
			{ value: 'Café', weight: 1 },
			{ value: 'celui avec du lait', weight: 0.5 }
		]);

		expect(score).toBeGreaterThan(0);
	});

	it('rend zéro sur une requête vide ou sans lettre', () => {
		expect(scoreEntry('', [{ value: 'Lait', weight: 1 }])).toBe(0);
		expect(scoreEntry('   ', [{ value: 'Lait', weight: 1 }])).toBe(0);
	});

	it('rend zéro quand un champ est vide', () => {
		expect(scoreEntry('lait', [{ value: '', weight: 1 }])).toBe(0);
	});
});

describe('searchAll', () => {
	it('ne cherche rien tant que la requête est trop courte', () => {
		expect(searchAll('l', source)).toEqual([]);
		expect(MIN_QUERY_LENGTH).toBe(2);
	});

	it('trouve un article par son nom', () => {
		expect(idsOf('lait')).toContain('i1');
	});

	it('trouve un article par sa note', () => {
		const hit = flattenHits(searchAll('celui avec', source)).find((h) => h.id === 'i2');
		expect(hit).toBeDefined();
	});

	it('trouve une liste par son nom', () => {
		expect(idsOf('anniversaire')).toContain('l2');
	});

	it('trouve un magasin par son enseigne et une carte par la sienne', () => {
		const ids = idsOf('carrefour');
		expect(ids).toContain('s1');
		expect(ids).toContain('c1');
	});

	it('range les résultats par famille, listes en premier', () => {
		const groups = searchAll('lait', source);
		expect(groups.map((group) => group.kind)).toEqual(['item']);

		const mixed = searchAll('carrefour', source);
		expect(mixed.map((group) => group.kind)).toEqual(['shop', 'card']);
	});

	it('ne rend aucune famille vide', () => {
		for (const group of searchAll('carrefour', source)) expect(group.hits.length).toBeGreaterThan(0);
	});

	it('mène un article vers sa liste, en le désignant', () => {
		const hit = flattenHits(searchAll('lait', source)).find((h) => h.id === 'i1');
		expect(hit?.href).toBe('/l/l1?item=i1');
	});

	it('porte le nom et l’emoji de la liste sur un article', () => {
		const hit = flattenHits(searchAll('bougies', source)).find((h) => h.id === 'i3');
		expect(hit?.detail).toBe('Anniversaire Léa');
		expect(hit?.icon).toBe('🎂');
	});

	it('rend un article dont la liste a disparu, sans détail', () => {
		const hit = flattenHits(searchAll('orphelin', source)).find((h) => h.id === 'i4');
		expect(hit?.detail).toBe('');
	});

	it('signale un article déjà coché', () => {
		const hit = flattenHits(searchAll('cafe', source)).find((h) => h.id === 'i2');
		expect(hit?.checked).toBe(true);
	});

	it('classe la correspondance la plus franche en tête', () => {
		const dense: SearchSource = {
			...source,
			items: [
				{ id: 'a', listId: 'l1', name: 'Chocolat au lait', checked: false },
				{ id: 'b', listId: 'l1', name: 'Lait', checked: false }
			]
		};

		expect(flattenHits(searchAll('lait', dense))[0]?.id).toBe('b');
	});

	it('borne le nombre de résultats par famille', () => {
		const many: SearchSource = {
			lists: [],
			items: Array.from({ length: HITS_PER_KIND + 5 }, (_, index) => ({
				id: `x${index}`,
				listId: 'l1',
				name: `Lait ${index}`,
				checked: false
			})),
			shops: [],
			cards: []
		};

		expect(flattenHits(searchAll('lait', many))).toHaveLength(HITS_PER_KIND);
	});

	it('ne rend rien sur un mot absent', () => {
		expect(searchAll('licorne', source)).toEqual([]);
	});

	it('supporte un foyer entièrement vide', () => {
		expect(searchAll('lait', { lists: [], items: [], shops: [], cards: [] })).toEqual([]);
	});
});
