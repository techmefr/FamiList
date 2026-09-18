<script lang="ts">
	import { page } from '$app/state';
	import { flip } from 'svelte/animate';
	import { fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { data } from '$stores/data.svelte';
	import { createIntent } from '$stores/create.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { motionMs, settings } from '$stores/settings.svelte';
	import { i18n, t } from '$i18n/index.svelte';
	import { listToMarkdown } from '$domain/list-markdown';
	import { unitKey } from '$domain/units';
	import { shareText, type ShareOutcome } from '$native/share';
	import type { Item } from '$db/schema';
	import ShopSwitcher from '$components/app/ShopSwitcher.svelte';
	import ItemRow from '$components/app/ItemRow.svelte';
	import SwipeRow from '$components/app/SwipeRow.svelte';
	import AisleCard from '$components/app/AisleCard.svelte';
	import AddItemSheet from '$components/app/AddItemSheet.svelte';
	import ShareSheet from '$components/app/ShareSheet.svelte';
	import FilterSheet from '$components/app/FilterSheet.svelte';
	import { createReorder, move } from '$components/app/reorder.svelte';
	import { Button } from '$components/ui/button';
	import EmptyState from '$components/app/EmptyState.svelte';
	import {
		ArrowLeft,
		MessagesSquare,
		Tags,
		UsersRound,
		SlidersHorizontal,
		Plus,
		Send,
		Check,
		Undo2,
		Trash2,
		Route
	} from '@lucide/svelte';

	const listId = $derived(page.params.id!);
	const list = $derived(data.list(listId));
	const groups = $derived(data.groupedItems(listId));

	const learned = $derived(
		data.layouts.find((l) => l.shopId === data.activeShopId)?.learned ?? false
	);

	let share = $state<ShareSheet | null>(null);
	let add = $state<AddItemSheet | null>(null);
	let filters = $state<FilterSheet | null>(null);

	/**
	 * The create button brings you here, then asks for the sheet: the same round trip as for a card or a
	 * shop. The sheet does not exist yet when the navigation ends, hence the effect rather than a direct
	 * call.
	 */
	$effect(() => {
		if (add && createIntent.take('item')) void add.show();
	});

	/**
	 * First names rather than a count: "With Hélène and Marc" reads at a glance, "2 participants" means
	 * opening the sheet to find out who they are.
	 *
	 * `Intl.ListFormat` handles the "and" and the commas — those are language rules, not strings to
	 * translate, and they differ from one language to another.
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

	/**
	 * Sending the list out, as text, to somebody who does not have the application.
	 *
	 * This is a different action from the sharing sheet above: that one gives access inside the household,
	 * this one sends out a frozen copy. Two gestures, two buttons.
	 */
	const STATUS_KEY: Record<Exclude<ShareOutcome, 'cancelled'>, string> = {
		shared: 'share.sent',
		copied: 'share.sendCopied',
		failed: 'share.sendFailed'
	};

	let shareStatus = $state<string | null>(null);

	/** Same rule as the item row: an unknown unit is written exactly as it was typed. */
	function unitLabel(unit: string): string {
		const key = unitKey(unit);
		return key ? t(key) : unit;
	}

	/**
	 * The text carries the whole list, not the filtered view: hiding ticked items is a reading convenience
	 * here, not a decision about what is sent over there.
	 */
	function listAsText(): string {
		return listToMarkdown({
			name: list?.name ?? '',
			emoji: list?.emoji ?? '',
			aisles: groups.map((group) => {
				const aisle = data.aisle(group.aisleId);
				return {
					name: aisle?.name ?? group.aisleId,
					emoji: aisle?.emoji ?? '',
					items: group.items.map((item) => ({
						name: item.name,
						qty: item.qty,
						unit: unitLabel(item.unit),
						checked: item.checked,
						priority: item.priority,
						note: item.note
					}))
				};
			})
		});
	}

	async function send() {
		if (!list) return;

		feedback.play('tap');
		const outcome = await shareText(list.name, listAsText());

		// A sheet closed without choosing: the person knows what they have just done.
		if (outcome === 'cancelled') return;

		feedback.play(outcome === 'failed' ? 'error' : 'success');
		shareStatus = t(STATUS_KEY[outcome]);
	}

	let priorityOnly = $state(false);
	let hideChecked = $state(false);
	const activeFilters = $derived(Number(priorityOnly) + Number(hideChecked));

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
	 * Which aisles are unfolded.
	 *
	 * The first two on opening, as in the mockup: unfolding everything fills three phone screens, folding
	 * everything gives a page that looks like it contains nothing. We only remember what the person
	 * changed — the rest follows the rule, including aisles that appear later because an item has just
	 * been added to them.
	 */
	let unfolded = $state<Record<string, boolean>>({});
	const isOpen = (aisleId: string, index: number) => unfolded[aisleId] ?? index < 2;

	function toggle(aisleId: string, index: number) {
		feedback.play('tap');
		unfolded = { ...unfolded, [aisleId]: !isOpen(aisleId, index) };
	}

	/**
	 * The screen only shows non-empty aisles: we put the hidden aisles back at the end, otherwise
	 * reordering would lose the learned route of momentarily empty aisles.
	 */
	function commitAisleOrder(visibleOrder: string[]) {
		const previous = data.activeLayout?.aisleOrder ?? data.aisles.map((a) => a.id);
		const hidden = previous.filter((id) => !visibleOrder.includes(id));
		data.reorderAisles([...visibleOrder, ...hidden]);
	}

	function moveAisle(from: number, to: number) {
		if (to < 0 || to >= visible.length) return;
		feedback.play('tap');
		commitAisleOrder(
			move(
				visible.map((g) => g.aisleId),
				from,
				to
			)
		);
	}

	function moveItem(aisleId: string, items: Item[], from: number, to: number) {
		if (to < 0 || to >= items.length) return;
		feedback.play('tap');
		data.reorderItems(aisleId, move(items, from, to));
	}

	const aisleReorder = createReorder(moveAisle);

	/**
	 * The item pointed at by the search.
	 *
	 * Finding an item and landing at the top of a forty-row list only half answers the question: you still
	 * have to look for it. So we unfold its aisle — it may have been folded, or below the screen — bring
	 * it into view, and outline it long enough to be seen.
	 *
	 * The outline fades on its own: left in place, it would look like a selection, and nothing on the page
	 * says how to remove it.
	 */
	const HIGHLIGHT_MS = 2400;
	let highlighted = $state<string | null>(null);

	$effect(() => {
		const target = page.url.searchParams.get('item');
		if (!target || !data.ready) return;

		const item = data.itemsOf(listId).find((i) => i.id === target);
		if (!item) return;

		unfolded[item.aisleId] = true;
		highlighted = target;

		const timer = setTimeout(() => (highlighted = null), HIGHLIGHT_MS);
		const frame = requestAnimationFrame(() => {
			document.getElementById(`item-${target}`)?.scrollIntoView({
				block: 'center',
				behavior: settings.animates ? 'smooth' : 'auto'
			});
		});

		return () => {
			clearTimeout(timer);
			cancelAnimationFrame(frame);
		};
	});
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
	<a
		href="/"
		class="text-muted-foreground text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2"
	>
		<ArrowLeft size={16} aria-hidden="true" />
		{t('list.back')}
	</a>

	<h1 class="text-h1 mt-2 flex flex-wrap items-center gap-3 font-semibold">
		<span aria-hidden="true">{list.emoji}</span>
		<span class="min-w-0 break-words">{list.name}</span>
	</h1>
	<p class="text-muted-foreground text-label mt-1">{t('lists.progress', { done, total })}</p>

	<!-- The text above already says the progress: the bar is only there to show it move. -->
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

		<button
			type="button"
			onclick={send}
			data-test-id="send-list"
			class="text-primary text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2 underline"
		>
			<Send size={16} aria-hidden="true" />
			{t('share.send')}
		</button>

		<!--
			Price history is reached from here, and not only from the left column: on a phone the bottom bar is
			full, and it is while preparing your list that you wonder where to buy — not by opening a dedicated
			tab.
		-->
		<a
			href="/prices"
			data-test-id="open-prices"
			class="text-primary text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2 underline"
		>
			<Tags size={16} aria-hidden="true" />
			{t('prices.open')}
		</a>
	</div>

	<p class="text-muted-foreground text-caption" data-test-id="share-summary">{sharedWith}</p>

	<!--
		The clipboard fallback moves nothing on screen: without this line, sending would look as if it had
		failed on a desktop computer. `aria-live` has it read aloud too.
	-->
	<p class="text-muted-foreground text-caption" aria-live="polite" data-test-id="send-status">
		{shareStatus ?? ''}
	</p>

	<ShareSheet bind:this={share} {listId} />

	<!-- On a phone, the shop moves down into the thumb bar, at the bottom: see below. -->
	<div class="mt-6 max-md:hidden">
		<ShopSwitcher />
	</div>

	<!--
		Filters on a large screen only: on a phone the same button floats at the bottom left, within reach of
		the thumb. One set of controls for both, in the sheet.
	-->
	<div class="mt-4 flex flex-wrap items-center gap-2">
		<Button
			variant="outline"
			onclick={() => filters?.show()}
			aria-haspopup="dialog"
			data-test-id="open-filters"
			class="max-md:hidden"
		>
			<SlidersHorizontal size={18} aria-hidden="true" />
			{t('list.filters')}
			{#if activeFilters > 0}
				<span
					class="bg-primary text-primary-foreground text-caption grid size-5 place-items-center rounded-full font-semibold"
				>
					{activeFilters}
				</span>
			{/if}
		</Button>

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

	{#if visible.length === 0}
		<!--
			Two kinds of empty that do not mean the same thing: a list nobody has written in, and a full list
			whose filters let nothing through. The second is fixed by touching the filters, the first by adding
			an item — the drawing says it before the sentence does.
		-->
		{#if activeFilters > 0}
			<EmptyState illustration="filter" text={t('list.empty')} testId="list-empty">
				{#snippet action()}
					<Button variant="outline" onclick={() => filters?.show()} data-test-id="empty-filters">
						<SlidersHorizontal size={18} aria-hidden="true" />
						{t('list.filters')}
					</Button>
				{/snippet}
			</EmptyState>
		{:else}
			<EmptyState illustration="cart" text={t('list.noItems')} testId="list-empty">
				{#snippet action()}
					<Button onclick={() => add?.show()} data-test-id="empty-add-item">
						<Plus size={18} aria-hidden="true" />
						{t('add.submit')}
					</Button>
				{/snippet}
			</EmptyState>
		{/if}
	{:else}
		<!--
			Why the aisles are in that order.

			Adaptive ordering is the promise of the application, and it is also the one thing you cannot see: a
			list sorted along a learned route looks exactly like a list sorted by default. Without this
			sentence, reordering an aisle looks like a whim with no effect.

			The mockup says "drag the aisles or tick"; ticking learns nothing here — only a move marks the route
			as learned.
		-->
		<p
			class="text-label text-secondary mt-6 flex items-start gap-2 rounded-md bg-[var(--fl-secondary-tint)] px-3.5 py-2.5 font-medium"
			data-test-id="route-hint"
		>
			<Route size={18} class="mt-0.5 shrink-0" aria-hidden="true" />
			<span>{learned ? t('list.routeLearned') : t('list.routeDefault')}</span>
		</p>

		<div class="mt-4 space-y-3" data-reorder-zone>
			{#each visible as group, aisleIndex (group.aisleId)}
				{@const aisle = data.aisle(group.aisleId)}
				{@const name = aisle?.name ?? group.aisleId}
				{@const itemReorder = createReorder((from, to) =>
					moveItem(group.aisleId, group.items, from, to)
				)}
				<!--
					Moving the aisles is what makes adaptive ordering visible: changing shop does not recompose the page
					at once, the aisles slide to their new place. During a finger gesture the animation is switched
					off — the cards are already where they should be, the handle put them there, and animating on top
					would make them move back.
				-->
				<div
					data-reorder-row
					data-held={aisleReorder.index === aisleIndex}
					class="fl-reorder-row rounded-xl"
					animate:flip={{
						duration: aisleReorder.busy ? 0 : motionMs(380),
						easing: cubicOut
					}}
				>
					<AisleCard
						name={name}
						emoji={aisle?.emoji ?? '🛒'}
						rank={aisleIndex}
						done={group.items.filter((i) => i.checked).length}
						total={group.items.length}
						open={isOpen(group.aisleId, aisleIndex)}
						grip={aisleReorder.handle(aisleIndex)}
						onToggle={() => toggle(group.aisleId, aisleIndex)}
						onMoveUp={() => moveAisle(aisleIndex, aisleIndex - 1)}
						onMoveDown={() => moveAisle(aisleIndex, aisleIndex + 1)}
						canMoveUp={aisleIndex > 0}
						canMoveDown={aisleIndex < visible.length - 1}
					>
						<div data-reorder-zone class="space-y-2">
							{#each group.items as item, index (item.id)}
								<div
									id="item-{item.id}"
									data-reorder-row
									data-held={itemReorder.index === index}
									class="fl-reorder-row rounded-md {highlighted === item.id
										? 'ring-primary ring-2 ring-offset-2'
										: ''}"
									animate:flip={{
										duration: itemReorder.busy ? 0 : motionMs(280),
										easing: cubicOut
									}}
									in:fly={{ y: 10, duration: motionMs(220), easing: cubicOut }}
									out:slide={{ duration: motionMs(180), easing: cubicOut }}
								>
									<!--
										The swipe doubles the row's buttons, it does not replace them: it is the quick gesture of the
										trolley, one hand busy, and it is not guessed on its own. Deleting asks you to go further than
										ticking — see $domain/swipe.
									-->
									<SwipeRow
										start={{
											label: item.checked ? t('list.swipeUncheck') : t('list.swipeCheck'),
											icon: item.checked ? Undo2 : Check,
											tone: 'primary',
											run: () => {
												feedback.play(item.checked ? 'uncheck' : 'check');
												data.toggleItem(item.id);
											}
										}}
										end={{
											label: t('list.swipeDelete'),
											icon: Trash2,
											tone: 'destructive',
											run: () => {
												feedback.play('remove');
												data.removeItem(item.id);
											}
										}}
									>
										<ItemRow
											{item}
											grip={itemReorder.handle(index)}
											canMoveUp={index > 0}
											canMoveDown={index < group.items.length - 1}
											onMoveUp={() => moveItem(group.aisleId, group.items, index, index - 1)}
											onMoveDown={() => moveItem(group.aisleId, group.items, index, index + 1)}
											onEdit={() => add?.show(item)}
										/>
									</SwipeRow>
								</div>
							{/each}
						</div>
					</AisleCard>
				</div>
			{/each}
		</div>
	{/if}

	<!--
		The thumb bar.

		On a phone, all the navigation lives at the bottom: the shop and the filters, handled as much as the
		tabs, have no business at the top of the screen — you would have to change grip every time. The shop
		comes first because it is what governs the order of everything else; the filters only hide.

		The background is blurred: the bar floats over a scrolling list, and set flat it blended into the
		cards passing underneath. It stops before the create button, which keeps its corner.
	-->
	<div
		class="fl-above-nav fl-dock flex items-center gap-1 md:hidden"
		data-test-id="thumb-bar"
	>
		<ShopSwitcher compact />

		<button
			type="button"
			onclick={() => filters?.show()}
			aria-haspopup="dialog"
			data-test-id="open-filters-mobile"
			class="fl-press bg-muted text-foreground text-label flex min-h-[max(2.75rem,44px)] shrink-0 items-center gap-2 rounded-full px-3 font-medium"
		>
			<SlidersHorizontal size={18} aria-hidden="true" />
			<span class="sr-only">{t('list.filters')}</span>
			{#if activeFilters > 0}
				<span
					class="bg-primary text-primary-foreground text-caption grid size-5 place-items-center rounded-full font-semibold"
				>
					{activeFilters}
				</span>
			{/if}
		</button>
	</div>
{/if}

<FilterSheet bind:this={filters} bind:priorityOnly bind:hideChecked />
<AddItemSheet bind:this={add} {listId} />
