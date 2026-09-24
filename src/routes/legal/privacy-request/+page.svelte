<script lang="ts">
	import { supabase } from '$db/supabase';
	import { session } from '$stores/session.svelte';
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { legalPath } from '$domain/legal';
	import {
		PRIVACY_MESSAGE_MAX,
		PRIVACY_REQUEST_KINDS,
		readPrivacyRequestOutcome,
		validatePrivacyRequest,
		type PrivacyRequestKind
	} from '$domain/privacy-request';

	let email = $state('');
	let kind = $state<PrivacyRequestKind>('access');
	let message = $state('');
	let confirmed = $state(false);
	let busy = $state(false);
	let sent = $state(false);
	let errorText = $state('');
	let emailTouched = false;

	$effect(() => {
		const accountEmail = session.user?.email;
		if (accountEmail && !emailTouched && email === '') email = accountEmail;
	});

	async function send(event: SubmitEvent) {
		event.preventDefault();
		errorText = '';

		const invalid = validatePrivacyRequest({ email, kind, message, confirmed });
		if (invalid) {
			errorText = t(invalid);
			return;
		}

		busy = true;
		const { data, error } = await supabase.rpc('submit_privacy_request', {
			email: email.trim(),
			kind,
			message: message.trim()
		});
		busy = false;

		const outcome = error ? 'legal.request.errorUnknown' : readPrivacyRequestOutcome(data);
		if (outcome) {
			errorText = t(outcome);
			return;
		}

		sent = true;
	}
</script>

<svelte:head>
	<title>{t('legal.request.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('legal.request.title')}</h1>
<p class="text-muted-foreground mt-2">{t('legal.request.intro')}</p>
<p class="text-muted-foreground text-label mt-2" data-test-id="privacy-request-deadline">
	{t('legal.request.deadline')}
</p>

{#if sent}
	<p class="text-primary mt-6" role="status" data-test-id="privacy-request-success">
		{t('legal.request.success')}
	</p>
{:else}
	<form onsubmit={send} class="mt-6 space-y-4" novalidate data-test-id="privacy-request-form">
		<div>
			<Label for="privacy-email">{t('legal.request.email')}</Label>
			<Input
				id="privacy-email"
				type="email"
				autocomplete="email"
				bind:value={email}
				oninput={() => (emailTouched = true)}
				required
				data-test-id="privacy-request-email"
			/>
		</div>

		<div>
			<Label for="privacy-kind">{t('legal.request.kind')}</Label>
			<select
				id="privacy-kind"
				bind:value={kind}
				data-test-id="privacy-request-kind"
				class="border-input bg-background h-11 w-full rounded-md border px-2"
			>
				{#each PRIVACY_REQUEST_KINDS as value (value)}
					<option {value}>{t(`legal.request.kinds.${value}`)}</option>
				{/each}
			</select>
		</div>

		<div>
			<Label for="privacy-message">{t('legal.request.message')}</Label>
			<textarea
				id="privacy-message"
				bind:value={message}
				rows="6"
				maxlength={PRIVACY_MESSAGE_MAX}
				required
				data-test-id="privacy-request-message"
				class="border-input bg-background w-full rounded-md border p-2"
			></textarea>
		</div>

		<div class="flex items-start gap-3">
			<input
				id="privacy-confirm"
				type="checkbox"
				bind:checked={confirmed}
				required
				data-test-id="privacy-request-confirm"
				class="accent-primary mt-1 size-5 shrink-0"
			/>
			<Label for="privacy-confirm" class="text-label font-normal">{t('legal.request.confirm')}</Label>
		</div>

		{#if errorText}
			<p class="text-destructive" role="alert" data-test-id="privacy-request-error">{errorText}</p>
		{/if}

		<Button type="submit" disabled={busy} data-test-id="privacy-request-submit" class="fl-press">
			{busy ? t('common.loading') : t('legal.request.submit')}
		</Button>
	</form>
{/if}

<p class="mt-8">
	<a href={legalPath('privacy')} class="text-primary text-label hover:underline" data-test-id="privacy-request-policy">
		{t('legal.privacy')}
	</a>
</p>
