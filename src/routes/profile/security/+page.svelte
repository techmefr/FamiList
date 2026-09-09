<script lang="ts">
	import { session, type Factor, type OpenSession } from '$stores/session.svelte';
	import { t, i18n } from '$lib/i18n/index.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { backupCodesText, formatBackupCode, isCompleteOtp, normalizeOtp } from '$domain/otp';
	import { deviceLabel, deviceText } from '$domain/device';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import CodeField from '$components/app/CodeField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import IconField from '$components/app/IconField.svelte';
	import {
		ShieldCheck,
		ShieldOff,
		KeyRound,
		Lock,
		Monitor,
		Copy,
		Check,
		Eye,
		EyeOff,
		TriangleAlert
	} from '@lucide/svelte';

	let facteurs = $state<Factor[]>([]);
	let sessions = $state<OpenSession[]>([]);
	let restants = $state(0);

	/** L'inscription en cours : le carré à photographier, la clé à recopier, et le code à confirmer. */
	let inscription = $state<{ id: string; qr: string; secret: string } | null>(null);
	let code = $state('');

	/** Les codes en clair, affichés une seule fois. Rien ne permet de les revoir ensuite. */
	let codes = $state<string[]>([]);
	let copie = $state(false);

	let busy = $state(false);
	let erreur = $state('');

	let ancien = $state('');
	let nouveau = $state('');
	let montre = $state(false);
	let motDePasseChange = $state(false);
	let erreurMotDePasse = $state('');

	const actif = $derived(facteurs.length > 0);

	const dateLongue = $derived(
		new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'long', timeStyle: 'short' })
	);

	async function recharger() {
		facteurs = await session.listFactors();
		sessions = await session.listSessions();
		restants = await session.backupCodesLeft();
	}

	$effect(() => {
		recharger();
	});

	async function commencer() {
		busy = true;
		erreur = '';
		inscription = await session.enrollTotp();
		busy = false;

		if (!inscription) erreur = session.error ?? '';
	}

	async function confirmer(event: SubmitEvent) {
		event.preventDefault();
		if (!inscription) return;

		busy = true;
		erreur = '';
		const ok = await session.verifyEnrollment(inscription.id, code);
		busy = false;

		if (!ok) {
			erreur = session.error ?? t('security.wrong');
			code = '';
			return;
		}

		feedback.play('success');
		inscription = null;
		code = '';

		// Activer la deuxième étape sans codes de secours, c'est poser un verrou et jeter le double
		// de la clé. On les fabrique dans la foulée plutôt que de compter sur une bonne résolution.
		codes = await session.newBackupCodes();
		await recharger();
	}

	async function desactiver(id: string) {
		busy = true;
		erreur = '';
		const ok = await session.unenrollTotp(id);
		busy = false;

		if (!ok) {
			erreur = session.error ?? '';
			return;
		}

		codes = [];
		await recharger();
	}

	async function renouveler() {
		busy = true;
		codes = await session.newBackupCodes();
		busy = false;
		restants = codes.length;
	}

	async function copier() {
		await navigator.clipboard.writeText(backupCodesText(codes, t('security.backupTitle')));
		copie = true;
		feedback.play('success');
		setTimeout(() => (copie = false), 2000);
	}

	/**
	 * Le fichier est fabriqué dans la page et non demandé au serveur : ces codes ne doivent pas
	 * repasser par le réseau une deuxième fois, et l'écran est le seul endroit où ils existent
	 * encore en clair.
	 */
	function telecharger() {
		const contenu = backupCodesText(codes, t('security.backupTitle'));
		const lien = document.createElement('a');
		lien.href = URL.createObjectURL(new Blob([contenu], { type: 'text/plain;charset=utf-8' }));
		lien.download = 'familist-codes-de-secours.txt';
		lien.click();
		URL.revokeObjectURL(lien.href);
	}

	async function fermer(id: string) {
		busy = true;
		const ok = await session.revokeSession(id);
		busy = false;

		if (ok) await recharger();
	}

	async function changerMotDePasse(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		erreurMotDePasse = '';
		motDePasseChange = false;

		const ok = await session.changePassword(ancien, nouveau);
		busy = false;

		if (!ok) {
			erreurMotDePasse = session.error ?? '';
			return;
		}

		ancien = '';
		nouveau = '';
		motDePasseChange = true;
		feedback.play('success');
		await recharger();
	}

	const appareil = (agent: string | null) =>
		deviceText(deviceLabel(agent), t('security.on'), t('security.unknownDevice'));
</script>

<svelte:head>
	<title>{t('security.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('security.title')}</h1>
<p class="text-muted-foreground mt-1">{t('security.subtitle')}</p>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			<Lock size={22} aria-hidden="true" />
			{t('security.passwordTitle')}
		</Card.Title>
	</Card.Header>
	<Card.Content>
		<p class="text-muted-foreground text-label">{t('security.passwordBody')}</p>

		<form onsubmit={changerMotDePasse} class="mt-4 space-y-4" data-test-id="password-form">
			<div>
				<Label for="password-current">{t('security.passwordCurrent')}</Label>
				<IconField icon={Lock}>
					<Input
						id="password-current"
						type="password"
						bind:value={ancien}
						autocomplete="current-password"
						data-test-id="password-current"
						required
					/>
				</IconField>
			</div>

			<div>
				<Label for="password-next">{t('security.passwordNext')}</Label>
				<!--
					Le type change, pas le champ : réécrire l'élément ferait perdre le curseur en pleine
					saisie. Même geste que sur l'écran de connexion, et pour la même raison.
				-->
				<IconField icon={Lock}>
					<Input
						id="password-next"
						type={montre ? 'text' : 'password'}
						bind:value={nouveau}
						autocomplete="new-password"
						minlength={8}
						aria-describedby="password-next-hint"
						data-test-id="password-next"
						required
					/>

					{#snippet action()}
						<button
							type="button"
							onclick={() => (montre = !montre)}
							aria-pressed={montre}
							aria-label={t('auth.showPassword')}
							data-test-id="password-reveal"
							class="text-muted-foreground hover:text-foreground focus-visible:ring-ring
								aria-pressed:text-primary flex size-11 items-center justify-center rounded-md
								transition-colors focus-visible:ring-2 focus-visible:ring-inset
								focus-visible:outline-none"
						>
							{#if montre}
								<EyeOff size={18} aria-hidden="true" />
							{:else}
								<Eye size={18} aria-hidden="true" />
							{/if}
						</button>
					{/snippet}
				</IconField>

				<p id="password-next-hint" class="text-muted-foreground text-caption mt-2">
					{t('auth.passwordHint')}
				</p>
			</div>

			{#if erreurMotDePasse}
				<p class="text-destructive text-label" role="alert" data-test-id="password-error">
					{erreurMotDePasse}
				</p>
			{/if}

			{#if motDePasseChange}
				<p class="text-secondary text-label flex items-center gap-2" role="status" data-test-id="password-done">
					<Check size={18} aria-hidden="true" />
					{t('security.passwordDone')}
				</p>
			{/if}

			<Button
				type="submit"
				class="fl-press"
				disabled={busy || ancien === '' || nouveau.length < 8}
				data-test-id="password-submit"
			>
				{busy ? t('common.loading') : t('security.passwordSubmit')}
			</Button>
		</form>
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			{#if actif}
				<ShieldCheck size={22} class="text-secondary" aria-hidden="true" />
			{:else}
				<ShieldOff size={22} class="text-muted-foreground" aria-hidden="true" />
			{/if}
			{t('security.twoFactor')}
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		{#if inscription}
			<p class="text-label">{t('security.scan')}</p>

			<!--
				Le carré est dessiné par Supabase et arrive en SVG : rien à encoder ici, et surtout rien
				qui remonte le secret quelque part pour se le faire dessiner.
			-->
			<img
				src={inscription.qr}
				alt={t('security.qrAlt')}
				class="bg-card mx-auto size-48 rounded-lg border p-2"
				data-test-id="totp-qr"
			/>

			<!--
				La clé en clair n'est pas un repli technique : elle est indispensable à qui ne peut pas
				viser un carré avec un appareil photo, et à qui règle son gestionnaire de mots de passe
				sur le même ordinateur, sans deuxième écran à photographier.
			-->
			<p class="text-caption text-muted-foreground text-center">{t('security.secret')}</p>
			<p
				class="bg-muted text-label rounded-md px-3 py-2 text-center font-mono break-all"
				data-test-id="totp-secret"
			>
				{inscription.secret}
			</p>

			<form onsubmit={confirmer} class="space-y-3" data-test-id="totp-form">
				<div>
					<CodeField
						id="totp-code"
						label={t('security.confirmCode')}
						bind:value={code}
						normalize={normalizeOtp}
						length={6}
						testId="totp-code"
					/>
				</div>

				{#if erreur}
					<p class="text-destructive text-label" role="alert" data-test-id="totp-error">{erreur}</p>
				{/if}

				<div class="flex flex-wrap gap-2">
					<Button
						type="submit"
						class="fl-press flex-auto"
						disabled={busy || !isCompleteOtp(code)}
						data-test-id="totp-confirm"
					>
						{busy ? t('common.loading') : t('security.confirm')}
					</Button>
					<Button
						variant="outline"
						onclick={() => {
							inscription = null;
							code = '';
							erreur = '';
						}}
						data-test-id="totp-cancel"
					>
						{t('common.cancel')}
					</Button>
				</div>
			</form>
		{:else if actif}
			{#each facteurs as facteur (facteur.id)}
				<div class="flex flex-wrap items-center justify-between gap-3">
					<p class="text-label" data-test-id="totp-active">
						{t('security.twoFactorOn', { date: dateLongue.format(new Date(facteur.createdAt)) })}
					</p>
					<Button
						variant="outline"
						class="text-destructive"
						disabled={busy}
						onclick={() => desactiver(facteur.id)}
						data-test-id="totp-disable"
					>
						{t('security.disable')}
					</Button>
				</div>
			{/each}
		{:else}
			<p class="text-muted-foreground text-label">{t('security.twoFactorOff')}</p>

			{#if erreur}
				<p class="text-destructive text-label" role="alert" data-test-id="totp-error">{erreur}</p>
			{/if}

			<Button class="fl-press" disabled={busy} onclick={commencer} data-test-id="totp-enable">
				<ShieldCheck size={18} aria-hidden="true" />
				{t('security.enable')}
			</Button>
		{/if}
	</Card.Content>
</Card.Root>

{#if actif || codes.length > 0}
	<Card.Root class="mt-6">
		<Card.Header>
			<Card.Title class="text-h2 flex items-center gap-2">
				<KeyRound size={22} aria-hidden="true" />
				{t('security.backupTitle')}
			</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<p class="text-muted-foreground text-label">{t('security.backupBody')}</p>

			{#if codes.length > 0}
				<!--
					Le seul moment où ces codes existent en clair. L'avertissement est au-dessus de la
					liste et non en dessous : lu après, il ne sert plus à rien.
				-->
				<p
					class="text-label text-secondary flex items-start gap-2 rounded-md bg-[var(--fl-secondary-tint)] px-3.5 py-2.5 font-medium"
					data-test-id="backup-warning"
				>
					<TriangleAlert size={18} class="mt-0.5 shrink-0" aria-hidden="true" />
					<span>{t('security.backupWarning')}</span>
				</p>

				<ul class="grid grid-cols-2 gap-2" data-test-id="backup-codes">
					{#each codes as code (code)}
						<li class="bg-muted text-label rounded-md px-3 py-2 text-center font-mono">
							{formatBackupCode(code)}
						</li>
					{/each}
				</ul>

				<div class="flex flex-wrap gap-2">
					<Button variant="outline" onclick={copier} data-test-id="backup-copy">
						{#if copie}
							<Check size={18} aria-hidden="true" />
						{:else}
							<Copy size={18} aria-hidden="true" />
						{/if}
						{t('security.backupCopy')}
					</Button>
					<Button variant="outline" onclick={telecharger} data-test-id="backup-download">
						{t('security.backupDownload')}
					</Button>
					<Button onclick={() => (codes = [])} class="fl-press" data-test-id="backup-done">
						{t('security.backupDone')}
					</Button>
				</div>
			{:else}
				<p class="text-label" data-test-id="backup-left">
					{restants > 0 ? t('security.backupLeft', { count: restants }) : t('security.backupNone')}
				</p>

				<Button
					variant="outline"
					disabled={busy}
					onclick={renouveler}
					data-test-id="backup-renew"
				>
					{restants > 0 ? t('security.backupRenew') : t('security.backupCreate')}
				</Button>
			{/if}
		</Card.Content>
	</Card.Root>
{/if}

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			<Monitor size={22} aria-hidden="true" />
			{t('security.sessionsTitle')}
		</Card.Title>
	</Card.Header>
	<Card.Content>
		<p class="text-muted-foreground text-label">{t('security.sessionsBody')}</p>

		{#if sessions.length === 0}
			<EmptyState illustration="inbox" text={t('security.sessionsEmpty')} testId="sessions-empty" />
		{:else}
			<ul class="fl-divided mt-4" data-test-id="sessions">
				{#each sessions as ouverte (ouverte.id)}
					<li class="flex flex-wrap items-center justify-between gap-3 py-3">
						<div class="min-w-0">
							<p class="text-label font-medium" data-test-class="session-device">
								{appareil(ouverte.user_agent)}
								{#if ouverte.current}
									<span class="bg-[var(--fl-primary-tint)] text-primary text-caption ms-2 rounded-full px-2 py-0.5">
										{t('security.sessionCurrent')}
									</span>
								{/if}
							</p>
							<p class="text-muted-foreground text-caption">
								{t('security.sessionSeen', {
									date: dateLongue.format(new Date(ouverte.refreshed_at))
								})}
								{#if ouverte.ip}· {ouverte.ip}{/if}
							</p>
						</div>

						<Button
							variant="outline"
							disabled={busy}
							onclick={() => fermer(ouverte.id)}
							data-test-class="session-revoke"
						>
							{t('security.revoke')}
						</Button>
					</li>
				{/each}
			</ul>
		{/if}
	</Card.Content>
</Card.Root>
