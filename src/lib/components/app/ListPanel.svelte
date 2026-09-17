<script lang="ts">
	import { page } from '$app/state';
	import { t } from '$lib/i18n/index.svelte';
	import { data } from '$stores/data.svelte';

	/**
	 * The inventory of lists, sitting permanently between the navigation and the content.
	 *
	 * It opens nothing new: each entry is a link to `/l/[id]`, the same route as anywhere else. A link shared
	 * between household members therefore goes on opening directly, and is simply accompanied by the panel on
	 * a large screen.
	 *
	 * On the home screen, the inventory is shown twice: here, and in the page. That is not an oversight — the
	 * two do not serve the same purpose. The page is the management screen, with the form, renaming,
	 * duplication and the bin; the panel is the switchboard, and it must stay identical from one page to the
	 * next so you know where to click without looking.
	 *
	 * Its visibility is decided in CSS alone (`.fl-list-panel`): outside the widest regime it is not hidden,
	 * it is not rendered at all for screen readers, which therefore never have two paths to the same list.
	 */
	const stats = (listId: string) => {
		const items = data.itemsOf(listId);
		return { total: items.length, done: items.filter((item) => item.checked).length };
	};

	const isActive = (id: string) => page.url.pathname === `/l/${id}`;
</script>

<nav class="fl-list-panel bg-card" aria-labelledby="list-panel-title" data-test-id="list-panel">
	<p id="list-panel-title" class="text-label text-muted-foreground px-4 pt-6 pb-3 font-semibold">
		{t('lists.title')}
	</p>

	{#if data.lists.length === 0}
		<p class="text-muted-foreground text-label px-4">{t('lists.empty')}</p>
	{:else}
		<ul class="flex flex-col gap-1 px-2 pb-6">
			{#each data.lists as list (list.id)}
				{@const { total, done } = stats(list.id)}
				{@const active = isActive(list.id)}
				<li>
					<a
						href="/l/{list.id}"
						data-test-class="list-panel-entry"
						aria-current={active ? 'page' : undefined}
						class="fl-press flex items-center gap-3 rounded-lg px-3 py-3 {active
							? 'bg-[var(--fl-primary-tint)] text-primary font-medium'
							: 'text-foreground'}"
					>
						<span class="text-h2 shrink-0" aria-hidden="true">{list.emoji}</span>
						<span class="min-w-0 flex-1">
							<span class="text-label block break-words">{list.name}</span>
							<span class="text-caption text-muted-foreground block">
								{t('lists.progress', { done, total })}
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</nav>
