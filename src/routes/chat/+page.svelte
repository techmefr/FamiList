<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { settings } from '$stores/settings.svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import * as Card from '$lib/components/ui/card';
	import EmptyState from '$components/app/EmptyState.svelte';
	import { MessagesSquare } from '@lucide/svelte';

	/**
	 * Une discussion est rattachée à une liste — `messages.list_id`, route `/l/[id]/chat`. Il n'y a
	 * donc pas de discussion globale vers laquelle pointer : cet écran est l'index des listes du
	 * foyer, chacune avec son dernier message. C'est ce qui manquait pour que le chat soit
	 * atteignable autrement qu'en ouvrant une liste et en cherchant son bouton.
	 */
	const rows = $derived(
		data.lists.map((list) => {
			const messages = data.messagesOf(list.id);
			return { list, last: messages.at(-1) };
		})
	);

	/** L'heure du dernier message, dans la langue de l'écran. Aujourd'hui l'heure, sinon la date. */
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

{#if rows.length === 0}
	<EmptyState illustration="chat" text={t('chat.indexEmpty')} testId="chats-empty" />
{:else}
	<ul class="mt-6 space-y-3" data-test-id="chat-list">
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
								<span class="text-caption text-muted-foreground shrink-0">{when(last.createdAt)}</span>
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
