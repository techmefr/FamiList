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
	centre: number,
	tops: number[],
	hauteurs: number[],
	depart: number
): number {
	let cible = depart;

	for (let i = 0; i < tops.length; i++) {
		const milieu = tops[i] + hauteurs[i] / 2;
		if (i < depart && centre < milieu) cible = Math.min(cible, i);
		else if (i > depart && centre > milieu) cible = Math.max(cible, i);
	}

	return cible;
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
	hauteurs: number[],
	ecart: number,
	depart: number,
	cible: number
): number[] {
	const ordre = move(
		tops.map((_, i) => i),
		depart,
		cible
	);

	const decalages = new Array<number>(tops.length).fill(0);
	let y = tops[0] ?? 0;

	for (const index of ordre) {
		decalages[index] = y - tops[index];
		y += hauteurs[index] + ecart;
	}

	return decalages;
}

/** How close to the screen edge the page starts scrolling by itself. */
export const BORD = 88;

/** The maximum step of an automatic scroll, per frame. */
export const VITESSE = 14;

/**
 * By how much the page must scroll when the finger holds a row near an edge.
 *
 * Without this scrolling, a row cannot be taller than the screen: you hold the card, you reach the bottom,
 * and there is nowhere to go. The step grows with how far into the edge zone you are, so a brush does not
 * run away; it is negative upwards.
 */
export function edgeScrollStep(
	y: number,
	hauteur: number,
	bord = BORD,
	vitesse = VITESSE
): number {
	const dessus = y - bord;
	if (dessus < 0) return Math.max(-vitesse, dessus / 6);

	const dessous = hauteur - bord - y;
	if (dessous < 0) return Math.min(vitesse, -dessous / 6);

	return 0;
}
