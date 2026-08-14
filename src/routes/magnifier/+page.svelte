<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { t } from '$lib/i18n/index.svelte';
	import { session } from '$stores/session.svelte';
	import {
		clampZoom,
		digitalZoom,
		opticalZoom,
		ZOOM_MAX,
		ZOOM_MIN,
		ZOOM_STEP,
		type ZoomRange
	} from '$domain/magnifier';
	import { Minus, Plus, Zap, ZoomIn, Camera } from '@lucide/svelte';

	type Status = 'loading' | 'live' | 'denied' | 'unsupported';

	let video = $state<HTMLVideoElement | null>(null);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let stream: MediaStream | null = null;
	let track: MediaStreamTrack | null = null;

	let status = $state<Status>('loading');
	let zoom = $state(1.5);
	let torch = $state(false);
	let frozen = $state(false);
	let range = $state<ZoomRange | null>(null);
	let hasTorch = $state(false);

	const applied = $derived(opticalZoom(zoom, range));
	const scale = $derived(digitalZoom(zoom, applied));

	/**
	 * Sans torche matérielle, on éclaircit l'image reçue. Ce n'est pas un vrai éclairage — cela ne
	 * révèle rien qui soit dans l'ombre — mais sur une étiquette mate un peu grise, cela suffit
	 * souvent à décoller le texte du fond.
	 */
	const brighten = $derived(torch && !hasTorch);

	interface AdvancedConstraint {
		zoom?: number;
		torch?: boolean;
	}

	function applyAdvanced(constraint: AdvancedConstraint) {
		// Un pilote qui refuse la contrainte laisse simplement l'image en l'état : rien à signaler,
		// le repli logiciel a déjà fait le travail.
		void track?.applyConstraints({ advanced: [constraint] } as MediaTrackConstraints).catch(() => {});
	}

	/**
	 * Le gabarit affiche la page avant que la redirection vers l'écran de connexion n'ait eu lieu.
	 * Sans cette garde, arriver sur l'adresse de la loupe sans être connecté ouvrait l'appareil photo
	 * le temps de la bascule — une demande d'autorisation surgie de nulle part.
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
		// L'élément vidéo n'est rendu qu'une fois l'état passé à « live » : sans cette attente, on
		// poserait le flux sur un élément qui n'existe pas encore.
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
		torch = !torch;
		if (hasTorch) applyAdvanced({ torch });
	}

	/**
	 * Figer l'image, c'est pouvoir reposer le bras et lire tranquillement — le geste qui manque le
	 * plus quand on tient un bocal d'une main et le téléphone de l'autre.
	 */
	function toggleFreeze() {
		if (frozen) {
			frozen = false;
			return;
		}

		if (status !== 'live' || !video || !canvas) return;

		const width = video.videoWidth;
		const height = video.videoHeight;
		if (!width || !height) return;

		canvas.width = width;
		canvas.height = height;

		const context = canvas.getContext('2d');
		if (!context) return;

		// La capture reprend le grossissement affiché : l'image figée doit être celle qu'on regardait.
		context.translate(width / 2, height / 2);
		context.scale(scale, scale);
		context.translate(-width / 2, -height / 2);
		context.drawImage(video, 0, 0, width, height);

		frozen = true;
	}

	const nudge = (delta: number) => (zoom = clampZoom(zoom + delta));

	// La session n'est pas toujours connue au montage : on attend qu'elle le soit, une seule fois.
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

<!--
	Plein écran, mais sous la barre de navigation : au-dessus, l'image de la caméra recouvrirait les
	onglets et il n'y aurait plus aucun moyen de quitter la loupe.
-->
<div class="fixed inset-0 z-0 overflow-hidden bg-black" data-test="magnifier">
	{#if status === 'live'}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			bind:this={video}
			playsinline
			muted
			data-test="magnifier-video"
			class="absolute inset-0 size-full object-cover transition-transform duration-200"
			class:hidden={frozen}
			style="transform: scale({scale}); filter: {brighten
				? 'brightness(1.35) contrast(1.05)'
				: 'none'}"
		></video>
	{/if}

	<canvas
		bind:this={canvas}
		data-test="magnifier-frozen"
		class="absolute inset-0 size-full object-cover"
		class:hidden={!frozen}
	></canvas>

	{#if status !== 'live'}
		<div class="absolute inset-0 grid place-items-center px-6 text-center">
			{#if status === 'loading'}
				<p class="text-product text-white/70">{t('magnifier.starting')}</p>
			{:else}
				<div
					class="max-w-sm rounded-lg border border-white/15 bg-white/5 p-6"
					data-test="magnifier-unavailable"
				>
					<Camera size={32} class="mx-auto text-[var(--primary)]" aria-hidden="true" />
					<p class="text-product mt-4 text-white">
						{status === 'denied' ? t('magnifier.denied') : t('magnifier.unsupported')}
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<div
		class="pointer-events-none absolute inset-x-[8%] top-[18%] bottom-[34%] rounded-[20px] border-2 border-white/30"
		aria-hidden="true"
	></div>

	<div class="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
		<p
			class="text-caption flex items-center gap-2 rounded-full bg-black/45 px-4 py-2 font-semibold text-white backdrop-blur-md"
		>
			<ZoomIn size={15} aria-hidden="true" />
			{frozen ? t('magnifier.frozen') : t('magnifier.title')}
		</p>
	</div>

	<div class="absolute inset-x-0 bottom-28 px-5 md:bottom-10">
		<div class="mb-4 rounded-[18px] border border-white/15 bg-black/55 px-4 py-3 backdrop-blur-lg">
			<div class="text-caption mb-2 flex justify-between font-semibold text-white/70">
				<label for="magnifier-zoom">{t('magnifier.zoom')}</label>
				<span class="tabular-nums text-white" data-test="magnifier-level">{zoom.toFixed(1)}×</span>
			</div>

			<div class="flex items-center gap-3">
				<button
					type="button"
					onclick={() => nudge(-ZOOM_STEP)}
					aria-label={t('magnifier.zoomOut')}
					data-test="magnifier-out"
					class="grid size-11 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white"
				>
					<Minus size={20} aria-hidden="true" />
				</button>

				<input
					id="magnifier-zoom"
					type="range"
					min={ZOOM_MIN}
					max={ZOOM_MAX}
					step="0.1"
					bind:value={zoom}
					data-test="magnifier-slider"
					class="h-1 flex-1 accent-[var(--primary)]"
				/>

				<button
					type="button"
					onclick={() => nudge(ZOOM_STEP)}
					aria-label={t('magnifier.zoomIn')}
					data-test="magnifier-in"
					class="grid size-11 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white"
				>
					<Plus size={20} aria-hidden="true" />
				</button>
			</div>
		</div>

		<div class="flex items-center justify-between px-2">
			<button
				type="button"
				onclick={toggleTorch}
				aria-pressed={torch}
				aria-label={t('magnifier.light')}
				data-test="magnifier-light"
				class="grid size-14 place-items-center rounded-full border border-white/20 backdrop-blur-lg
					{torch ? 'bg-white text-neutral-900' : 'bg-white/15 text-white'}"
			>
				<Zap size={24} aria-hidden="true" />
			</button>

			<button
				type="button"
				onclick={toggleFreeze}
				aria-pressed={frozen}
				aria-label={frozen ? t('magnifier.resume') : t('magnifier.freeze')}
				data-test="magnifier-freeze"
				class="grid size-20 place-items-center rounded-full border-4 border-white/40 bg-white"
			>
				<span
					class="block transition-all duration-200 {frozen
						? 'size-8 rounded-md bg-[var(--primary)]'
						: 'size-full rounded-full bg-white'}"
				></span>
			</button>

			<span class="text-caption w-14 text-center leading-tight text-white/45">
				{#if status === 'live' && !hasTorch}{t('magnifier.softLight')}{/if}
			</span>
		</div>
	</div>
</div>
