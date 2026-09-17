import { describe, expect, it } from 'vitest';
import { defaultCircle, ofCircle, resolveAisle, visibleLists } from './circle';

describe('ofCircle', () => {
	it('ne garde que ce qui appartient au cercle actif', () => {
		const rows = [{ householdId: 'a' }, { householdId: 'b' }, { householdId: 'a' }];
		expect(ofCircle(rows, 'a')).toHaveLength(2);
		expect(ofCircle(rows, 'b')).toEqual([{ householdId: 'b' }]);
	});

	it('ne montre rien tant qu’aucun cercle n’est actif', () => {
		// Le cache est plein avant que le cercle soit connu — première ouverture, changement de
		// compte. Tout montrer à ce moment-là afficherait les cercles mélangés le temps d'un rendu.
		expect(ofCircle([{ householdId: 'a' }], '')).toEqual([]);
	});

	it('écarte une ligne sans cercle', () => {
		expect(ofCircle([{}], 'a')).toEqual([]);
	});
});

describe('visibleLists', () => {
	it('montre les listes du cercle actif et les personnelles', () => {
		const lists = [
			{ id: 'famille', householdId: 'a' },
			{ id: 'bureau', householdId: 'b' },
			{ id: 'cadeaux' }
		];

		expect(visibleLists(lists, 'a').map((list) => list.id)).toEqual(['famille', 'cadeaux']);
		expect(visibleLists(lists, 'b').map((list) => list.id)).toEqual(['bureau', 'cadeaux']);
	});

	it('garde la liste personnelle même sans cercle actif', () => {
		// Elle n'appartient à personne d'autre qu'à son auteur : aucun cercle ne peut la cacher, et
		// surtout pas l'absence de cercle.
		expect(visibleLists([{ id: 'cadeaux' }, { id: 'famille', householdId: 'a' }], '')).toEqual([
			{ id: 'cadeaux' }
		]);
	});
});

describe('resolveAisle', () => {
	const known = new Set(['fruits', 'pain']);

	it('garde le rayon quand le cercle actif le connaît', () => {
		expect(resolveAisle('fruits', known, 'pain')).toBe('fruits');
	});

	it('retombe sur le rayon proposé quand il vient d’un autre cercle', () => {
		expect(resolveAisle('rayon-du-bureau', known, 'pain')).toBe('pain');
	});
});

describe('defaultCircle', () => {
	const circles = [
		{ id: 'a', name: 'Maison' },
		{ id: 'b', name: 'Bureau' }
	];

	it('reprend le cercle qu’on regardait', () => {
		expect(defaultCircle(circles, 'b')).toBe('b');
	});

	it('retombe sur le plus ancien quand le cercle retenu n’est plus à nous', () => {
		// On a pu en être sorti depuis un autre appareil : l'afficher quand même donnerait un écran
		// vide décrivant un cercle auquel on n'appartient plus.
		expect(defaultCircle(circles, 'c')).toBe('a');
		expect(defaultCircle(circles, null)).toBe('a');
	});

	it('ne rend rien quand le compte n’a aucun cercle', () => {
		expect(defaultCircle([], 'a')).toBe('');
	});
});
