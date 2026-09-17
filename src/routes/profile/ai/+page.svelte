<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { PROVIDERS, providerById } from '$domain/ai';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import IconField from '$components/app/IconField.svelte';
	import { KeyRound, Cpu, Check, ExternalLink, TriangleAlert } from '@lucide/svelte';

	let fournisseur = $state(ai.provider);
	let cle = $state('');
	let modele = $state(ai.model);
	let busy = $state(false);
	let enregistre = $state(false);
	let erreur = $state('');

	const choisi = $derived(providerById(fournisseur));

	/**
	 * Le champ du modèle suit le fournisseur tant qu'on ne l'a pas écrit soi-même. Sans cela,
	 * changer de fournisseur laisserait le nom de modèle du précédent dans le champ — une valeur
	 * qu'aucun des deux ne connaît, et un refus incompréhensible au premier appel.
	 */
	let modeleTouche = $state(false);
	const modeleAffiche = $derived(modeleTouche ? modele : ai.model || (choisi?.defaultModel ?? ''));

	$effect(() => {
		if (!ai.loading) fournisseur = ai.provider;
	});

	async function enregistrer(event: SubmitEvent) {
		event.preventDefault();

		busy = true;
		erreur = '';
		enregistre = false;

		const ok = await ai.save(fournisseur, cle, modeleTouche ? modele : '');
		busy = false;

		if (!ok) {
			erreur = ai.error ?? t('ai.saveFailed');
			return;
		}

		// La clé quitte l'écran dès qu'elle est enregistrée : elle n'a plus rien à faire dans un
		// champ, et le formulaire ne sert plus qu'à la remplacer.
		cle = '';
		enregistre = true;
		feedback.play('success');
	}

	async function retirer() {
		busy = true;
		erreur = '';

		const ok = await ai.clear();
		busy = false;

		if (!ok) {
			erreur = ai.error ?? t('ai.saveFailed');
			return;
		}

		cle = '';
		modele = '';
		modeleTouche = false;
		enregistre = false;
		feedback.play('remove');
	}
</script>

<!--
	La clé d'IA de la personne, et rien qu'à elle.

	Cet écran est le seul endroit de l'application d'où part un appel vers un tiers, et c'est
	pourquoi il dit ce qui part avant de proposer quoi que ce soit. Le dépôt a refusé le géocodage
	pour ne pas faire sortir une adresse ; ici on fait sortir quelque chose, donc on l'écrit.

	Ce qui n'est volontairement pas proposé : une clé fournie par l'hébergeur. Il n'y en a pas. Sans
	clé posée ici, la suggestion de recette n'apparaît nulle part — elle ne promet rien.
-->
<svelte:head>
	<title>{t('ai.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('ai.title')}</h1>
<p class="text-muted-foreground mt-1">{t('ai.subtitle')}</p>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			<TriangleAlert size={22} aria-hidden="true" />
			{t('ai.privacyTitle')}
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3">
		<p class="text-label">{t('ai.privacyBody')}</p>
		<ul class="text-muted-foreground text-label list-disc space-y-1 ps-5">
			<li>{t('ai.privacySent')}</li>
			<li>{t('ai.privacyNotSent')}</li>
			<li>{t('ai.privacyBill')}</li>
			<li>{t('ai.privacyTerms')}</li>
		</ul>
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			<KeyRound size={22} aria-hidden="true" />
			{t('ai.keyTitle')}
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		{#if ai.loading}
			<p class="text-muted-foreground text-label" role="status" data-test-id="ai-loading">
				{t('common.loading')}
			</p>
		{:else}
			<p
				class="text-label"
				role="status"
				data-test-id="ai-state"
				data-test-state={ai.configured ? 'on' : 'off'}
			>
				{ai.configured ? t('ai.stateOn') : t('ai.stateOff')}
			</p>

			<form onsubmit={enregistrer} class="space-y-4" data-test-id="ai-form">
				<div>
					<Label for="ai-provider">{t('ai.provider')}</Label>
					<!--
						Une liste déroulante native : elle est courte, elle n'a besoin d'aucun ornement, et
						c'est le seul contrôle dont le lecteur d'écran et le clavier physique connaissent
						déjà le fonctionnement sans qu'on ait à le réécrire.
					-->
					<select
						id="ai-provider"
						bind:value={fournisseur}
						data-test-id="ai-provider"
						class="border-input bg-background focus-visible:ring-ring text-label min-h-[max(2.75rem,44px)]
							w-full rounded-lg border px-3 focus-visible:ring-2 focus-visible:outline-none"
					>
						{#each PROVIDERS as provider (provider.id)}
							<option value={provider.id}>{t(`ai.providers.${provider.id}`)}</option>
						{/each}
					</select>
					<p class="text-muted-foreground text-caption mt-2">{t('ai.providerHint')}</p>
				</div>

				{#if choisi}
					<p class="text-caption">
						<a
							href={choisi.keysUrl}
							target="_blank"
							rel="noreferrer noopener"
							class="text-primary inline-flex items-center gap-1 underline"
							data-test-id="ai-keys-link"
						>
							{t('ai.whereKey', { provider: t(`ai.providers.${choisi.id}`) })}
							<ExternalLink size={14} aria-hidden="true" />
						</a>
					</p>
				{/if}

				<div>
					<Label for="ai-key">{t('ai.key')}</Label>
					<!--
						`type="password"` et non un champ à révéler : contrairement à un mot de passe, une
						clé d'API se colle depuis un gestionnaire et ne se relit jamais. La montrer
						n'aiderait personne et la laisserait sur l'écran d'un téléphone posé sur la table.
					-->
					<IconField icon={KeyRound}>
						<Input
							id="ai-key"
							type="password"
							bind:value={cle}
							autocomplete="off"
							spellcheck="false"
							aria-describedby="ai-key-hint"
							data-test-id="ai-key"
							placeholder={ai.configured ? t('ai.keyPlaceholderSet') : t('ai.keyPlaceholder')}
						/>
					</IconField>
					<p id="ai-key-hint" class="text-muted-foreground text-caption mt-2">
						{t('ai.keyHint')}
					</p>
				</div>

				<div>
					<Label for="ai-model">{t('ai.model')}</Label>
					<IconField icon={Cpu}>
						<Input
							id="ai-model"
							value={modeleAffiche}
							oninput={event => {
								modeleTouche = true;
								modele = event.currentTarget.value;
							}}
							autocomplete="off"
							spellcheck="false"
							aria-describedby="ai-model-hint"
							data-test-id="ai-model"
						/>
					</IconField>
					<p id="ai-model-hint" class="text-muted-foreground text-caption mt-2">
						{t('ai.modelHint')}
					</p>
				</div>

				{#if erreur}
					<p class="text-destructive text-label" role="alert" data-test-id="ai-error">{erreur}</p>
				{/if}

				{#if enregistre}
					<p
						class="text-secondary text-label flex items-center gap-2"
						role="status"
						data-test-id="ai-saved"
					>
						<Check size={18} aria-hidden="true" />
						{t('ai.saved')}
					</p>
				{/if}

				<div class="flex flex-wrap gap-2">
					<Button
						type="submit"
						class="fl-press"
						disabled={busy || cle.trim() === ''}
						data-test-id="ai-save"
					>
						{busy ? t('common.loading') : t('ai.save')}
					</Button>

					{#if ai.configured}
						<Button variant="outline" disabled={busy} onclick={retirer} data-test-id="ai-clear">
							{t('ai.clear')}
						</Button>
					{/if}
				</div>
			</form>
		{/if}
	</Card.Content>
</Card.Root>
