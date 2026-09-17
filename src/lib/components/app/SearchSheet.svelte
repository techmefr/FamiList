<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { flattenHits, searchAll, MIN_QUERY_LENGTH, type SearchHit } from '$domain/search';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Search, X, Check, ListChecks, ShoppingBasket, Store, CreditCard } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';

	let dialog = $state<HTMLDialogElement | null>(null);
	let field = $state<HTMLInputElement | null>(null);
	let query = $state('');

	/**
	 * The result pointed at by the keyboard. The arrows move it, Enter opens it; the mouse does not touch it
	 * — hovering a row while scanning with your eyes would move the Enter key's target under the fingers of
	 * somebody not looking at the mouse.
	 */
	let enabled = $state(0);

	/**
	 * Everything happens on the local cache: the lists, the items, the shops and the cards are already in
	 * memory, and a family's household comes to hundreds of rows. Querying the server would make the search
	 * unusable where it serves most — standing in an aisle, with one bar of signal.
	 */
	const groups = $derived(
		searchAll(query, {
			lists: data.lists,
			items: data.items,
			shops: data.shops,
			cards: data.cards
		})
	);

	const hits = $derived(flattenHits(groups));
	const tapeAssez = $derived(query.trim().length >= MIN_QUERY_LENGTH);

	const ICONS = {
		list: ListChecks,
		item: ShoppingBasket,
		shop: Store,
		card: CreditCard
	};

	export async function show() {
		query = '';
		enabled = 0;
		dialog?.showModal();

		// Like the emoji palette: `showModal` places focus itself, we only move it afterwards.
		await tick();
		field?.focus();
	}

	function hide() {
		dialog?.close();
	}

	function open(hit: SearchHit) {
		feedback.play('tap');
		hide();
		void goto(hit.href);
	}

	/**
	 * The arrows travel the sequence of results without leaving the field: you go on correcting your typing
	 * while watching the selection move down. It wraps — at the bottom, the next arrow comes back to the top,
	 * which avoids having to count rows to go back up.
	 */
	function surTouche(event: KeyboardEvent) {
		if (hits.length === 0) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			enabled = (enabled + 1) % hits.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			enabled = (enabled - 1 + hits.length) % hits.length;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			const hit = hits[enabled];
			if (hit) open(hit);
		}
	}

	// One more keystroke rebuilds the list: the selection must start again from the first result, otherwise
	// Enter would open the third row of a list that no longer exists.
	$effect(() => {
		void query;
		enabled = 0;
	});

	const optionId = (index: number) => `search-hit-${index}`;
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="search-title"
	data-test-id="search-sheet"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="search-title" class="text-h2 pe-12 font-semibold">{t('search.title')}</h2>

		<div class="mt-4">
			<Label for="search-query">{t('search.label')}</Label>
			<IconField icon={Search}>
				<Input
					id="search-query"
					bind:ref={field}
					bind:value={query}
					onkeydown={surTouche}
					type="search"
					placeholder={t('search.placeholder')}
					data-test-id="search-query"
					autocomplete="off"
					role="combobox"
					aria-expanded={hits.length > 0}
					aria-controls="search-results"
					aria-activedescendant={hits.length > 0 ? optionId(enabled) : undefined}
				/>
			</IconField>
		</div>

		<!-- The count is spoken by the screen reader, not displayed: the list already shows it. -->
		<p class="sr-only" aria-live="polite" data-test-id="search-count">
			{tapeAssez ? t('search.count', { count: hits.length }) : ''}
		</p>

		<!--
			Bounded height and internal scrolling, like the palette: without it, a dozen results would push the
			search field off the screen, on a phone, with the keyboard open.
		-->
		<div class="mt-3 max-h-[55vh] overflow-y-auto pe-1">
			{#if !tapeAssez}
				<p class="text-muted-foreground text-label py-6 text-center" data-test-id="search-hint">
					{t('search.hint', { count: MIN_QUERY_LENGTH })}
				</p>
			{:else if hits.length === 0}
				<EmptyState illustration="inbox" text={t('search.empty')} testId="search-empty" />
			{:else}
				<ul id="search-results" role="listbox" aria-label={t('search.title')}>
					{#each groups as group (group.kind)}
						{@const Icon = ICONS[group.kind]}
						<li role="presentation">
							<h3
								class="text-caption text-muted-foreground mt-3 flex items-center gap-1.5 font-medium first:mt-0"
							>
								<Icon size={13} aria-hidden="true" />
								{t(`search.group.${group.kind}`)}
							</h3>
							<ul role="presentation" class="mt-1 space-y-1">
								{#each group.hits as hit (hit.id)}
									{@const index = hits.indexOf(hit)}
									<li role="presentation" data-test-class="search-hit">
										<!--
											A button, not a link: the sheet must close before the navigation, otherwise you come back to a page
											covered by a panel of stale results. The keyboard goes through the field and the arrows, never
											through tabbing from one row to the next — hence `tabindex="-1"`, which leaves Escape and Enter
											where the finger already is.
										-->
										<button
											type="button"
											id={optionId(index)}
											role="option"
											aria-selected={index === enabled}
											tabindex="-1"
											onclick={() => open(hit)}
											class="fl-press hover:bg-muted flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start
												{index === enabled ? 'bg-muted ring-primary ring-2' : ''}"
										>
											{#if hit.icon}
												<span class="text-h2 shrink-0" aria-hidden="true">{hit.icon}</span>
											{/if}
											<span class="min-w-0 flex-1">
												<span
													class="text-product block font-medium break-words {hit.checked
														? 'text-muted-foreground line-through'
														: ''}"
												>
													{hit.label}
												</span>
												{#if hit.detail}
													<span class="text-muted-foreground text-caption block break-words">
														{hit.detail}
													</span>
												{/if}
											</span>
											{#if hit.checked}
												<span class="text-muted-foreground shrink-0">
													<Check size={16} aria-hidden="true" />
													<span class="sr-only">{t('search.checked')}</span>
												</span>
											{/if}
										</button>
									</li>
								{/each}
							</ul>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- The close button after the results: first focus must land on the field. -->
		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="search-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
