/**
 * Motion setting, and the direction of page transitions.
 *
 * Three values as for the theme: "system" follows `prefers-reduced-motion`, the other two decide. System is
 * the default — somebody who has already asked their phone for fewer animations does not have to ask again
 * here.
 */
export type MotionPreference = 'system' | 'full' | 'none';

export const MOTION_PREFERENCES: MotionPreference[] = ['system', 'full', 'none'];

export const isMotionPreference = (value: unknown): value is MotionPreference =>
	MOTION_PREFERENCES.includes(value as MotionPreference);

export function animates(preference: MotionPreference, prefersReducedMotion: boolean): boolean {
	if (preference === 'none') return false;
	if (preference === 'full') return true;

	return !prefersReducedMotion;
}

export type NavDirection = 'forward' | 'back' | 'none';

const depth = (path: string) => path.split('/').filter(Boolean).length;

/**
 * Which side the next page comes in from.
 *
 * Between two tabs, the navigation bar's order decides: going right along the bar makes the page come in
 * from the right. Elsewhere it is the depth of the path — `/l/xyz` is one step further than `/`, so
 * forwards, and the way back leaves through the left. A round trip thus gives two opposite movements, which
 * is the only thing a user really reads in a page transition.
 */
export function navDirection(from: string, to: string, order: string[] = []): NavDirection {
	if (from === to) return 'none';

	const fromIndex = order.indexOf(from);
	const toIndex = order.indexOf(to);

	if (fromIndex !== -1 && toIndex !== -1) return toIndex > fromIndex ? 'forward' : 'back';

	return depth(to) < depth(from) ? 'back' : 'forward';
}
