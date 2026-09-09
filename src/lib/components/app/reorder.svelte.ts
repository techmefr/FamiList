import { tick } from 'svelte';
import { dropIndex, edgeScrollStep, slotShifts, move } from '$domain/reorder';

export { move };

/** En deçà, c'est un appui qui tremble, pas une intention de déplacer. */
const SEUIL = 4;

/**
 * Réordonner à la poignée, au doigt comme à la souris.
 *
 * Un seul mécanisme pour les deux : le glisser-déposer HTML5 qu'on utilisait avant ne répond pas
 * au tactile, et la moitié des gens sont sur téléphone. Les événements de pointeur couvrent tout,
 * à condition que la poignée porte `touch-action: none` — sans quoi le navigateur emmène le geste
 * en défilement avant qu'on ait pu dire quoi que ce soit.
 *
 * Svelte reste seul maître de l'ordre du DOM. Pendant le geste on ne déplace rien : on décale les
 * lignes visuellement, et on ne réordonne le tableau qu'au relâchement. Une bibliothèque qui
 * réarrange elle-même les enfants du conteneur empêcherait un déplacement venu d'ailleurs — les
 * boutons monter/descendre, un autre appareil qui synchronise — de s'afficher.
 *
 * Les boutons monter/descendre restent. Ils ne sont pas un repli : ils sont le chemin du clavier
 * et des lecteurs d'écran, pour lesquels aucun geste de pointeur n'existe.
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

		// Des coordonnées de page, pas de fenêtre : la page défile pendant le geste, et des
		// positions relatives à la fenêtre deviendraient fausses au premier pixel de défilement.
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

	/** La page suit le doigt quand il arrive au bord — le pas est calculé dans $domain/reorder. */
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

		// Le tour suivant : l'appelant peut ranimer les bascules une fois le nouvel ordre posé.
		await tick();
	}

	return {
		get index() {
			return saisie;
		},
		/**
		 * Vrai le temps d'un geste.
		 *
		 * L'appelant s'en sert pour couper l'animation de bascule pendant qu'on valide : les lignes
		 * sont déjà à leur place à l'écran, c'est nous qui les y avons mises. Animer par-dessus les
		 * ferait revenir en arrière d'un bond avant de repartir.
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
					// Safari a deja refuse la capture sur un pointeur qu'il ne reconnait plus : le geste
					// marche sans, il devient seulement sensible a une sortie de l'element.
					try {
						poignee.setPointerCapture(event.pointerId);
					} catch {
						/* rien a faire */
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
