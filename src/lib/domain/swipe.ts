/**
 * A row's sideways swipe: from which side, from when, and by how much it follows the finger.
 *
 * Everything is here rather than in the component because this is where the decisions hide — when a
 * gesture stops being a scroll, when it counts as triggered — and they are checked far better with
 * numbers than with a finger on a screen.
 */

/** Below this, we do not yet know whether the intent is to scroll the page or to swipe. */
export const SWIPE_SLOP = 12;

/** The distance that triggers the ordinary action — ticking. */
export const SWIPE_THRESHOLD = 72;

/**
 * The one that triggers deletion. Further, on purpose: the bin button asks you to aim at a 44px target, a
 * swipe starts on its own from a thumb resting crooked. Deleting an item by accident costs more than
 * having to swipe one more centimetre.
 */
export const SWIPE_DESTRUCTIVE = 110;

/** The maximum travel: beyond it the row stops moving, it has said all it had to say. */
export const SWIPE_MAX = 140;

/**
 * The side the action comes from, in logical properties: `start` is revealed by swiping towards the end
 * of the row, `end` by swiping towards its start. In Arabic, the row reads the other way and the two
 * gestures swap by themselves.
 */
export type SwipeSide = 'start' | 'end';

export interface SwipeLimits {
	rtl?: boolean;
	startAt?: number;
	endAt?: number;
}

/**
 * A horizontal gesture, or a vertical scroll?
 *
 * We only take over if the movement is clearly horizontal: on a phone, the same surface is used to scroll
 * the list, and a scroll turning into a deletion is the worst thing that could happen here.
 */
export function isHorizontalGesture(dx: number, dy: number, slop = SWIPE_SLOP): boolean {
	return Math.abs(dx) > slop && Math.abs(dx) > Math.abs(dy);
}

/**
 * By how much the row shifts.
 *
 * It follows the finger while nothing is triggered, then resists: the travel is compressed beyond the
 * threshold and stops dead at the maximum. That slowdown is what makes you feel you have gone far enough,
 * without having to read anything.
 */
export function swipeOffset(dx: number, threshold = SWIPE_THRESHOLD, max = SWIPE_MAX): number {
	const distance = Math.abs(dx);
	if (distance <= threshold) return dx;

	const sign = Math.sign(dx);
	const rest = distance - threshold;

	return sign * Math.min(max, threshold + rest * 0.35);
}

/**
 * The side triggered on release, or nothing if you did not go far enough — in which case the row goes
 * back into place and nothing happened.
 */
export function swipeSide(offset: number, limits: SwipeLimits = {}): SwipeSide | null {
	const { rtl = false, startAt = SWIPE_THRESHOLD, endAt = SWIPE_THRESHOLD } = limits;
	const logical = rtl ? -offset : offset;

	if (logical >= startAt) return 'start';
	if (logical <= -endAt) return 'end';
	return null;
}
