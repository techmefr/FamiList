<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import { X } from '@lucide/svelte';

	let { recipeId }: { recipeId: string } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	const recipe = $derived(data.recipe(recipeId));

	/**
	 * The person's other circles: the audience a recipe can be opened to. Unlike `ShareSheet`, which picks
	 * people inside one circle, this picks among circles — the recipe already belongs to one, sharing only
	 * ever adds others.
	 */
	const otherCircles = $derived(data.circles.filter((circle) => circle.id !== recipe?.householdId));

	const shares = $derived(recipeId ? data.sharesOf(recipeId) : []);

	export function show() {
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	function toggle(householdId: string, on: boolean) {
		feedback.play('tap');
		if (on) data.shareRecipe(recipeId, householdId);
		else data.unshareRecipe(recipeId, householdId);
	}
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="recipe-share-title"
	data-test-id="recipe-share-sheet"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="recipe-share-title" class="text-h2 pe-12 font-semibold">{t('recipeShare.title')}</h2>
		<p class="text-muted-foreground text-caption mt-1 pe-12">{t('recipeShare.note')}</p>

		{#if otherCircles.length === 0}
			<p class="text-muted-foreground text-label mt-4" data-test-id="recipe-share-empty">
				{t('recipeShare.empty')}
			</p>
		{:else}
			<ul class="mt-4 space-y-1">
				{#each otherCircles as circle (circle.id)}
					{@const on = shares.some((share) => share.householdId === circle.id)}
					<li>
						<label
							data-test-class="recipe-share-circle"
							class="hover:bg-muted flex min-h-[max(3.5rem,56px)] cursor-pointer items-center gap-3 rounded-lg px-2"
						>
							<span class="text-label min-w-0 flex-1 font-medium">{circle.name}</span>
							<input
								type="checkbox"
								checked={on}
								onchange={(event) => toggle(circle.id, event.currentTarget.checked)}
								data-test-class="recipe-share-toggle"
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
			data-test-id="recipe-share-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
