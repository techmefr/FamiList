/**
 * Glisser-déposer natif, sans dépendance. Svelte reste la seule source de vérité de l'ordre du DOM :
 * une bibliothèque qui reprend la main sur les enfants du conteneur empêche un réordonnancement
 * déclenché ailleurs (boutons monter/descendre) de s'afficher.
 *
 * Le glisser-déposer HTML5 ne fonctionne pas au doigt. Sur mobile et au clavier, ce sont les boutons
 * monter/descendre qui font le travail — ils ne sont pas un repli, ils sont le mode principal.
 */
export function createDrag(onReorder: (from: number, to: number) => void) {
	let dragging = $state<number | null>(null);
	let over = $state<number | null>(null);

	return {
		get overIndex() {
			return over;
		},
		handlers(index: number) {
			return {
				draggable: true,
				ondragstart: (event: DragEvent) => {
					dragging = index;
					event.dataTransfer?.setData('text/plain', String(index));
					if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
				},
				ondragover: (event: DragEvent) => {
					event.preventDefault();
					over = index;
				},
				ondragleave: () => {
					if (over === index) over = null;
				},
				ondrop: (event: DragEvent) => {
					event.preventDefault();
					const raw = dragging ?? Number(event.dataTransfer?.getData('text/plain'));
					dragging = null;
					over = null;
					if (raw === null || Number.isNaN(raw) || raw === index) return;
					onReorder(raw, index);
				},
				ondragend: () => {
					dragging = null;
					over = null;
				}
			};
		}
	};
}

export function move<T>(items: T[], from: number, to: number): T[] {
	const next = [...items];
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return next;
}
