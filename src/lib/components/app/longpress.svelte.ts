import { LONGPRESS_MS, movedTooFar } from '$domain/longpress';

/**
 * The action that puts a long press on an element.
 *
 * It listens to `pointer*` and not `touch*`: the mouse and the stylus trigger the same gesture, which makes
 * the thing testable and usable at a desk.
 *
 * Two precautions are worth saying:
 *
 * — `contextmenu` is cancelled during the press. On mobile, holding the finger opens the browser menu and
 *   freezes the text selection over our sheet.
 * — Once the gesture has started, the `click` that follows is swallowed. Without that, releasing the finger
 *   would tick the item whose sheet has just been opened.
 */
export function longpress(node: HTMLElement, action: () => void) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let origin: { x: number; y: number } | null = null;
	let moved = false;

	function cancel() {
		if (timer) clearTimeout(timer);
		timer = null;
		origin = null;
	}

	function down(event: PointerEvent) {
		// The right button already opens the system menu: laying our gesture over it would make two answers to
		// a single press.
		if (event.button !== 0) return;

		moved = false;
		origin = { x: event.clientX, y: event.clientY };
		timer = setTimeout(() => {
			moved = true;
			cancel();
			action();
		}, LONGPRESS_MS);
	}

	function move(event: PointerEvent) {
		if (origin && movedTooFar(origin, { x: event.clientX, y: event.clientY })) cancel();
	}

	function click(event: MouseEvent) {
		if (!moved) return;

		moved = false;
		event.preventDefault();
		event.stopPropagation();
	}

	function menu(event: Event) {
		if (timer || moved) event.preventDefault();
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', cancel);
	node.addEventListener('pointercancel', cancel);
	node.addEventListener('pointerleave', cancel);
	node.addEventListener('click', click, true);
	node.addEventListener('contextmenu', menu);

	return {
		destroy() {
			cancel();
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', cancel);
			node.removeEventListener('pointercancel', cancel);
			node.removeEventListener('pointerleave', cancel);
			node.removeEventListener('click', click, true);
			node.removeEventListener('contextmenu', menu);
		}
	};
}
