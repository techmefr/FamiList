import { tick } from 'svelte';
import { dropIndex, edgeScrollStep, slotShifts, move } from '$domain/reorder';

export { move };

/** Below this, it is a trembling press, not an intention to move. */
const THRESHOLD = 4;

/**
 * Reordering by the handle, with a finger as with a mouse.
 *
 * A single mechanism for both: the HTML5 drag-and-drop used before does not respond to touch, and half the
 * people are on a phone. Pointer events cover everything, provided the handle carries `touch-action: none`
 * — without which the browser takes the gesture away as a scroll before we can say anything.
 *
 * Svelte stays the sole owner of DOM order. During the gesture we move nothing: we shift the rows
 * visually, and only reorder the array on release. A library rearranging the container's children itself
 * would stop a move coming from elsewhere — the up/down buttons, another device syncing — from showing.
 *
 * The up/down buttons stay. They are not a fallback: they are the path for the keyboard and for screen
 * readers, for which no pointer gesture exists.
 */
export function createReorder(onCommit: (from: number, to: number) => void) {
	let rows: HTMLElement[] = [];
	let tops: number[] = [];
	let heights: number[] = [];
	let gap = 0;
	let origin = -1;
	let originTop = 0;
	let engaged = false;
	let lastY = 0;
	let image = 0;

	let grabbed = $state<number | null>(null);
	let target = $state<number | null>(null);

	function measure(handle: HTMLElement) {
		const zone = handle.closest('[data-reorder-zone]');
		if (!zone) return false;

		rows = [...zone.querySelectorAll<HTMLElement>(':scope > [data-reorder-row]')];
		if (rows.length < 2) return false;

		// Page coordinates, not window ones: the page scrolls during the gesture, and window-relative positions
		// would become wrong at the first pixel of scrolling.
		const scrollTop = window.scrollY;
		const rects = rows.map((row) => row.getBoundingClientRect());
		tops = rects.map((r) => r.top + scrollTop);
		heights = rects.map((r) => r.height);
		gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
		return true;
	}

	function paint(dy: number) {
		const center = tops[origin] + heights[origin] / 2 + dy;
		const to = dropIndex(center, tops, heights, origin);
		target = to;

		const shifts = slotShifts(tops, heights, gap, origin, to);
		rows.forEach((row, i) => {
			row.style.translate = `0 ${i === origin ? dy : shifts[i]}px`;
		});
	}

	/** The page follows the finger when it reaches an edge — the step is computed in $domain/reorder. */
	function autoScroll() {
		if (!engaged) return;

		const pas = edgeScrollStep(lastY, window.innerHeight);
		if (pas !== 0) {
			window.scrollBy(0, pas);
			paint(lastY + window.scrollY - originTop);
		}

		image = requestAnimationFrame(autoScroll);
	}

	function cleanup() {
		cancelAnimationFrame(image);
		image = 0;

		for (const row of rows) {
			row.style.translate = '';
			row.style.transition = '';
			row.style.zIndex = '';
		}
		rows = [];
	}

	async function finish(submit: boolean) {
		const de = origin;
		const to = target;

		cleanup();
		origin = -1;
		engaged = false;
		grabbed = null;
		target = null;

		if (submit && to !== null && to !== de) onCommit(de, to);

		// The next turn: the caller can bring the animations back once the new order is in place.
		await tick();
	}

	return {
		get index() {
			return grabbed;
		},
		/**
		 * True for the duration of a gesture.
		 *
		 * The caller uses it to switch off the flip animation while we commit: the rows are already in place on
		 * screen, we put them there. Animating on top would make them jump back before setting off again.
		 */
		get busy() {
			return grabbed !== null;
		},

		handle(index: number) {
			return {
				'data-no-swipe': '',
				onpointerdown: (event: PointerEvent) => {
					if (event.button !== 0 && event.pointerType === 'mouse') return;

					const handle = event.currentTarget as HTMLElement;
					if (!measure(handle)) return;

					event.preventDefault();
					event.stopPropagation();

					origin = index;
					originTop = event.clientY + window.scrollY;
					lastY = event.clientY;
					engaged = false;
					// Safari has already refused capture on a pointer it no longer recognises: the gesture works without
					// it, it only becomes sensitive to leaving the element.
					try {
						handle.setPointerCapture(event.pointerId);
					} catch {
						/* nothing to do */
					}
				},

				onpointermove: (event: PointerEvent) => {
					if (origin === -1) return;

					lastY = event.clientY;
					const dy = event.clientY + window.scrollY - originTop;
					if (!engaged) {
						if (Math.abs(dy) < THRESHOLD) return;
						engaged = true;
						grabbed = origin;
						target = origin;
						rows[origin].style.zIndex = '2';
						rows[origin].style.transition = 'none';
						image = requestAnimationFrame(autoScroll);
					}

					paint(dy);
				},

				onpointerup: () => {
					if (origin === -1) return;
					void finish(engaged);
				},

				onpointercancel: () => {
					if (origin === -1) return;
					void finish(false);
				},

				onkeydown: (event: KeyboardEvent) => {
					if (event.key === 'Escape' && origin !== -1) void finish(false);
				}
			};
		}
	};
}
