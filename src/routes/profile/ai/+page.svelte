<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { PROVIDERS, providerById } from '$domain/ai';
	import * as Card from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import IconField from '$components/app/IconField.svelte';
	import { KeyRound, Cpu, Check, ExternalLink, TriangleAlert, Trash2 } from '@lucide/svelte';

	/** Providers not yet saved for this account: the only ones the "add" form still offers. */
	const available = $derived(
		PROVIDERS.filter(p => !ai.credentials.some(c => c.provider === p.id))
	);

	let provider = $state(PROVIDERS[0]?.id ?? '');
	let key = $state('');
	let model = $state('');
	let busy = $state(false);
	let saved = $state(false);
	let error = $state('');

	const selected = $derived(providerById(provider));

	$effect(() => {
		if (!ai.loading && available.length > 0 && !available.some(p => p.id === provider)) {
			provider = available[0].id;
		}
	});

	async function save(event: SubmitEvent) {
		event.preventDefault();

		busy = true;
		error = '';
		saved = false;

		const ok = await ai.save(provider, key, model.trim());
		busy = false;

		if (!ok) {
			error = ai.error ?? t('ai.saveFailed');
			return;
		}

		// The key leaves the screen as soon as it is saved: it has no business in a field any more.
		key = '';
		model = '';
		saved = true;
		feedback.play('success');
	}

	async function remove(providerId: string) {
		busy = true;
		error = '';

		const ok = await ai.clear(providerId);
		busy = false;

		if (!ok) {
			error = ai.error ?? t('ai.saveFailed');
			return;
		}

		saved = false;
		feedback.play('remove');
	}

	async function activate(providerId: string) {
		busy = true;
		error = '';

		const ok = await ai.setActive(providerId);
		busy = false;

		if (!ok) error = ai.error ?? t('ai.saveFailed');
	}
</script>

<!--
	The person's AI keys, and theirs alone.

	This screen is the only place in the application from which a call leaves for a third party, and that is
	why it says what leaves before offering anything. The repository refused geocoding so as not to let an
	address out; here we do let something out, so we write it down.

	What is deliberately not offered: a key supplied by the host. There is none. With no key set here, the
	recipe suggestion appears nowhere — it promises nothing.
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

			{#if ai.credentials.length > 0}
				<ul class="space-y-2" data-test-id="ai-credential-list">
					{#each ai.credentials as credential (credential.provider)}
						<li
							class="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
							data-test-id="ai-credential-row"
							data-test-provider={credential.provider}
						>
							<div>
								<p class="text-label font-medium">{t(`ai.providers.${credential.provider}`)}</p>
								<p class="text-muted-foreground text-caption">
									{credential.model || providerById(credential.provider)?.defaultModel}
								</p>
							</div>
							<div class="flex items-center gap-2">
								{#if credential.isActive}
									<span
										class="text-secondary text-label flex items-center gap-1"
										data-test-id="ai-active-badge"
									>
										<Check size={16} aria-hidden="true" />
										{t('ai.active')}
									</span>
								{:else}
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={busy}
										onclick={() => activate(credential.provider)}
										data-test-id="ai-activate"
									>
										{t('ai.useThisOne')}
									</Button>
								{/if}
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={busy}
									onclick={() => remove(credential.provider)}
									data-test-id="ai-clear"
									aria-label={t('ai.clear')}
								>
									<Trash2 size={16} aria-hidden="true" />
								</Button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}

			{#if available.length > 0}
				<form onsubmit={save} class="space-y-4" data-test-id="ai-form">
					<div>
						<Label for="ai-provider">{t('ai.provider')}</Label>
						<!--
							A native dropdown: it is short, it needs no ornament, and it is the only control whose workings the
							screen reader and the physical keyboard already know without our having to rewrite them.
						-->
						<select
							id="ai-provider"
							bind:value={provider}
							data-test-id="ai-provider"
							class="border-input bg-background focus-visible:ring-ring text-label min-h-[max(2.75rem,44px)]
								w-full rounded-lg border px-3 focus-visible:ring-2 focus-visible:outline-none"
						>
							{#each available as candidate (candidate.id)}
								<option value={candidate.id}>{t(`ai.providers.${candidate.id}`)}</option>
							{/each}
						</select>
						<p class="text-muted-foreground text-caption mt-2">{t('ai.providerHint')}</p>
					</div>

					{#if selected}
						<p class="text-caption">
							<a
								href={selected.keysUrl}
								target="_blank"
								rel="noreferrer noopener"
								class="text-primary inline-flex items-center gap-1 underline"
								data-test-id="ai-keys-link"
							>
								{t('ai.whereKey', { provider: t(`ai.providers.${selected.id}`) })}
								<ExternalLink size={14} aria-hidden="true" />
							</a>
						</p>
					{/if}

					<div>
						<Label for="ai-key">{t('ai.key')}</Label>
						<!--
							`type="password"` and not a field to reveal: unlike a password, an API key is pasted from a manager
							and never read back. Showing it would help nobody and would leave it on the screen of a phone lying
							on the table.
						-->
						<IconField icon={KeyRound}>
							<Input
								id="ai-key"
								type="password"
								bind:value={key}
								autocomplete="off"
								spellcheck="false"
								aria-describedby="ai-key-hint"
								data-test-id="ai-key"
								placeholder={t('ai.keyPlaceholder')}
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
								bind:value={model}
								autocomplete="off"
								spellcheck="false"
								placeholder={selected?.defaultModel ?? ''}
								aria-describedby="ai-model-hint"
								data-test-id="ai-model"
							/>
						</IconField>
						<p id="ai-model-hint" class="text-muted-foreground text-caption mt-2">
							{t('ai.modelHint')}
						</p>
					</div>

					{#if error}
						<p class="text-destructive text-label" role="alert" data-test-id="ai-error">{error}</p>
					{/if}

					{#if saved}
						<p
							class="text-secondary text-label flex items-center gap-2"
							role="status"
							data-test-id="ai-saved"
						>
							<Check size={18} aria-hidden="true" />
							{t('ai.saved')}
						</p>
					{/if}

					<Button
						type="submit"
						class="fl-press"
						disabled={busy || key.trim() === ''}
						data-test-id="ai-save"
					>
						{busy ? t('common.loading') : t('ai.save')}
					</Button>
				</form>
			{/if}
		{/if}
	</Card.Content>
</Card.Root>
