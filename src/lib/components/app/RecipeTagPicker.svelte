<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { RECIPE_TAG_CATEGORIES, toggleTag, type RecipeTag } from '$domain/recipe-tags';

	interface Props {
		/** Keys, possibly holding some this version does not know: they are left as they are. */
		tags: string[];
	}

	let { tags = $bindable() }: Props = $props();

	function toggle(tag: RecipeTag) {
		tags = toggleTag(tags, tag);
	}
</script>

<!--
	The recipe's tags (#314), as large chips that are real checkboxes: the tick and the words carry the
	state, the tint only repeats it, and a screen reader hears "checked" like on any other box. Grouped by
	category so a long list reads as four short ones.
-->
<fieldset class="min-w-0 space-y-4" data-test-id="recipe-tags">
	<legend class="text-label font-semibold">{t('recipeTags.title')}</legend>
	<p class="text-muted-foreground text-caption">{t('recipeTags.hint')}</p>

	{#each RECIPE_TAG_CATEGORIES as category (category.id)}
		<fieldset class="min-w-0">
			<legend class="text-label mb-2 font-medium">{t(`recipeTags.category.${category.id}`)}</legend>
			<div class="flex flex-wrap gap-2">
				{#each category.tags as tag (tag)}
					<label
						class="fl-press has-[:focus-visible]:ring-ring has-[:checked]:border-primary has-[:checked]:bg-primary/10 flex min-h-[max(3rem,48px)] max-w-full cursor-pointer items-center gap-2 rounded-full border px-3 py-1 has-[:focus-visible]:ring-2"
					>
						<input
							type="checkbox"
							checked={tags.includes(tag)}
							onchange={() => toggle(tag)}
							data-test-id="recipe-tag-{tag}"
							class="accent-primary size-6 shrink-0"
						/>
						<span class="text-label min-w-0 hyphens-auto [overflow-wrap:anywhere]">
							{t(`recipeTags.tag.${tag}`)}
						</span>
					</label>
				{/each}
			</div>
		</fieldset>
	{/each}
</fieldset>
