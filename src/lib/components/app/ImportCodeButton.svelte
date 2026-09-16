<script lang="ts">
	import { scanImage, type ScanResult } from '$lib/scan/scanner';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Camera, ImageUp, LoaderCircle } from '@lucide/svelte';

	/**
	 * Deux entrées pour un seul décodeur. En mode photo, `capture` fait ouvrir l'appareil photo
	 * directement : sans cet attribut, le téléphone proposait un choix entre galerie et caméra sous
	 * un libellé qui ne parlait que d'image, et personne ne devinait qu'on pouvait photographier sa
	 * carte quand le scan en direct n'y arrivait pas.
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
	Enregistrer une carte depuis une image plutôt que devant la caméra.

	C'est souvent la seule voie praticable sur un ordinateur : la carte est dans un courriel, dans
	une photo prise il y a un mois, ou dans l'application de l'enseigne. La présenter à la webcam
	d'un portable, à l'envers et à bout de bras, ne marche pas — et c'est justement devant un
	ordinateur qu'on s'installe pour enregistrer une pile de cartes d'un coup.

	Sur téléphone, la même mécanique sert d'issue au scan en direct : une photo est fixe, nette et
	relue plusieurs fois, là où le flux vidéo se bat contre le reflet de l'écran qui porte la carte.
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

<!-- Pleine largeur : le message prend sa propre ligne au lieu d'étirer un seul bouton de la rangée. -->
{#if erreur}
	<p class="text-destructive text-caption w-full" role="alert" data-test-id="import-code-error">
		{erreur}
	</p>
{/if}
