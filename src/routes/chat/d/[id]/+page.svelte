<script lang="ts">
	import { page } from '$app/state';
	import { data } from '$stores/data.svelte';
	import { t, i18n } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { ArrowLeft, Send } from '@lucide/svelte';
	import Avatar from '$components/app/Avatar.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';

	const conversationId = $derived(page.params.id!);
	const conversation = $derived(data.direct(conversationId));
	const other = $derived(data.otherOf(conversationId));
	const messages = $derived(data.messagesOfConversation(conversationId));

	let body = $state('');

	function send(event: SubmitEvent) {
		event.preventDefault();
		if (!body.trim()) return;

		data.sendDirectMessage(conversationId, body);
		body = '';
	}

	const time = (at: number) =>
		new Intl.DateTimeFormat(i18n.locale, { timeStyle: 'short' }).format(new Date(at));

	const otherName = $derived(other?.name ?? t('chat.someone'));
</script>

<svelte:head>
	<title>{otherName} — {t('app.name')}</title>
</svelte:head>

{#if !data.ready}
	<p class="text-muted-foreground">{t('common.loading')}</p>
{:else if !conversation}
	<p class="text-muted-foreground">{t('chat.directNotFound')}</p>
	<a href="/chat" class="text-primary mt-4 inline-block underline">{t('chat.backToChats')}</a>
{:else}
	<a
		href="/chat"
		class="text-muted-foreground text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2"
	>
		<ArrowLeft size={16} aria-hidden="true" />
		{t('chat.backToChats')}
	</a>

	<h1 class="text-h1 mt-2 flex items-center gap-3 font-semibold">
		{#if other}
			<Avatar member={other} size={36} />
		{/if}
		{otherName}
	</h1>

	<p class="text-caption text-muted-foreground mt-2">{t('chat.directsHint')}</p>

	{#if messages.length === 0}
		<EmptyState illustration="chat" text={t('chat.empty')} testId="direct-empty" />
	{:else}
		<ol class="mt-6 space-y-4">
			{#each messages as message (message.id)}
				{@const mine = message.userId === data.me}

				<li
					class="flex flex-col {mine ? 'items-end' : 'items-start'}"
					data-test-class="direct-message"
				>
					<p class="text-muted-foreground text-caption">
						{mine ? t('household.role.self') : otherName} — {time(message.createdAt)}
					</p>

					<p
						class="text-product mt-1 max-w-[85%] rounded-md px-4 py-2
							{mine ? 'bg-[var(--fl-primary-tint)] text-primary' : 'bg-card border'}"
					>
						{message.body}
					</p>
				</li>
			{/each}
		</ol>
	{/if}

	<form onsubmit={send} class="mt-6 flex gap-2" data-test-id="direct-form">
		<Input
			bind:value={body}
			aria-label={t('chat.messageLabel')}
			placeholder={t('chat.placeholder')}
			data-test-id="direct-input"
			required
		/>
		<Button
			type="submit"
			class="min-w-[44px]"
			data-test-id="direct-send"
			aria-label={t('chat.send')}
		>
			<Send size={18} aria-hidden="true" />
		</Button>
	</form>
{/if}
