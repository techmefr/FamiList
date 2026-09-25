<script lang="ts">
	import { goto } from '$app/navigation';
	import { session, type Factor, type OpenSession } from '$stores/session.svelte';
	import { t, i18n } from '$i18n/index.svelte';
	import {
		deleteAccountErrorKey,
		exportFileName,
		matchesConfirmation
	} from '$domain/account-data';
	import { feedback } from '$stores/feedback.svelte';
	import { backupCodesText, formatBackupCode, isCompleteOtp, normalizeOtp } from '$domain/otp';
	import { deviceLabel, deviceText } from '$domain/device';
	import * as Card from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import CodeField from '$components/app/CodeField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Switch } from '$components/ui/switch';
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
		TriangleAlert,
		Download,
		Trash2
	} from '@lucide/svelte';

	let factors = $state<Factor[]>([]);
	let sessions = $state<OpenSession[]>([]);
	let remaining = $state(0);

	/** The enrolment in progress: the square to photograph, the key to copy, and the code to confirm. */
	let enrollment = $state<{ id: string; qr: string; secret: string } | null>(null);
	let code = $state('');

	/** The plain codes, shown once. Nothing lets them be seen again afterwards. */
	let codes = $state<string[]>([]);
	let copied = $state(false);

	let busy = $state(false);
	let error = $state('');
	let loading = $state(true);
	let loadError = $state('');

	let oldPassword = $state('');
	let newPassword = $state('');
	let shown = $state(false);
	let passwordChanged = $state(false);
	let passwordError = $state('');

	const enabled = $derived(factors.length > 0);

	/**
	 * The switch is not derived from `active`: between the gesture and the second factor actually set,
	 * there is a square to photograph and a code to confirm. So it takes the lead from the gesture,
	 * otherwise it would move back under your fingers — and every exit from enrolment, abandonment or
	 * failure, puts it back on the account's state so it stops announcing a protection that does not exist.
	 */
	let switchOn = $state(false);

	/**
	 * What the status line under the switch says, in one word. The switch answers for the gesture — it goes
	 * to "off" as soon as you click, before the removal has left. The only state that answers for the
	 * account is this one: it changes only once the list of factors has been re-read.
	 */
	const status = $derived(
		enrollment || (switchOn && !enabled) ? 'pending' : enabled ? 'on' : 'off'
	);

	const dateLongue = $derived(
		new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'long', timeStyle: 'short' })
	);

	/**
	 * Until these three reads have answered, the screen concludes nothing. Without that it shows "second
	 * factor disabled" and "no connected device", which read as an established state — at best for the
	 * duration of the loading, at worst for good if the read failed.
	 */
	async function reload() {
		loading = true;
		loadError = '';

		const [loadedFactors, loadedSessions, loadedRemaining] = await Promise.all([
			session.listFactors(),
			session.listSessions(),
			session.backupCodesLeft()
		]);

		loading = false;

		if (loadedFactors === null || loadedSessions === null || loadedRemaining === null) {
			loadError = session.error ?? '';
			return;
		}

		factors = loadedFactors;
		switchOn = loadedFactors.length > 0 || enrollment !== null;
		sessions = loadedSessions;
		remaining = loadedRemaining;
	}

	$effect(() => {
		reload();
	});

	async function begin() {
		busy = true;
		error = '';
		switchOn = true;
		enrollment = await session.enrollTotp();
		busy = false;

		if (!enrollment) {
			error = session.error ?? '';
			switchOn = false;
		}
	}

	function cancelEnrollment() {
		enrollment = null;
		code = '';
		error = '';
		switchOn = enabled;
	}

	async function toggle(requested: boolean) {
		if (requested) {
			await begin();
			return;
		}

		if (enrollment) {
			cancelEnrollment();
			return;
		}

		// Switching off with no known factor must not be a gesture with no follow-up. The loop alone then
		// started from nothing: the switch, which has already taken the lead, stayed on "off" with no request
		// sent and no error shown — the screen announced a protection removed that still held. We re-read the
		// account, which puts the switch back on its real state.
		if (factors.length === 0) {
			await reload();
			return;
		}

		// We stop at the first refusal rather than carry on: `disable` has already put the switch back and shown
		// the reason, and the next turn would erase it straight away.
		for (const factor of factors) {
			if (!(await disable(factor.id))) return;
		}
	}

	async function confirm(event: SubmitEvent) {
		event.preventDefault();
		if (!enrollment) return;

		busy = true;
		error = '';
		const ok = await session.verifyEnrollment(enrollment.id, code);
		busy = false;

		if (!ok) {
			error = session.error ?? t('security.wrong');
			code = '';
			return;
		}

		feedback.play('success');
		enrollment = null;
		code = '';

		// Enabling the second step with no backup codes is putting up a lock and throwing away the spare key.
		// We make them straight away rather than count on a good resolution.
		codes = await session.newBackupCodes();
		await reload();
	}

	async function disable(id: string) {
		busy = true;
		error = '';
		const ok = await session.unenrollTotp(id);
		busy = false;

		if (!ok) {
			error = session.error ?? '';
			switchOn = true;
			return false;
		}

		codes = [];
		await reload();
		return true;
	}

	async function renew() {
		busy = true;
		codes = await session.newBackupCodes();
		busy = false;
		remaining = codes.length;
	}

	async function copy() {
		await navigator.clipboard.writeText(backupCodesText(codes, t('security.backupTitle')));
		copied = true;
		feedback.play('success');
		setTimeout(() => (copied = false), 2000);
	}

	/**
	 * The file is made in the page and not asked of the server: these codes must not travel over the
	 * network a second time, and the screen is the only place they still exist in plain text.
	 */
	function download() {
		const content = backupCodesText(codes, t('security.backupTitle'));
		const link = document.createElement('a');
		link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
		link.download = 'familist-codes-de-secours.txt';
		link.click();
		URL.revokeObjectURL(link.href);
	}

	async function close(id: string) {
		busy = true;
		const ok = await session.revokeSession(id);
		busy = false;

		if (ok) await reload();
	}

	async function changePassword(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		passwordError = '';
		passwordChanged = false;

		const ok = await session.changePassword(oldPassword, newPassword);
		busy = false;

		if (!ok) {
			passwordError = session.error ?? '';
			return;
		}

		oldPassword = '';
		newPassword = '';
		passwordChanged = true;
		feedback.play('success');
		await reload();
	}

	let exportEnCours = $state(false);
	let exportError = $state('');

	/**
	 * The file is assembled in the page, like the backup codes: there is no server of ours to put it on, and
	 * intermediate storage would be one more copy to purge afterwards.
	 */
	async function exportAll() {
		exportEnCours = true;
		exportError = '';

		const data = await session.exportData();
		exportEnCours = false;

		if (data === null) {
			exportError = t('security.dataError');
			return;
		}

		const link = document.createElement('a');
		link.href = URL.createObjectURL(
			new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
		);
		link.download = exportFileName(new Date());
		link.click();
		URL.revokeObjectURL(link.href);
	}

	/**
	 * Two gestures, not one. The first opens the form, the second asks you to retype your address: a single
	 * button on a touch screen is an account deleted by a thumb that slipped.
	 */
	let deleteOpen = $state(false);
	let confirmation = $state('');
	let deleteError = $state('');

	const confirmed = $derived(matchesConfirmation(confirmation, session.user?.email ?? null));

	function cancelDelete() {
		deleteOpen = false;
		confirmation = '';
		deleteError = '';
	}

	async function remove(event: SubmitEvent) {
		event.preventDefault();
		if (!confirmed) return;

		busy = true;
		deleteError = '';

		const ok = await session.deleteAccount();
		busy = false;

		if (!ok) {
			deleteError = t(deleteAccountErrorKey(session.error ?? ''));
			return;
		}

		goto('/');
	}

	const device = (agent: string | null) =>
		deviceText(deviceLabel(agent), t('security.on'), t('security.unknownDevice'));
</script>

<svelte:head>
	<title>{t('security.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('security.title')}</h1>
<p class="text-muted-foreground mt-1">{t('security.subtitle')}</p>

<Card.Root id="setting-password" tabindex={-1} class="fl-setting mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			<Lock size={22} aria-hidden="true" />
			{t('security.passwordTitle')}
		</Card.Title>
	</Card.Header>
	<Card.Content>
		<p class="text-muted-foreground text-label">{t('security.passwordBody')}</p>

		<form onsubmit={changePassword} class="mt-4 space-y-4" data-test-id="password-form">
			<div>
				<Label for="password-current">{t('security.passwordCurrent')}</Label>
				<IconField icon={Lock}>
					<Input
						id="password-current"
						type="password"
						bind:value={oldPassword}
						autocomplete="current-password"
						data-test-id="password-current"
						required
					/>
				</IconField>
			</div>

			<div>
				<Label for="password-next">{t('security.passwordNext')}</Label>
				<!--
					The type changes, not the field: rewriting the element would lose the cursor mid-typing. Same gesture
					as on the sign-in screen, and for the same reason.
				-->
				<IconField icon={Lock}>
					<Input
						id="password-next"
						type={shown ? 'text' : 'password'}
						bind:value={newPassword}
						autocomplete="new-password"
						minlength={8}
						aria-describedby="password-next-hint"
						data-test-id="password-next"
						required
					/>

					{#snippet action()}
						<button
							type="button"
							onclick={() => (shown = !shown)}
							aria-pressed={shown}
							aria-label={t('auth.showPassword')}
							data-test-id="password-reveal"
							class="text-muted-foreground hover:text-foreground focus-visible:ring-ring
								aria-pressed:text-primary flex size-11 items-center justify-center rounded-md
								transition-colors focus-visible:ring-2 focus-visible:ring-inset
								focus-visible:outline-none"
						>
							{#if shown}
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

			{#if passwordError}
				<p class="text-destructive text-label" role="alert" data-test-id="password-error">
					{passwordError}
				</p>
			{/if}

			{#if passwordChanged}
				<p class="text-secondary text-label flex items-center gap-2" role="status" data-test-id="password-done">
					<Check size={18} aria-hidden="true" />
					{t('security.passwordDone')}
				</p>
			{/if}

			<Button
				type="submit"
				class="fl-press"
				disabled={busy || oldPassword === '' || newPassword.length < 8}
				data-test-id="password-submit"
			>
				{busy ? t('common.loading') : t('security.passwordSubmit')}
			</Button>
		</form>
	</Card.Content>
</Card.Root>

<Card.Root id="setting-two-factor" tabindex={-1} class="fl-setting mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			{#if enabled}
				<ShieldCheck size={22} class="text-secondary" aria-hidden="true" />
			{:else}
				<ShieldOff size={22} class="text-muted-foreground" aria-hidden="true" />
			{/if}
			{t('security.twoFactor')}
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		{#if loading}
			<p class="text-muted-foreground text-label" role="status" data-test-id="security-loading">
				{t('common.loading')}
			</p>
		{:else if loadError}
			<p class="text-destructive text-label" role="alert" data-test-id="security-load-error">
				{loadError}
			</p>
		{:else}
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div class="min-w-0">
					<Label for="totp-switch">{t('security.twoFactor')}</Label>
					<p
						id="totp-switch-state"
						class="text-muted-foreground text-label mt-1"
						role="status"
						data-test-id="totp-state"
						data-test-state={status}
					>
						{#if status === 'pending'}
							{t('security.twoFactorPending')}
						{:else if enabled}
							{t('security.twoFactorOn', {
								date: dateLongue.format(new Date(factors[0].createdAt))
							})}
						{:else}
							{t('security.twoFactorOff')}
						{/if}
					</p>
				</div>
				<Switch
					id="totp-switch"
					size="lg"
					bind:checked={switchOn}
					onCheckedChange={toggle}
					disabled={busy}
					aria-describedby="totp-switch-state"
					data-test-id="totp-switch"
				/>
			</div>
		{/if}

		{#if !loading && !loadError && error && !enrollment}
			<p class="text-destructive text-label" role="alert" data-test-id="totp-error">{error}</p>
		{/if}

		{#if enrollment}
			<p class="text-label">{t('security.scan')}</p>

			<!--
				The square is drawn by Supabase and arrives as SVG: nothing to encode here, and above all nothing
				sending the secret somewhere to have it drawn.
			-->
			<img
				src={enrollment.qr}
				alt={t('security.qrAlt')}
				class="bg-card mx-auto size-48 rounded-lg border p-2"
				data-test-id="totp-qr"
			/>

			<!--
				The key in plain text is not a technical fallback: it is essential to anyone who cannot aim at a
				square with a camera, and to anyone setting up their password manager on the same computer, with no
				second screen to photograph.
			-->
			<p class="text-caption text-muted-foreground text-center">{t('security.secret')}</p>
			<p
				class="bg-muted text-label rounded-md px-3 py-2 text-center font-mono break-all"
				data-test-id="totp-secret"
			>
				{enrollment.secret}
			</p>

			<form onsubmit={confirm} class="space-y-3" data-test-id="totp-form">
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

				{#if error}
					<p class="text-destructive text-label" role="alert" data-test-id="totp-error">{error}</p>
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
					<Button variant="outline" onclick={cancelEnrollment} data-test-id="totp-cancel">
						{t('common.cancel')}
					</Button>
				</div>
			</form>
		{/if}
	</Card.Content>
</Card.Root>

{#if enabled || codes.length > 0}
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
					The only moment these codes exist in plain text. The warning is above the list and not below it: read
					afterwards, it is of no use any more.
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
					<Button variant="outline" onclick={copy} data-test-id="backup-copy">
						{#if copied}
							<Check size={18} aria-hidden="true" />
						{:else}
							<Copy size={18} aria-hidden="true" />
						{/if}
						{t('security.backupCopy')}
					</Button>
					<Button variant="outline" onclick={download} data-test-id="backup-download">
						{t('security.backupDownload')}
					</Button>
					<Button onclick={() => (codes = [])} class="fl-press" data-test-id="backup-done">
						{t('security.backupDone')}
					</Button>
				</div>
			{:else}
				<p class="text-label" data-test-id="backup-left">
					{remaining > 0 ? t('security.backupLeft', { count: remaining }) : t('security.backupNone')}
				</p>

				<Button
					variant="outline"
					disabled={busy}
					onclick={renew}
					data-test-id="backup-renew"
				>
					{remaining > 0 ? t('security.backupRenew') : t('security.backupCreate')}
				</Button>
			{/if}
		</Card.Content>
	</Card.Root>
{/if}

<Card.Root id="setting-sessions" tabindex={-1} class="fl-setting mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			<Monitor size={22} aria-hidden="true" />
			{t('security.sessionsTitle')}
		</Card.Title>
	</Card.Header>
	<Card.Content>
		<p class="text-muted-foreground text-label">{t('security.sessionsBody')}</p>

		{#if loading}
			<p class="text-muted-foreground text-label mt-4" role="status" data-test-id="sessions-loading">
				{t('common.loading')}
			</p>
		{:else if loadError}
			<p class="text-destructive text-label mt-4" role="alert" data-test-id="sessions-error">
				{loadError}
			</p>
		{:else if sessions.length === 0}
			<EmptyState illustration="inbox" text={t('security.sessionsEmpty')} testId="sessions-empty" />
		{:else}
			<ul class="fl-divided mt-4" data-test-id="sessions">
				{#each sessions as visible (visible.id)}
					<li class="flex flex-wrap items-center justify-between gap-3 py-3">
						<div class="min-w-0">
							<p class="text-label font-medium" data-test-class="session-device">
								{device(visible.user_agent)}
								{#if visible.current}
									<span class="bg-[var(--fl-primary-tint)] text-primary text-caption ms-2 rounded-full px-2 py-0.5">
										{t('security.sessionCurrent')}
									</span>
								{/if}
							</p>
							<p class="text-muted-foreground text-caption">
								{t('security.sessionSeen', {
									date: dateLongue.format(new Date(visible.refreshed_at))
								})}
								{#if visible.ip}· {visible.ip}{/if}
							</p>
						</div>

						<Button
							variant="outline"
							disabled={busy}
							onclick={() => close(visible.id)}
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

<Card.Root id="setting-data" tabindex={-1} class="fl-setting mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			<Download size={22} aria-hidden="true" />
			{t('security.dataTitle')}
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		<p class="text-muted-foreground text-label">{t('security.dataBody')}</p>

		{#if exportError}
			<p class="text-destructive text-label" role="alert" data-test-id="export-error">
				{exportError}
			</p>
		{/if}

		<Button variant="outline" disabled={exportEnCours} onclick={exportAll} data-test-id="export-data">
			<Download size={18} aria-hidden="true" />
			{exportEnCours ? t('common.loading') : t('security.dataExport')}
		</Button>
	</Card.Content>
</Card.Root>

<Card.Root id="setting-delete" tabindex={-1} class="fl-setting mt-6 border-destructive/40">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			<Trash2 size={22} class="text-destructive" aria-hidden="true" />
			{t('security.deleteTitle')}
		</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-4">
		<p class="text-muted-foreground text-label">{t('security.deleteBody')}</p>

		<p
			class="text-label text-destructive flex items-start gap-2 rounded-md bg-destructive/10 px-3.5 py-2.5 font-medium"
			data-test-id="delete-warning"
		>
			<TriangleAlert size={18} class="mt-0.5 shrink-0" aria-hidden="true" />
			<span>{t('security.deleteWarning')}</span>
		</p>

		{#if deleteOpen}
			<form onsubmit={remove} class="space-y-4" data-test-id="delete-form">
				<div>
					<Label for="delete-confirm">{t('security.deleteConfirmLabel')}</Label>
					<Input
						id="delete-confirm"
						type="email"
						bind:value={confirmation}
						autocomplete="off"
						aria-describedby="delete-confirm-hint"
						data-test-id="delete-confirm"
						required
					/>
					<p id="delete-confirm-hint" class="text-muted-foreground text-caption mt-2">
						{t('security.deleteConfirmHint')}
					</p>
				</div>

				{#if deleteError}
					<p class="text-destructive text-label" role="alert" data-test-id="delete-error">
						{deleteError}
					</p>
				{/if}

				<div class="flex flex-wrap gap-2">
					<Button
						type="submit"
						variant="destructive"
						class="fl-press"
						disabled={busy || !confirmed}
						data-test-id="delete-submit"
					>
						{busy ? t('common.loading') : t('security.deleteSubmit')}
					</Button>
					<Button variant="outline" onclick={cancelDelete} data-test-id="delete-cancel">
						{t('common.cancel')}
					</Button>
				</div>
			</form>
		{:else}
			<Button
				variant="outline"
				onclick={() => (deleteOpen = true)}
				data-test-id="delete-start"
			>
				<Trash2 size={18} aria-hidden="true" />
				{t('security.deleteStart')}
			</Button>
		{/if}
	</Card.Content>
</Card.Root>
