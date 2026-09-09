import { describe, it, expect } from 'vitest';
import { move, dropIndex, slotShifts, edgeScrollStep, BORD, VITESSE } from './reorder';

/** Trois lignes de 100 px collées les unes aux autres, la première à 0. */
const tops = [0, 108, 216];
const hauteurs = [100, 100, 100];
const ecart = 8;

describe('move', () => {
	it('descend un element', () => {
		expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
	});

	it('remonte un element', () => {
		expect(move(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
	});

	it('ne touche pas au tableau d origine', () => {
		const source = ['a', 'b'];
		move(source, 0, 1);
		expect(source).toEqual(['a', 'b']);
	});
});

describe('dropIndex', () => {
	it('reste en place tant que la moitie du voisin n est pas franchie', () => {
		// La ligne 0 descend de 40 px : son centre est a 90, la moitie de la ligne 1 est a 158.
		expect(dropIndex(50 + 40, tops, hauteurs, 0)).toBe(0);
	});

	it('prend la place du voisin des sa moitie franchie', () => {
		expect(dropIndex(50 + 110, tops, hauteurs, 0)).toBe(1);
	});

	it('descend de deux rangs d un seul geste', () => {
		expect(dropIndex(50 + 220, tops, hauteurs, 0)).toBe(2);
	});

	it('remonte', () => {
		expect(dropIndex(266 - 120, tops, hauteurs, 2)).toBe(1);
	});

	it('ne sort pas de la liste, si loin que le doigt aille', () => {
		expect(dropIndex(9999, tops, hauteurs, 0)).toBe(2);
		expect(dropIndex(-9999, tops, hauteurs, 2)).toBe(0);
	});
});

describe('slotShifts', () => {
	it('ne bouge personne quand la cible est le depart', () => {
		expect(slotShifts(tops, hauteurs, ecart, 1, 1)).toEqual([0, 0, 0]);
	});

	it('remonte les lignes survolees quand on descend', () => {
		// 0 va en 2 : les lignes 1 et 2 remontent d une hauteur de ligne plus l ecart.
		expect(slotShifts(tops, hauteurs, ecart, 0, 2)).toEqual([216, -108, -108]);
	});

	it('descend les lignes survolees quand on remonte', () => {
		expect(slotShifts(tops, hauteurs, ecart, 2, 0)).toEqual([108, 108, -216]);
	});

	it('tient compte des hauteurs inegales', () => {
		// Une ligne haute au milieu : la premiere doit descendre de sa hauteur, pas de la sienne.
		const inegaux = [0, 108, 266];
		const grandes = [100, 150, 100];
		expect(slotShifts(inegaux, grandes, ecart, 0, 1)).toEqual([158, -108, 0]);
	});

	it('somme des decalages nulle sur des lignes egales', () => {
		const decalages = slotShifts(tops, hauteurs, ecart, 0, 2);
		expect(decalages.reduce((a, b) => a + b, 0)).toBe(0);
	});
});

describe('edgeScrollStep', () => {
	const ecran = 800;

	it('ne defile pas au milieu de l ecran', () => {
		expect(edgeScrollStep(400, ecran)).toBe(0);
	});

	it('ne defile pas juste avant la zone de bord', () => {
		expect(edgeScrollStep(BORD, ecran)).toBe(0);
		expect(edgeScrollStep(ecran - BORD, ecran)).toBe(0);
	});

	it('remonte quand le doigt approche du haut', () => {
		expect(edgeScrollStep(BORD - 30, ecran)).toBeLessThan(0);
	});

	it('descend quand le doigt approche du bas', () => {
		expect(edgeScrollStep(ecran - BORD + 30, ecran)).toBeGreaterThan(0);
	});

	it('accelere a mesure qu on s enfonce dans le bord', () => {
		const doux = edgeScrollStep(ecran - BORD + 10, ecran);
		const franc = edgeScrollStep(ecran - BORD + 60, ecran);
		expect(franc).toBeGreaterThan(doux);
	});

	it('ne depasse jamais la vitesse maximale', () => {
		expect(edgeScrollStep(-9999, ecran)).toBe(-VITESSE);
		expect(edgeScrollStep(9999, ecran)).toBe(VITESSE);
	});
});
