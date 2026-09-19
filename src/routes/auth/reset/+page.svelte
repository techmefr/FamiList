<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$db/supabase';
	import { session } from '$stores/session.svelte';
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import * as Card from '$components/ui/card';
	import Logo from '$components/app/Logo.svelte';
	import IconField from '$components/app/IconField.svelte';
	import { Lock, Eye, EyeOff, TriangleAlert, CheckCircle2 } from '@lucide/svelte';

	/**
	 * Three states, not two: the link may be invalid before we even know it, since Supabase reports an
	 * expired or already-used link as an error in the URL fragment rather than as a normal session.
	 */
	let status = $state<'checking' | 'ready' | 'invalid' | 'done'>('checking');

	let password = $state('');
	let reveal = $state(false);
	let busy = $state(false);

	/**
	 * The recovery link is consumed once, by `detectSessionInUrl` at client creation, well before this
	 * component exists. So we do not parse the fragment ourselves — we ask the client what came of it: a
	 * session means the link worked, its absence means it did not.
	 */
	onMount(async () => {
		const params = new URLSearchParams(location.hash.replace(/^#/, ''));
		if (params.get('error')) {
			status = 'invalid';
			return;
		}

		const { data } = await supabase.auth.getSession();
		status = data.session ? 'ready' : 'invalid';
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;

		const ok = await session.completePasswordReset(password);
		busy = false;

		if (!ok) return;

		status = 'done';
	}
</script>

<svelte:head>
	<title>{t('auth.resetTitle')} — {t('app.name')}</title>
</svelte:head>

<p class="text-h2 text-primary flex items-center justify-center gap-2.5 font-semibold">
	<Logo />
	{t('app.name')}
</p>

{#if status === 'checking'}
	<p class="text-muted-foreground mt-8 text-center">{t('common.loading')}</p>
{:else if status === 'invalid'}
	<Card.Root class="fl-pop-in mt-8">
		<Card.Content class="flex gap-3">
			<TriangleAlert class="text-destructive mt-0.5 shrink-0" size={22} aria-hidden="true" />
			<div class="space-y-2">
				<p class="text-product font-medium">{t('auth.resetInvalidTitle')}</p>
				<p class="text-muted-foreground">{t('auth.resetInvalidBody')}</p>
			</div>
		</Card.Content>
	</Card.Root>

	<Button
		variant="outline"
		class="mt-4 w-full"
		onclick={() => goto('/auth')}
		data-test-id="reset-back-to-auth"
	>
		{t('auth.backToSignIn')}
	</Button>
{:else if status === 'done'}
	<Card.Root class="fl-pop-in mt-8">
		<Card.Content class="flex gap-3">
			<CheckCircle2 class="text-primary mt-0.5 shrink-0" size={22} aria-hidden="true" />
			<div class="space-y-2">
				<p class="text-product font-medium">{t('auth.resetDoneTitle')}</p>
				<p class="text-muted-foreground">{t('auth.resetDoneBody')}</p>
			</div>
		</Card.Content>
	</Card.Root>

	<Button class="fl-press mt-4 w-full" onclick={() => goto('/auth')} data-test-id="reset-continue">
		{t('auth.backToSignIn')}
	</Button>
{:else}
	<h1 class="text-h1 mt-8 text-center font-semibold">{t('auth.resetTitle')}</h1>
	<p class="text-muted-foreground mt-2 text-center text-balance">{t('auth.resetBody')}</p>

	<form
		onsubmit={submit}
		class="bg-card shadow-fl-1 mt-4 space-y-5 rounded-xl border p-5"
		data-test-id="reset-form"
	>
		<div>
			<Label for="reset-password">{t('auth.resetNewPassword')}</Label>
			<IconField icon={Lock}>
				<Input
					id="reset-password"
					type={reveal ? 'text' : 'password'}
					bind:value={password}
					data-test-id="reset-password"
					autocomplete="new-password"
					minlength={8}
					aria-describedby="reset-password-hint"
					required
				/>

				{#snippet action()}
					<button
						type="button"
						onclick={() => (reveal = !reveal)}
						aria-pressed={reveal}
						aria-label={t('auth.showPassword')}
						data-test-id="reset-reveal"
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

			<p id="reset-password-hint" class="text-muted-foreground text-caption mt-2">
				{t('auth.passwordHint')}
			</p>
		</div>

		{#if session.error}
			<p class="text-destructive text-label" role="alert" data-test-id="reset-error">
				{session.error}
			</p>
		{/if}

		<Button type="submit" disabled={busy} data-test-id="reset-submit" class="fl-press w-full">
			{busy ? t('common.loading') : t('auth.resetSubmit')}
		</Button>
	</form>
{/if}
