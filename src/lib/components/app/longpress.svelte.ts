import { LONGPRESS_MS, movedTooFar } from '$domain/longpress';

/**
 * L'action qui pose l'appui long sur un élément.
 *
 * Elle écoute des `pointer*` et non des `touch*` : la souris et le stylet déclenchent le même
 * geste, ce qui rend la chose testable au clavier près et utilisable au bureau.
 *
 * Deux précautions valent d'être dites :
 *
 * — `contextmenu` est annulé pendant l'appui. Sur mobile, maintenir le doigt ouvre le menu du
 *   navigateur et fige la sélection de texte par-dessus notre feuille.
 * — Une fois le geste parti, le `click` qui suit est avalé. Sans cela, relâcher le doigt cocherait
 *   l'article dont on vient d'ouvrir la fiche.
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
		// Le bouton droit ouvre déjà le menu du système : lui superposer notre geste ferait deux
		// réponses à une seule pression.
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
