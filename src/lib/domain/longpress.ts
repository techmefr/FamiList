/**
 * The long press: holding a finger on a thing to open it, without adding a button to it.
 *
 * The gesture only makes sense if it is clearly distinct from its neighbours. Three of them go through the
 * same finger in the same place: the tap, the drag to reorder, and scrolling the list. Hence the two
 * thresholds below, and the rule joining them — the slightest clear movement cancels the press, because it
 * is then a swipe, not a press.
 */

/** How long to hold before the gesture counts. */
export const LONGPRESS_MS = 500;

/**
 * The movement tolerated during that time, in pixels. A resting finger does not hold perfectly still;
 * beyond that, the person is scrolling or moving the row.
 */
export const LONGPRESS_TOLERANCE = 10;

export function movedTooFar(
	from: { x: number; y: number },
	to: { x: number; y: number },
	tolerance = LONGPRESS_TOLERANCE
) {
	return Math.abs(to.x - from.x) > tolerance || Math.abs(to.y - from.y) > tolerance;
}
