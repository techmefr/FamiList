<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$i18n/index.svelte';
	import { X } from '@lucide/svelte';

	let { mealPlanId }: { mealPlanId: string } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	const recipes = $derived(data.recipes);
	const inPlan = $derived(new Set(data.recipesInPlan(mealPlanId).map((entry) => entry.recipeId)));

	export function show() {
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	function toggle(recipeId: string, servings: number, on: boolean) {
		feedback.play('tap');
		if (on) {
			data.addRecipeToPlan(mealPlanId, recipeId, servings);
			return;
		}

		const entry = data.recipesInPlan(mealPlanId).find((e) => e.recipeId === recipeId);
		if (entry) data.removeRecipeFromPlan(entry.id);
	}
</script>

<!--
	Picking several recipes into a plan, the same gesture as sharing a list with several people
	(ShareSheet): one checkbox per row, nothing to submit. A recipe just picked keeps its own number of
	servings — it is adjusted afterwards, on the plan itself, once it is clear how many people are really
	coming.
-->
<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="meal-plan-picker-title"
	data-test-id="meal-plan-recipe-picker"
>
	<div class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl">
		<h2 id="meal-plan-picker-title" class="text-h2 pe-12 font-semibold">
			{t('mealPlan.pickRecipes')}
		</h2>

		{#if recipes.length === 0}
			<p class="text-muted-foreground text-label mt-4">{t('mealPlan.noRecipes')}</p>
		{:else}
			<ul class="mt-4 max-h-[60vh] space-y-1 overflow-y-auto">
				{#each recipes as recipe (recipe.id)}
					{@const on = inPlan.has(recipe.id)}
					<li>
						<label
							data-test-class="meal-plan-recipe-toggle"
							class="hover:bg-muted flex min-h-[max(3.5rem,56px)] cursor-pointer items-center gap-3 rounded-lg px-2"
						>
							<span aria-hidden="true" class="text-h2">{recipe.emoji}</span>
							<span class="text-label min-w-0 flex-1 font-medium">{recipe.name}</span>
							<input
								type="checkbox"
								checked={on}
								onchange={(event) => toggle(recipe.id, recipe.servings, event.currentTarget.checked)}
								data-test-class="meal-plan-recipe-checkbox"
							/>
						</label>
					</li>
				{/each}
			</ul>
		{/if}

		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="meal-plan-picker-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
