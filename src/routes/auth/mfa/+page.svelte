<script lang="ts">
	import { goto } from '$app/navigation';
	import { session, type Factor } from '$stores/session.svelte';
	import { t } from '$i18n/index.svelte';
	import { isCompleteBackupCode, isCompleteOtp, normalizeBackupCode, normalizeOtp } from '$domain/otp';
	import { factorsOfType, pickDeviceFactor } from '$domain/device-unlock';
	import { deviceUnlockAvailable, rememberedDeviceFactor } from '$native/device-unlock';
	import { Button } from '$components/ui/button';
	import * as Card from '$components/ui/card';
	import CodeField from '$components/app/CodeField.svelte';
	import { ShieldCheck, LifeBuoy, FingerprintPattern } from '@lucide/svelte';

	let factor = $state<Factor | null>(null);
	let passkeys = $state<Factor[]>([]);
	let deviceFactor = $state<Factor | null>(null);
	let deviceSupported = $state(false);
	let code = $state('');
	let backup = $state('');
	let mode = $state<'totp' | 'backup'>('totp');
	let busy = $state(false);
	let error = $state('');

	const offerDevice = $derived(deviceSupported && passkeys.length > 0);

	/**
	 * The first verified TOTP factor is enough: the security screen only lets one be set. Passkeys can be
	 * several, one per device, and only the one held in hand can answer.
	 */
	$effect(() => {
		deviceUnlockAvailable().then((available) => (deviceSupported = available));
		session.listFactors().then((factors) => {
			// A failed read left the factor at null: the button stayed active and did nothing at all on click,
			// without a word of explanation.
			if (factors === null) {
				error = session.error ?? '';
				return;
			}

			factor = factorsOfType(factors, 'totp')[0] ?? null;
			passkeys = factorsOfType(factors, 'webauthn');
			deviceFactor = pickDeviceFactor(factors, rememberedDeviceFactor());
		});
	});

	async function confirmWithDevice(target: Factor) {
		busy = true;
		error = '';

		const ok = await session.confirmWithDevice(target.id);
		busy = false;

		if (!ok) {
			error = t('deviceUnlock.failed');
			return;
		}

		goto('/');
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!factor) return;

		busy = true;
		error = '';

		const ok = await session.challengeTotp(factor.id, code);
		busy = false;

		if (!ok) {
			error = session.error ?? t('mfa.wrong');
			code = '';
			return;
		}

		goto('/');
	}

	async function useBackupCode(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';

		const ok = await session.useBackupCode(backup);
		busy = false;

		if (!ok) {
			error = session.error ?? t('mfa.backupWrong');
			backup = '';
			return;
		}

		goto('/');
	}
</script>

<svelte:head>
	<title>{t('mfa.title')} — {t('app.name')}</title>
</svelte:head>

<Card.Root class="mt-10">
	<Card.Content class="space-y-4">
		{#if mode === 'totp'}
			<ShieldCheck size={40} class="text-primary mx-auto" aria-hidden="true" />
			<h1 class="text-h1 text-center font-semibold">{t('mfa.title')}</h1>

			{#if offerDevice}
				<section class="space-y-3" data-test-id="mfa-device">
					<p class="text-muted-foreground text-center">{t('deviceUnlock.confirmBody')}</p>
					{#if deviceFactor}
						<Button
							class="fl-press w-full"
							disabled={busy}
							onclick={() => deviceFactor && confirmWithDevice(deviceFactor)}
							data-test-id="mfa-device-confirm"
						>
							<FingerprintPattern size={18} aria-hidden="true" />
							{busy ? t('common.loading') : t('deviceUnlock.confirm')}
						</Button>
					{:else}
						<p class="text-label">{t('deviceUnlock.choose')}</p>
						<ul class="space-y-2">
							{#each passkeys as passkey (passkey.id)}
								<li>
									<Button
										variant="outline"
										class="h-auto min-h-[max(2.75rem,44px)] w-full justify-start text-start break-words whitespace-normal"
										disabled={busy}
										onclick={() => confirmWithDevice(passkey)}
										data-test-class="mfa-device-choice"
									>
										<FingerprintPattern size={18} aria-hidden="true" class="shrink-0" />
										{passkey.friendlyName}
									</Button>
								</li>
							{/each}
						</ul>
					{/if}

					{#if error && !factor}
						<p class="text-destructive text-label" role="alert" data-test-id="mfa-error">{error}</p>
					{/if}
				</section>
			{:else if passkeys.length > 0 && !factor}
				<p class="text-muted-foreground text-center" data-test-id="mfa-device-elsewhere">
					{t('deviceUnlock.unavailableHere')}
				</p>
			{/if}

			{#if factor || passkeys.length === 0}
				{#if offerDevice}
					<h2 class="text-label border-t pt-4 font-semibold">{t('deviceUnlock.useCode')}</h2>
				{/if}
				<p class="text-muted-foreground {offerDevice ? '' : 'text-center'}">{t('mfa.body')}</p>

				<form onsubmit={submit} class="space-y-4" data-test-id="mfa-form">
					<div>
						<CodeField
							id="mfa-code"
							label={t('mfa.code')}
							bind:value={code}
							normalize={normalizeOtp}
							length={6}
							testId="mfa-code"
						/>
					</div>

					{#if error}
						<p class="text-destructive text-label" role="alert" data-test-id="mfa-error">{error}</p>
					{/if}

					<Button
						type="submit"
						class="fl-press w-full"
						disabled={busy || !factor || !isCompleteOtp(code)}
						data-test-id="mfa-submit"
					>
						{busy ? t('common.loading') : t('mfa.submit')}
					</Button>
				</form>
			{/if}

			<!--
				The way out is visible from the first screen, not hidden behind a link in small type. Somebody who has
				lost their phone is already panicking; making them hunt for the exit is exactly how an account is lost
				for good.
			-->
			<Button
				variant="ghost"
				class="w-full"
				onclick={() => {
					mode = 'backup';
					error = '';
				}}
				data-test-id="mfa-lost"
			>
				<LifeBuoy size={18} aria-hidden="true" />
				{t('mfa.lost')}
			</Button>
		{:else}
			<LifeBuoy size={40} class="text-primary mx-auto" aria-hidden="true" />
			<h1 class="text-h1 text-center font-semibold">{t('mfa.backupTitle')}</h1>
			<p class="text-muted-foreground">{t('mfa.backupBody')}</p>

			<form onsubmit={useBackupCode} class="space-y-4" data-test-id="mfa-backup-form">
				<div>
					<CodeField
						id="mfa-backup"
						label={t('mfa.backupCode')}
						hint={t('mfa.backupHint')}
						bind:value={backup}
						normalize={normalizeBackupCode}
						length={10}
						numeric={false}
						testId="mfa-backup"
					/>
				</div>

				{#if error}
					<p class="text-destructive text-label" role="alert" data-test-id="mfa-backup-error">
						{error}
					</p>
				{/if}

				<Button
					type="submit"
					class="fl-press w-full"
					disabled={busy || !isCompleteBackupCode(backup)}
					data-test-id="mfa-backup-submit"
				>
					{busy ? t('common.loading') : t('mfa.backupSubmit')}
				</Button>
			</form>

			<Button
				variant="ghost"
				class="w-full"
				onclick={() => {
					mode = 'totp';
					error = '';
				}}
				data-test-id="mfa-back"
			>
				{factor ? t('mfa.back') : t('deviceUnlock.back')}
			</Button>
		{/if}

		<Button
			variant="outline"
			class="w-full"
			onclick={() => session.signOut()}
			data-test-id="sign-out"
		>
			{t('auth.signOut')}
		</Button>
	</Card.Content>
</Card.Root>
