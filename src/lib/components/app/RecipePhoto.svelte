<script lang="ts">
	import { supabase } from '$db/supabase';
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import RecipeImagePicker from './RecipeImagePicker.svelte';
	import { ImagePlus } from '@lucide/svelte';

	interface Props {
		recipeId: string;
		recipeName: string;
		ingredientNames: string[];
		photoPath?: string;
		imagePrompt?: string;
	}

	let { recipeId, recipeName, ingredientNames, photoPath, imagePrompt }: Props = $props();

	/** How long a signed URL to a private bucket stays usable before the screen would need another one. */
	const SIGNED_URL_TTL_SECONDS = 3600;

	let signedUrl = $state<string | null>(null);
	let picker = $state<RecipeImagePicker | null>(null);

	$effect(() => {
		if (!photoPath) {
			signedUrl = null;
			return;
		}

		let cancelled = false;

		supabase.storage
			.from('recipe-photos')
			.createSignedUrl(photoPath, SIGNED_URL_TTL_SECONDS)
			.then(({ data: signed }) => {
				if (!cancelled) signedUrl = signed?.signedUrl ?? null;
			});

		return () => {
			cancelled = true;
		};
	});
</script>

<div class="mb-3 space-y-2" data-test-class="recipe-photo-generate">
	{#if signedUrl}
		<img
			src={signedUrl}
			alt={t('recipes.photoAlt', { name: recipeName })}
			data-test-class="recipe-photo"
			class="aspect-video w-full rounded-lg object-cover"
		/>
	{/if}
	<Button
		variant="outline"
		onclick={() => picker?.show()}
		aria-haspopup="dialog"
		data-test-class="recipe-photo-button"
		class="fl-press h-auto min-h-11 w-full px-4 py-2 text-base whitespace-normal [overflow-wrap:normal]"
	>
		<ImagePlus size={18} aria-hidden="true" />
		{photoPath ? t('ai.photoChange') : t('ai.photoAdd')}
	</Button>
</div>

<RecipeImagePicker bind:this={picker} {recipeId} {recipeName} {ingredientNames} {photoPath} {imagePrompt} />
