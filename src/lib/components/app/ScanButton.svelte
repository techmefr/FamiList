<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onDestroy, tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { scan, scanSupport, type ScanResult } from '$lib/scan/scanner';
	import { SCAN_SUGGEST_MS, scanOutcome } from '$domain/scan-timing';
	import { feedback } from '$stores/feedback.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { ScanLine, X, Zap } from '@lucide/svelte';

	/**
	 * `actions` reçoit les autres façons d'obtenir le même code — aujourd'hui l'import d'une image.
	 * Elles sont rendues ici, et pas côté appelant, parce que c'est ce composant qui décide de la
	 * rangée : il en disparaît quand la caméra manque, et il la remplace entièrement par l'aperçu
	 * vidéo pendant le scan. Les laisser dehors les mettrait à côté de la vidéo.
	 *
	 * `photo` est la voie de secours du scan lui-même. Elle n'a de sens qu'avec un appareil photo,
	 * et elle réapparaît sous l'aperçu dès que la lecture traîne : c'est là, devant la ligne qui
	 * balaie sans rien trouver, qu'on a besoin qu'on nous la propose.
	 */
	let {
		onScanned,
		actions,
		photo
	}: { onScanned: (result: ScanResult) => void; actions?: Snippet; photo?: Snippet } = $props();

	let video = $state<HTMLVideoElement | null>(null);
	let scanning = $state(false);
	let error = $state<string | null>(null);
	let suggest = $state(false);
	let torch = $state(false);
	let hasTorch = $state(false);
	let controller: AbortController | null = null;
	let track: MediaStreamTrack | null = null;
	let suggestTimer: ReturnType<typeof setTimeout> | null = null;

	const support = scanSupport();

	interface TorchConstraint {
		torch: boolean;
	}

	function applyTorch(on: boolean) {
		const contrainte: TorchConstraint = { torch: on };

		// Un pilote qui refuse la contrainte laisse simplement la lampe éteinte : l'aperçu reste
		// lisible, il n'y a rien à signaler à l'utilisateur.
		void track
			?.applyConstraints({ advanced: [contrainte] } as MediaTrackConstraints)
			.catch(() => {});
	}

	function toggleTorch() {
		torch = !torch;
		applyTorch(torch);
	}

	function prendreLaPiste(piste: MediaStreamTrack | null) {
		track = piste;
		hasTorch = ((piste?.getCapabilities?.() ?? {}) as { torch?: boolean }).torch === true;
		if (piste && torch) applyTorch(true);
	}

	async function start() {
		error = null;
		scanning = true;
		suggest = false;
		controller = new AbortController();
		suggestTimer = setTimeout(() => (suggest = true), SCAN_SUGGEST_MS);

		// L'élément vidéo n'existe qu'une fois `scanning` rendu : sans cette attente, on passerait
		// un élément absent au lecteur et rien ne s'afficherait.
		await tick();

		try {
			const result = await scan(video, controller.signal, { onTrack: prendreLaPiste });
			// Un code se lit à bout de bras, l'œil sur l'étiquette : le son dit que c'est pris sans
			// qu'on ait à retourner l'écran.
			if (result) {
				feedback.play('success');
				onScanned(result);
			} else if (scanOutcome(controller.signal.aborted) === 'timeout') {
				feedback.play('error');
				error = t('scan.givenUp');
			}
		} catch {
			// Caméra refusée, absente, ou déjà prise par une autre application : on le dit et on
			// laisse la saisie manuelle faire le travail.
			feedback.play('error');
			error = t('scan.failed');
		} finally {
			arreterLesTemoins();
			scanning = false;
			controller = null;
		}
	}

	/**
	 * La lampe ne survit pas au scan : la piste est rendue avec la caméra, et garder l'état allumé
	 * ferait rouvrir la caméra torche allumée au scan suivant, sans qu'on l'ait demandé.
	 */
	function arreterLesTemoins() {
		if (suggestTimer) clearTimeout(suggestTimer);
		suggestTimer = null;
		track = null;
		hasTorch = false;
		torch = false;
	}

	function stop() {
		controller?.abort();
	}

	onDestroy(() => {
		controller?.abort();
		arreterLesTemoins();
	});
</script>

<!--
	La rangée des façons d'attraper un code.

	Les boutons sont étirés à la même hauteur plutôt qu'alignés en haut : sur écran étroit, l'un des
	libellés passe sur deux lignes et l'autre non, et deux boutons de hauteurs différentes côte à
	côte se voient tout de suite.
-->
<div class="mt-2 flex flex-wrap items-stretch gap-2">
	{#if scanning}
		<div class="w-full" transition:slide={{ duration: motionMs(200), easing: cubicOut }}>
			<div class="relative overflow-hidden rounded-md">
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					bind:this={video}
					playsinline
					muted
					class="w-full rounded-md bg-black"
					data-test-id="scan-video"
				></video>
				<!-- La ligne qui balaie dit que la caméra tourne, là où une image figée ne dit rien. -->
				<span
					class="fl-scanline bg-primary absolute inset-x-4 h-0.5 rounded-full opacity-80"
					aria-hidden="true"
				></span>
			</div>
			<div class="mt-2 flex flex-wrap items-stretch gap-2">
				<Button variant="outline" onclick={stop} data-test-id="scan-stop" class="fl-press">
					<X size={18} aria-hidden="true" />
					{t('scan.stop')}
				</Button>
				{#if hasTorch}
					<Button
						variant="outline"
						onclick={toggleTorch}
						aria-pressed={torch}
						data-test-id="scan-torch"
						class="fl-press"
					>
						<Zap size={18} aria-hidden="true" />
						{t('scan.torch')}
					</Button>
				{/if}
			</div>
			{#if suggest}
				<div
					class="mt-2 flex flex-wrap items-stretch gap-2"
					transition:slide={{ duration: motionMs(200), easing: cubicOut }}
				>
					<p class="text-muted-foreground text-caption w-full" data-test-id="scan-suggest">
						{t('scan.stillSearching')}
					</p>
					{@render photo?.()}
				</div>
			{/if}
		</div>
	{:else}
		{#if support !== 'none'}
			<Button variant="outline" onclick={start} data-test-id="scan-start" class="fl-press">
				<ScanLine size={18} aria-hidden="true" />
				{t('scan.start')}
			</Button>

			{@render photo?.()}
		{/if}

		{@render actions?.()}
	{/if}

	{#if error}
		<p class="text-destructive text-caption w-full" role="alert" data-test-id="scan-error">
			{error}
		</p>
	{/if}
</div>
