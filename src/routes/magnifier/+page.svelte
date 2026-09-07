<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { t } from '$lib/i18n/index.svelte';
	import { session } from '$stores/session.svelte';
	import { digitalZoom, opticalZoom, ZOOM_MAX, ZOOM_MIN, type ZoomRange } from '$domain/magnifier';
	import { Zap, ZoomIn, Camera, Snowflake, Play } from '@lucide/svelte';

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
	 *
	 * On capture la trame entière, sans grossissement. C'est ce qui permet de continuer à zoomer
	 * dans l'image figée : le grossissement est appliqué à l'affichage, pas gravé dans la capture.
	 * L'inverse — capturer déjà zoomé — rendait le curseur inerte une fois l'image posée, et
	 * obligeait à dégeler pour regarder un détail de plus près.
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

		context.drawImage(video, 0, 0, width, height);
		frozen = true;
	}

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
		class="absolute inset-0 size-full object-cover transition-transform duration-200"
		class:hidden={!frozen}
		style="transform: scale({scale}); filter: {brighten
			? 'brightness(1.35) contrast(1.05)'
			: 'none'}"
	></canvas>

	{#if status !== 'live'}
		<div class="absolute inset-0 overflow-y-auto px-6 py-6 text-center">
			<div class="flex min-h-full items-center justify-center">
				{#if status === 'loading'}
					<p class="text-product text-white/70">{t('magnifier.starting')}</p>
				{:else}
					<div
						class="max-w-sm min-w-0 rounded-lg border border-white/15 bg-white/5 p-6"
						data-test="magnifier-unavailable"
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

	<div
		class="pointer-events-none absolute inset-x-[8%] top-[18%] bottom-[34%] rounded-[20px] border-2 border-white/30"
		aria-hidden="true"
	></div>

	<!-- Le bandeau ne sert plus qu'à signaler l'image figée : le reste du temps il répétait le titre. -->
	{#if frozen}
		<div class="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
			<p
				class="text-caption flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 font-semibold text-white backdrop-blur-md"
				data-test="magnifier-frozen-badge"
			>
				<Snowflake size={15} aria-hidden="true" />
				{t('magnifier.frozen')}
			</p>
		</div>
	{/if}

	<!--
		Trois commandes, pas une de plus : éclairer, figer, grossir. Les boutons plus et moins ont
		disparu — le curseur fait déjà les deux, et deux cibles de 44 px en moins, c'est autant
		d'image rendue à ce qu'on essaie de lire.

		Le curseur est vertical et collé au bord : à l'horizontale il occupait toute la largeur
		au-dessus des boutons, soit une bande de l'écran perdue là où l'étiquette se trouve. Vertical,
		il ne prend qu'une colonne, et le geste — monter pour grossir — dit ce qu'il fait.

		`end` et pas `right` : en arabe, l'interface est en miroir et le curseur passe à gauche.
	-->
	<div
		class="absolute end-[16px] top-1/2 flex -translate-y-1/2 flex-col items-center gap-3
			rounded-full border border-white/15 bg-black/55 px-[10px] py-[16px] backdrop-blur-lg"
	>
		<ZoomIn size={18} class="text-white/70" aria-hidden="true" />

		<input
			id="magnifier-zoom"
			type="range"
			min={ZOOM_MIN}
			max={ZOOM_MAX}
			step="0.1"
			bind:value={zoom}
			aria-label={t('magnifier.zoom')}
			data-test="magnifier-slider"
			class="fl-range-vertical accent-[var(--primary)]"
		/>

		<span class="text-caption tabular-nums text-white" data-test="magnifier-level">
			{zoom.toFixed(1)}×
		</span>
	</div>

	<!--
		Tailles en pixels, pas en rem : ces deux boutons ne portent qu'une icône, rien à y lire, et le
		cran de texte n'a donc rien à y changer. En `size-16`, ils atteignaient 140 px au cran Confort
		et la barre tenait dans 375 px au pixel près — une icône de plus et elle débordait.
	-->
	<div
		class="absolute inset-x-0 bottom-28 flex items-center justify-center gap-[24px] px-[20px] md:bottom-10"
	>
		<button
			type="button"
			onclick={toggleTorch}
			aria-pressed={torch}
			aria-label={t('magnifier.light')}
			data-test="magnifier-light"
			class="grid size-[64px] min-h-[64px] place-items-center rounded-full border border-white/20 backdrop-blur-lg
				{torch ? 'bg-white text-neutral-900' : 'bg-white/15 text-white'}"
		>
			<Zap size={26} aria-hidden="true" />
		</button>

		<button
			type="button"
			onclick={toggleFreeze}
			aria-pressed={frozen}
			aria-label={frozen ? t('magnifier.resume') : t('magnifier.freeze')}
			data-test="magnifier-freeze"
			class="grid size-[64px] min-h-[64px] place-items-center rounded-full border border-white/20 backdrop-blur-lg
				{frozen ? 'bg-white text-neutral-900' : 'bg-white/15 text-white'}"
		>
			{#if frozen}
				<Play size={26} aria-hidden="true" />
			{:else}
				<Snowflake size={26} aria-hidden="true" />
			{/if}
		</button>
	</div>
</div>
