<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Check } from '@lucide/svelte';

	const moi = $derived(data.members.find((m) => m.id === data.me));

	let saisi = $state<string | null>(null);
	let occupe = $state(false);
	let enregistre = $state(false);
	let erreur = $state('');

	/**
	 * Tant que personne n'a tapé, le champ suit le nom du foyer — il se remplit tout seul quand la
	 * synchronisation arrive, au lieu de rester vide sur un appareil qui vient de s'ouvrir. Dès la
	 * première frappe, c'est la saisie qui commande : une mise à jour venue du serveur ne doit pas
	 * effacer ce qu'on est en train d'écrire.
	 */
	/**
	 * Le champ se remplit du nom connu dès que la synchronisation le rapporte, puis se tait : une
	 * mise à jour venue du serveur ne doit pas effacer ce qu'on est en train d'écrire.
	 */
	$effect(() => {
		if (saisi === null && moi) saisi = moi.name;
	});

	// Tant que le compte n'est pas identifié, on ne sait pas quel profil écrire : le champ reste
	// fermé plutôt que d'accepter une frappe qui partirait dans le vide.
	const modifie = $derived(
		!!moi && (saisi ?? '').trim().length > 0 && (saisi ?? '').trim() !== moi.name
	);

	async function enregistrer(event: SubmitEvent) {
		event.preventDefault();
		if (!modifie) return;

		const nom = (saisi ?? '').trim();

		occupe = true;
		erreur = (await data.setMyName(nom)) ?? '';
		occupe = false;

		if (erreur) {
			saisi = moi?.name ?? '';
			return;
		}

		saisi = nom;
		enregistre = true;
		feedback.play('success');
		setTimeout(() => (enregistre = false), 2000);
	}
</script>

<!--
	Le nom se pose à l'inscription, et jusqu'ici plus rien ne permettait d'y revenir : une faute de
	frappe restait affichée à tout le foyer. Les initiales de la pastille se recalculent depuis ce
	champ, elles n'ont rien à saisir de leur côté.
-->
<form onsubmit={enregistrer} class="flex flex-wrap items-end gap-3" data-test-id="name-form">
	<div class="min-w-0 flex-1 basis-48">
		<Label for="display-name">{t('profile.name')}</Label>
		<Input
			id="display-name"
			bind:value={() => saisi ?? '', (v) => (saisi = v)}
			data-test-id="name-input"
			disabled={!moi}
			maxlength={60}
			autocomplete="name"
			placeholder={t('profile.namePlaceholder')}
		/>
	</div>

	<Button type="submit" disabled={occupe || !modifie} data-test-id="name-save" class="fl-press">
		{#if enregistre}
			<Check size={18} aria-hidden="true" />
			{t('profile.nameSaved')}
		{:else}
			{t('profile.nameSave')}
		{/if}
	</Button>

	{#if erreur}
		<p class="text-destructive text-caption basis-full" role="alert" data-test-id="name-error">
			{t('profile.nameFailed')}
		</p>
	{/if}
</form>
