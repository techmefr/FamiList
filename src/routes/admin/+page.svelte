<script lang="ts">
	import { supabase } from '$db/supabase';
	import { session } from '$stores/session.svelte';
	import { t, i18n } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import { adminErrorKey, needsElevation } from '$domain/admin-error';
	import {
		Check,
		X,
		RotateCcw,
		UserCheck,
		ShieldCheck,
		ShieldOff,
		KeyRound,
		LifeBuoy
	} from '@lucide/svelte';
	import EmptyState from '$components/app/EmptyState.svelte';

	interface PendingAccount {
		id: string;
		display_name: string;
		email: string;
		requested_at: string;
		status: string;
		is_demo: boolean;
		role: 'user' | 'admin';
		has_mfa: boolean;
	}

	interface BugReport {
		id: string;
		email: string | null;
		description: string;
		screenshot: string | null;
		path: string | null;
		user_agent: string | null;
		kind: string;
		status: string;
		created_at: string;
	}

	let accounts = $state<PendingAccount[]>([]);
	let reports = $state<BugReport[]>([]);
	let loading = $state(true);
	let errors = $state<string[]>([]);
	let elevationRequise = $state(false);

	/**
	 * Un refus de la base, dit à l'écran.
	 *
	 * La cause se lit dans le message plutôt que dans l'état du client : la session a pu être
	 * élevée, ou cesser de l'être, depuis la dernière fois qu'on l'a regardée — un deuxième facteur
	 * posé sur un autre appareil laisse justement cet onglet-ci en arrière.
	 */
	function refuser(messages: (string | undefined)[]) {
		const bruts = messages.filter((message): message is string => !!message);
		elevationRequise = needsElevation(bruts);
		errors = bruts.map((message) => {
			const key = adminErrorKey(message);
			return key ? t(key) : message;
		});
	}

	async function load() {
		loading = true;
		const [{ data, error: rpcError }, { data: reportData, error: reportError }] =
			await Promise.all([
				supabase.rpc('pending_accounts'),
				supabase.rpc('list_bug_reports')
			]);

		// Un non-admin reçoit une erreur, pas une liste vide : la distinction évite de croire
		// qu'il n'y a personne en attente alors qu'on n'a simplement pas le droit de regarder.
		//
		// Les deux lectures sont indépendantes et peuvent échouer chacune pour sa raison : n'en
		// montrer qu'une laisserait croire que l'autre a répondu.
		refuser([rpcError?.message, reportError?.message]);
		accounts = (data as PendingAccount[]) ?? [];
		reports = (reportData as BugReport[]) ?? [];
		loading = false;
	}

	async function resolveReport(id: string) {
		const { error: rpcError } = await supabase.rpc('resolve_bug_report', { target: id });
		if (rpcError) {
			refuser([rpcError.message]);
			return;
		}
		await load();
	}

	async function review(id: string, decision: 'approved' | 'rejected') {
		const { error: rpcError } = await supabase.rpc('review_account', { target: id, decision });
		if (rpcError) {
			refuser([rpcError.message]);
			return;
		}
		await load();
	}

	async function setRole(id: string, admin: boolean) {
		const { error: rpcError } = await supabase.rpc(admin ? 'promote_admin' : 'demote_admin', {
			target: id
		});
		refuser([rpcError?.message]);
		await load();
	}

	// Le facteur retiré, la personne se reconnecte avec son seul mot de passe : le dire ici évite
	// qu'on croie l'action sans effet parce que la ligne, elle, ne change presque pas.
	async function resetMfa(id: string) {
		const { error: rpcError } = await supabase.rpc('admin_reset_mfa', { target: id });
		refuser([rpcError?.message]);
		notice = rpcError ? null : t('admin.mfaReset');
		await load();
	}

	async function setDemo(id: string, demo: boolean) {
		const { error: rpcError } = await supabase.rpc('set_demo', { target: id, demo });
		refuser([rpcError?.message]);
		await load();
	}

	async function resetDemo() {
		const { error: rpcError } = await supabase.rpc('reset_demo');
		refuser([rpcError?.message]);
		notice = rpcError ? null : t('admin.demoReset');

		// La réinitialisation refait le foyer de démonstration : sans relecture, l'écran garde les
		// comptes et les badges d'avant, et laisse croire qu'il ne s'est rien passé.
		if (!rpcError) await load();
	}

	let notice = $state<string | null>(null);

	// Le dernier administrateur ne peut pas se retirer : la base le refuse déjà, l'écran se contente
	// de ne pas proposer un bouton qui n'aboutirait qu'à un message d'erreur.
	const adminCount = $derived(
		accounts.filter((account) => account.role === 'admin' && account.status === 'approved').length
	);

	$effect(() => {
		if (session.isAdmin) load();
	});

	const formatDate = (value: string) =>
		new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(value)
		);
</script>

<svelte:head>
	<title>{t('admin.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('admin.title')}</h1>

{#if !session.isAdmin}
	<p class="text-muted-foreground mt-6" data-test-id="admin-denied">{t('admin.denied')}</p>
{:else if loading}
	<p class="text-muted-foreground mt-6">{t('common.loading')}</p>
{:else}
	{#if errors.length > 0}
		<div class="mt-6" role="alert" data-test-id="admin-errors">
			{#each errors as message (message)}
				<p class="text-destructive">{message}</p>
			{/each}
		</div>
	{/if}

	<!--
		« Élevez votre session » a une suite, « vous n'êtes pas administrateur » n'en a pas : seul le
		premier des deux refus mérite un bouton, et il mène à l'écran qui porte aussi les codes de
		secours.
	-->
	{#if elevationRequise}
		<Button href="/auth/mfa" class="fl-press mt-3" data-test-id="admin-elevate">
			<LifeBuoy size={18} aria-hidden="true" />
			{t('admin.elevate')}
		</Button>
	{/if}

	{#if notice}
		<p class="text-primary mt-6" role="status" data-test-id="admin-notice">{notice}</p>
	{/if}

	{#if accounts.some((account) => account.is_demo)}
		<div class="bg-card mt-6 rounded-xl border p-4">
			<p class="text-label">{t('admin.demoHint')}</p>
			<Button variant="outline" onclick={resetDemo} data-test-id="reset-demo" class="mt-3">
				<RotateCcw size={18} aria-hidden="true" />
				{t('admin.resetDemo')}
			</Button>
		</div>
	{/if}

	{#if accounts.length === 0}
		<EmptyState illustration="inbox" text={t('admin.empty')} testId="admin-empty" />
	{:else}
		<ul class="mt-6 space-y-3">
			{#each accounts as account (account.id)}
				{@const self = account.id === session.user?.id}
				<li>
					<Card.Root data-test-class="admin-pending-account">
						<Card.Content class="flex flex-wrap items-center gap-4">
							<div class="min-w-0 flex-1 basis-[12rem]">
								<p class="text-product font-medium break-words">{account.display_name}</p>
								<p class="text-muted-foreground text-label break-all">{account.email}</p>
								<p class="text-muted-foreground text-caption">
									{t('admin.requestedAt', { date: formatDate(account.requested_at) })}
								</p>
							</div>

							<Badge variant={account.status === 'pending' ? 'secondary' : 'default'}>
								{t(`admin.status.${account.status}`)}
							</Badge>

							{#if account.role === 'admin'}
								<Badge data-test-class="admin-badge">{t('admin.roleAdmin')}</Badge>
							{/if}

							{#if account.has_mfa}
								<Badge variant="secondary" data-test-class="mfa-badge">{t('admin.twoFactor')}</Badge>
							{/if}

							{#if account.is_demo}
								<Badge variant="secondary" data-test-class="demo-badge">{t('admin.demo')}</Badge>
							{/if}

							<!--
								Les actions sont désactivées plutôt que masquées : une ligne garde la même largeur
								quel que soit son état, et un administrateur voit que l'action existe mais qu'elle
								ne s'applique pas ici.
							-->
							{#if self}
								<div class="ms-auto flex shrink-0 flex-wrap items-center gap-3">
									<p
										class="text-muted-foreground text-label flex items-center gap-2"
										data-test-class="admin-self"
									>
										<UserCheck size={18} aria-hidden="true" />
										{t('admin.selfAccount')}
									</p>

									<!--
										Passer la main fait partie du parcours : on nomme son successeur, puis on se
										retire. Sans ce bouton, la seule façon de se retirer serait la base.
									-->
									{#if account.role === 'admin' && adminCount > 1}
										<Button
											variant="outline"
											onclick={() => setRole(account.id, false)}
											data-test-class="admin-demote"
										>
											<ShieldOff size={18} aria-hidden="true" />
											{t('admin.demote')}
										</Button>
									{/if}
								</div>
							{:else}
								<div class="ms-auto flex shrink-0 flex-wrap items-center gap-3">
									<Button
										onclick={() => review(account.id, 'approved')}
										disabled={account.status === 'approved'}
										data-test-class="admin-approve"
									>
										<Check size={18} aria-hidden="true" />
										{t('admin.approve')}
									</Button>
									<Button
										variant="outline"
										onclick={() => review(account.id, 'rejected')}
										disabled={account.status === 'rejected'}
										data-test-class="admin-reject"
									>
										<X size={18} aria-hidden="true" />
										{t('admin.reject')}
									</Button>
									{#if account.role === 'admin'}
										<Button
											variant="outline"
											onclick={() => setRole(account.id, false)}
											disabled={adminCount < 2}
											data-test-class="admin-demote"
										>
											<ShieldOff size={18} aria-hidden="true" />
											{t('admin.demote')}
										</Button>
									{:else}
										<Button
											variant="outline"
											onclick={() => setRole(account.id, true)}
											disabled={account.status !== 'approved'}
											data-test-class="admin-promote"
										>
											<ShieldCheck size={18} aria-hidden="true" />
											{t('admin.promote')}
										</Button>
									{/if}
									<Button
										variant="outline"
										onclick={() => resetMfa(account.id)}
										disabled={!account.has_mfa}
										data-test-class="admin-reset-mfa"
									>
										<KeyRound size={18} aria-hidden="true" />
										{t('admin.resetMfa')}
									</Button>
									<Label for="demo-{account.id}" class="text-label">{t('admin.demoToggle')}</Label>
									<Switch
										id="demo-{account.id}"
										size="lg"
										checked={account.is_demo}
										onCheckedChange={(checked) => setDemo(account.id, checked)}
										data-test-class="toggle-demo"
									/>
								</div>
							{/if}
						</Card.Content>
					</Card.Root>
				</li>
			{/each}
		</ul>
	{/if}

	<h2 class="text-h2 mt-10 font-semibold">{t('admin.reportsTitle')}</h2>

	{#if reports.length === 0}
		<EmptyState illustration="inbox" text={t('admin.reportsEmpty')} testId="admin-reports-empty" />
	{:else}
		<ul class="mt-6 space-y-3" data-test-id="bug-reports">
			{#each reports as report (report.id)}
				<li>
					<Card.Root data-test-class="bug-report">
						<Card.Content class="space-y-3">
							<div class="flex flex-wrap items-start justify-between gap-4">
								<div class="min-w-0 flex-1 basis-[16rem]">
									<p class="whitespace-pre-wrap">{report.description}</p>
									<p class="text-muted-foreground text-caption mt-1">
										{report.email ?? '—'} · {report.path ?? '—'} · {formatDate(report.created_at)}
									</p>
								</div>
								<div class="flex shrink-0 flex-wrap gap-2">
									<Badge variant="secondary">{t(`admin.reportKind.${report.kind}`)}</Badge>
									<Badge variant={report.status === 'open' ? 'secondary' : 'default'}>
										{t(`admin.reportStatus.${report.status}`)}
									</Badge>
								</div>
							</div>

							{#if report.screenshot}
								<img
									src={report.screenshot}
									alt={t('bugReport.screenshotAlt')}
									class="max-h-64 rounded-lg border"
								/>
							{/if}

							{#if report.status === 'open'}
								<Button
									variant="outline"
									onclick={() => resolveReport(report.id)}
									data-test-class="resolve-bug"
								>
									{t('admin.resolveReport')}
								</Button>
							{/if}
						</Card.Content>
					</Card.Root>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
