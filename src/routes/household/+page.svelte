<script lang="ts">
	import { supabase } from '$db/supabase';
	import { data } from '$stores/data.svelte';
	import { sync } from '$lib/sync/index.svelte';
	import { t, i18n } from '$lib/i18n/index.svelte';
	import { tintForWhiteText } from '$domain/tint';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Users, Copy, Check, KeyRound } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';

	let invite = $state<{ code: string; expires: string } | null>(null);
	let joinCode = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);
	let copied = $state(false);

	async function createInvite() {
		busy = true;
		error = null;

		const { data: code, error: rpcError } = await supabase.rpc('create_invite');

		busy = false;
		if (rpcError) {
			error = rpcError.message;
			return;
		}

		const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000);
		invite = {
			code: code as unknown as string,
			expires: new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'long' }).format(expires)
		};
	}

	async function copyCode() {
		if (!invite) return;

		await navigator.clipboard.writeText(invite.code);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	async function join(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;

		const { error: rpcError } = await supabase.rpc('redeem_invite', { invite_code: joinCode });

		if (rpcError) {
			busy = false;
			error = rpcError.message;
			return;
		}

		// Le foyer a changé : tout le cache local appartient à l'ancien, il faut repartir du serveur.
		await data.reload();
		busy = false;
		joinCode = '';
	}

	async function leave() {
		if (!sync.householdId) return;

		busy = true;
		error = null;

		const { error: rpcError } = await supabase.rpc('leave_household', { target: sync.householdId });

		if (rpcError) {
			busy = false;
			error = rpcError.message;
			return;
		}

		await data.reload();
		busy = false;
	}
</script>

<svelte:head>
	<title>{t('household.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('household.title')}</h1>

{#if error}
	<p class="text-destructive mt-6" role="alert" data-test-id="household-error">{error}</p>
{/if}

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			<Users size={20} aria-hidden="true" />
			{t('household.members')}
		</Card.Title>
	</Card.Header>
	<Card.Content>
		<ul class="space-y-2">
			{#each data.members as member (member.id)}
				<li class="flex flex-wrap items-center gap-3" data-test-class="household-member">
					<span
						class="text-caption grid size-9 shrink-0 place-items-center rounded-full font-semibold text-white"
						style="background: {tintForWhiteText(member.tint)}"
						aria-hidden="true"
					>
						{member.initial}
					</span>
					<span class="text-product min-w-0 flex-1 basis-[8rem]">{member.name}</span>
					<span class="text-muted-foreground text-caption">{t(`household.role.${member.role}`)}</span>
				</li>
			{/each}
		</ul>

		{#if data.members.length > 1}
			<Button variant="outline" onclick={leave} disabled={busy} data-test-id="household-leave" class="mt-4">
				{t('household.leave')}
			</Button>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('household.inviteTitle')}</Card.Title>
	</Card.Header>
	<Card.Content>
		<p class="text-muted-foreground text-label">{t('household.inviteHint')}</p>

		{#if invite}
			<div class="mt-4 flex flex-wrap items-center gap-3">
				<p class="text-display font-mono tracking-[0.3em]" data-test-id="invite-code">{invite.code}</p>
				<Button variant="outline" onclick={copyCode} data-test-id="invite-copy">
					{#if copied}
						<Check size={16} aria-hidden="true" />
						{t('household.copied')}
					{:else}
						<Copy size={16} aria-hidden="true" />
						{t('household.copy')}
					{/if}
				</Button>
			</div>
			<p class="text-muted-foreground text-caption mt-2">
				{t('household.inviteExpires', { date: invite.expires })}
			</p>
		{:else}
			<Button onclick={createInvite} disabled={busy} data-test-id="invite-create" class="mt-4">
				{t('household.createInvite')}
			</Button>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('household.joinTitle')}</Card.Title>
	</Card.Header>
	<Card.Content>
		<p class="text-muted-foreground text-label">{t('household.joinHint')}</p>

		<form onsubmit={join} class="mt-4 flex flex-wrap items-end gap-3" data-test-id="join-form">
			<div class="flex-1">
				<Label for="join-code">{t('household.code')}</Label>
				<IconField icon={KeyRound}>
					<Input
						id="join-code"
						bind:value={joinCode}
						data-test-id="join-code"
						maxlength={6}
						autocapitalize="characters"
						class="font-mono tracking-[0.3em] uppercase"
						required
						placeholder={t('household.codePlaceholder')}
					/>
				</IconField>
			</div>
			<Button type="submit" disabled={busy} data-test-id="join-submit">{t('household.join')}</Button>
		</form>
	</Card.Content>
</Card.Root>
