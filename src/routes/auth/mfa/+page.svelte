<script lang="ts">
	import { goto } from '$app/navigation';
	import { session, type Factor } from '$stores/session.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { isCompleteBackupCode, isCompleteOtp, normalizeBackupCode, normalizeOtp } from '$domain/otp';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import CodeField from '$components/app/CodeField.svelte';
	import { ShieldCheck, LifeBuoy } from '@lucide/svelte';

	let facteur = $state<Factor | null>(null);
	let code = $state('');
	let secours = $state('');
	let mode = $state<'totp' | 'backup'>('totp');
	let busy = $state(false);
	let erreur = $state('');

	/**
	 * The first verified factor is enough: the security screen only lets one be set. Looking for several here
	 * would mean making people choose between two identical rows.
	 */
	$effect(() => {
		session.listFactors().then((facteurs) => {
			// A failed read left the factor at null: the button stayed active and did nothing at all on click,
			// without a word of explanation.
			if (facteurs === null) {
				erreur = session.error ?? '';
				return;
			}

			facteur = facteurs[0] ?? null;
		});
	});

	async function valider(event: SubmitEvent) {
		event.preventDefault();
		if (!facteur) return;

		busy = true;
		erreur = '';

		const ok = await session.challengeTotp(facteur.id, code);
		busy = false;

		if (!ok) {
			erreur = session.error ?? t('mfa.wrong');
			code = '';
			return;
		}

		goto('/');
	}

	async function utiliserSecours(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		erreur = '';

		const ok = await session.useBackupCode(secours);
		busy = false;

		if (!ok) {
			erreur = session.error ?? t('mfa.backupWrong');
			secours = '';
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
			<p class="text-muted-foreground text-center">{t('mfa.body')}</p>

			<form onsubmit={valider} class="space-y-4" data-test-id="mfa-form">
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

				{#if erreur}
					<p class="text-destructive text-label" role="alert" data-test-id="mfa-error">{erreur}</p>
				{/if}

				<Button
					type="submit"
					class="fl-press w-full"
					disabled={busy || !facteur || !isCompleteOtp(code)}
					data-test-id="mfa-submit"
				>
					{busy ? t('common.loading') : t('mfa.submit')}
				</Button>
			</form>

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
					erreur = '';
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

			<form onsubmit={utiliserSecours} class="space-y-4" data-test-id="mfa-backup-form">
				<div>
					<CodeField
						id="mfa-backup"
						label={t('mfa.backupCode')}
						hint={t('mfa.backupHint')}
						bind:value={secours}
						normalize={normalizeBackupCode}
						length={10}
						numeric={false}
						testId="mfa-backup"
					/>
				</div>

				{#if erreur}
					<p class="text-destructive text-label" role="alert" data-test-id="mfa-backup-error">
						{erreur}
					</p>
				{/if}

				<Button
					type="submit"
					class="fl-press w-full"
					disabled={busy || !isCompleteBackupCode(secours)}
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
					erreur = '';
				}}
				data-test-id="mfa-back"
			>
				{t('mfa.back')}
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
