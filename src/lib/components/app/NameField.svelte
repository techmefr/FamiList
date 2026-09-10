<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Check } from '@lucide/svelte';

	const moi = $derived(data.members.find((m) => m.id === data.me));

	let prenom = $state<string | null>(null);
	let nom = $state<string | null>(null);
	let affiche = $state<string | null>(null);
	let occupe = $state(false);
	let enregistre = $state(false);
	let erreur = $state('');

	/**
	 * Les champs se remplissent de ce que la synchronisation rapporte, puis se taisent : une mise à
	 * jour venue du serveur ne doit pas effacer ce qu'on est en train d'écrire.
	 */
	$effect(() => {
		if (prenom === null && moi) {
			prenom = moi.firstName;
			nom = moi.lastName;
			affiche = moi.name;
		}
	});

	const compose = (p: string, n: string) => `${p.trim()} ${n.trim()}`.trim();

	/**
	 * Le nom affiché suit le prénom et le nom tant qu'il n'a pas été personnalisé — c'est le cas le
	 * plus courant, et le retaper une troisième fois n'apprendrait rien à personne. Dès qu'il porte
	 * autre chose (« Mamie », « Lulu »), il ne bouge plus : ce surnom-là est un choix, pas un
	 * brouillon à écraser à la frappe suivante.
	 */
	function poser(champ: 'prenom' | 'nom', valeur: string) {
		const avant = compose(prenom ?? '', nom ?? '');
		const perso = (affiche ?? '').trim() !== '' && (affiche ?? '').trim() !== avant;

		if (champ === 'prenom') prenom = valeur;
		else nom = valeur;

		if (!perso) affiche = compose(prenom ?? '', nom ?? '');
	}

	// Tant que le compte n'est pas identifié, on ne sait pas quel profil écrire : les champs
	// restent fermés plutôt que d'accepter une frappe qui partirait dans le vide.
	const modifie = $derived(
		!!moi &&
			(affiche ?? '').trim().length > 0 &&
			((affiche ?? '').trim() !== moi.name ||
				(prenom ?? '').trim() !== moi.firstName ||
				(nom ?? '').trim() !== moi.lastName)
	);

	async function enregistrer(event: SubmitEvent) {
		event.preventDefault();
		if (!modifie) return;

		const identite = {
			name: (affiche ?? '').trim(),
			firstName: (prenom ?? '').trim(),
			lastName: (nom ?? '').trim()
		};

		occupe = true;
		erreur = (await data.setMyName(identite)) ?? '';
		occupe = false;

		if (erreur) {
			prenom = moi?.firstName ?? '';
			nom = moi?.lastName ?? '';
			affiche = moi?.name ?? '';
			return;
		}

		prenom = identite.firstName;
		nom = identite.lastName;
		affiche = identite.name;
		enregistre = true;
		feedback.play('success');
		setTimeout(() => (enregistre = false), 2000);
	}
</script>

<!--
	Le nom se pose à l'inscription, et jusqu'ici plus rien ne permettait d'y revenir : une faute de
	frappe restait affichée à tout le foyer. Le prénom et le nom, eux, ne se demandent qu'ici — pas
	à l'inscription, qui reste courte. Les initiales de la pastille se recalculent depuis ces
	champs, elles n'ont rien à saisir de leur côté.
-->
<form onsubmit={enregistrer} class="flex flex-wrap items-end gap-3" data-test-id="name-form">
	<div class="min-w-0 flex-1 basis-40">
		<Label for="first-name">{t('profile.firstName')}</Label>
		<Input
			id="first-name"
			bind:value={() => prenom ?? '', (v) => poser('prenom', v)}
			data-test-id="first-name-input"
			disabled={!moi}
			maxlength={60}
			autocomplete="given-name"
		/>
	</div>

	<div class="min-w-0 flex-1 basis-40">
		<Label for="last-name">{t('profile.lastName')}</Label>
		<Input
			id="last-name"
			bind:value={() => nom ?? '', (v) => poser('nom', v)}
			data-test-id="last-name-input"
			disabled={!moi}
			maxlength={60}
			autocomplete="family-name"
		/>
	</div>

	<div class="min-w-0 flex-1 basis-48">
		<Label for="display-name">{t('profile.name')}</Label>
		<Input
			id="display-name"
			bind:value={() => affiche ?? '', (v) => (affiche = v)}
			data-test-id="name-input"
			disabled={!moi}
			maxlength={60}
			autocomplete="nickname"
			placeholder={t('profile.namePlaceholder')}
		/>
		<p class="text-muted-foreground text-caption mt-1">{t('profile.nameHint')}</p>
	</div>

	<Button type="submit" disabled={occupe || !modifie} data-test-id="name-save" class="fl-press">
		{#if enregistre}
			<Check size={18} aria-hidden="true" data-test-id="name-saved" />
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
