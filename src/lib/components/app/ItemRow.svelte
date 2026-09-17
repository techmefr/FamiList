<script lang="ts">
	import type { Item } from '$db/schema';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { unitKey } from '$domain/units';
	import { slugify } from '$domain/slug';
	import { formatAmount } from '$domain/price';
	import { longpress } from '$components/app/longpress.svelte';
	import { Star, Trash2, ArrowUp, ArrowDown, GripVertical, Pencil } from '@lucide/svelte';

	let {
		item,
		grip,
		onMoveUp,
		onMoveDown,
		onEdit,
		canMoveUp,
		canMoveDown
	}: {
		item: Item;
		grip: Record<string, unknown>;
		onMoveUp: () => void;
		onMoveDown: () => void;
		onEdit: () => void;
		canMoveUp: boolean;
		canMoveDown: boolean;
	} = $props();

	/**
	 * The long press opens the sheet. It is the expected gesture on a phone, but it does not exist for the
	 * keyboard or the screen reader: the pencil button does the same thing and stays the announced path.
	 */
	function editer() {
		feedback.play('tap');
		onEdit();
	}

	const inputId = $derived(`item-${item.id}`);

	/**
	 * An unknown unit is shown exactly as it was written: an item typed as "dozen" before the field became a
	 * list must stay readable, not be replaced by a neighbouring unit.
	 */
	const unitLabel = $derived.by(() => {
		const key = unitKey(item.unit);
		return key ? t(key) : item.unit;
	});

	/** `item.checked` is still the previous state: ticking goes up, unticking goes down. */
	function toggle() {
		feedback.play(item.checked ? 'uncheck' : 'check');
		data.toggleItem(item.id);
	}

	/**
	 * What is being typed, until the field is left. `null` means "nothing in progress": the field then shows
	 * the saved price, reformatted in the language being read. Without this state, every keystroke would be
	 * rewritten by the formatting and the field would become untypable.
	 */
	let draft = $state<string | null>(null);

	const recorded = $derived(data.priceOf(item));

	const priceValue = $derived(
		draft ??
			(recorded
				? i18n.number(recorded.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
				: '')
	);

	/**
	 * The price of the same product elsewhere, and only if it is lower than here.
	 *
	 * That is the whole feature in one line, placed at the moment it serves: the product is in your hand, in
	 * front of the aisle. Nothing to show when you are already at the cheapest — a line saying "you did
	 * well" takes the space without teaching anything.
	 */
	const cheaper = $derived.by(() => {
		if (!item.checked) return null;

		const best = data.priceComparison(slugify(item.name))[0];
		if (!best || best.shopId === data.activeShopId) return null;
		if (recorded && best.amount >= recorded.amount) return null;

		return best;
	});

	const cheaperShop = $derived(data.shops.find((shop) => shop.id === cheaper?.shopId));
</script>

<div
	class="bg-card flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 transition-colors"
	data-test-class="item-row"
>
	<!--
		The handle. It doubles the arrows without replacing them: those stay the keyboard's path, this is the
		thumb's gesture. Neither focusable nor announced, for the same reason — reaching by keyboard a handle you
		can do nothing with by keyboard would be a trap.
	-->
	<span
		{...grip}
		data-test-class="item-grip"
		aria-hidden="true"
		class="fl-reorder-grip text-muted-foreground -my-2 flex shrink-0 items-center self-stretch pe-1"
	>
		<GripVertical size={18} />
	</span>

	<!--
		The checkbox is inside the label, not beside it: alone, it offered a 28px target where 44 are needed.
		Wrapped, the whole text line ticks, and the target is well over.
	-->
	<label
		for={inputId}
		use:longpress={editer}
		class="flex min-h-[max(2.75rem,44px)] min-w-0 flex-1 basis-[12rem] cursor-pointer items-center gap-3 py-1"
	>
		<input
			id={inputId}
			type="checkbox"
			checked={item.checked}
			onchange={toggle}
			data-test-class="item-check"
			class="accent-primary shrink-0"
		/>

		<span class="min-w-0">
			<span
				class="text-product block transition-colors {item.checked
					? 'text-muted-foreground line-through'
					: ''}"
			>
				{item.name}
			</span>
			<span class="text-muted-foreground text-caption">
				{item.qty}
				{unitLabel}{item.note ? ` — ${item.note}` : ''}
			</span>
		</span>
	</label>

	<div class="flex max-w-full shrink-0 flex-wrap items-center justify-end">
		<button
			type="button"
			onclick={onMoveUp}
			disabled={!canMoveUp}
			aria-label={t('list.moveUp', { name: item.name })}
			data-test-class="item-up"
			class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center disabled:opacity-30"
		>
			<ArrowUp size={18} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={onMoveDown}
			disabled={!canMoveDown}
			aria-label={t('list.moveDown', { name: item.name })}
			data-test-class="item-down"
			class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center disabled:opacity-30"
		>
			<ArrowDown size={18} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={editer}
			aria-label={t('list.edit', { name: item.name })}
			data-test-class="item-edit"
			class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center"
		>
			<Pencil size={18} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={() => {
				feedback.play('tap');
				data.togglePriority(item.id);
			}}
			aria-label={t('list.priority', { name: item.name })}
			aria-pressed={item.priority}
			data-test-class="item-priority"
			class="fl-press grid size-11 min-w-[44px] place-items-center {item.priority
				? 'text-primary'
				: 'text-muted-foreground'}"
		>
			<Star size={18} fill={item.priority ? 'currentColor' : 'none'} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={() => {
				feedback.play('remove');
				data.removeItem(item.id);
			}}
			aria-label={t('list.remove', { name: item.name })}
			data-test-class="item-remove"
			class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center"
		>
			<Trash2 size={18} aria-hidden="true" />
		</button>
	</div>

	<!--
		The price, on a ticked item only.

		It is the only moment somebody has it in front of them: the label is there and the product is going into
		the trolley. Asking at add time would mean guessing the day before on the sofa, and asking after the
		trip would mean reopening every row from memory.

		It takes the full width under the row, rather than a box squeezed between the buttons: an input field
		next to five 44px targets is touched by mistake on every shopping trip.
	-->
	{#if item.checked}
		<div class="flex w-full flex-wrap items-center gap-x-3 gap-y-1 ps-9">
			<label class="text-caption text-muted-foreground flex items-center gap-2">
				<span>{t('list.price')}</span>
				<input
					type="text"
					inputmode="decimal"
					value={priceValue}
					placeholder={t('list.pricePlaceholder')}
					aria-label={t('list.priceOf', { name: item.name })}
					data-test-class="item-price"
					oninput={(event) => (draft = event.currentTarget.value)}
					onchange={(event) => {
						data.setItemPrice(item, event.currentTarget.value);
						draft = null;
					}}
					class="border-input bg-background text-label h-9 w-24 rounded-md border px-2"
				/>
			</label>

			{#if cheaper && cheaperShop}
				<p class="text-caption text-secondary font-medium" data-test-class="item-cheaper">
					{t('list.cheaperAt', {
						shop: cheaperShop.name,
						price: formatAmount(cheaper.amount, cheaper.currency, i18n.locale)
					})}
				</p>
			{/if}
		</div>
	{/if}
</div>
