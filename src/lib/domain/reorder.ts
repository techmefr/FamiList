/**
 * The geometry of reordering with a finger.
 *
 * HTML5 drag-and-drop ignores touch: on a phone, nothing happened. What follows replaces that mechanism
 * with pointer events, which cover finger, stylus and mouse in one go. The computation is here, with no
 * DOM, so it can be verified: it is what decides where the grabbed row lands, and by how much the others
 * move apart to make room.
 */

/** Moves an element from one position to another, without touching the original array. */
export function move<T>(items: T[], from: number, to: number): T[] {
	const next = [...items];
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
}

/**
 * Where the grabbed row lands, from the centre it now occupies.
 *
 * We compare against the middle of each row rather than its edge: crossing half of a neighbour means
 * having taken its place. Comparing against edges would reorder from the first millimetre, and hesitate
 * between two positions at the slightest tremble of the hand.
 */
export function dropIndex(
	center: number,
	tops: number[],
	heights: number[],
	origin: number
): number {
	let target = origin;

	for (let i = 0; i < tops.length; i++) {
		const middle = tops[i] + heights[i] / 2;
		if (i < origin && center < middle) target = Math.min(target, i);
		else if (i > origin && center > middle) target = Math.max(target, i);
	}

	return target;
}

/**
 * By how much each row must shift so the intended order already reads on screen.
 *
 * The heights are not equal — an item with a note is taller than another — so we cannot shift by a constant
 * "step": we recompose everybody's positions in the intended order, and derive each one's movement from
 * that. The shift returned for the grabbed row is that of its landing slot; the caller prefers the
 * finger's real position.
 */
export function slotShifts(
	tops: number[],
	heights: number[],
	gap: number,
	origin: number,
	target: number
): number[] {
	const order = move(
		tops.map((_, i) => i),
		origin,
		target
	);

	const shifts = new Array<number>(tops.length).fill(0);
	let y = tops[0] ?? 0;

	for (const index of order) {
		shifts[index] = y - tops[index];
		y += heights[index] + gap;
	}

	return shifts;
}

/** How close to the screen edge the page starts scrolling by itself. */
export const EDGE = 88;

/** The maximum step of an automatic scroll, per frame. */
export const SPEED = 14;

/**
 * By how much the page must scroll when the finger holds a row near an edge.
 *
 * Without this scrolling, a row cannot be taller than the screen: you hold the card, you reach the bottom,
 * and there is nowhere to go. The step grows with how far into the edge zone you are, so a brush does not
 * run away; it is negative upwards.
 */
export function edgeScrollStep(
	y: number,
	height: number,
	edge = EDGE,
	speed = SPEED
): number {
	const above = y - edge;
	if (above < 0) return Math.max(-speed, above / 6);

	const below = height - edge - y;
	if (below < 0) return Math.min(speed, -below / 6);

	return 0;
}
