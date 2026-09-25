<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { imageBanks } from '$stores/image-banks.svelte';
	import { placeCredentials } from '$stores/place-credentials.svelte';
	import { toasts } from '$stores/toast.svelte';
	import { IMAGE_BANKS, type ImageBankId } from '$domain/image-bank';
	import { PLACE_PROVIDERS, type PlaceProviderId } from '$domain/place-bank';
	import * as Card from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import IconField from '$components/app/IconField.svelte';
	import { Check, ExternalLink, Images, KeyRound, MapPin, Trash2, TriangleAlert } from '@lucide/svelte';

	let keys = $state<Record<ImageBankId, string>>({ pexels: '', pixabay: '' });
	let busy = $state<ImageBankId | null>(null);

	async function save(event: SubmitEvent, bank: ImageBankId, name: string) {
		event.preventDefault();

		busy = bank;
		const ok = await imageBanks.save(bank, keys[bank]);
		busy = null;

		if (!ok) {
			toasts.error(t('imageBanks.saveFailed'));
			return;
		}

		keys[bank] = '';
		toasts.success(t('imageBanks.saved', { bank: name }));
	}

	async function remove(bank: ImageBankId, name: string) {
		busy = bank;
		const ok = await imageBanks.clear(bank);
		busy = null;

		if (ok) toasts.success(t('imageBanks.removed', { bank: name }));
		else toasts.error(t('imageBanks.saveFailed'));
	}

	let placeKeys = $state<Record<PlaceProviderId, string>>({ google_places: '' });
	let placeBusy = $state<PlaceProviderId | null>(null);

	async function savePlace(event: SubmitEvent, provider: PlaceProviderId, name: string) {
		event.preventDefault();

		placeBusy = provider;
		const ok = await placeCredentials.save(provider, placeKeys[provider]);
		placeBusy = null;

		if (!ok) {
			toasts.error(t('imageBanks.saveFailed'));
			return;
		}

		placeKeys[provider] = '';
		toasts.success(t('imageBanks.saved', { bank: name }));
	}

	async function removePlace(provider: PlaceProviderId, name: string) {
		placeBusy = provider;
		const ok = await placeCredentials.clear(provider);
		placeBusy = null;

		if (ok) toasts.success(t('imageBanks.removed', { bank: name }));
		else toasts.error(t('imageBanks.saveFailed'));
	}
</script>

<svelte:head>
	<title>{t('imageBanks.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('imageBanks.title')}</h1>
<p class="text-muted-foreground mt-1">{t('imageBanks.subtitle')}</p>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			<TriangleAlert size={22} aria-hidden="true" />
			{t('ai.privacyTitle')}
		</Card.Title>
	</Card.Header>
	<Card.Content>
		<ul class="text-label list-disc space-y-1 ps-5">
			<li>{t('imageBanks.privacySent')}</li>
			<li>{t('imageBanks.privacyKey')}</li>
			<li>{t('imageBanks.privacyFree')}</li>
		</ul>
	</Card.Content>
</Card.Root>

{#each IMAGE_BANKS as bank (bank.id)}
	{@const isSaved = imageBanks.saved.includes(bank.id)}
	<Card.Root class="mt-6" data-test-id="image-bank-{bank.id}">
		<Card.Header>
			<Card.Title class="text-h2 flex items-center gap-2">
				<Images size={22} aria-hidden="true" />
				{bank.name}
			</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if imageBanks.loading}
				<p class="text-muted-foreground text-label" role="status">{t('common.loading')}</p>
			{:else}
				<p class="text-label flex items-center gap-2" data-test-id="image-bank-{bank.id}-state" data-state={isSaved ? 'on' : 'off'}>
					{#if isSaved}<Check size={18} class="text-secondary" aria-hidden="true" />{/if}
					{isSaved ? t('imageBanks.stateOn') : t('imageBanks.stateOff')}
				</p>

				<p class="text-caption">
					<a
						href={bank.keyUrl}
						target="_blank"
						rel="noreferrer noopener"
						class="text-primary inline-flex items-center gap-1 underline"
					>
						{t('ai.whereKey', { provider: bank.name })}
						<ExternalLink size={14} aria-hidden="true" />
					</a>
				</p>

				<form onsubmit={(event) => save(event, bank.id, bank.name)} class="space-y-3">
					<div>
						<Label for="image-bank-key-{bank.id}">{isSaved ? t('imageBanks.replaceKey') : t('ai.key')}</Label>
						<IconField icon={KeyRound}>
							<Input
								id="image-bank-key-{bank.id}"
								type="password"
								bind:value={keys[bank.id]}
								autocomplete="off"
								spellcheck="false"
								data-test-id="image-bank-{bank.id}-key"
								placeholder={t('ai.keyPlaceholder')}
							/>
						</IconField>
					</div>

					<div class="flex flex-wrap gap-2">
						<Button
							type="submit"
							loading={busy === bank.id}
							disabled={busy !== null || keys[bank.id].trim() === ''}
							data-test-id="image-bank-{bank.id}-save"
							class="fl-press min-h-11 px-4 text-base"
						>
							{t('ai.save')}
						</Button>
						{#if isSaved}
							<Button
								type="button"
								variant="outline"
								disabled={busy !== null}
								onclick={() => remove(bank.id, bank.name)}
								data-test-id="image-bank-{bank.id}-clear"
								class="fl-press min-h-11 px-4 text-base"
							>
								<Trash2 size={18} aria-hidden="true" />
								{t('imageBanks.remove')}
							</Button>
						{/if}
					</div>
				</form>
			{/if}
		</Card.Content>
	</Card.Root>
{/each}

<h2 class="text-h2 mt-8 font-semibold">{t('places.title')}</h2>
<p class="text-muted-foreground mt-1">{t('places.subtitle')}</p>

{#each PLACE_PROVIDERS as provider (provider.id)}
	{@const isSaved = placeCredentials.saved.includes(provider.id)}
	<Card.Root class="mt-6" data-test-id="place-provider-{provider.id}">
		<Card.Header>
			<Card.Title class="text-h2 flex items-center gap-2">
				<MapPin size={22} aria-hidden="true" />
				{provider.name}
			</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if placeCredentials.loading}
				<p class="text-muted-foreground text-label" role="status">{t('common.loading')}</p>
			{:else}
				<p
					class="text-label flex items-center gap-2"
					data-test-id="place-provider-{provider.id}-state"
					data-state={isSaved ? 'on' : 'off'}
				>
					{#if isSaved}<Check size={18} class="text-secondary" aria-hidden="true" />{/if}
					{isSaved ? t('imageBanks.stateOn') : t('imageBanks.stateOff')}
				</p>

				<p class="text-caption">
					<a
						href={provider.keyUrl}
						target="_blank"
						rel="noreferrer noopener"
						class="text-primary inline-flex items-center gap-1 underline"
					>
						{t('ai.whereKey', { provider: provider.name })}
						<ExternalLink size={14} aria-hidden="true" />
					</a>
				</p>

				<form onsubmit={(event) => savePlace(event, provider.id, provider.name)} class="space-y-3">
					<div>
						<Label for="place-key-{provider.id}">{isSaved ? t('imageBanks.replaceKey') : t('ai.key')}</Label>
						<IconField icon={KeyRound}>
							<Input
								id="place-key-{provider.id}"
								type="password"
								bind:value={placeKeys[provider.id]}
								autocomplete="off"
								spellcheck="false"
								data-test-id="place-provider-{provider.id}-key"
								placeholder={t('ai.keyPlaceholder')}
							/>
						</IconField>
					</div>

					<div class="flex flex-wrap gap-2">
						<Button
							type="submit"
							loading={placeBusy === provider.id}
							disabled={placeBusy !== null || placeKeys[provider.id].trim() === ''}
							data-test-id="place-provider-{provider.id}-save"
							class="fl-press min-h-11 px-4 text-base"
						>
							{t('ai.save')}
						</Button>
						{#if isSaved}
							<Button
								type="button"
								variant="outline"
								disabled={placeBusy !== null}
								onclick={() => removePlace(provider.id, provider.name)}
								data-test-id="place-provider-{provider.id}-clear"
								class="fl-press min-h-11 px-4 text-base"
							>
								<Trash2 size={18} aria-hidden="true" />
								{t('imageBanks.remove')}
							</Button>
						{/if}
					</div>
				</form>
			{/if}
		</Card.Content>
	</Card.Root>
{/each}
