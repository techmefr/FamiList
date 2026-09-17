import { tick } from 'svelte';
import { dropIndex, edgeScrollStep, slotShifts, move } from '$domain/reorder';

export { move };

/** Below this, it is a trembling press, not an intention to move. */
const SEUIL = 4;

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
	let lignes: HTMLElement[] = [];
	let tops: number[] = [];
	let hauteurs: number[] = [];
	let ecart = 0;
	let depart = -1;
	let origine = 0;
	let engage = false;
	let dernierY = 0;
	let image = 0;

	let saisie = $state<number | null>(null);
	let cible = $state<number | null>(null);

	function mesurer(poignee: HTMLElement) {
		const zone = poignee.closest('[data-reorder-zone]');
		if (!zone) return false;

		lignes = [...zone.querySelectorAll<HTMLElement>(':scope > [data-reorder-row]')];
		if (lignes.length < 2) return false;

		// Page coordinates, not window ones: the page scrolls during the gesture, and window-relative positions
		// would become wrong at the first pixel of scrolling.
		const haut = window.scrollY;
		const rects = lignes.map((ligne) => ligne.getBoundingClientRect());
		tops = rects.map((r) => r.top + haut);
		hauteurs = rects.map((r) => r.height);
		ecart = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
		return true;
	}

	function peindre(dy: number) {
		const centre = tops[depart] + hauteurs[depart] / 2 + dy;
		const vers = dropIndex(centre, tops, hauteurs, depart);
		cible = vers;

		const decalages = slotShifts(tops, hauteurs, ecart, depart, vers);
		lignes.forEach((ligne, i) => {
			ligne.style.translate = `0 ${i === depart ? dy : decalages[i]}px`;
		});
	}

	/** The page follows the finger when it reaches an edge — the step is computed in $domain/reorder. */
	function defiler() {
		if (!engage) return;

		const pas = edgeScrollStep(dernierY, window.innerHeight);
		if (pas !== 0) {
			window.scrollBy(0, pas);
			peindre(dernierY + window.scrollY - origine);
		}

		image = requestAnimationFrame(defiler);
	}

	function nettoyer() {
		cancelAnimationFrame(image);
		image = 0;

		for (const ligne of lignes) {
			ligne.style.translate = '';
			ligne.style.transition = '';
			ligne.style.zIndex = '';
		}
		lignes = [];
	}

	async function terminer(valider: boolean) {
		const de = depart;
		const vers = cible;

		nettoyer();
		depart = -1;
		engage = false;
		saisie = null;
		cible = null;

		if (valider && vers !== null && vers !== de) onCommit(de, vers);

		// The next turn: the caller can bring the animations back once the new order is in place.
		await tick();
	}

	return {
		get index() {
			return saisie;
		},
		/**
		 * True for the duration of a gesture.
		 *
		 * The caller uses it to switch off the flip animation while we commit: the rows are already in place on
		 * screen, we put them there. Animating on top would make them jump back before setting off again.
		 */
		get busy() {
			return saisie !== null;
		},

		handle(index: number) {
			return {
				'data-no-swipe': '',
				onpointerdown: (event: PointerEvent) => {
					if (event.button !== 0 && event.pointerType === 'mouse') return;

					const poignee = event.currentTarget as HTMLElement;
					if (!mesurer(poignee)) return;

					event.preventDefault();
					event.stopPropagation();

					depart = index;
					origine = event.clientY + window.scrollY;
					dernierY = event.clientY;
					engage = false;
					// Safari has already refused capture on a pointer it no longer recognises: the gesture works without
					// it, it only becomes sensitive to leaving the element.
					try {
						poignee.setPointerCapture(event.pointerId);
					} catch {
						/* nothing to do */
					}
				},

				onpointermove: (event: PointerEvent) => {
					if (depart === -1) return;

					dernierY = event.clientY;
					const dy = event.clientY + window.scrollY - origine;
					if (!engage) {
						if (Math.abs(dy) < SEUIL) return;
						engage = true;
						saisie = depart;
						cible = depart;
						lignes[depart].style.zIndex = '2';
						lignes[depart].style.transition = 'none';
						image = requestAnimationFrame(defiler);
					}

					peindre(dy);
				},

				onpointerup: () => {
					if (depart === -1) return;
					void terminer(engage);
				},

				onpointercancel: () => {
					if (depart === -1) return;
					void terminer(false);
				},

				onkeydown: (event: KeyboardEvent) => {
					if (event.key === 'Escape' && depart !== -1) void terminer(false);
				}
			};
		}
	};
}
