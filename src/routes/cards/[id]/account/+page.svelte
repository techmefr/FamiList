<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { data } from '$stores/data.svelte';
	import { session } from '$stores/session.svelte';
	import { t } from '$i18n/index.svelte';
	import { accountRevealGate } from '$domain/card-share';
	import {
		hasUnlockCode,
		isUnlockCodeValid,
		revealSecret,
		setUnlockCode,
		storeSecret
	} from '$domain/offline-secret';
	import { deviceSecrets } from '$stores/offline-secrets';
	import {
		readCardAccount,
		revealCardPassword,
		saveCardAccount,
		type CardAccount
	} from '$stores/card-account';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { ArrowLeft, Eye, EyeOff, Copy, ShieldCheck } from '@lucide/svelte';

	const REVEAL_MS = 60_000;

	const cardId = $derived(page.params.id!);
	const card = $derived(data.cards.find((candidate) => candidate.id === cardId) ?? null);
	const owned = $derived(card ? data.isOwnCard(card) : false);

	const gate = $derived(accountRevealGate(session.level, session.nextLevel));

	let online = $state(typeof navigator === 'undefined' ? true : navigator.onLine);
	let account = $state<CardAccount | null>(null);
	let error = $state('');
	let notice = $state('');

	let password = $state<string | null>(null);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	let deviceCopy = $state(false);
	let unlockCode = $state('');
	let offlineCode = $state('');

	let email = $state('');
	let newPassword = $state('');
	let saving = $state(false);

	function forget() {
		password = null;
		clearTimeout(hideTimer);
	}

	function show(value: string) {
		password = value;
		clearTimeout(hideTimer);
		hideTimer = setTimeout(forget, REVEAL_MS);
	}

	async function load() {
		deviceCopy = await hasUnlockCode(deviceSecrets);
		if (!online) return;

		const result = await readCardAccount(cardId);
		if (!result.ok) {
			error = t('cards.accountError', { error: result.error });
			return;
		}
		account = result.value;
		email = account?.email ?? '';
	}

	function onVisibility() {
		if (document.visibilityState === 'hidden') forget();
	}

	function onConnectivity() {
		online = navigator.onLine;
		if (online) void load();
	}

	onMount(() => {
		void session.refreshLevels();
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('online', onConnectivity);
		window.addEventListener('offline', onConnectivity);
	});

	onDestroy(() => {
		forget();
		if (typeof document === 'undefined') return;
		document.removeEventListener('visibilitychange', onVisibility);
		window.removeEventListener('online', onConnectivity);
		window.removeEventListener('offline', onConnectivity);
	});

	$effect(() => {
		void cardId;
		forget();
		void load();
	});

	$effect(() => {
		if (online && gate === 'second-factor') goto('/auth/mfa');
	});

	async function revealOnline() {
		error = '';
		const result = await revealCardPassword(cardId);
		if (!result.ok) {
			error = t('cards.accountError', { error: result.error });
			return;
		}
		show(result.value);
		if (result.value) await storeSecret(deviceSecrets, cardId, result.value);
	}

	async function revealOffline(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		const result = await revealSecret(deviceSecrets, cardId, offlineCode);
		offlineCode = '';
		if (result.ok) {
			show(result.value);
			return;
		}
		if (result.reason === 'wiped') deviceCopy = false;
		error = t(
			result.reason === 'wrong-code'
				? 'cards.offlineWrongCode'
				: result.reason === 'wiped'
					? 'cards.offlineWiped'
					: 'cards.offlineMissing'
		);
	}

	async function keepOnDevice(event: SubmitEvent) {
		event.preventDefault();
		if (!password || !isUnlockCodeValid(unlockCode)) return;
		const value = password;
		if (await setUnlockCode(deviceSecrets, unlockCode)) {
			await storeSecret(deviceSecrets, cardId, value);
			deviceCopy = true;
			notice = t('cards.offlineEnabled');
		}
		unlockCode = '';
	}

	async function save(removePassword: boolean) {
		saving = true;
		error = '';
		notice = '';
		const next = removePassword ? '' : newPassword || null;
		const result = await saveCardAccount(cardId, email, next);
		saving = false;
		if (!result.ok) {
			error = t('cards.accountError', { error: result.error });
			return;
		}
		if (next === '') await deviceSecrets.deleteSecret(cardId);
		else if (next) await storeSecret(deviceSecrets, cardId, next);
		newPassword = '';
		forget();
		notice = t('cards.accountSaved');
		await load();
	}

	async function copy() {
		if (!password || !navigator.clipboard) return;
		await navigator.clipboard.writeText(password);
		notice = t('cards.accountCopied');
	}
</script>

<svelte:head>
	<title>{card ? t('cards.accountTitle', { name: card.name }) : t('cards.title')} — {t('app.name')}</title>
</svelte:head>

<a
	href="/cards"
	class="fl-press text-label text-muted-foreground inline-flex min-h-[max(2.75rem,44px)] items-center gap-2"
	data-test-id="card-account-back"
>
	<ArrowLeft size={18} aria-hidden="true" />
	{t('cards.accountBack')}
</a>

{#if !card}
	<p class="text-muted-foreground mt-6" data-test-id="card-account-missing">{t('cards.accountNotFound')}</p>
{:else}
	<h1 class="text-h1 mt-2 font-semibold">{t('cards.accountTitle', { name: card.name })}</h1>

	<div aria-live="polite">
		{#if error}
			<p class="text-destructive text-label mt-4" role="alert" data-test-id="card-account-error">{error}</p>
		{/if}
		{#if notice}
			<p class="text-label mt-4" data-test-id="card-account-notice">{notice}</p>
		{/if}
	</div>

	{#if online && gate === 'enrol'}
		<section class="bg-card mt-6 rounded-xl border p-4" data-test-id="card-account-needs-mfa">
			<p class="text-label flex items-start gap-3">
				<ShieldCheck size={20} aria-hidden="true" class="mt-0.5 shrink-0" />
				{t('cards.accountNeedsMfa')}
			</p>
			<a
				href="/profile/security"
				class="fl-press bg-primary text-primary-foreground text-label mt-4 inline-flex min-h-[max(2.75rem,44px)] items-center rounded-full px-6 font-medium"
				data-test-id="card-account-go-profile"
			>
				{t('cards.accountGoProfile')}
			</a>
		</section>
	{:else if online && gate === 'allowed'}
		<section class="bg-card mt-6 space-y-3 rounded-xl border p-4" data-test-id="card-account-secret">
			{#if account?.email}
				<p class="text-caption text-muted-foreground">{t('cards.accountEmail')}</p>
				<p class="text-label break-all" data-test-id="card-account-email">{account.email}</p>
			{/if}

			{#if password !== null}
				<p
					class="text-label rounded-md bg-[var(--fl-primary-tint)] p-3 font-mono break-all"
					data-test-id="card-account-password"
				>
					{password || t('cards.accountNoPassword')}
				</p>
				<div class="flex flex-wrap gap-2">
					<Button variant="outline" onclick={forget} data-test-id="card-account-hide">
						<EyeOff size={18} aria-hidden="true" />
						{t('cards.accountHide')}
					</Button>
					{#if password}
						<Button variant="outline" onclick={copy} data-test-id="card-account-copy">
							<Copy size={18} aria-hidden="true" />
							{t('cards.accountCopy')}
						</Button>
					{/if}
				</div>

				{#if password && !deviceCopy}
					<form onsubmit={keepOnDevice} class="space-y-2 border-t pt-3" data-test-id="card-offline-setup">
						<h2 class="text-label font-semibold">{t('cards.offlineTitle')}</h2>
						<p class="text-muted-foreground text-caption">{t('cards.offlineHint')}</p>
						<Label for="card-unlock-code">{t('cards.offlineCode')}</Label>
						<Input
							id="card-unlock-code"
							type="password"
							autocomplete="off"
							bind:value={unlockCode}
							data-test-id="card-unlock-code"
						/>
						<Button type="submit" disabled={!isUnlockCodeValid(unlockCode)} data-test-id="card-offline-enable">
							{t('cards.offlineEnable')}
						</Button>
					</form>
				{/if}
			{:else if account?.hasPassword}
				<Button onclick={revealOnline} data-test-id="card-account-reveal">
					<Eye size={18} aria-hidden="true" />
					{t('cards.accountReveal')}
				</Button>
			{:else}
				<p class="text-muted-foreground text-label">{t('cards.accountNoPassword')}</p>
			{/if}
		</section>

		{#if owned}
			<form
				onsubmit={(event) => {
					event.preventDefault();
					void save(false);
				}}
				class="bg-card mt-6 space-y-4 rounded-xl border p-4"
				data-test-id="card-account-form"
			>
				<div>
					<Label for="card-account-email-input">{t('cards.accountEmail')}</Label>
					<Input
						id="card-account-email-input"
						type="email"
						autocomplete="off"
						bind:value={email}
						data-test-id="card-account-email-input"
					/>
				</div>
				<div>
					<Label for="card-account-password-input">{t('cards.accountNewPassword')}</Label>
					<Input
						id="card-account-password-input"
						type="password"
						autocomplete="new-password"
						bind:value={newPassword}
						aria-describedby="card-account-password-hint"
						data-test-id="card-account-password-input"
					/>
					<p id="card-account-password-hint" class="text-muted-foreground text-caption mt-1">
						{t('cards.accountNewPasswordHint')}
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button type="submit" disabled={saving} data-test-id="card-account-save">
						{t('cards.accountSave')}
					</Button>
					{#if account?.hasPassword}
						<Button
							type="button"
							variant="outline"
							disabled={saving}
							onclick={() => save(true)}
							data-test-id="card-account-remove-password"
						>
							{t('cards.accountRemovePassword')}
						</Button>
					{/if}
				</div>
			</form>
		{:else}
			<p class="text-muted-foreground text-caption mt-4">{t('cards.accountReadOnly')}</p>
		{/if}
	{:else if !online}
		<section class="bg-card mt-6 space-y-3 rounded-xl border p-4" data-test-id="card-account-offline">
			{#if password !== null}
				<p
					class="text-label rounded-md bg-[var(--fl-primary-tint)] p-3 font-mono break-all"
					data-test-id="card-account-password"
				>
					{password}
				</p>
				<Button variant="outline" onclick={forget} data-test-id="card-account-hide">
					<EyeOff size={18} aria-hidden="true" />
					{t('cards.accountHide')}
				</Button>
			{:else if deviceCopy}
				<form onsubmit={revealOffline} class="space-y-2">
					<p class="text-label">{t('cards.offlineUnlockHint')}</p>
					<Label for="card-offline-code">{t('cards.offlineCode')}</Label>
					<Input
						id="card-offline-code"
						type="password"
						autocomplete="off"
						bind:value={offlineCode}
						data-test-id="card-offline-code"
					/>
					<Button type="submit" disabled={!offlineCode} data-test-id="card-offline-unlock">
						{t('cards.offlineUnlock')}
					</Button>
				</form>
			{:else}
				<p class="text-muted-foreground text-label">{t('cards.offlineMissing')}</p>
			{/if}
		</section>
	{/if}
{/if}
