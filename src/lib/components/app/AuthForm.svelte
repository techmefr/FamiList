<script lang="ts">
	import { goto } from '$app/navigation';
	import { session } from '$stores/session.svelte';
	import { enabledProviders, type ProviderId } from '$domain/oauth';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { CheckCircle2 } from '@lucide/svelte';

	/**
	 * Le même bloc sert à l'écran de connexion et à la dernière étape de l'accueil. Là-bas on arrive
	 * pour créer un compte, ici pour en retrouver un.
	 *
	 * Le mode est `$bindable` pour que la page qui l'accueille puisse titrer juste : sans ça, le
	 * titre annonçait « Connexion » alors qu'on remplissait un formulaire d'inscription. L'accueil,
	 * lui, passe la valeur sans la lier — il a son propre titre et n'a rien à en faire.
	 */
	let { mode = $bindable<'signin' | 'signup'>('signin') }: { mode?: 'signin' | 'signup' } =
		$props();

	let email = $state('');
	let password = $state('');
	let displayName = $state('');
	let reveal = $state(false);
	let busy = $state(false);
	let signedUp = $state(false);

	const providers = enabledProviders();

	const MODES = ['signin', 'signup'] as const;

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

	/*
	 * Un segment est un bouton radio déguisé, et non deux boutons : le clavier y circule aux
	 * flèches, la sélection est annoncée comme un choix parmi deux, et le bouton d'envoi reste le
	 * seul élément plein de l'écran. Avec deux boutons pleins, on ne savait plus lequel validait.
	 */
	const segmentClass =
		'has-checked:bg-card has-checked:text-primary has-checked:shadow-fl-1 ' +
		'flex min-h-[max(2.5rem,40px)] cursor-pointer items-center justify-center rounded-md ' +
		'px-3 text-center font-medium transition-colors';
</script>

{#if signedUp}
	<Card.Root class="fl-pop-in mt-6">
		<Card.Content class="flex gap-3">
			<CheckCircle2 class="text-primary mt-0.5 shrink-0" size={22} aria-hidden="true" />
			<div class="space-y-2">
				<p class="text-product font-medium">{t('auth.signedUpTitle')}</p>
				<p class="text-muted-foreground">{t('auth.signedUpBody')}</p>
			</div>
		</Card.Content>
	</Card.Root>
{:else}
	<fieldset
		class="border-input mt-6 grid grid-cols-2 gap-1 rounded-lg border bg-[var(--muted)]/60 p-1"
		data-test-id="auth-mode"
	>
		<legend class="sr-only">{t('auth.mode')}</legend>
		{#each MODES as value (value)}
			<Label class={segmentClass}>
				<input
					type="radio"
					name="auth-mode"
					class="sr-only"
					checked={mode === value}
					onchange={() => (mode = value)}
					data-test-id="mode-{value}"
				/>
				{t(value === 'signin' ? 'auth.signIn' : 'auth.signUp')}
			</Label>
		{/each}
	</fieldset>

	{#if providers.length > 0}
		<div class="mt-4 flex flex-wrap gap-2" data-test-id="auth-providers">
			{#each providers as provider (provider.id)}
				<Button
					variant="outline"
					class="fl-press flex-auto basis-[10rem]"
					disabled={busy}
					onclick={() => continueWith(provider.id)}
					data-test-id="auth-provider-{provider.id}"
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

	<form
		onsubmit={submit}
		class="bg-card shadow-fl-1 mt-4 space-y-5 rounded-xl border p-5"
		data-test-id="auth-form"
	>
		{#if mode === 'signup'}
			<div>
				<Label for="auth-name">{t('auth.displayName')}</Label>
				<Input id="auth-name" bind:value={displayName} data-test-id="auth-name" required />
			</div>
		{/if}

		<div>
			<Label for="auth-email">{t('auth.email')}</Label>
			<Input
				id="auth-email"
				type="email"
				bind:value={email}
				data-test-id="auth-email"
				autocomplete="email"
				required
			/>
		</div>

		<div>
			<Label for="auth-password">{t('auth.password')}</Label>
			<!--
				Le type change, pas le champ : réécrire l'élément lui ferait perdre le focus et le
				curseur en plein milieu d'une saisie.
			-->
			<Input
				id="auth-password"
				type={reveal ? 'text' : 'password'}
				bind:value={password}
				data-test-id="auth-password"
				autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
				minlength={8}
				aria-describedby={mode === 'signup' ? 'auth-password-hint' : undefined}
				required
			/>

			{#if mode === 'signup'}
				<p id="auth-password-hint" class="text-muted-foreground text-caption mt-2">
					{t('auth.passwordHint')}
				</p>
			{/if}

			<!--
				Voir ce qu'on tape n'est pas un luxe quand le mot de passe fait huit caractères et que
				l'écran est petit. Une case et non un œil posé dans le champ : le libellé dit ce qui se
				passe, et rien n'a besoin d'être positionné par-dessus la saisie.
			-->
			<Label class="mt-3 gap-2.5 font-normal">
				<input type="checkbox" bind:checked={reveal} data-test-id="auth-reveal" />
				{t('auth.showPassword')}
			</Label>
		</div>

		{#if session.error}
			<p class="text-destructive text-label" role="alert" data-test-id="auth-error">
				{session.error}
			</p>
		{/if}

		<Button type="submit" disabled={busy} data-test-id="auth-submit" class="fl-press w-full">
			{busy ? t('common.loading') : mode === 'signin' ? t('auth.signIn') : t('auth.signUp')}
		</Button>

		{#if mode === 'signup'}
			<p class="text-muted-foreground text-caption">{t('auth.approvalNotice')}</p>
		{/if}
	</form>
{/if}
