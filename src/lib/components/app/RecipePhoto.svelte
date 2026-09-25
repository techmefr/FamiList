<script lang="ts">
	import { supabase } from '$db/supabase';
	import { t } from '$i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { data } from '$stores/data.svelte';
	import { toasts } from '$stores/toast.svelte';
	import { dishPhotoPrompt, photoFailureKey } from '$domain/ai-image';
	import { Button } from '$components/ui/button';
	import RecipeImageSearch from './RecipeImageSearch.svelte';
	import { ImagePlus, Search } from '@lucide/svelte';

	interface Props {
		recipeId: string;
		recipeName: string;
		ingredientNames: string[];
		photoPath?: string;
	}

	let { recipeId, recipeName, ingredientNames, photoPath }: Props = $props();

	/** How long a signed URL to a private bucket stays usable before the screen would need another one. */
	const SIGNED_URL_TTL_SECONDS = 3600;

	let generating = $state(false);
	let signedUrl = $state<string | null>(null);
	let picker = $state<RecipeImageSearch | null>(null);

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

	async function generate() {
		if (generating) return;

		generating = true;
		const prompt = dishPhotoPrompt(recipeName, ingredientNames);
		const outcome = await ai.generateRecipePhoto(data.circle, recipeId, prompt);
		generating = false;

		if (!outcome.ok) {
			toasts.error(t(photoFailureKey(outcome.reason)));
			return;
		}

		data.setRecipePhoto(recipeId, outcome.path);
		toasts.success(t('ai.photoSaved'));
	}
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
	<div class="flex flex-wrap gap-2">
		<Button
			variant="outline"
			onclick={() => picker?.show()}
			disabled={generating}
			aria-haspopup="dialog"
			data-test-class="recipe-photo-search-button"
			class="fl-press h-auto min-h-11 w-full px-4 py-2 text-base whitespace-normal [overflow-wrap:normal]"
		>
			<Search size={18} aria-hidden="true" />
			{t('ai.photoSearch')}
		</Button>
		<Button
			variant="outline"
			onclick={generate}
			loading={generating}
			data-test-class={signedUrl ? 'recipe-photo-regenerate' : 'recipe-photo-button'}
			class="fl-press h-auto min-h-11 w-full px-4 py-2 text-base whitespace-normal [overflow-wrap:normal]"
		>
			{#if !generating}<ImagePlus size={18} aria-hidden="true" />{/if}
			{generating ? t('ai.photoGenerating') : signedUrl ? t('ai.photoRegenerate') : t('ai.photoGenerate')}
		</Button>
	</div>
</div>

<RecipeImageSearch bind:this={picker} {recipeId} {recipeName} />
