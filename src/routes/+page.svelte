<script lang="ts">
	import { data } from '$stores/data.svelte';
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

		data.addList({ name, emoji, color: '#C8532A' });
		name = '';
		emoji = '🛒';
		creating = false;
	}
</script>

<svelte:head>
	<title>{t('lists.title')} — {t('app.name')}</title>
</svelte:head>

<div class="flex items-center justify-between gap-4">
	<h1 class="text-h1 font-semibold">{t('lists.title')}</h1>
	<Button onclick={() => (creating = !creating)} data-test="new-list">
		<Plus size={18} aria-hidden="true" />
		{t('lists.new')}
	</Button>
</div>

{#if creating}
	<form onsubmit={create} class="bg-card mt-4 space-y-3 rounded-md border p-4">
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
		<Button type="submit" data-test="list-create">{t('common.save')}</Button>
	</form>
{/if}

{#if !data.ready}
	<p class="text-muted-foreground mt-6">{t('common.loading')}</p>
{:else if data.lists.length === 0}
	<p class="text-muted-foreground mt-6">{t('lists.empty')}</p>
{:else}
	<ul class="mt-6 space-y-3">
		{#each data.lists as list (list.id)}
			{@const { total, done } = stats(list.id)}
			<li>
				<Card.Root data-test="list-card">
					<Card.Content class="flex items-center gap-4">
						<a href="/l/{list.id}" class="flex min-w-0 flex-1 items-center gap-4">
							<span class="text-h1" aria-hidden="true">{list.emoji}</span>
							<span class="min-w-0 flex-1">
								<span class="text-product block truncate font-medium">{list.name}</span>
								<span class="text-muted-foreground text-label">
									{t('lists.progress', { done, total })}
								</span>
							</span>
						</a>
						<Badge variant="secondary">{t('lists.remaining', { count: total - done })}</Badge>
						<button
							type="button"
							onclick={() => data.removeList(list.id)}
							aria-label={t('lists.delete', { name: list.name })}
							data-test="list-delete"
							class="text-muted-foreground grid size-11 shrink-0 place-items-center"
						>
							<Trash2 size={18} aria-hidden="true" />
						</button>
					</Card.Content>
				</Card.Root>
			</li>
		{/each}
	</ul>
{/if}
