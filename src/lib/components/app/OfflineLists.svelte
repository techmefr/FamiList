<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$i18n/index.svelte';
	import { offlineLists } from '$stores/offline-lists.svelte';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Plus, Trash2 } from '@lucide/svelte';

	onMount(() => {
		void offlineLists.load();
	});

	let newListName = $state('');
	let openListId = $state<string | null>(null);
	let newItemName = $state('');

	async function createList() {
		if (newListName.trim() === '') return;
		const list = await offlineLists.addList(newListName);
		newListName = '';
		openListId = list.id;
	}

	async function addItem() {
		if (!openListId) return;
		await offlineLists.addItem(openListId, newItemName);
		newItemName = '';
	}

	const openList = $derived(offlineLists.lists.find((list) => list.id === openListId) ?? null);
</script>

<section class="mt-8 space-y-4" data-test-id="offline-lists">
	<div>
		<h2 class="text-h2 font-semibold">{t('offline.title')}</h2>
		<p class="text-muted-foreground text-caption mt-1">{t('offline.body')}</p>
	</div>

	{#if openList}
		<div class="space-y-3">
			<button
				type="button"
				onclick={() => (openListId = null)}
				data-test-id="offline-back"
				class="fl-press text-label text-primary font-medium"
			>
				{t('offline.back')}
			</button>

			<h3 class="text-product font-semibold">{openList.name}</h3>

			<form
				onsubmit={(event) => {
					event.preventDefault();
					void addItem();
				}}
				class="flex gap-2"
			>
				<Input
					bind:value={newItemName}
					placeholder={t('offline.itemPlaceholder')}
					data-test-id="offline-item-name"
					class="flex-1"
				/>
				<Button type="submit" data-test-id="offline-item-add">
					<Plus size={18} aria-hidden="true" />
				</Button>
			</form>

			<ul class="space-y-2">
				{#each offlineLists.itemsOf(openList.id) as item (item.id)}
					<li class="bg-card flex items-center gap-3 rounded-lg border p-3" data-test-class="offline-item">
						<input
							type="checkbox"
							checked={item.checked}
							onchange={() => offlineLists.toggleItem(item.id)}
							data-test-class="offline-item-check"
							class="size-5"
						/>
						<span class="flex-1 {item.checked ? 'text-muted-foreground line-through' : ''}"
							>{item.name}</span
						>
						<button
							type="button"
							onclick={() => offlineLists.removeItem(item.id)}
							aria-label={t('cards.delete', { name: item.name })}
							data-test-class="offline-item-remove"
							class="fl-press text-muted-foreground grid size-9 place-items-center"
						>
							<Trash2 size={16} aria-hidden="true" />
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<form
			onsubmit={(event) => {
				event.preventDefault();
				void createList();
			}}
			class="flex gap-2"
		>
			<Input
				bind:value={newListName}
				placeholder={t('offline.listPlaceholder')}
				data-test-id="offline-list-name"
				class="flex-1"
			/>
			<Button type="submit" data-test-id="offline-list-add">
				<Plus size={18} aria-hidden="true" />
			</Button>
		</form>

		<ul class="space-y-2">
			{#each offlineLists.lists as list (list.id)}
				<li class="bg-card flex items-center gap-3 rounded-lg border p-3" data-test-class="offline-list">
					<button
						type="button"
						onclick={() => (openListId = list.id)}
						data-test-class="offline-list-open"
						class="fl-press flex-1 text-start font-medium"
					>
						{list.name}
					</button>
					<button
						type="button"
						onclick={() => offlineLists.removeList(list.id)}
						aria-label={t('cards.delete', { name: list.name })}
						data-test-class="offline-list-remove"
						class="fl-press text-muted-foreground grid size-9 place-items-center"
					>
						<Trash2 size={16} aria-hidden="true" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>
