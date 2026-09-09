<script lang="ts">
	import { goto } from '$app/navigation';
	import { session } from '$stores/session.svelte';
	import { enabledProviders, type ProviderId } from '$domain/oauth';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { CheckCircle2, User, Mail, Lock, Eye, EyeOff, KeyRound } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';
	import CodeField from '$components/app/CodeField.svelte';
	import { isCompleteOtp, normalizeOtp } from '$domain/otp';

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

	/**
	 * Le chemin sans mot de passe.
	 *
	 * Un mot de passe de plus est un mot de passe de plus à retenir, et c'est celui-là qu'on oublie
	 * — l'application ne s'ouvre pas tous les jours. Le code reçu par courriel évite la question
	 * entière, et le même envoi porte aussi un lien : cliquer marche, recopier les six chiffres
	 * marche, on ne demande pas laquelle des deux méthodes la personne préfère.
	 *
	 * Réservé à la connexion : pour créer un compte il faut un nom, et une adresse mal tapée
	 * fabriquerait un compte fantôme à trier.
	 */
	let sansMotDePasse = $state(false);
	let codeEnvoye = $state(false);
	let code = $state('');

	const providers = enabledProviders();

	const MODES = ['signin', 'signup'] as const;

	async function envoyerCode(event: SubmitEvent) {
		event.preventDefault();
		busy = true;

		const ok = await session.sendEmailCode(email);
		busy = false;

		if (ok) codeEnvoye = true;
	}

	async function validerCode(event: SubmitEvent) {
		event.preventDefault();
		busy = true;

		const ok = await session.verifyEmailCode(email, code);
		busy = false;

		if (!ok) {
			code = '';
			return;
		}

		goto('/');
	}

	/** Créer un compte demande un nom : le chemin sans mot de passe n'y mène pas. */
	function revenirAuMotDePasse() {
		sansMotDePasse = false;
		codeEnvoye = false;
		code = '';
	}

	function basculer() {
		sansMotDePasse = !sansMotDePasse;
		codeEnvoye = false;
		code = '';
		session.error = null;
	}

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
					onchange={() => {
						mode = value;
						if (value === 'signup') revenirAuMotDePasse();
					}}
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

	{#if sansMotDePasse}
		<form
			onsubmit={codeEnvoye ? validerCode : envoyerCode}
			class="bg-card shadow-fl-1 mt-4 space-y-5 rounded-xl border p-5"
			data-test-id="auth-code-form"
		>
			<div>
				<Label for="auth-otp-email">{t('auth.email')}</Label>
				<IconField icon={Mail}>
					<Input
						id="auth-otp-email"
						type="email"
						bind:value={email}
						data-test-id="auth-otp-email"
						autocomplete="email"
						readonly={codeEnvoye}
						required
						placeholder={t('auth.emailPlaceholder')}
					/>
				</IconField>
			</div>

			{#if codeEnvoye}
				<p class="text-muted-foreground text-label" data-test-id="auth-code-sent">
					{t('auth.codeSent', { email })}
				</p>

				<div>
					<CodeField
						id="auth-otp"
						label={t('auth.code')}
						hint={t('auth.codeHint')}
						bind:value={code}
						normalize={normalizeOtp}
						length={6}
						testId="auth-otp"
					/>
				</div>
			{/if}

			{#if session.error}
				<p class="text-destructive text-label" role="alert" data-test-id="auth-error">
					{session.error}
				</p>
			{/if}

			<Button
				type="submit"
				disabled={busy || (codeEnvoye && !isCompleteOtp(code))}
				data-test-id="auth-code-submit"
				class="fl-press w-full"
			>
				{busy ? t('common.loading') : codeEnvoye ? t('auth.verify') : t('auth.sendCode')}
			</Button>

			{#if codeEnvoye}
				<Button
					variant="ghost"
					class="w-full"
					disabled={busy}
					onclick={() => (codeEnvoye = false)}
					data-test-id="auth-code-again"
				>
					{t('auth.resend')}
				</Button>
			{/if}
		</form>

		<Button variant="ghost" class="mt-2 w-full" onclick={basculer} data-test-id="auth-use-password">
			<Lock size={18} aria-hidden="true" />
			{t('auth.usePassword')}
		</Button>
	{:else}
	<form
		onsubmit={submit}
		class="bg-card shadow-fl-1 mt-4 space-y-5 rounded-xl border p-5"
		data-test-id="auth-form"
	>
		{#if mode === 'signup'}
			<div>
				<Label for="auth-name">{t('auth.displayName')}</Label>
				<IconField icon={User}>
					<Input
						id="auth-name"
						bind:value={displayName}
						data-test-id="auth-name"
						required
						placeholder={t('auth.namePlaceholder')}
					/>
				</IconField>
			</div>
		{/if}

		<div>
			<Label for="auth-email">{t('auth.email')}</Label>
			<IconField icon={Mail}>
				<Input
					id="auth-email"
					type="email"
					bind:value={email}
					data-test-id="auth-email"
					autocomplete="email"
					required
					placeholder={t('auth.emailPlaceholder')}
				/>
			</IconField>
		</div>

		<div>
			<Label for="auth-password">{t('auth.password')}</Label>
			<!--
				Le type change, pas le champ : réécrire l'élément lui ferait perdre le focus et le
				curseur en plein milieu d'une saisie.
			-->
			<IconField icon={Lock}>
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

				{#snippet action()}
					<!--
						Un bouton bascule, pas une case : `aria-pressed` dit l'état, et le libellé ne
						change pas sous le curseur du lecteur d'écran. `tabindex={-1}` serait plus
						reposant à la tabulation, mais priverait du geste ceux qui n'ont que le clavier.
					-->
					<button
						type="button"
						onclick={() => (reveal = !reveal)}
						aria-pressed={reveal}
						aria-label={t('auth.showPassword')}
						data-test-id="auth-reveal"
						class="text-muted-foreground hover:text-foreground focus-visible:ring-ring
							aria-pressed:text-primary flex size-11 items-center justify-center
							rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-inset
							focus-visible:outline-none"
					>
						{#if reveal}
							<EyeOff size={18} aria-hidden="true" />
						{:else}
							<Eye size={18} aria-hidden="true" />
						{/if}
					</button>
				{/snippet}
			</IconField>

			{#if mode === 'signup'}
				<p id="auth-password-hint" class="text-muted-foreground text-caption mt-2">
					{t('auth.passwordHint')}
				</p>
			{/if}
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

		{#if mode === 'signin'}
			<Button
				variant="ghost"
				class="mt-2 w-full"
				onclick={basculer}
				data-test-id="auth-passwordless"
			>
				<KeyRound size={18} aria-hidden="true" />
				{t('auth.passwordless')}
			</Button>
		{/if}
	{/if}
{/if}
