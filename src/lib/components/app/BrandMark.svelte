<script lang="ts">
	import { findBrand, monogram } from '$domain/brand-catalogue';
	import { tintForWhiteText } from '$domain/tint';

	/**
	 * The brand's face on a card: its logo when the catalogue ships one, otherwise its letters in its
	 * colour on a white tile. The letters use the same darkened tint as the card behind, so they read at
	 * 4.5:1 on the white — the ratio is the same both ways.
	 *
	 * Decorative: the card's name is always written next to it.
	 */
	let {
		name,
		brand = '',
		tint,
		size = 'md'
	}: { name: string; brand?: string; tint: string; size?: 'sm' | 'md' } = $props();

	const entry = $derived(findBrand(brand) ?? findBrand(name));
	const letters = $derived(monogram(entry?.name ?? name, entry));
	const ink = $derived(tintForWhiteText(tint));
</script>

<span
	class="grid shrink-0 place-items-center overflow-hidden rounded-md bg-white font-bold {size === 'sm'
		? 'text-caption size-9'
		: 'text-label size-11'}"
	style="color: {ink}"
	aria-hidden="true"
	data-test-class="brand-mark"
	data-brand={entry?.name ?? ''}
>
	{#if entry?.logo}
		<img src={entry.logo} alt="" class="size-full object-contain p-1" />
	{:else}
		{letters}
	{/if}
</span>
