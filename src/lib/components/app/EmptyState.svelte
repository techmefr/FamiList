<script lang="ts">
	import type { Snippet } from 'svelte';
	import { settings } from '$stores/settings.svelte';
	import Illustration, { type IllustrationName } from '$components/app/Illustration.svelte';

	let {
		illustration,
		text,
		testId,
		action
	}: {
		illustration: IllustrationName;
		text: string;
		testId?: string;
		action?: Snippet;
	} = $props();
</script>

<!--
	An empty screen, and what can be done there.

	A sentence alone on a blank page reads as a breakdown. The drawing says the screen works and that there is
	simply nothing yet — it is the difference between "this is broken" and "it is your turn". It stays
	decorative: the sentence carries all the meaning.
-->
<div
	class="flex flex-col items-center gap-4 py-10 text-center"
	class:fl-rise={settings.animates}
	data-test-id={testId}
>
	<Illustration name={illustration} />
	<p class="text-muted-foreground text-label max-w-[32ch] text-balance">{text}</p>
	{#if action}
		{@render action()}
	{/if}
</div>
