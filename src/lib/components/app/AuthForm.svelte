<script lang="ts">
	import { goto } from '$app/navigation';
	import { session } from '$stores/session.svelte';
	import { enabledProviders, type ProviderId } from '$domain/oauth';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';

	/**
	 * Le même bloc sert à l'écran de connexion et à la dernière étape de l'accueil. Là-bas on arrive
	 * pour créer un compte, ici pour en retrouver un : seul le mode de départ change.
	 */
	let { initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' } = $props();

	// `chosen` reste nul tant que personne n'a touché aux deux onglets : le mode affiché est
	// alors celui demandé par l'appelant, sans en figer une copie.
	let chosen = $state<'signin' | 'signup' | null>(null);
	const mode = $derived(chosen ?? initialMode);
	let email = $state('');
	let password = $state('');
	let displayName = $state('');
	let busy = $state(false);
	let signedUp = $state(false);

	const providers = enabledProviders();

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;

		const ok =
			mode === 'signin'
				? await session.signIn(email, password)
				: await session.signUp(email, password, displayName);

		busy = false;
		if (!ok) return;

		if (mode === 'signup') signedUp = true;
		else goto('/');
	}

	// Pas de goto derriere : signInWithProvider quitte le site pour le fournisseur, et c'est lui qui
	// nous ramene. On garde busy a true pendant la redirection pour ne pas rendre les boutons
	// cliquables une seconde fois.
	async function continueWith(id: ProviderId) {
		busy = true;
		const ok = await session.signInWithProvider(id);
		if (!ok) busy = false;
	}
</script>

{#if signedUp}
	<Card.Root class="mt-6">
		<Card.Content class="space-y-3">
			<p class="text-product font-medium">{t('auth.signedUpTitle')}</p>
			<p class="text-muted-foreground">{t('auth.signedUpBody')}</p>
		</Card.Content>
	</Card.Root>
{:else}
	{#if providers.length > 0}
		<div class="mt-6 flex flex-wrap gap-2" data-test="auth-providers">
			{#each providers as provider (provider.id)}
				<Button
					variant="outline"
					class="flex-auto basis-[10rem]"
					disabled={busy}
					onclick={() => continueWith(provider.id)}
					data-test="auth-provider-{provider.id}"
				>
					{t('auth.continueWith', { provider: provider.label })}
				</Button>
			{/each}
		</div>

		<div class="text-muted-foreground text-caption mt-4 flex items-center gap-3">
			<span class="bg-border h-px flex-1"></span>
			{t('auth.orEmail')}
			<span class="bg-border h-px flex-1"></span>
		</div>
	{/if}

	<div class="flex gap-2 {providers.length > 0 ? 'mt-4' : 'mt-6'}">
		<Button
			variant={mode === 'signin' ? 'default' : 'outline'}
			onclick={() => (chosen = 'signin')}
			data-test="mode-signin"
		>
			{t('auth.signIn')}
		</Button>
		<Button
			variant={mode === 'signup' ? 'default' : 'outline'}
			onclick={() => (chosen = 'signup')}
			data-test="mode-signup"
		>
			{t('auth.signUp')}
		</Button>
	</div>

	<form onsubmit={submit} class="bg-card mt-4 space-y-4 rounded-md border p-4" data-test="auth-form">
		{#if mode === 'signup'}
			<div>
				<Label for="auth-name">{t('auth.displayName')}</Label>
				<Input id="auth-name" bind:value={displayName} data-test="auth-name" required />
			</div>
		{/if}

		<div>
			<Label for="auth-email">{t('auth.email')}</Label>
			<Input
				id="auth-email"
				type="email"
				bind:value={email}
				data-test="auth-email"
				autocomplete="email"
				required
			/>
		</div>

		<div>
			<Label for="auth-password">{t('auth.password')}</Label>
			<Input
				id="auth-password"
				type="password"
				bind:value={password}
				data-test="auth-password"
				autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
				minlength={8}
				required
			/>
		</div>

		{#if session.error}
			<p class="text-destructive text-label" role="alert" data-test="auth-error">
				{session.error}
			</p>
		{/if}

		<Button type="submit" disabled={busy} data-test="auth-submit" class="w-full">
			{busy ? t('common.loading') : mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
		</Button>

		{#if mode === 'signup'}
			<p class="text-muted-foreground text-caption">{t('auth.approvalNotice')}</p>
		{/if}
	</form>
{/if}
