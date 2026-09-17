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
	 * A click is born of any pointer release. After a swipe, it would land on whatever is under the finger —
	 * the label that ticks the item — and we would have done two things for one gesture. This flag swallows
	 * it, for the time the click goes by.
	 */
	let avale = false;

	const IconeDebut = $derived(start.icon);
	const IconeFin = $derived(end.icon);

	const rtl = $derived(i18n.dir === 'rtl');
	const limites = $derived({ rtl, startAt: SWIPE_THRESHOLD, endAt: SWIPE_DESTRUCTIVE });

	/** The side that would leave if you released now. Used to light the right half of the background. */
	const arme = $derived<SwipeSide | null>(engage ? swipeSide(course, limites) : null);

	function debut(event: PointerEvent) {
		// The mouse already has drag-and-drop and the row's four buttons; taking the left button from it would
		// break the first without adding anything. Swiping is a finger gesture, we do not impose it on the
		// mouse.
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
			// The finger is going down: this is a scroll, we let go for good rather than watch for a horizontal
			// turn in the middle of the gesture.
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
	A row that swipes: tick on one side, delete on the other.

	The background does not move, it is the row that slides over it and uncovers it. Both actions are drawn
	permanently, each on its side, and light up when the gesture has gone far enough to trigger them — you see
	what is about to happen before releasing, and can come back as long as you have not let go.

	None of this is the only path: the same actions have their button in the row, and the background is hidden
	from screen readers so as not to announce the same thing twice.

	`touch-action: pan-y` leaves vertical scrolling to the browser and keeps only the horizontal: without it,
	the page would lock up as soon as a finger landed on a row.
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
		No ARIA role on this wrapper, and the warning is silenced knowingly. The rule exists to catch divs made
		interactive with no keyboard equivalent; here both actions each have their real button inside the row,
		announced and reachable. Giving the wrapper a role would make the whole row be announced as a control,
		which would be wrong and would get in the way of reading.
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
