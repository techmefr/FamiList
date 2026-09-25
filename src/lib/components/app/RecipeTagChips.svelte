<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { knownTags } from '$domain/recipe-tags';

	interface Props {
		tags: readonly string[] | undefined;
		class?: string;
	}

	let { tags, class: className = '' }: Props = $props();

	/** A key a newer app added has no label here yet: it is kept on the recipe, just not shown. */
	const shown = $derived(knownTags(tags));
</script>

{#if shown.length}
	<ul class="flex flex-wrap gap-1.5 {className}" aria-label={t('recipeTags.listLabel')} data-test-class="recipe-tags">
		{#each shown as tag (tag)}
			<li
				class="bg-muted text-foreground text-caption max-w-full rounded-full border px-2.5 py-0.5 font-medium [overflow-wrap:anywhere]"
				data-test-class="recipe-tag-chip"
				data-test-tag={tag}
			>
				{t(`recipeTags.tag.${tag}`)}
			</li>
		{/each}
	</ul>
{/if}
