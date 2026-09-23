<script lang="ts">
	import { supabase } from '$db/supabase';
	import { t } from '$i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { data } from '$stores/data.svelte';
	import { dishPhotoPrompt, recipeImageSearchQuery } from '$domain/ai-image';
	import { Button } from '$components/ui/button';
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

	let busy = $state(false);
	let signedUrl = $state<string | null>(null);

	/**
	 * Set the moment a search comes back empty: it is what turns the AI button's label from the plain "Generate
	 * a photo" into an explicit "Generate an image with AI" fallback, so the switch from one source to the
	 * other stays visible instead of happening silently behind a single button.
	 */
	let searchFailed = $state(false);

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

	/**
	 * The image is decorative only: a failure here is never surfaced as an error, it just leaves the plain
	 * card the household already had. Nothing here blocks saving or reading the recipe.
	 */
	async function generate() {
		if (busy) return;

		busy = true;
		const householdId = data.circle;
		const prompt = dishPhotoPrompt(recipeName, ingredientNames);
		const outcome = await ai.generateRecipePhoto(householdId, recipeId, prompt);
		busy = false;

		if (outcome.ok) data.setRecipePhoto(recipeId, outcome.path);
	}

	async function search() {
		if (busy) return;

		busy = true;
		const householdId = data.circle;
		const query = recipeImageSearchQuery(recipeName, ingredientNames);
		const outcome = await ai.searchRecipePhoto(householdId, recipeId, query);
		busy = false;

		if (outcome.ok) {
			searchFailed = false;
			data.setRecipePhoto(recipeId, outcome.path);
		} else {
			searchFailed = true;
		}
	}
</script>

{#if signedUrl}
	<div class="mb-3 space-y-2">
		<img
			src={signedUrl}
			alt={t('recipes.photoAlt', { name: recipeName })}
			data-test-class="recipe-photo"
			class="aspect-video w-full rounded-lg object-cover"
		/>
		<Button
			variant="outline"
			size="sm"
			onclick={generate}
			disabled={busy}
			data-test-class="recipe-photo-regenerate"
			class="fl-press"
		>
			<ImagePlus size={18} aria-hidden="true" />
			{busy ? t('ai.photoGenerating') : t('ai.photoRegenerate')}
		</Button>
	</div>
{:else}
	<div class="mb-3 space-y-2" data-test-class="recipe-photo-generate">
		<div class="flex flex-wrap gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={search}
				disabled={busy}
				data-test-class="recipe-photo-search-button"
				class="fl-press"
			>
				<Search size={18} aria-hidden="true" />
				{busy ? t('ai.photoSearching') : t('ai.photoSearch')}
			</Button>
			<Button
				variant="outline"
				size="sm"
				onclick={generate}
				disabled={busy}
				data-test-class="recipe-photo-button"
				class="fl-press"
			>
				<ImagePlus size={18} aria-hidden="true" />
				{busy ? t('ai.photoGenerating') : searchFailed ? t('ai.photoGenerateFallback') : t('ai.photoGenerate')}
			</Button>
		</div>
		{#if searchFailed}
			<p class="text-muted-foreground text-sm" data-test-class="recipe-photo-search-not-found">
				{t('ai.photoSearchNotFound')}
			</p>
		{/if}
	</div>
{/if}
