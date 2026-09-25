<script lang="ts">
	import type { Component } from 'svelte';
	import { ChevronRight } from '@lucide/svelte';

	let {
		href,
		title,
		hint,
		icon: Icon,
		testId,
		testClass
	}: {
		href: string;
		title: string;
		hint?: string;
		icon?: Component;
		testId?: string;
		testClass?: string;
	} = $props();
</script>

<!--
	A whole row is the target, not a button at its end: at the largest text size the chevron would be the
	only thing left within reach, and a word you can read but not tap is a trap. The text wraps rather than
	being cut, and the chevron turns with the reading direction — in Arabic "further" is to the left.
-->
<a
	{href}
	data-test-id={testId}
	data-test-class={testClass}
	class="fl-press hover:bg-muted focus-visible:ring-ring flex min-h-16 w-full items-center gap-4 px-4 py-3 text-start outline-none focus-visible:ring-3 focus-visible:ring-inset"
>
	{#if Icon}
		<span
			class="text-primary grid size-11 shrink-0 place-items-center rounded-full bg-[var(--fl-primary-tint)]"
			aria-hidden="true"
		>
			<Icon size={22} />
		</span>
	{/if}
	<span class="min-w-0 flex-1">
		<span class="text-label block font-medium break-words">{title}</span>
		{#if hint}
			<span class="text-muted-foreground text-caption mt-0.5 block break-words">{hint}</span>
		{/if}
	</span>
	<ChevronRight size={22} aria-hidden="true" class="text-muted-foreground shrink-0 rtl:rotate-180" />
</a>
