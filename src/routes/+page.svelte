<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { t } from '$lib/i18n/index.svelte';

	const lists = [
		{ id: 'l1', name: 'Courses de la semaine', emoji: '🛒', count: 12, done: 3 },
		{ id: 'l2', name: 'Pharmacie & soins', emoji: '💊', count: 5, done: 1 },
		{ id: 'l3', name: 'Réception samedi', emoji: '🎉', count: 7, done: 0 }
	];
</script>

<svelte:head>
	<title>{t('lists.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('lists.title')}</h1>
<p class="text-muted-foreground text-label mt-1">{t('lists.demoNotice')}</p>

<ul class="mt-6 space-y-3">
	{#each lists as list (list.id)}
		<li>
			<Card.Root data-test="list-card">
				<Card.Content class="flex items-center gap-4">
					<span class="text-h1" aria-hidden="true">{list.emoji}</span>
					<div class="min-w-0 flex-1">
						<p class="text-product truncate font-medium">{list.name}</p>
						<p class="text-muted-foreground text-label">
							{t('lists.progress', { done: list.done, total: list.count })}
						</p>
					</div>
					<Badge variant="secondary">
						{t('lists.remaining', { count: list.count - list.done })}
					</Badge>
				</Card.Content>
			</Card.Root>
		</li>
	{/each}
</ul>
