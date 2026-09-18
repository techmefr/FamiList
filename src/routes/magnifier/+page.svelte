<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { t } from '$i18n/index.svelte';
	import { session } from '$stores/session.svelte';
	import {
		CENTER,
		digitalZoom,
		opticalZoom,
		panFocus,
		pinchDistance,
		pinchZoom,
		viewFilter,
		visibleSource,
		ZOOM_MAX,
		ZOOM_MIN,
		type Focus,
		type ZoomRange
	} from '$domain/magnifier';
	import { Zap, Contrast, Camera, Snowflake, Play } from '@lucide/svelte';

	type Status = 'loading' | 'live' | 'denied' | 'unsupported';

	let video = $state<HTMLVideoElement | null>(null);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let stream: MediaStream | null = null;
	let track: MediaStreamTrack | null = null;

	let status = $state<Status>('loading');
	let zoom = $state(1.5);
	let torch = $state(false);
	let contrast = $state(false);
	let frozen = $state(false);
	let range = $state<ZoomRange | null>(null);
	let hasTorch = $state(false);

	/**
	 * The usage hint only shows while nothing has been touched. It answers the one question you ask on
	 * arriving in front of a black image, and disappears on the first gesture: left in place, it would
	 * cover the very line you are trying to read.
	 */
	let touched = $state(false);

	/**
	 * The point of the frozen image being looked at. It only matters once the image is frozen: while the
	 * camera runs, you move by moving the phone, which is more direct than a finger.
	 */
	let focus = $state<Focus>(CENTER);

	/** The captured frame, at its original resolution: it is the reserve of detail we crop into. */
	let frame: HTMLCanvasElement | null = null;

	/** The hint about gestures fades on the first pinch or pan, like the other one. */
	let gestured = $state(false);

	const applied = $derived(opticalZoom(zoom, range));
	const scale = $derived(digitalZoom(zoom, applied));

	/**
	 * Without a hardware torch, we brighten the image received. It is not real lighting — it reveals
	 * nothing that is in shadow — but on a matt, slightly grey label it is often enough to lift the text
	 * off the background.
	 */
	const brighten = $derived(torch && !hasTorch);
	const filter = $derived(viewFilter({ contrast, brighten }));

	interface AdvancedConstraint {
		zoom?: number;
		torch?: boolean;
	}

	function applyAdvanced(constraint: AdvancedConstraint) {
		// A driver refusing the constraint simply leaves the image as it is: nothing to report, the software
		// fallback has already done the work.
		void track?.applyConstraints({ advanced: [constraint] } as MediaTrackConstraints).catch(() => {});
	}

	/**
	 * The layout shows the page before the redirect to the sign-in screen has happened. Without this
	 * guard, landing on the magnifier address while signed out opened the camera for the duration of the
	 * switch — a permission prompt out of nowhere.
	 */
	async function start() {
		if (!browser || !session.isApproved) return;

		if (!navigator.mediaDevices?.getUserMedia) {
			status = 'unsupported';
			return;
		}

		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
				audio: false
			});
		} catch {
			status = 'denied';
			return;
		}

		track = stream.getVideoTracks()[0] ?? null;

		const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
			zoom?: ZoomRange;
			torch?: boolean;
		};
		range = caps.zoom ?? null;
		hasTorch = caps.torch === true;

		status = 'live';
		// The video element is only rendered once the state has moved to "live": without this wait, we would
		// attach the stream to an element that does not exist yet.
		await tick();

		if (video) {
			video.srcObject = stream;
			await video.play().catch(() => {});
		}
	}

	function stop() {
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		track = null;
	}

	$effect(() => {
		if (status === 'live' && range) applyAdvanced({ zoom: applied });
	});

	function toggleTorch() {
		touched = true;
		torch = !torch;
		if (hasTorch) applyAdvanced({ torch });
	}

	/**
	 * Freezing the image means being able to lower your arm and read calmly — the gesture missed most
	 * when holding a jar in one hand and the phone in the other.
	 *
	 * We capture the whole frame, with no magnification. That is what makes it possible to keep zooming
	 * inside the frozen image: magnification is applied to the display, not burned into the capture. The
	 * opposite — capturing already zoomed — made the slider inert once the image was frozen, and forced
	 * you to unfreeze to look at a detail more closely.
	 */
	function toggleFreeze() {
		touched = true;

		if (frozen) {
			frozen = false;
			return;
		}

		if (status !== 'live' || !video) return;

		const width = video.videoWidth;
		const height = video.videoHeight;
		if (!width || !height) return;

		frame ??= document.createElement('canvas');
		frame.width = width;
		frame.height = height;

		const context = frame.getContext('2d');
		if (!context) return;

		context.drawImage(video, 0, 0, width, height);
		focus = CENTER;
		frozen = true;
	}

	/**
	 * The rendering of the frozen image, redrawn on every change of magnification or position.
	 *
	 * The old version enlarged an already drawn image in CSS: at 3x you were looking at stretched pixels,
	 * not at characters. Here we re-crop from the original frame, which is far finer than the screen, and
	 * the text stays sharp as long as the camera had the detail to give.
	 *
	 * The pixel ratio is capped at 2: beyond that we quadruple the surface to paint on every finger
	 * movement for a gain nobody sees, and panning starts to stutter.
	 */
	function renderFrozen() {
		if (!frozen || !frame || !canvas) return;

		const view = { width: canvas.clientWidth, height: canvas.clientHeight };
		if (!view.width || !view.height) return;

		const density = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(view.width * density);
		canvas.height = Math.round(view.height * density);

		const context = canvas.getContext('2d');
		if (!context) return;

		const source = { width: frame.width, height: frame.height };
		const rect = visibleSource(source, view, focus, scale);

		context.drawImage(
			frame,
			rect.x,
			rect.y,
			rect.width,
			rect.height,
			0,
			0,
			canvas.width,
			canvas.height
		);
	}

	$effect(renderFrozen);

	/**
	 * The gestures, doubling the slider and never replacing it: pinching needs two fingers and precision,
	 * which not everybody has. The slider stays the safe way to magnify.
	 */
	const pointers = new Map<number, { x: number; y: number }>();
	let pinch: { distance: number; zoom: number } | null = null;

	function spread(): number {
		const [a, b] = [...pointers.values()];

		return a && b ? pinchDistance(a, b) : 0;
	}

	function onPointerDown(event: PointerEvent) {
		if (status !== 'live') return;

		// Without capture, moving the finger over a button during the gesture leaves the layer and interrupts
		// the pan mid-way — the image stops for no visible reason.
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);

		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size === 2) pinch = { distance: spread(), zoom };
	}

	function onPointerMove(event: PointerEvent) {
		const previous = pointers.get(event.pointerId);
		if (!previous) return;

		const point = { x: event.clientX, y: event.clientY };
		pointers.set(event.pointerId, point);

		if (pointers.size >= 2) {
			if (!pinch) return;
			touched = true;
			gestured = true;
			zoom = pinchZoom(pinch.zoom, pinch.distance, spread());
			return;
		}

		// On the live image, a finger dragging must do nothing: you move by moving the phone, and a frozen
		// offset on a stream that keeps moving is disorienting.
		if (!frozen || !canvas) return;

		touched = true;
		gestured = true;
		focus = panFocus(
			focus,
			{ x: point.x - previous.x, y: point.y - previous.y },
			{ width: canvas.clientWidth, height: canvas.clientHeight },
			scale
		);
	}

	function onPointerEnd(event: PointerEvent) {
		pointers.delete(event.pointerId);
		if (pointers.size < 2) pinch = null;
	}

	// The session is not always known at mount: we wait for it to be, once.
	let started = false;
	$effect(() => {
		if (session.isApproved && !started) {
			started = true;
			void start();
		}
	});

	onDestroy(stop);
</script>

<svelte:head><title>{t('magnifier.title')} — {t('app.name')}</title></svelte:head>

<!-- The crop depends on the screen shape: turning the phone changes what has to be redrawn. -->
<svelte:window onresize={renderFrozen} />

<!--
	Full screen, but under the navigation bar: above it, the camera image would cover the tabs and there
	would be no way left to leave the magnifier.
-->
<div class="fixed inset-0 z-0 overflow-hidden bg-black" data-test-id="magnifier">
	<!--
		The surface receiving the gestures covers the image and nothing else: the controls come after it in
		the markup, therefore above it, and keep their taps.

		`touch-none` is essential — without it the browser takes the pinch for itself and zooms the whole
		page, controls included, which leaves nothing to work with.
	-->
	<!--
		The role and the name give the surface an identity for those who do not see it: otherwise it is a
		mute rectangle reacting to a finger without ever saying what can be done on it.
	-->
	<div
		role="group"
		aria-label={t('magnifier.gestures')}
		class="absolute inset-0 touch-none"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerEnd}
		onpointercancel={onPointerEnd}
	>
		{#if status === 'live'}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={video}
				playsinline
				muted
				data-test-id="magnifier-video"
				class="absolute inset-0 size-full object-cover transition-transform duration-200"
				class:hidden={frozen}
				style="transform: scale({scale}); filter: {filter}"
			></video>
		{/if}

		<!--
			No more `transform: scale()` here: the magnification is now in the drawing itself, re-cropped from
			the original frame. Stretching it a second time in CSS would blur it, which was exactly the defect.
		-->
		<canvas
			bind:this={canvas}
			data-test-id="magnifier-frozen"
			class="absolute inset-0 size-full"
			class:hidden={!frozen}
			style="filter: {filter}"
		></canvas>
	</div>

	{#if status !== 'live'}
		<div class="absolute inset-0 overflow-y-auto px-6 py-6 text-center">
			<div class="flex min-h-full items-center justify-center">
				{#if status === 'loading'}
					<p class="text-product text-white/70">{t('magnifier.starting')}</p>
				{:else}
					<div
						class="max-w-sm min-w-0 rounded-lg border border-white/15 bg-white/5 p-6"
						data-test-id="magnifier-unavailable"
					>
						<Camera size={32} class="mx-auto text-[var(--primary)]" aria-hidden="true" />
						<p class="text-product mt-4 text-white">
							{status === 'denied' ? t('magnifier.denied') : t('magnifier.unsupported')}
						</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!--
		The top banner says one thing at a time. The frozen image first — it is a state, and not signalling
		it suggests the camera has crashed. Otherwise, while nothing has been touched, the sentence saying
		what to do: come closer, then freeze. It fades on the first gesture.

		The dotted frame marking out a "reading zone" is gone. It framed nothing — the image fills the whole
		screen — and suggested the rest did not count, when moving the phone around is precisely how you
		find the line to read.
	-->
	{#if frozen}
		<div class="pointer-events-none absolute inset-x-3 top-3 flex flex-col items-center gap-2">
			<p
				class="text-caption flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 font-semibold text-white backdrop-blur-md"
				data-test-id="magnifier-frozen-badge"
			>
				<Snowflake size={15} aria-hidden="true" />
				{t('magnifier.frozen')}
			</p>

			<!--
				Once the image is frozen, the gesture is guessed by nobody: the sentence says it once, then fades
				as soon as it has served, so as not to cover the line to read.
			-->
			{#if !gestured}
				<p
					class="text-label max-w-sm rounded-2xl bg-black/60 px-4 py-3 text-center text-white backdrop-blur-md"
					data-test-id="magnifier-gestures"
				>
					{t('magnifier.gestures')}
				</p>
			{/if}
		</div>
	{:else if status === 'live' && !touched}
		<div class="pointer-events-none absolute inset-x-3 top-3 flex justify-center">
			<p
				class="text-label max-w-sm rounded-2xl bg-black/60 px-4 py-3 text-center text-white backdrop-blur-md"
				data-test-id="magnifier-hint"
			>
				{t('magnifier.hint')}
			</p>
		</div>
	{/if}

	<!--
		Three controls, not one more: light, freeze, magnify. The plus and minus buttons are gone — the
		slider already does both, and two fewer 44px targets is that much image given back to what you are
		trying to read.

		The slider is vertical and against the edge: horizontal it took the full width above the buttons, a
		band of screen lost where the label is. Vertical, it takes only one column, and the gesture — up to
		magnify — says what it does.

		`end` and not `right`: in Arabic the interface is mirrored and the slider moves to the left.
	-->
	<!--
		The level moved above the slider, and the magnifier icon that was there is gone: it repeated what the
		number says better. Read aloud, a slider announces "2.5"; `aria-valuetext` makes it "2.5x", which is
		the real unit.
	-->
	<div
		class="absolute end-[16px] top-1/2 flex -translate-y-1/2 flex-col items-center gap-3
			rounded-full border border-white/15 bg-black/55 px-[10px] py-[16px] backdrop-blur-lg"
	>
		<span
			class="text-label font-semibold tabular-nums text-white"
			data-test-id="magnifier-level"
		>
			{zoom.toFixed(1)}×
		</span>

		<input
			id="magnifier-zoom"
			type="range"
			min={ZOOM_MIN}
			max={ZOOM_MAX}
			step="0.1"
			bind:value={zoom}
			oninput={() => (touched = true)}
			aria-label={t('magnifier.zoom')}
			aria-valuetext="{zoom.toFixed(1)}×"
			data-test-id="magnifier-slider"
			class="fl-range-vertical accent-[var(--primary)]"
		/>
	</div>

	<!--
		The controls carry their name in full. An icon alone has to be guessed — a lightning bolt, a
		snowflake — and that is precisely what we do not want to ask of someone opening the magnifier
		because they cannot make out a label. The word is also the name read by a screen reader: no more
		`aria-label` saying something other than what is written.

		The disc stays in pixels, not rem: it is a target, not text, and at `size-16` it reached 140px at the
		Comfort step. The label, on the other hand, follows the chosen text size — it is text, it must grow —
		and the row wraps rather than overflow.
	-->
	<!--
		The gradient under the row is not decoration: the labels are white, and the image behind is precisely
		a product label, so light half the time. Without it, "Light" and "Contrast" faded out on a cream
		background. It goes down to the bottom of the screen to cover what sticks out under the buttons too.
	-->
	<div
		class="absolute inset-x-0 bottom-0 flex flex-wrap items-start justify-center gap-x-4 gap-y-3
			bg-gradient-to-t from-black/85 via-black/55 to-transparent px-4 pt-12 pb-24 md:pb-8"
	>
		<button
			type="button"
			onclick={toggleTorch}
			aria-pressed={torch}
			data-test-id="magnifier-light"
			class="fl-magnifier-control"
		>
			<span class="fl-magnifier-disc {torch ? 'is-on' : ''}">
				<Zap size={26} aria-hidden="true" />
			</span>
			{t('magnifier.light')}
		</button>

		<button
			type="button"
			onclick={toggleFreeze}
			aria-pressed={frozen}
			data-test-id="magnifier-freeze"
			class="fl-magnifier-control"
		>
			<span class="fl-magnifier-disc {frozen ? 'is-on' : ''}">
				{#if frozen}
					<Play size={26} aria-hidden="true" />
				{:else}
					<Snowflake size={26} aria-hidden="true" />
				{/if}
			</span>
			{frozen ? t('magnifier.resume') : t('magnifier.freeze')}
		</button>

		<!--
			Contrast serves when the text is printed in pale grey, or sits on a photo: we remove the colour,
			which says nothing here, and push the greys apart. That is often what makes the difference between a
			line guessed and a line read.
		-->
		<button
			type="button"
			onclick={() => {
				touched = true;
				contrast = !contrast;
			}}
			aria-pressed={contrast}
			data-test-id="magnifier-contrast"
			class="fl-magnifier-control"
		>
			<span class="fl-magnifier-disc {contrast ? 'is-on' : ''}">
				<Contrast size={26} aria-hidden="true" />
			</span>
			{t('magnifier.contrast')}
		</button>
	</div>
</div>
