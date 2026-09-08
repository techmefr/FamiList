<script lang="ts">
	import { supabase } from '$db/supabase';
	import { session } from '$stores/session.svelte';
	import { t, i18n } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';

	interface PendingAccount {
		id: string;
		display_name: string;
		email: string;
		requested_at: string;
		status: string;
		is_demo: boolean;
	}

	let accounts = $state<PendingAccount[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function load() {
		loading = true;
		const { data, error: rpcError } = await supabase.rpc('pending_accounts');

		// Un non-admin reçoit une erreur, pas une liste vide : la distinction évite de croire
		// qu'il n'y a personne en attente alors qu'on n'a simplement pas le droit de regarder.
		error = rpcError?.message ?? null;
		accounts = (data as PendingAccount[]) ?? [];
		loading = false;
	}

	async function review(id: string, decision: 'approved' | 'rejected') {
		const { error: rpcError } = await supabase.rpc('review_account', { target: id, decision });
		if (rpcError) {
			error = rpcError.message;
			return;
		}
		await load();
	}

	async function setDemo(id: string, demo: boolean) {
		const { error: rpcError } = await supabase.rpc('set_demo', { target: id, demo });
		error = rpcError?.message ?? null;
		await load();
	}

	async function resetDemo() {
		const { error: rpcError } = await supabase.rpc('reset_demo');
		error = rpcError?.message ?? null;
		notice = rpcError ? null : t('admin.demoReset');
	}

	let notice = $state<string | null>(null);

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
	{#if error}
		<p class="text-destructive mt-6" role="alert">{error}</p>
	{/if}

	{#if notice}
		<p class="text-primary mt-6" role="status" data-test-id="admin-notice">{notice}</p>
	{/if}

	{#if accounts.some((account) => account.is_demo)}
		<div class="bg-card mt-6 rounded-xl border p-4">
			<p class="text-label">{t('admin.demoHint')}</p>
			<Button variant="outline" onclick={resetDemo} data-test-id="reset-demo" class="mt-3">
				{t('admin.resetDemo')}
			</Button>
		</div>
	{/if}

	{#if accounts.length === 0}
		<p class="text-muted-foreground mt-6" data-test-id="admin-empty">{t('admin.empty')}</p>
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

							{#if account.is_demo}
								<Badge variant="secondary" data-test-class="demo-badge">{t('admin.demo')}</Badge>
							{/if}

							{#if !self && account.status !== 'approved'}
								<Button onclick={() => review(account.id, 'approved')} data-test-class="admin-approve">
									{t('admin.approve')}
								</Button>
							{/if}
							{#if !self && account.status !== 'rejected'}
								<Button
									variant="outline"
									onclick={() => review(account.id, 'rejected')}
									data-test-class="admin-reject"
								>
									{t('admin.reject')}
								</Button>
							{/if}

							{#if !self}
								<Button
									variant="outline"
									onclick={() => setDemo(account.id, !account.is_demo)}
									data-test-class="toggle-demo"
								>
									{account.is_demo ? t('admin.unsetDemo') : t('admin.setDemo')}
								</Button>
							{/if}
						</Card.Content>
					</Card.Root>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
