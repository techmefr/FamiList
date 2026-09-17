<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$db/supabase';
	import { session } from '$stores/session.svelte';
	import { householdErrorKey } from '$domain/household-error';
	import { readInviteOutcome } from '$domain/invite-outcome';
	import { data } from '$stores/data.svelte';
	import { sync } from '$lib/sync/index.svelte';
	import { t, i18n } from '$lib/i18n/index.svelte';
	import { tintForWhiteText } from '$domain/tint';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Users, Copy, Check, KeyRound, CircleDot } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';

	let invite = $state<{ code: string; expires: string } | null>(null);
	let joinCode = $state('');
	let renaming = $state('');

	const circleName = $derived(data.circleName(data.circle));
	let error = $state<string | null>(null);
	let secondFacteurRequis = $state(false);
	let busy = $state(false);
	let copied = $state(false);

	/**
	 * A refusal from the database, said in the person's language — and, when the cause is a session left at
	 * the password stage, with the door to get out of it.
	 *
	 * The authentication level is read again before concluding: "invalid account" covers both an account
	 * awaiting approval and a second factor not yet presented, and what the client believes about the
	 * session may come from a read that failed.
	 */
	async function montrerRefus(message: string) {
		await session.refreshLevels();
		secondFacteurRequis = session.needsSecondFactor;
		error = t(householdErrorKey(message, secondFacteurRequis));
	}

	async function createInvite() {
		busy = true;
		error = null;

		const { data: code, error: rpcError } = await supabase.rpc('create_invite');

		busy = false;
		if (rpcError) {
			await montrerRefus(rpcError.message);
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

		const { data: reponse, error: rpcError } = await supabase.rpc('redeem_invite', {
			invite_code: joinCode
		});

		if (rpcError) {
			busy = false;
			await montrerRefus(rpcError.message);
			return;
		}

		// A refused code no longer arrives as an exception: the database must be able to record the attempt,
		// which a rolled-back transaction would forbid.
		const issue = readInviteOutcome(reponse);

		if (issue.errorKey) {
			busy = false;
			error = t(issue.errorKey);
			return;
		}

		// We stay a member of the previous household — joining one no longer means leaving one. So this is
		// where we say which to look at, otherwise the reload would take the oldest again.
		if (issue.householdId) sync.adopt(issue.householdId);

		// The displayed household has changed: the whole local cache belongs to the other one, we start again
		// from the server.
		await data.reload();
		busy = false;
		joinCode = '';
	}

	/**
	 * The circle name, which the selector is the first to make necessary: two circles created at sign-up
	 * carry the same default name, and a list of duplicates cannot be chosen from.
	 */
	async function rename(event: SubmitEvent) {
		event.preventDefault();

		const nom = renaming.trim();
		if (!nom || !sync.householdId) return;

		busy = true;
		error = null;

		const { error: rpcError } = await supabase
			.from('households')
			.update({ name: nom })
			.eq('id', sync.householdId);

		busy = false;
		if (rpcError) {
			await montrerRefus(rpcError.message);
			return;
		}

		renaming = '';
		await sync.households();
	}

	async function leave() {
		if (!sync.householdId) return;

		busy = true;
		error = null;

		const { error: rpcError } = await supabase.rpc('leave_household', { target: sync.householdId });

		if (rpcError) {
			busy = false;
			await montrerRefus(rpcError.message);
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
	<div class="mt-6" role="alert" data-test-id="household-error">
		<p class="text-destructive">{error}</p>

		<!--
			The only refusal with an immediate way out: the person does have their verification code, all they are
			missing is the screen to type it on.
		-->
		{#if secondFacteurRequis}
			<Button
				variant="outline"
				onclick={() => goto('/auth/mfa')}
				data-test-id="household-second-factor"
				class="mt-3"
			>
				{t('household.goToSecondFactor')}
			</Button>
		{/if}
	</div>
{/if}

<!--
	The circles, and the one being looked at.

	Only one circle is active at a time: it is the one deciding which lists, shops, aisles and cards are
	shown, and it is where what you create lands. The others stay read and cached — switching reads nothing
	again and works with no network.

	The card disappears when there is only one circle: there is then nothing to choose, and a one-item list
	would only invite the question of what it is for.
-->
{#if data.circles.length > 1}
	<Card.Root class="mt-6">
		<Card.Header>
			<Card.Title class="text-h2 flex items-center gap-2">
				<CircleDot size={20} aria-hidden="true" />
				{t('household.circles')}
			</Card.Title>
		</Card.Header>
		<Card.Content>
			<p class="text-muted-foreground text-label">{t('household.circlesHint')}</p>

			<ul class="mt-4 space-y-1">
				{#each data.circles as circle (circle.id)}
					{@const actif = circle.id === data.circle}
					<li>
						<button
							type="button"
							onclick={() => data.switchCircle(circle.id)}
							aria-current={actif ? 'true' : undefined}
							data-test-class="circle-option"
							class="fl-press hover:bg-muted flex min-h-[max(3.5rem,56px)] w-full items-center gap-3 rounded-lg px-3 text-start"
							class:bg-muted={actif}
						>
							<span class="text-product min-w-0 flex-1 font-medium">{circle.name}</span>
							{#if actif}
								<span class="text-secondary text-caption inline-flex shrink-0 items-center gap-1 font-semibold">
									<Check size={16} aria-hidden="true" />
									{t('household.circleShown')}
								</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		</Card.Content>
	</Card.Root>
{/if}

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			<Users size={20} aria-hidden="true" />
			{t('household.members')}
		</Card.Title>
	</Card.Header>
	<Card.Content>
		<!--
			The name of the displayed circle. It served no purpose while only one was visible; it becomes what
			tells two circles apart in the selector, and all are born with the same default name.
		-->
		<form onsubmit={rename} class="mb-6">
			<Label for="circle-name">{t('household.nameLabel')}</Label>
			<div class="mt-2 flex flex-wrap items-center gap-3">
				<Input
					id="circle-name"
					value={renaming || circleName}
					oninput={(event) => (renaming = event.currentTarget.value)}
					data-test-id="circle-name"
					class="min-w-0 flex-1 basis-[12rem]"
				/>
				<Button type="submit" variant="outline" disabled={busy} data-test-id="circle-rename">
					{t('household.rename')}
				</Button>
			</div>
		</form>

		<ul class="space-y-2">
			{#each data.members as member (member.key)}
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
