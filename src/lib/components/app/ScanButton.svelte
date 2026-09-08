<script lang="ts">
	import { tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { scan, scanSupport, type ScanResult } from '$lib/scan/scanner';
	import { feedback } from '$stores/feedback.svelte';
	import { motionMs } from '$stores/settings.svelte';
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
			// Un code se lit à bout de bras, l'œil sur l'étiquette : le son dit que c'est pris sans
			// qu'on ait à retourner l'écran.
			if (result) {
				feedback.play('success');
				onScanned(result);
			}
		} catch {
			// Caméra refusée, absente, ou déjà prise par une autre application : on le dit et on
			// laisse la saisie manuelle faire le travail.
			feedback.play('error');
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
		<div class="mt-3" transition:slide={{ duration: motionMs(200), easing: cubicOut }}>
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
			<Button variant="outline" onclick={stop} data-test-id="scan-stop" class="fl-press mt-2">
				<X size={16} aria-hidden="true" />
				{t('scan.stop')}
			</Button>
		</div>
	{:else}
		<Button variant="outline" onclick={start} data-test-id="scan-start" class="fl-press mt-3">
			<ScanLine size={16} aria-hidden="true" />
			{t('scan.start')}
		</Button>
	{/if}
{/if}

{#if error}
	<p class="text-destructive text-caption mt-2" role="alert" data-test-id="scan-error">{error}</p>
{/if}
