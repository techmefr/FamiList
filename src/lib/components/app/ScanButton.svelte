<script lang="ts">
	import { tick } from 'svelte';
	import { scan, scanSupport, type ScanResult } from '$lib/scan/scanner';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { ScanLine, X } from '@lucide/svelte';

	let { onScanned }: { onScanned: (result: ScanResult) => void } = $props();

	let video = $state<HTMLVideoElement | null>(null);
	let scanning = $state(false);
	let error = $state<string | null>(null);
	let controller: AbortController | null = null;

	const support = scanSupport();

	async function start() {
		error = null;
		scanning = true;
		controller = new AbortController();

		// L'élément vidéo n'existe qu'une fois `scanning` rendu : sans cette attente, on passerait
		// un élément absent au lecteur et rien ne s'afficherait.
		await tick();

		try {
			const result = await scan(video, controller.signal);
			if (result) onScanned(result);
		} catch {
			// Caméra refusée, absente, ou déjà prise par une autre application : on le dit et on
			// laisse la saisie manuelle faire le travail.
			error = t('scan.failed');
		} finally {
			scanning = false;
			controller = null;
		}
	}

	function stop() {
		controller?.abort();
	}
</script>

{#if support !== 'none'}
	{#if scanning}
		<div class="mt-3">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={video}
				playsinline
				muted
				class="w-full rounded-md bg-black"
				data-test="scan-video"
			></video>
			<Button variant="outline" onclick={stop} data-test="scan-stop" class="mt-2">
				<X size={16} aria-hidden="true" />
				{t('scan.stop')}
			</Button>
		</div>
	{:else}
		<Button variant="outline" onclick={start} data-test="scan-start" class="mt-3">
			<ScanLine size={16} aria-hidden="true" />
			{t('scan.start')}
		</Button>
	{/if}
{/if}

{#if error}
	<p class="text-destructive text-caption mt-2" role="alert" data-test="scan-error">{error}</p>
{/if}
