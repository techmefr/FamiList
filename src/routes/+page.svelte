<script lang="ts">
	import { flip } from 'svelte/animate';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Plus, Trash2 } from '@lucide/svelte';

	let creating = $state(false);
	let name = $state('');
	let emoji = $state('🛒');

	const stats = (listId: string) => {
		const items = data.itemsOf(listId);
		return { total: items.length, done: items.filter((i) => i.checked).length };
	};

	function create(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) return;

		feedback.play('add');
		data.addList({ name, emoji, color: '#C8532A' });
		name = '';
		emoji = '🛒';
		creating = false;
	}

	/**
	 * Les cartes entrent l'une après l'autre, de haut en bas. Le décalage est plafonné : à quinze
	 * listes, une cascade complète ferait attendre la dernière carte une seconde entière.
	 */
	const STAGGER_MS = 45;
	const STAGGER_MAX = 6;
	const delay = (index: number) => Math.min(index, STAGGER_MAX) * STAGGER_MS;
</script>

<svelte:head>
	<title>{t('lists.title')} — {t('app.name')}</title>
</svelte:head>

<div class="flex flex-wrap items-center justify-between gap-4">
	<h1 class="text-h1 font-semibold">{t('lists.title')}</h1>
	<Button
		onclick={() => {
			feedback.play('tap');
			creating = !creating;
		}}
		data-test="new-list"
		class="fl-press"
	>
		<Plus size={18} aria-hidden="true" />
		{t('lists.new')}
	</Button>
</div>

{#if creating}
	<form
		onsubmit={create}
		transition:slide={{ duration: motionMs(220), easing: cubicOut }}
		class="bg-card mt-4 space-y-3 rounded-md border p-4"
	>
		<div class="grid gap-3 sm:grid-cols-[auto_1fr]">
			<div class="w-20">
				<Label for="list-emoji">{t('lists.emoji')}</Label>
				<Input id="list-emoji" bind:value={emoji} data-test="list-emoji" maxlength={2} />
			</div>
			<div>
				<Label for="list-name">{t('lists.name')}</Label>
				<Input id="list-name" bind:value={name} data-test="list-name" required />
			</div>
		</div>
		<Button type="submit" data-test="list-create" class="fl-press">{t('common.save')}</Button>
	</form>
{/if}

{#if !data.ready}
	<p class="text-muted-foreground mt-6">{t('common.loading')}</p>
{:else if data.lists.length === 0}
	<p class="fl-rise text-muted-foreground mt-6">{t('lists.empty')}</p>
{:else}
	<ul class="mt-6 space-y-3">
		{#each data.lists as list, index (list.id)}
			{@const { total, done } = stats(list.id)}
			<li
				class="fl-rise"
				style="animation-delay: {delay(index)}ms"
				animate:flip={{ duration: motionMs(280), easing: cubicOut }}
				out:slide={{ duration: motionMs(180), easing: cubicOut }}
			>
				<Card.Root data-test="list-card" class="fl-press">
					<Card.Content class="flex flex-wrap items-center gap-x-4 gap-y-3">
						<a href="/l/{list.id}" class="flex min-w-0 flex-auto flex-wrap items-center gap-4">
							<span class="text-h1" aria-hidden="true">{list.emoji}</span>
							<span class="min-w-0 flex-1 basis-[6rem]">
								<span class="text-product block font-medium break-words">{list.name}</span>
								<span class="text-muted-foreground text-label">
									{t('lists.progress', { done, total })}
								</span>
								<span class="bg-muted mt-1.5 block h-1 overflow-hidden rounded-full" aria-hidden="true">
									<span
										class="fl-grow bg-secondary block h-full rounded-full"
										style="width: {total ? Math.round((done / total) * 100) : 0}%"
									></span>
								</span>
							</span>
						</a>
						<Badge variant="secondary">{t('lists.remaining', { count: total - done })}</Badge>
						<button
							type="button"
							onclick={() => {
								feedback.play('remove');
								data.removeList(list.id);
							}}
							aria-label={t('lists.delete', { name: list.name })}
							data-test="list-delete"
							class="fl-press text-muted-foreground grid size-11 shrink-0 place-items-center"
						>
							<Trash2 size={18} aria-hidden="true" />
						</button>
					</Card.Content>
				</Card.Root>
			</li>
		{/each}
	</ul>
{/if}
