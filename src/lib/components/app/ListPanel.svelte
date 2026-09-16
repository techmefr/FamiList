<script lang="ts">
	import { page } from '$app/state';
	import { t } from '$lib/i18n/index.svelte';
	import { data } from '$stores/data.svelte';

	/**
	 * L'inventaire des listes, posé à demeure entre la navigation et le contenu.
	 *
	 * Il n'ouvre rien de neuf : chaque entrée est un lien vers `/l/[id]`, la même route qu'ailleurs.
	 * Un lien partagé entre membres du foyer continue donc de s'ouvrir directement, et se retrouve
	 * simplement accompagné du panneau sur un grand écran.
	 *
	 * Sur l'accueil, l'inventaire est affiché deux fois : ici, et dans la page. Ce n'est pas un
	 * oubli — les deux ne servent pas à la même chose. La page est l'écran de gestion, avec le
	 * formulaire, le renommage, la duplication et la corbeille ; le panneau est l'aiguillage, et il
	 * doit rester identique d'une page à l'autre pour qu'on sache où cliquer sans regarder.
	 *
	 * Sa visibilité est décidée en CSS seul (`.fl-list-panel`) : hors du régime le plus large il
	 * n'est pas masqué, il n'est pas rendu du tout aux lecteurs d'écran, qui n'ont donc jamais deux
	 * chemins vers la même liste.
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
