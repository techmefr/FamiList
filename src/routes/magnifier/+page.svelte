<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { t } from '$lib/i18n/index.svelte';
	import { session } from '$stores/session.svelte';
	import {
		digitalZoom,
		opticalZoom,
		viewFilter,
		ZOOM_MAX,
		ZOOM_MIN,
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
	 * Le conseil d'usage ne s'affiche que tant qu'on n'a touché à rien. Il répond à la seule
	 * question qu'on se pose en arrivant devant une image noire, et disparaît au premier geste :
	 * laissé en place, il masquerait justement la ligne qu'on essaie de lire.
	 */
	let touched = $state(false);

	const applied = $derived(opticalZoom(zoom, range));
	const scale = $derived(digitalZoom(zoom, applied));

	/**
	 * Sans torche matérielle, on éclaircit l'image reçue. Ce n'est pas un vrai éclairage — cela ne
	 * révèle rien qui soit dans l'ombre — mais sur une étiquette mate un peu grise, cela suffit
	 * souvent à décoller le texte du fond.
	 */
	const brighten = $derived(torch && !hasTorch);
	const filter = $derived(viewFilter({ contrast, brighten }));

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
		touched = true;
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
		touched = true;

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
<div class="fixed inset-0 z-0 overflow-hidden bg-black" data-test-id="magnifier">
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

	<canvas
		bind:this={canvas}
		data-test-id="magnifier-frozen"
		class="absolute inset-0 size-full object-cover transition-transform duration-200"
		class:hidden={!frozen}
		style="transform: scale({scale}); filter: {filter}"
	></canvas>

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
		Le bandeau du haut dit une chose à la fois. L'image figée d'abord — c'est un état, et ne pas
		le signaler laisse croire que la caméra a planté. Sinon, tant qu'on n'a touché à rien, la
		phrase qui explique quoi faire : approcher, puis figer. Elle s'efface au premier geste.

		Le cadre en pointillés qui délimitait une « zone de lecture » a disparu. Il ne cadrait rien —
		l'image occupe tout l'écran — et laissait croire que le reste ne comptait pas, alors que
		c'est justement en promenant le téléphone qu'on trouve la ligne à lire.
	-->
	{#if frozen}
		<div class="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
			<p
				class="text-caption flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 font-semibold text-white backdrop-blur-md"
				data-test-id="magnifier-frozen-badge"
			>
				<Snowflake size={15} aria-hidden="true" />
				{t('magnifier.frozen')}
			</p>
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
		Trois commandes, pas une de plus : éclairer, figer, grossir. Les boutons plus et moins ont
		disparu — le curseur fait déjà les deux, et deux cibles de 44 px en moins, c'est autant
		d'image rendue à ce qu'on essaie de lire.

		Le curseur est vertical et collé au bord : à l'horizontale il occupait toute la largeur
		au-dessus des boutons, soit une bande de l'écran perdue là où l'étiquette se trouve. Vertical,
		il ne prend qu'une colonne, et le geste — monter pour grossir — dit ce qu'il fait.

		`end` et pas `right` : en arabe, l'interface est en miroir et le curseur passe à gauche.
	-->
	<!--
		Le niveau est passé au-dessus du curseur, et l'icône de loupe qui s'y trouvait a sauté : elle
		répétait ce que le chiffre dit mieux. Lu à voix haute, un curseur annonce « 2,5 » ; le
		`aria-valuetext` en fait « 2,5 × », qui est l'unité réelle.
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
		Les commandes portent leur nom en toutes lettres. Une icône seule se devine — un éclair, un
		flocon —, et c'est précisément ce qu'on ne veut pas demander à quelqu'un qui ouvre la loupe
		parce qu'il ne déchiffre pas une étiquette. Le mot est aussi le nom lu par un lecteur
		d'écran : plus d'`aria-label` qui dirait autre chose que ce qui est écrit.

		Le disque reste en pixels, pas en rem : c'est une cible, pas du texte, et en `size-16` il
		atteignait 140 px au cran Confort. Le libellé, lui, suit la taille de texte choisie — c'est
		du texte, il doit grandir — et la rangée passe à la ligne plutôt que de déborder.
	-->
	<!--
		Le dégradé sous la rangée n'est pas une décoration : les libellés sont blancs, et l'image
		derrière est justement une étiquette de produit, donc claire une fois sur deux. Sans lui,
		« Éclairer » et « Contraste » s'effaçaient sur fond crème. Il descend jusqu'au bas de l'écran
		pour couvrir aussi ce qui dépasse sous les boutons.
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
			Le contraste sert quand le texte est imprimé en gris pâle, ou posé sur une photo : on
			retire la couleur, qui ne dit rien ici, et on écarte les gris. C'est souvent ce qui fait
			la différence entre une ligne devinée et une ligne lue.
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
