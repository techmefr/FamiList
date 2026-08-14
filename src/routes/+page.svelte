<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';

	const lists = [
		{ id: 'l1', name: 'Courses de la semaine', emoji: '🛒', count: 12, done: 3 },
		{ id: 'l2', name: 'Pharmacie & soins', emoji: '💊', count: 5, done: 1 },
		{ id: 'l3', name: 'Réception samedi', emoji: '🎉', count: 7, done: 0 }
	];
</script>

<svelte:head>
	<title>Mes listes — FamiList</title>
</svelte:head>

<h1 class="text-h1 font-semibold">Mes listes</h1>
<p class="text-muted-foreground mt-1 text-label">Données de démonstration, pas encore branchées.</p>

<ul class="mt-6 space-y-3">
	{#each lists as list (list.id)}
		<li>
			<Card.Root data-test="list-card">
				<Card.Content class="flex items-center gap-4">
					<span class="text-h1" aria-hidden="true">{list.emoji}</span>
					<div class="min-w-0 flex-1">
						<p class="text-product truncate font-medium">{list.name}</p>
						<p class="text-muted-foreground text-label">
							{list.done} sur {list.count} articles pris
						</p>
					</div>
					<Badge variant="secondary">{list.count - list.done}</Badge>
				</Card.Content>
			</Card.Root>
		</li>
	{/each}
</ul>
