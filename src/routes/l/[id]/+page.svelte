<script lang="ts">
	import { page } from '$app/state';
	import { flip } from 'svelte/animate';
	import { fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import type { Item } from '$db/schema';
	import ShopSwitcher from '$components/app/ShopSwitcher.svelte';
	import ItemRow from '$components/app/ItemRow.svelte';
	import AddItemForm from '$components/app/AddItemForm.svelte';
	import ShareSheet from '$components/app/ShareSheet.svelte';
	import { createDrag, move } from '$components/app/drag.svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		ChevronUp,
		ChevronDown,
		ArrowLeft,
		GripVertical,
		MessagesSquare,
		UsersRound
	} from '@lucide/svelte';

	const listId = $derived(page.params.id!);
	const list = $derived(data.list(listId));
	const groups = $derived(data.groupedItems(listId));

	let share = $state<ShareSheet | null>(null);

	/**
	 * Les prénoms plutôt qu'un décompte : « Avec Hélène et Marc » se lit d'un coup d'œil, « 2
	 * participants » demande d'ouvrir la feuille pour savoir de qui il s'agit.
	 *
	 * `Intl.ListFormat` s'occupe du « et » et des virgules — ce sont des règles de langue, pas des
	 * chaînes à traduire, et elles diffèrent d'une langue à l'autre.
	 */
	const others = $derived(
		(list?.memberIds ?? [])
			.filter((id) => id !== data.me)
			.map((id) => data.member(id)?.name)
			.filter((name): name is string => Boolean(name))
	);

	const sharedWith = $derived(
		others.length === 0
			? t('share.aloneSummary')
			: t('share.summary', {
					names: new Intl.ListFormat(i18n.locale, { type: 'conjunction' }).format(others)
				})
	);

	let priorityOnly = $state(false);
	let hideChecked = $state(false);

	const visible = $derived(
		groups
			.map((group) => ({
				...group,
				items: group.items.filter(
					(item) => (!priorityOnly || item.priority) && (!hideChecked || !item.checked)
				)
			}))
			.filter((group) => group.items.length > 0)
	);

	const total = $derived(data.itemsOf(listId).length);
	const done = $derived(data.itemsOf(listId).filter((i) => i.checked).length);

	/**
	 * L'écran ne montre que les rayons non vides : on réinjecte les rayons masqués à la fin, sinon
	 * réordonner ferait disparaître le parcours appris des rayons momentanément vides.
	 */
	function commitAisleOrder(visibleOrder: string[]) {
		const previous = data.activeLayout?.aisleOrder ?? data.aisles.map((a) => a.id);
		const hidden = previous.filter((id) => !visibleOrder.includes(id));
		data.reorderAisles([...visibleOrder, ...hidden]);
	}

	function moveAisle(from: number, to: number) {
		commitAisleOrder(move(visible.map((g) => g.aisleId), from, to));
	}

	function moveItem(aisleId: string, items: Item[], from: number, to: number) {
		if (to < 0 || to >= items.length) return;
		data.reorderItems(aisleId, move(items, from, to));
	}

	const aisleDrag = createDrag(moveAisle);
</script>

<svelte:head>
	<title>{list?.name ?? t('lists.title')} — {t('app.name')}</title>
</svelte:head>

{#if !data.ready}
	<p class="text-muted-foreground">{t('common.loading')}</p>
{:else if !list}
	<p class="text-muted-foreground">{t('list.notFound')}</p>
	<a href="/" class="text-primary mt-4 inline-block underline">{t('list.back')}</a>
{:else}
	<a href="/" class="text-muted-foreground text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2">
		<ArrowLeft size={16} aria-hidden="true" />
		{t('list.back')}
	</a>

	<h1 class="text-h1 mt-2 flex flex-wrap items-center gap-3 font-semibold">
		<span aria-hidden="true">{list.emoji}</span>
		<span class="min-w-0 break-words">{list.name}</span>
	</h1>
	<p class="text-muted-foreground text-label mt-1">{t('lists.progress', { done, total })}</p>

	<!-- Le texte au-dessus dit déjà l'avancement : la barre n'est là que pour le montrer bouger. -->
	<div class="bg-muted mt-2 h-1.5 overflow-hidden rounded-full" aria-hidden="true">
		<div
			class="fl-grow bg-secondary h-full rounded-full"
			style="width: {total ? Math.round((done / total) * 100) : 0}%"
			data-test-id="list-progress"
		></div>
	</div>

	<div class="mt-3 flex flex-wrap items-center gap-x-5">
		<a
			href="/l/{listId}/chat"
			data-test-id="open-chat"
			class="text-primary text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2 underline"
		>
			<MessagesSquare size={16} aria-hidden="true" />
			{t('chat.open')}
		</a>

		<button
			type="button"
			onclick={() => share?.show()}
			data-test-id="open-share"
			aria-haspopup="dialog"
			class="text-primary text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2 underline"
		>
			<UsersRound size={16} aria-hidden="true" />
			{t('share.open')}
		</button>
	</div>

	<p class="text-muted-foreground text-caption" data-test-id="share-summary">{sharedWith}</p>

	<ShareSheet bind:this={share} {listId} />

	<div class="mt-6">
		<ShopSwitcher />
	</div>

	<div class="mt-4 flex flex-wrap items-center gap-2">
		<label
			class="border-input flex min-h-[max(2.75rem,44px)] cursor-pointer items-center gap-2 rounded-full border px-4 py-2"
		>
			<input type="checkbox" bind:checked={priorityOnly} data-test-id="filter-priority" />
			<span class="text-label">{t('list.priorityOnly')}</span>
		</label>
		<label
			class="border-input flex min-h-[max(2.75rem,44px)] cursor-pointer items-center gap-2 rounded-full border px-4 py-2"
		>
			<input type="checkbox" bind:checked={hideChecked} data-test-id="filter-hide-checked" />
			<span class="text-label">{t('list.hideChecked')}</span>
		</label>
		{#if done > 0}
			<Button
				variant="outline"
				onclick={() => {
					feedback.play('success');
					data.clearChecked(listId);
				}}
				data-test-id="clear-checked"
			>
				{t('list.clearChecked', { count: done })}
			</Button>
		{/if}
	</div>

	<AddItemForm {listId} />

	{#if visible.length === 0}
		<p class="text-muted-foreground mt-8">{t('list.empty')}</p>
	{:else}
		<div class="mt-6 space-y-6">
			{#each visible as group, aisleIndex (group.aisleId)}
				{@const aisle = data.aisle(group.aisleId)}
				{@const itemDrag = createDrag((from, to) => moveItem(group.aisleId, group.items, from, to))}
				<!--
					Le glissement des rayons est ce qui rend visible l'ordre adaptatif : changer de magasin
					ne recompose pas la page d'un coup, les rayons se déplacent vers leur nouvelle place.
				-->
				<section
					data-test-class="aisle-group"
					data-aisle={group.aisleId}
					{...aisleDrag.handlers(aisleIndex)}
					animate:flip={{ duration: motionMs(380), easing: cubicOut }}
					class="transition-[outline-color] {aisleDrag.overIndex === aisleIndex
						? 'outline-primary rounded-md outline-2'
						: ''}"
				>
					<div class="mb-2 flex items-center gap-2">
						<GripVertical
							size={18}
							class="text-muted-foreground shrink-0 cursor-grab"
							aria-hidden="true"
						/>
						<h2 class="text-h2 flex flex-1 items-center gap-2 font-medium">
							<span aria-hidden="true">{aisle?.emoji ?? '🛒'}</span>
							{aisle?.name ?? group.aisleId}
						</h2>
						<button
							type="button"
							onclick={() => moveAisle(aisleIndex, aisleIndex - 1)}
							disabled={aisleIndex === 0}
							aria-label={t('list.aisleUp', { name: aisle?.name ?? group.aisleId })}
							data-test-class="aisle-up"
							class="text-muted-foreground grid size-11 min-w-[44px] place-items-center disabled:opacity-30"
						>
							<ChevronUp size={18} aria-hidden="true" />
						</button>
						<button
							type="button"
							onclick={() => moveAisle(aisleIndex, aisleIndex + 1)}
							disabled={aisleIndex === visible.length - 1}
							aria-label={t('list.aisleDown', { name: aisle?.name ?? group.aisleId })}
							data-test-class="aisle-down"
							class="text-muted-foreground grid size-11 min-w-[44px] place-items-center disabled:opacity-30"
						>
							<ChevronDown size={18} aria-hidden="true" />
						</button>
					</div>

					<div class="space-y-2">
						{#each group.items as item, index (item.id)}
							<div
								{...itemDrag.handlers(index)}
								animate:flip={{ duration: motionMs(280), easing: cubicOut }}
								in:fly={{ y: 10, duration: motionMs(220), easing: cubicOut }}
								out:slide={{ duration: motionMs(180), easing: cubicOut }}
								class={itemDrag.overIndex === index ? 'outline-primary rounded-md outline-2' : ''}
							>
								<ItemRow
									{item}
									canMoveUp={index > 0}
									canMoveDown={index < group.items.length - 1}
									onMoveUp={() => moveItem(group.aisleId, group.items, index, index - 1)}
									onMoveDown={() => moveItem(group.aisleId, group.items, index, index + 1)}
								/>
							</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
{/if}
