<script lang="ts">
	import { goto } from '$app/navigation';
	import { data } from '$stores/data.svelte';
	import { settings } from '$stores/settings.svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import Avatar from '$components/app/Avatar.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';
	import { MessagesSquare, Plus } from '@lucide/svelte';

	/**
	 * Two scopes live side by side here. A list discussion is attached to its list — `list_id`, route
	 * `/l/[id]/chat` — and is shared with the circle. A private message, for its part, belongs to no circle:
	 * it is the choice that removes the ambiguity of two people who are members of several shared circles,
	 * and the reason the two do not mix on screen.
	 */
	const rows = $derived(
		data.lists.map((list) => {
			const messages = data.messagesOf(list.id);
			return { list, last: messages.at(-1) };
		})
	);

	let picking = $state(false);
	let failed = $state(false);

	async function open(otherId: string) {
		failed = false;

		const conversationId = await data.startDirect(otherId);
		if (!conversationId) {
			failed = true;
			return;
		}

		picking = false;
		await goto(`/chat/d/${conversationId}`);
	}

	/** The time of the last message, in the screen's language. Today the time, otherwise the date. */
	function when(createdAt: number) {
		const date = new Date(createdAt);
		if (Number.isNaN(date.getTime())) return '';

		const sameDay = new Date().toDateString() === date.toDateString();

		return new Intl.DateTimeFormat(
			i18n.locale,
			sameDay ? { hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short' }
		).format(date);
	}

	const STAGGER_MS = 45;
	const STAGGER_MAX = 6;
	const delay = (index: number) => Math.min(index, STAGGER_MAX) * STAGGER_MS;
</script>

<svelte:head>
	<title>{t('chat.indexTitle')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('chat.indexTitle')}</h1>

<section aria-labelledby="direct-heading" class="mt-6">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2 id="direct-heading" class="text-h2 font-semibold">{t('chat.directs')}</h2>
		<Button variant="outline" onclick={() => (picking = !picking)} data-test-id="new-direct">
			<Plus size={16} aria-hidden="true" />
			{t('chat.newDirect')}
		</Button>
	</div>

	<p class="text-caption text-muted-foreground mt-1">{t('chat.directsHint')}</p>

	{#if picking}
		<div class="bg-card mt-4 rounded-xl border p-4" data-test-id="direct-picker">
			<h3 class="text-label font-medium">{t('chat.newDirectTitle')}</h3>

			{#if data.directCandidates.length === 0}
				<p class="text-caption text-muted-foreground mt-2">{t('chat.noDirectCandidates')}</p>
			{:else}
				<ul class="mt-3 space-y-2">
					{#each data.directCandidates as candidate (candidate.id)}
						<li>
							<button
								type="button"
								onclick={() => open(candidate.id)}
								data-test-class="direct-candidate"
								class="hover:bg-muted flex min-h-[max(2.75rem,44px)] w-full items-center gap-3 rounded-md px-2 text-left"
							>
								<Avatar member={candidate} size={32} />
								<span class="text-label truncate">{candidate.name}</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if failed}
				<p class="text-destructive text-caption mt-3" role="alert" data-test-id="direct-error">
					{t('chat.directFailed')}
				</p>
			{/if}
		</div>
	{/if}

	{#if data.directs.length === 0}
		<p class="text-muted-foreground text-label mt-4" data-test-id="directs-empty">
			{t('chat.directsEmpty')}
		</p>
	{:else}
		<ul class="mt-4 space-y-3" data-test-id="direct-list">
			{#each data.directs as summary (summary.conversationId)}
				{@const other = data.member(summary.otherId)}
				<li>
					<a
						href="/chat/d/{summary.conversationId}"
						data-test-class="direct-entry"
						class="fl-press block"
					>
						<Card.Root class="hover:border-primary transition-colors">
							<Card.Content class="flex items-center gap-3 py-4">
								{#if other}
									<Avatar member={other} size={36} />
								{:else}
									<MessagesSquare size={18} class="text-muted-foreground shrink-0" aria-hidden="true" />
								{/if}

								<span class="min-w-0 flex-1">
									<span class="text-label block truncate font-medium">
										{other?.name ?? t('chat.someone')}
									</span>
									<span class="text-caption text-muted-foreground block truncate">
										{summary.lastBody || t('chat.empty')}
									</span>
								</span>

								{#if summary.lastAt > 0}
									<span class="text-caption text-muted-foreground shrink-0">
										{when(summary.lastAt)}
									</span>
								{/if}
							</Card.Content>
						</Card.Root>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section aria-labelledby="list-chats-heading" class="mt-10">
	<h2 id="list-chats-heading" class="text-h2 font-semibold">{t('chat.listSection')}</h2>

	{#if rows.length === 0}
		<EmptyState illustration="chat" text={t('chat.indexEmpty')} testId="chats-empty" />
	{:else}
		<ul class="mt-4 space-y-3" data-test-id="chat-list">
			{#each rows as { list, last }, index (list.id)}
				<li
					class:fl-rise={settings.animates}
					style={settings.animates ? `animation-delay: ${delay(index)}ms` : undefined}
				>
					<a href="/l/{list.id}/chat" data-test-class="chat-entry" class="fl-press block">
						<Card.Root class="hover:border-primary transition-colors">
							<Card.Content class="flex items-center gap-3 py-4">
								<span class="text-h2" aria-hidden="true">{list.emoji}</span>

								<span class="min-w-0 flex-1">
									<span class="text-label block truncate font-medium">{list.name}</span>
									<span class="text-caption text-muted-foreground block truncate">
										{#if last}
											{last.body}
										{:else}
											{t('chat.empty')}
										{/if}
									</span>
								</span>

								{#if last}
									<span class="text-caption text-muted-foreground shrink-0">
										{when(last.createdAt)}
									</span>
								{:else}
									<MessagesSquare size={18} class="text-muted-foreground shrink-0" aria-hidden="true" />
								{/if}
							</Card.Content>
						</Card.Root>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
