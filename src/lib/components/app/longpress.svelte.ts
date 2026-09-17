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
	let depart: { x: number; y: number } | null = null;
	let parti = false;

	function annuler() {
		if (timer) clearTimeout(timer);
		timer = null;
		depart = null;
	}

	function down(event: PointerEvent) {
		// The right button already opens the system menu: laying our gesture over it would make two answers to
		// a single press.
		if (event.button !== 0) return;

		parti = false;
		depart = { x: event.clientX, y: event.clientY };
		timer = setTimeout(() => {
			parti = true;
			annuler();
			action();
		}, LONGPRESS_MS);
	}

	function move(event: PointerEvent) {
		if (depart && movedTooFar(depart, { x: event.clientX, y: event.clientY })) annuler();
	}

	function click(event: MouseEvent) {
		if (!parti) return;

		parti = false;
		event.preventDefault();
		event.stopPropagation();
	}

	function menu(event: Event) {
		if (timer || parti) event.preventDefault();
	}

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', annuler);
	node.addEventListener('pointercancel', annuler);
	node.addEventListener('pointerleave', annuler);
	node.addEventListener('click', click, true);
	node.addEventListener('contextmenu', menu);

	return {
		destroy() {
			annuler();
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', annuler);
			node.removeEventListener('pointercancel', annuler);
			node.removeEventListener('pointerleave', annuler);
			node.removeEventListener('click', click, true);
			node.removeEventListener('contextmenu', menu);
		}
	};
}
