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
	 * `actions` receives the other ways of getting the same code — today, importing an image. They are
	 * rendered here, and not on the caller's side, because this component is what decides the row: it
	 * disappears from it when the camera is missing, and it replaces it entirely with the video preview
	 * while scanning. Leaving them outside would put them next to the video.
	 *
	 * `photo` is the fallback route of the scan itself. It only makes sense with a camera, and it reappears
	 * under the preview as soon as the reading drags on: it is there, in front of the line sweeping and
	 * finding nothing, that you need it offered.
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
		const constraint: TorchConstraint = { torch: on };

		// A driver refusing the constraint simply leaves the light off: the preview stays readable, there is
		// nothing to report to the user.
		void track
			?.applyConstraints({ advanced: [constraint] } as MediaTrackConstraints)
			.catch(() => {});
	}

	function toggleTorch() {
		torch = !torch;
		applyTorch(torch);
	}

	function useTrack(track: MediaStreamTrack | null) {
		track = track;
		hasTorch = ((track?.getCapabilities?.() ?? {}) as { torch?: boolean }).torch === true;
		if (track && torch) applyTorch(true);
	}

	async function start() {
		error = null;
		scanning = true;
		suggest = false;
		controller = new AbortController();
		suggestTimer = setTimeout(() => (suggest = true), SCAN_SUGGEST_MS);

		// The video element only exists once `scanning` is rendered: without this wait, we would pass a missing
		// element to the reader and nothing would show.
		await tick();

		try {
			const result = await scan(video, controller.signal, { onTrack: useTrack });
			// A code is read at arm's length, eye on the label: the sound says it is taken without having to turn
			// the screen round.
			if (result) {
				feedback.play('success');
				onScanned(result);
			} else if (scanOutcome(controller.signal.aborted) === 'timeout') {
				feedback.play('error');
				error = t('scan.givenUp');
			}
		} catch {
			// Camera refused, absent, or already taken by another application: we say so and let manual entry do
			// the work.
			feedback.play('error');
			error = t('scan.failed');
		} finally {
			stopIndicators();
			scanning = false;
			controller = null;
		}
	}

	/**
	 * The light does not survive the scan: the track is released with the camera, and keeping the state on
	 * would reopen the camera with the torch on at the next scan, without anyone asking.
	 */
	function stopIndicators() {
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
		stopIndicators();
	});
</script>

<!--
	The row of ways to catch a code.

	The buttons are stretched to the same height rather than aligned to the top: on a narrow screen, one of
	the labels wraps onto two lines and the other does not, and two buttons of different heights side by side
	show at once.
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
				<!-- The sweeping line says the camera is running, where a frozen image says nothing. -->
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
