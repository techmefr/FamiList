<script lang="ts">
	import { page } from '$app/state';
	import { data } from '$stores/data.svelte';
	import { t, i18n } from '$lib/i18n/index.svelte';
	import PollCard from '$components/app/PollCard.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		ArrowLeft,
		Send,
		CalendarDays,
		UtensilsCrossed,
		MessageCircleQuestionMark,
		List
	} from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';

	const listId = $derived(page.params.id!);
	const list = $derived(data.list(listId));
	const messages = $derived(data.messagesOf(listId));

	let body = $state('');
	let composing = $state<'date' | 'apport' | null>(null);
	let question = $state('');
	let choices = $state('');

	/** Parts d'un repas : ce sont celles que le prototype propose, et elles couvrent presque tout. */
	const APPORT_PRESET = [
		{ label: 'Apéritif', emoji: '🍾' },
		{ label: 'Entrée', emoji: '🍞' },
		{ label: 'Plat principal', emoji: '🥘' },
		{ label: 'Dessert', emoji: '🍰' }
	];

	function send(event: SubmitEvent) {
		event.preventDefault();
		if (!body.trim()) return;

		data.sendMessage(listId, body);
		body = '';
	}

	function openPoll(kind: 'date' | 'apport') {
		composing = kind;
		question = kind === 'date' ? t('chat.dateQuestion') : t('chat.apportQuestion');
		choices = kind === 'apport' ? APPORT_PRESET.map((p) => p.label).join('\n') : '';
	}

	function createPoll(event: SubmitEvent) {
		event.preventDefault();
		if (!composing) return;

		const labels = choices
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)
			.map((label) => ({
				label,
				emoji: APPORT_PRESET.find((p) => p.label === label)?.emoji
			}));

		if (labels.length === 0) return;

		data.createPoll(listId, composing, question, labels);
		composing = null;
	}

	const time = (at: number) =>
		new Intl.DateTimeFormat(i18n.locale, { timeStyle: 'short' }).format(new Date(at));
</script>

<svelte:head>
	<title>{t('chat.title')} — {list?.name ?? t('app.name')}</title>
</svelte:head>

{#if !data.ready}
	<p class="text-muted-foreground">{t('common.loading')}</p>
{:else if !list}
	<p class="text-muted-foreground">{t('list.notFound')}</p>
	<a href="/" class="text-primary mt-4 inline-block underline">{t('list.back')}</a>
{:else}
	<a
		href="/l/{listId}"
		class="text-muted-foreground text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2"
	>
		<ArrowLeft size={16} aria-hidden="true" />
		{t('chat.backToList')}
	</a>

	<h1 class="text-h1 mt-2 flex items-center gap-3 font-semibold">
		<span aria-hidden="true">{list.emoji}</span>
		{list.name}
	</h1>

	{#if list.eventDate}
		<p
			class="text-label text-primary mt-3 flex items-center gap-2 rounded-md bg-[var(--fl-primary-tint)] px-4 py-2"
			data-test-id="event-date"
		>
			<CalendarDays size={17} aria-hidden="true" />
			{list.eventDate}
		</p>
	{/if}

	{#if messages.length === 0}
		<EmptyState illustration="chat" text={t('chat.empty')} testId="chat-empty" />
	{:else}
		<ol class="mt-6 space-y-4">
			{#each messages as message (message.id)}
				{@const poll = data.pollOf(message.id)}
				{@const author = data.member(message.userId)}
				{@const mine = message.userId === data.me}

				<li class="flex flex-col {mine ? 'items-end' : 'items-start'}" data-test-class="chat-message">
					<p class="text-muted-foreground text-caption">
						{author?.name ?? t('chat.unknownAuthor')} — {time(message.createdAt)}
					</p>

					{#if message.body}
						<p
							class="text-product mt-1 max-w-[85%] rounded-md px-4 py-2
								{mine ? 'bg-[var(--fl-primary-tint)] text-primary' : 'bg-card border'}"
						>
							{message.body}
						</p>
					{/if}

					{#if poll}
						<div class="w-full">
							<PollCard {poll} {listId} />
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}

	{#if composing}
		<form onsubmit={createPoll} class="bg-card mt-6 space-y-4 rounded-xl border p-4" data-test-id="poll-form">
			<div>
				<Label for="poll-question">{t('chat.question')}</Label>
				<IconField icon={MessageCircleQuestionMark}>
					<Input
						id="poll-question"
						bind:value={question}
						data-test-id="poll-question"
						required
						placeholder={t('chat.questionPlaceholder')}
					/>
				</IconField>
			</div>

			<div>
				<Label for="poll-choices">{t('chat.choices')}</Label>
				<IconField icon={List} align="top">
					<textarea
						id="poll-choices"
						bind:value={choices}
						rows="4"
						placeholder={t('chat.choicesPlaceholder')}
						data-test-id="poll-choices"
						class="border-input bg-background w-full rounded-md border p-2"
					></textarea>
				</IconField>
			</div>

			<div class="flex flex-wrap gap-2">
				<Button type="submit" data-test-id="poll-create">{t('chat.createPoll')}</Button>
				<Button type="button" variant="outline" onclick={() => (composing = null)}>
					{t('common.cancel')}
				</Button>
			</div>
		</form>
	{:else}
		<div class="mt-6 flex flex-wrap gap-2">
			<Button variant="outline" onclick={() => openPoll('date')} data-test-id="new-poll-date">
				<CalendarDays size={16} aria-hidden="true" />
				{t('chat.newDatePoll')}
			</Button>
			<Button variant="outline" onclick={() => openPoll('apport')} data-test-id="new-poll-apport">
				<UtensilsCrossed size={16} aria-hidden="true" />
				{t('chat.newApportPoll')}
			</Button>
		</div>
	{/if}

	<!--
		aria-label et pas seulement le placeholder : celui-ci n'est pas un nom accessible, et il
		disparaît dès la première lettre tapée. min-w-[44px] sur le bouton parce qu'il ne porte qu'une
		icône — il tombait à 43 px de large, un pixel sous la cible tactile.
	-->
	<form onsubmit={send} class="mt-4 flex gap-2" data-test-id="chat-form">
		<Input
			bind:value={body}
			aria-label={t('chat.messageLabel')}
			placeholder={t('chat.placeholder')}
			data-test-id="chat-input"
			required
		/>
		<Button type="submit" class="min-w-[44px]" data-test-id="chat-send" aria-label={t('chat.send')}>
			<Send size={18} aria-hidden="true" />
		</Button>
	</form>
{/if}
