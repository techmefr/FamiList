<script lang="ts">
	import { scanImage, type ScanResult } from '$lib/scan/scanner';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Camera, ImageUp, LoaderCircle } from '@lucide/svelte';

	/**
	 * Two entrances for a single decoder. In photo mode, `capture` opens the camera directly: without that
	 * attribute, the phone offered a choice between gallery and camera under a label that only spoke of
	 * images, and nobody guessed they could photograph their card when the live scan could not manage it.
	 */
	let {
		onScanned,
		mode = 'image'
	}: { onScanned: (result: ScanResult) => void; mode?: 'image' | 'photo' } = $props();

	const photo = $derived(mode === 'photo');
	const libelle = $derived(photo ? t('scan.takePhoto') : t('scan.fromImage'));

	let input = $state<HTMLInputElement | null>(null);
	let occupe = $state(false);
	let erreur = $state('');

	async function lire(event: Event) {
		const fichier = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!fichier) return;

		erreur = '';
		occupe = true;

		try {
			const resultat = await scanImage(fichier);
			if (resultat) {
				feedback.play('success');
				onScanned(resultat);
			} else {
				feedback.play('error');
				erreur = t('scan.noCodeInImage');
			}
		} catch {
			feedback.play('error');
			erreur = t('scan.imageFailed');
		} finally {
			occupe = false;
			if (input) input.value = '';
		}
	}
</script>

<!--
	Saving a card from an image rather than in front of the camera.

	It is often the only workable route on a computer: the card is in an email, in a photo taken a month ago,
	or in the retailer's application. Presenting it to a laptop webcam, upside down and at arm's length, does
	not work — and a computer is precisely where you sit down to save a stack of cards in one go.

	On a phone, the same mechanism serves as the live scan's way out: a photo is still, sharp and read several
	times, where the video stream fights the reflection of the screen carrying the card.
-->
<Button
	variant="outline"
	onclick={() => input?.click()}
	disabled={occupe}
	data-test-id={photo ? 'capture-photo' : 'import-code'}
	class="fl-press"
>
	{#if occupe}
		<LoaderCircle size={18} class="animate-spin" aria-hidden="true" />
	{:else if photo}
		<Camera size={18} aria-hidden="true" />
	{:else}
		<ImageUp size={18} aria-hidden="true" />
	{/if}
	{libelle}
</Button>

<input
	bind:this={input}
	type="file"
	accept="image/*"
	capture={photo ? 'environment' : undefined}
	onchange={lire}
	aria-label={libelle}
	data-test-id={photo ? 'capture-photo-input' : 'import-code-input'}
	class="sr-only"
/>

<!-- Full width: the message takes its own line instead of stretching a single button of the row. -->
{#if erreur}
	<p class="text-destructive text-caption w-full" role="alert" data-test-id="import-code-error">
		{erreur}
	</p>
{/if}
