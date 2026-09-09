<script lang="ts">
	import { scanImage, type ScanResult } from '$lib/scan/scanner';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { ImageUp, LoaderCircle } from '@lucide/svelte';

	let { onScanned }: { onScanned: (result: ScanResult) => void } = $props();

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
	Enregistrer une carte depuis une image plutôt que devant la caméra.

	C'est souvent la seule voie praticable sur un ordinateur : la carte est dans un courriel, dans
	une photo prise il y a un mois, ou dans l'application de l'enseigne. La présenter à la webcam
	d'un portable, à l'envers et à bout de bras, ne marche pas — et c'est justement devant un
	ordinateur qu'on s'installe pour enregistrer une pile de cartes d'un coup.
-->
<Button
	variant="outline"
	onclick={() => input?.click()}
	disabled={occupe}
	data-test-id="import-code"
	class="fl-press"
>
	{#if occupe}
		<LoaderCircle size={18} class="animate-spin" aria-hidden="true" />
	{:else}
		<ImageUp size={18} aria-hidden="true" />
	{/if}
	{t('scan.fromImage')}
</Button>

<input
	bind:this={input}
	type="file"
	accept="image/*"
	onchange={lire}
	aria-label={t('scan.fromImage')}
	data-test-id="import-code-input"
	class="sr-only"
/>

{#if erreur}
	<p class="text-destructive text-caption mt-2" role="alert" data-test-id="import-code-error">
		{erreur}
	</p>
{/if}
