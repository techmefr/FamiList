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
	 * The same block serves the sign-in screen and the last step of the welcome. There you arrive to create
	 * an account, here to find one again.
	 *
	 * The mode is `$bindable` so the page hosting it can title itself correctly: without that, the title
	 * announced "Sign in" while you were filling in a sign-up form. The welcome passes the value without
	 * binding it — it has its own title and has no use for it.
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
	 * The passwordless path.
	 *
	 * One more password is one more password to remember, and it is that one you forget — the application is
	 * not opened every day. The code received by email avoids the whole question, and the same message also
	 * carries a link: clicking works, copying the six digits works, we do not ask which of the two methods
	 * the person prefers.
	 *
	 * Limited to signing in: creating an account needs a name, and a mistyped address would make a ghost
	 * account to sort out.
	 */
	let withoutPassword = $state(false);
	let codeSent = $state(false);
	let code = $state('');

	const providers = enabledProviders();

	const MODES = ['signin', 'signup'] as const;

	async function sendCode(event: SubmitEvent) {
		event.preventDefault();
		busy = true;

		const ok = await session.sendEmailCode(email);
		busy = false;

		if (ok) codeSent = true;
	}

	async function submitCode(event: SubmitEvent) {
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

	/** Creating an account needs a name: the passwordless path does not lead there. */
	function backToPassword() {
		withoutPassword = false;
		codeSent = false;
		code = '';
	}

	function toggle() {
		withoutPassword = !withoutPassword;
		codeSent = false;
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

	// No goto behind: signInWithProvider leaves the site for the provider, and it is the provider that brings
	// us back. We keep busy at true during the redirect so as not to make the buttons clickable a second
	// time.
	async function continueWith(id: ProviderId) {
		busy = true;
		const ok = await session.signInWithProvider(id);
		if (!ok) busy = false;
	}

	/*
	 * A segment is a radio button in disguise, and not two buttons: the keyboard moves through it with the
	 * arrows, the selection is announced as a choice between two, and the submit button stays the only solid
	 * element on screen. With two solid buttons, you could no longer tell which one submitted.
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
						if (value === 'signup') backToPassword();
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

	{#if withoutPassword}
		<form
			onsubmit={codeSent ? submitCode : sendCode}
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
						readonly={codeSent}
						required
						placeholder={t('auth.emailPlaceholder')}
					/>
				</IconField>
			</div>

			{#if codeSent}
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
				disabled={busy || (codeSent && !isCompleteOtp(code))}
				data-test-id="auth-code-submit"
				class="fl-press w-full"
			>
				{busy ? t('common.loading') : codeSent ? t('auth.verify') : t('auth.sendCode')}
			</Button>

			{#if codeSent}
				<Button
					variant="ghost"
					class="w-full"
					disabled={busy}
					onclick={() => (codeSent = false)}
					data-test-id="auth-code-again"
				>
					{t('auth.resend')}
				</Button>
			{/if}
		</form>

		<Button variant="ghost" class="mt-2 w-full" onclick={toggle} data-test-id="auth-use-password">
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
				The type changes, not the field: rewriting the element would make it lose focus and the cursor in the
				middle of typing.
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
						A toggle button, not a checkbox: `aria-pressed` says the state, and the label does not change under
						the screen reader's cursor. `tabindex={-1}` would be more restful when tabbing, but would deprive
						keyboard-only users of the gesture.
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
				onclick={toggle}
				data-test-id="auth-passwordless"
			>
				<KeyRound size={18} aria-hidden="true" />
				{t('auth.passwordless')}
			</Button>
		{/if}
	{/if}
{/if}
