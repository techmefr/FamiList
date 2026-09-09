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
	Un écran vide, et ce qu'on peut y faire.

	Une phrase seule dans une page blanche se lit comme une panne. Le dessin dit que l'écran
	fonctionne et qu'il n'y a simplement rien encore — c'est la différence entre « c'est cassé » et
	« c'est à vous de jouer ». Il reste décoratif : la phrase porte tout le sens.
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
