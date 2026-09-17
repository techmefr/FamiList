<script lang="ts">
	import { i18n, t, LOCALES } from '$lib/i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { recipePrompt, shoppedProducts, type SuggestedRecipe } from '$domain/ai-recipe';
	import { DEFAULT_SERVINGS, MAX_SERVINGS, MIN_SERVINGS } from '$domain/recipe';
	import { unitKey } from '$domain/units';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import IconField from '$components/app/IconField.svelte';
	import { Sparkles, Users, Send, RotateCcw, Check } from '@lucide/svelte';

	let ouvert = $state(false);
	let convives = $state(DEFAULT_SERVINGS);
	let busy = $state(false);
	let erreur = $state('');
	let proposition = $state<SuggestedRecipe | null>(null);
	let enregistree = $state(false);

	const langue = $derived(LOCALES.find(l => l.code === i18n.locale)?.native ?? 'français');

	/**
	 * Les produits déjà achetés, tels qu'ils partiront. Ce tableau est calculé une seule fois et
	 * sert aux deux usages : la liste montrée avant l'envoi et la consigne envoyée. C'est la seule
	 * façon d'être sûr que ce qui est affiché est ce qui part — deux calculs séparés finiraient par
	 * diverger à la première modification.
	 */
	const produits = $derived(shoppedProducts(data.items));
	const consigne = $derived(recipePrompt(produits, { language: langue, servings: convives }));

	function basculer() {
		ouvert = !ouvert;
		if (!ouvert) reinitialiser();
	}

	function reinitialiser() {
		proposition = null;
		erreur = '';
		enregistree = false;
	}

	async function demander() {
		busy = true;
		reinitialiser();

		const issue = await ai.suggestRecipe(consigne);
		busy = false;

		if (!issue.ok) {
			erreur = issue.detail
				? t(`ai.error.${issue.reason}Detail`, { detail: issue.detail })
				: t(`ai.error.${issue.reason}`);
			return;
		}

		proposition = issue.recipe;
		feedback.play('success');
	}

	/**
	 * La proposition devient une vraie recette du foyer, dans le modèle qui existe déjà : elle se
	 * relit, se modifie, et surtout `generateList` en tire une liste de courses. Une réponse
	 * affichée en texte n'aurait donné aucun de ces trois gestes.
	 *
	 * Elle n'est écrite que sur ce clic : rien n'entre dans le foyer sans que quelqu'un l'ait relu.
	 */
	function accepter() {
		if (!proposition) return;

		feedback.play('add');
		data.addRecipe({
			name: proposition.name,
			emoji: proposition.emoji,
			servings: proposition.servings,
			ingredients: proposition.ingredients,
			steps: proposition.steps
		});

		enregistree = true;
		proposition = null;
	}
</script>

<!--
	Une idée de recette à partir de ce que le foyer a déjà acheté.

	Le bouton n'existe pas tant qu'aucune clé n'est posée : cette fonctionnalité passe par un tiers
	payé par la personne, et l'annoncer sans pouvoir la rendre serait une promesse creuse.

	Rien ne part au dépliage. On montre d'abord la liste exacte des produits concernés, puis le
	texte complet de la demande, et c'est un second geste qui envoie. L'ordre compte : un écran qui
	enverrait d'abord et expliquerait ensuite ne laisserait pas le choix de refuser.
-->
{#if ai.configured}
	<div class="mt-4" data-test-id="ai-suggest-block">
		<Button variant="outline" onclick={basculer} data-test-id="ai-suggest-open">
			<Sparkles size={18} aria-hidden="true" />
			{t('ai.suggest')}
		</Button>

		{#if ouvert}
			<Card.Root class="mt-4">
				<Card.Header>
					<Card.Title class="text-h2">{t('ai.suggestTitle')}</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if produits.length === 0}
						<p class="text-muted-foreground text-label" data-test-id="ai-no-products">
							{t('ai.noProducts')}
						</p>
					{:else}
						<div>
							<h3 class="text-label font-semibold">
								{t('ai.willSend', { count: produits.length })}
							</h3>
							<p class="text-muted-foreground text-caption mt-1">{t('ai.willSendHint')}</p>

							<!--
								La liste est montrée en entier, pas résumée en « 40 produits » : consentir à
								un nombre n'est pas consentir à son contenu, et c'est le contenu qui part.
							-->
							<ul class="mt-2 flex flex-wrap gap-1.5" data-test-id="ai-products">
								{#each produits as produit (produit)}
									<li class="bg-muted text-caption rounded-full px-2.5 py-1">{produit}</li>
								{/each}
							</ul>
						</div>

						<div>
							<Label for="ai-servings">{t('recipes.people')}</Label>
							<IconField icon={Users}>
								<Input
									id="ai-servings"
									type="number"
									bind:value={convives}
									min={MIN_SERVINGS}
									max={MAX_SERVINGS}
									data-test-id="ai-servings"
								/>
							</IconField>
						</div>

						<details class="text-caption">
							<summary class="cursor-pointer underline" data-test-id="ai-prompt-toggle">
								{t('ai.seeExact')}
							</summary>
							<pre
								class="bg-muted mt-2 overflow-x-auto rounded-md p-3 whitespace-pre-wrap"
								data-test-id="ai-prompt">{consigne}</pre>
						</details>

						<p class="text-muted-foreground text-caption">
							{t('ai.sendingTo', { provider: t(`ai.providers.${ai.provider}`) })}
						</p>

						<Button
							class="fl-press"
							disabled={busy}
							onclick={demander}
							data-test-id="ai-suggest-send"
						>
							<Send size={18} aria-hidden="true" />
							{busy ? t('ai.asking') : t('ai.sendConfirm')}
						</Button>
					{/if}

					{#if erreur}
						<p class="text-destructive text-label" role="alert" data-test-id="ai-suggest-error">
							{erreur}
						</p>
					{/if}

					{#if enregistree}
						<p
							class="text-secondary text-label flex items-center gap-2"
							role="status"
							data-test-id="ai-suggest-added"
						>
							<Check size={18} aria-hidden="true" />
							{t('ai.added')}
						</p>
					{/if}

					{#if proposition}
						<!--
							La relecture avant écriture. La proposition vient d'un tiers : elle peut être
							fausse, inutilisable, ou simplement sans intérêt, et rien ne doit entrer dans les
							recettes du foyer sans qu'un humain l'ait vue en entier.
						-->
						<div class="rounded-lg border p-4" data-test-id="ai-proposal">
							<h3 class="text-h2 font-semibold">
								<span aria-hidden="true">{proposition.emoji}</span>
								{proposition.name}
							</h3>
							<p class="text-muted-foreground text-caption mt-1">
								{t('recipes.servingsCount', { count: proposition.servings })}
							</p>

							<h4 class="text-label mt-3 font-semibold">{t('recipes.step.ingredients')}</h4>
							<ul class="text-label mt-1 list-disc space-y-0.5 ps-5">
								{#each proposition.ingredients as ligne, index (index)}
									<li>
										{ligne.name}
										{#if ligne.qty}
											— {ligne.qty}
											{t(unitKey(ligne.unit) ?? 'units.piece')}
										{/if}
									</li>
								{/each}
							</ul>

							{#if proposition.steps.some(Boolean)}
								<h4 class="text-label mt-3 font-semibold">{t('recipes.step.etapes')}</h4>
								<ol class="text-label mt-1 list-decimal space-y-0.5 ps-5">
									{#each proposition.steps.filter(Boolean) as etape, index (index)}
										<li>{etape}</li>
									{/each}
								</ol>
							{/if}

							<div class="mt-4 flex flex-wrap gap-2">
								<Button class="fl-press" onclick={accepter} data-test-id="ai-proposal-accept">
									{t('ai.keep')}
								</Button>
								<Button variant="outline" onclick={demander} disabled={busy} data-test-id="ai-proposal-retry">
									<RotateCcw size={18} aria-hidden="true" />
									{t('ai.retry')}
								</Button>
								<Button variant="outline" onclick={reinitialiser} data-test-id="ai-proposal-discard">
									{t('ai.discard')}
								</Button>
							</div>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}
	</div>
{/if}
