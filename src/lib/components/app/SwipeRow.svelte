<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { i18n } from '$lib/i18n/index.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import {
		isHorizontalGesture,
		swipeOffset,
		swipeSide,
		SWIPE_DESTRUCTIVE,
		SWIPE_THRESHOLD,
		type SwipeSide
	} from '$domain/swipe';

	export interface SwipeAction {
		label: string;
		icon: Component;
		tone: 'primary' | 'destructive';
		run: () => void;
	}

	let {
		start,
		end,
		children
	}: { start: SwipeAction; end: SwipeAction; children: Snippet } = $props();

	let contenu = $state<HTMLDivElement | null>(null);

	let course = $state(0);
	let engage = $state(false);
	let pointeur: number | null = null;
	let depart = { x: 0, y: 0 };

	/**
	 * Un clic naît de tout relâchement de pointeur. Après un glissement, il tomberait sur ce qui
	 * se trouve sous le doigt — l'étiquette qui coche l'article — et on aurait fait deux choses
	 * pour un seul geste. Ce drapeau l'avale, le temps que le clic passe.
	 */
	let avale = false;

	const IconeDebut = $derived(start.icon);
	const IconeFin = $derived(end.icon);

	const rtl = $derived(i18n.dir === 'rtl');
	const limites = $derived({ rtl, startAt: SWIPE_THRESHOLD, endAt: SWIPE_DESTRUCTIVE });

	/** Le côté qui partirait si on relâchait maintenant. Sert à allumer la bonne moitié du fond. */
	const arme = $derived<SwipeSide | null>(engage ? swipeSide(course, limites) : null);

	function debut(event: PointerEvent) {
		// La souris a déjà le glisser-déposer et les quatre boutons de la ligne ; lui prendre le
		// bouton gauche casserait le premier sans rien apporter. Le glissement est un geste de
		// doigt, on ne le lui impose pas.
		if (event.pointerType === 'mouse') return;
		if ((event.target as HTMLElement).closest('button, a, select, textarea, [data-no-swipe]')) {
			return;
		}

		pointeur = event.pointerId;
		depart = { x: event.clientX, y: event.clientY };
		engage = false;
	}

	function pendant(event: PointerEvent) {
		if (pointeur !== event.pointerId) return;

		const dx = event.clientX - depart.x;
		const dy = event.clientY - depart.y;

		if (!engage) {
			// Le doigt descend : c'est un défilement, on lâche prise pour de bon plutôt que de
			// guetter un virage horizontal au milieu du geste.
			if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
				pointeur = null;
				return;
			}

			if (!isHorizontalGesture(dx, dy)) return;

			engage = true;
			contenu?.setPointerCapture(event.pointerId);
		}

		course = swipeOffset(dx);
	}

	function fin(event: PointerEvent) {
		if (pointeur !== event.pointerId) return;

		const cote = engage ? swipeSide(course, limites) : null;

		pointeur = null;
		course = 0;

		if (engage) {
			avale = true;
			setTimeout(() => (avale = false), 0);
		}
		engage = false;

		if (cote === 'start') start.run();
		else if (cote === 'end') end.run();
	}

	function clic(event: MouseEvent) {
		if (!avale) return;
		event.preventDefault();
		event.stopPropagation();
	}
</script>

<!--
	Une ligne qui se glisse : cocher d'un côté, supprimer de l'autre.

	Le fond ne bouge pas, c'est la ligne qui coulisse par-dessus et le découvre. Les deux actions
	sont dessinées en permanence, chacune de son côté, et s'allument quand le geste est allé assez
	loin pour les déclencher — on voit ce qui va se passer avant de relâcher, et on peut revenir en
	arrière tant qu'on n'a pas lâché.

	Rien de tout cela n'est le seul chemin : les mêmes actions ont leur bouton dans la ligne, et le
	fond est masqué aux lecteurs d'écran pour ne pas annoncer deux fois la même chose.

	`touch-action: pan-y` laisse le défilement vertical au navigateur et ne garde que l'horizontale :
	sans lui, la page se bloquerait dès qu'un doigt se pose sur une ligne.
-->
<div class="fl-swipe">
	<div class="fl-swipe-track" aria-hidden="true">
		<span class="fl-swipe-action fl-swipe-start" data-tone={start.tone} data-armed={arme === 'start'}>
			<IconeDebut size={20} aria-hidden="true" />
			<span class="text-caption">{start.label}</span>
		</span>
		<span class="fl-swipe-action fl-swipe-end" data-tone={end.tone} data-armed={arme === 'end'}>
			<span class="text-caption">{end.label}</span>
			<IconeFin size={20} aria-hidden="true" />
		</span>
	</div>

	<!--
		Pas de rôle ARIA sur cette enveloppe, et l'avertissement est levé sciemment. La règle
		existe pour rattraper les div rendues interactives sans équivalent au clavier ; ici les
		deux actions ont chacune leur vrai bouton à l'intérieur de la ligne, annoncé et
		atteignable. Donner un rôle à l'enveloppe ferait annoncer la ligne entière comme une
		commande, ce qui serait faux et gênerait la lecture.
	-->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={contenu}
		class="fl-swipe-content"
		style="translate: {course}px 0; transition-duration: {engage ? 0 : motionMs(220)}ms"
		onpointerdown={debut}
		onpointermove={pendant}
		onpointerup={fin}
		onpointercancel={fin}
		onclickcapture={clic}
	>
		{@render children()}
	</div>
</div>
