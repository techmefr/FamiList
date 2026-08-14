<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { t, i18n } from '$lib/i18n/index.svelte';
	import { Trash2 } from '@lucide/svelte';
</script>

<svelte:head>
	<title>{t('cards.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('cards.title')}</h1>

{#if !data.ready}
	<p class="text-muted-foreground mt-6">{t('common.loading')}</p>
{:else if data.cards.length === 0}
	<p class="text-muted-foreground mt-6">{t('cards.empty')}</p>
{:else}
	<ul class="mt-6 space-y-4">
		{#each data.cards as card (card.id)}
			<li>
				<article
					class="rounded-lg p-4 text-white shadow-[var(--fl-shadow-2)]"
					style="background: {card.grad}"
					data-test="loyalty-card"
				>
					<div class="flex items-start gap-3">
						<div class="min-w-0 flex-1">
							<h2 class="text-h2 font-medium">{card.name}</h2>
							<p class="text-label opacity-80">{card.num}</p>
						</div>
						<button
							type="button"
							onclick={() => data.removeCard(card.id)}
							aria-label={t('cards.delete', { name: card.name })}
							data-test="card-delete"
							class="grid size-11 shrink-0 place-items-center text-white/80"
						>
							<Trash2 size={18} aria-hidden="true" />
						</button>
					</div>

					<p class="text-display mt-4 font-semibold">{i18n.number(card.points)}</p>
					<p class="text-caption opacity-80">{t('cards.points')}</p>

					{#if card.notes}
						<p class="text-label mt-3 opacity-90">{card.notes}</p>
					{/if}
				</article>
			</li>
		{/each}
	</ul>

	<p class="text-muted-foreground text-caption mt-6">{t('cards.secretNotice')}</p>
{/if}
