/**
 * Below this, what shrank the visual viewport is the browser's own toolbar folding or unfolding, not a
 * keyboard: no on-screen keyboard is this short, and following the toolbar would make the bar jitter
 * while scrolling.
 */
export const MIN_KEYBOARD_PX = 120;

/**
 * How much of the bottom of the page a software keyboard covers, from `window.innerHeight` and the
 * `visualViewport`. Zero while the page is pinch-zoomed: the viewport is then smaller because of the zoom,
 * and lifting the bar would send it to the middle of the enlarged page.
 */
export function keyboardInset(layoutHeight: number, viewport: { height: number; offsetTop: number; scale: number }): number {
	if (viewport.scale > 1.01) return 0;

	const covered = layoutHeight - viewport.height - viewport.offsetTop;
	return covered >= MIN_KEYBOARD_PX ? Math.round(covered) : 0;
}
