import { describe, it, expect } from 'vitest';
import { move, dropIndex, slotShifts, edgeScrollStep, EDGE, SPEED } from './reorder';

/** Three 100 px rows stuck to each other, the first at 0. */
const tops = [0, 108, 216];
const heights = [100, 100, 100];
const gap = 8;

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
		// Row 0 goes down by 40 px: its centre is at 90, the middle of row 1 is at 158.
		expect(dropIndex(50 + 40, tops, heights, 0)).toBe(0);
	});

	it('prend la place du voisin des sa moitie franchie', () => {
		expect(dropIndex(50 + 110, tops, heights, 0)).toBe(1);
	});

	it('descend de deux rangs d un seul geste', () => {
		expect(dropIndex(50 + 220, tops, heights, 0)).toBe(2);
	});

	it('remonte', () => {
		expect(dropIndex(266 - 120, tops, heights, 2)).toBe(1);
	});

	it('ne sort pas de la liste, si loin que le doigt aille', () => {
		expect(dropIndex(9999, tops, heights, 0)).toBe(2);
		expect(dropIndex(-9999, tops, heights, 2)).toBe(0);
	});
});

describe('slotShifts', () => {
	it('ne bouge personne quand la cible est le depart', () => {
		expect(slotShifts(tops, heights, gap, 1, 1)).toEqual([0, 0, 0]);
	});

	it('remonte les lignes survolees quand on descend', () => {
		// 0 goes to 2: rows 1 and 2 come up by one row height plus the gap.
		expect(slotShifts(tops, heights, gap, 0, 2)).toEqual([216, -108, -108]);
	});

	it('descend les lignes survolees quand on remonte', () => {
		expect(slotShifts(tops, heights, gap, 2, 0)).toEqual([108, 108, -216]);
	});

	it('tient compte des hauteurs inegales', () => {
		// A tall row in the middle: the first must go down by its height, not by its own.
		const inegaux = [0, 108, 266];
		const tall = [100, 150, 100];
		expect(slotShifts(inegaux, tall, gap, 0, 1)).toEqual([158, -108, 0]);
	});

	it('somme des decalages nulle sur des lignes egales', () => {
		const shifts = slotShifts(tops, heights, gap, 0, 2);
		expect(shifts.reduce((a, b) => a + b, 0)).toBe(0);
	});
});

describe('edgeScrollStep', () => {
	const screen = 800;

	it('ne defile pas au milieu de l ecran', () => {
		expect(edgeScrollStep(400, screen)).toBe(0);
	});

	it('ne defile pas juste avant la zone de bord', () => {
		expect(edgeScrollStep(EDGE, screen)).toBe(0);
		expect(edgeScrollStep(screen - EDGE, screen)).toBe(0);
	});

	it('remonte quand le doigt approche du haut', () => {
		expect(edgeScrollStep(EDGE - 30, screen)).toBeLessThan(0);
	});

	it('descend quand le doigt approche du bas', () => {
		expect(edgeScrollStep(screen - EDGE + 30, screen)).toBeGreaterThan(0);
	});

	it('accelere a mesure qu on s enfonce dans le bord', () => {
		const gentle = edgeScrollStep(screen - EDGE + 10, screen);
		const sharp = edgeScrollStep(screen - EDGE + 60, screen);
		expect(sharp).toBeGreaterThan(gentle);
	});

	it('ne depasse jamais la vitesse maximale', () => {
		expect(edgeScrollStep(-9999, screen)).toBe(-SPEED);
		expect(edgeScrollStep(9999, screen)).toBe(SPEED);
	});
});
