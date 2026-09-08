import { describe, expect, it } from 'vitest';
import {
	isHorizontalGesture,
	swipeOffset,
	swipeSide,
	SWIPE_DESTRUCTIVE,
	SWIPE_MAX,
	SWIPE_THRESHOLD
} from './swipe';

describe('isHorizontalGesture', () => {
	it('ignore un mouvement trop court pour vouloir dire quelque chose', () => {
		expect(isHorizontalGesture(0, 0)).toBe(false);
		expect(isHorizontalGesture(8, 0)).toBe(false);
	});

	// Le cas qui compte : la même surface sert à faire défiler la liste.
	it('laisse passer un défilement vertical', () => {
		expect(isHorizontalGesture(10, 60)).toBe(false);
		expect(isHorizontalGesture(30, 40)).toBe(false);
	});

	it('prend la main sur un geste franchement horizontal', () => {
		expect(isHorizontalGesture(40, 10)).toBe(true);
		expect(isHorizontalGesture(-40, 10)).toBe(true);
	});

	it('tranche en faveur du défilement quand c’est à égalité', () => {
		expect(isHorizontalGesture(30, 30)).toBe(false);
	});
});

describe('swipeOffset', () => {
	it('suit le doigt tant qu’on n’a rien déclenché', () => {
		expect(swipeOffset(0)).toBe(0);
		expect(swipeOffset(40)).toBe(40);
		expect(swipeOffset(-40)).toBe(-40);
		expect(swipeOffset(SWIPE_THRESHOLD)).toBe(SWIPE_THRESHOLD);
	});

	it('résiste au-delà du seuil', () => {
		const course = swipeOffset(SWIPE_THRESHOLD + 100);
		expect(course).toBeGreaterThan(SWIPE_THRESHOLD);
		expect(course).toBeLessThan(SWIPE_THRESHOLD + 100);
	});

	it('s’arrête au maximum, dans les deux sens', () => {
		expect(swipeOffset(10_000)).toBe(SWIPE_MAX);
		expect(swipeOffset(-10_000)).toBe(-SWIPE_MAX);
	});

	// La suppression doit rester atteignable, sinon le geste ne sert à rien.
	it('laisse atteindre le seuil de suppression', () => {
		expect(Math.abs(swipeOffset(-400))).toBeGreaterThanOrEqual(SWIPE_DESTRUCTIVE);
	});
});

describe('swipeSide', () => {
	it('ne déclenche rien en deçà du seuil', () => {
		expect(swipeSide(0)).toBeNull();
		expect(swipeSide(SWIPE_THRESHOLD - 1)).toBeNull();
		expect(swipeSide(-(SWIPE_THRESHOLD - 1))).toBeNull();
	});

	it('déclenche le côté début en glissant vers la fin', () => {
		expect(swipeSide(SWIPE_THRESHOLD)).toBe('start');
	});

	it('déclenche le côté fin en glissant vers le début', () => {
		expect(swipeSide(-SWIPE_THRESHOLD)).toBe('end');
	});

	// Supprimer se mérite : le même geste, plus loin.
	it('respecte un seuil propre à chaque côté', () => {
		const limites = { startAt: SWIPE_THRESHOLD, endAt: SWIPE_DESTRUCTIVE };

		expect(swipeSide(SWIPE_THRESHOLD, limites)).toBe('start');
		expect(swipeSide(-SWIPE_THRESHOLD, limites)).toBeNull();
		expect(swipeSide(-SWIPE_DESTRUCTIVE, limites)).toBe('end');
	});

	it('inverse les deux sens quand la ligne se lit de droite à gauche', () => {
		expect(swipeSide(SWIPE_THRESHOLD, { rtl: true })).toBe('end');
		expect(swipeSide(-SWIPE_THRESHOLD, { rtl: true })).toBe('start');
	});
});
