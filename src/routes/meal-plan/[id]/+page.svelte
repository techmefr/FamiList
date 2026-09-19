<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$i18n/index.svelte';
	import { MIN_SERVINGS, MAX_SERVINGS } from '$domain/recipe';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import IconField from '$components/app/IconField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';
	import MealPlanRecipePicker from '$components/app/MealPlanRecipePicker.svelte';
	import { ArrowLeft, Users, Plus, ShoppingBasket, Trash2 } from '@lucide/svelte';

	const DAY_COUNT = 7;

	const planId = $derived(page.params.id!);
	const plan = $derived(data.mealPlan(planId));
	const entries = $derived(data.recipesInPlan(planId));

	let picker = $state<MealPlanRecipePicker | null>(null);
	let target = $state('');
	let toDelete = $state(false);

	function recipeOf(recipeId: string) {
		return data.recipe(recipeId);
	}

	function rename(event: Event) {
		const name = (event.currentTarget as HTMLInputElement).value;
		data.renameMealPlan(planId, name);
	}

	function setPeople(entryId: string, people: number) {
		data.updateMealPlanRecipe(entryId, { people });
	}

	function setDay(entryId: string, value: string) {
		data.updateMealPlanRecipe(entryId, { dayIndex: value === '' ? null : Number(value) });
	}

	function removeEntry(entryId: string) {
		feedback.play('remove');
		data.removeRecipeFromPlan(entryId);
	}

	async function generate() {
		const issue = data.generateMealPlanList(planId, target || undefined);
		if (!issue) return;

		feedback.play('add');
		await goto(`/l/${issue.listId}`);
	}

	function removePlan() {
		feedback.play('remove');
		data.removeMealPlan(planId);
		goto('/meal-plan');
	}
</script>

<svelte:head>
	<title>{plan?.name ?? t('mealPlan.title')} — {t('app.name')}</title>
</svelte:head>

{#if !plan}
	<EmptyState illustration="lists" text={t('mealPlan.notFound')} testId="meal-plan-not-found" />
{:else}
	<a href="/meal-plan" class="text-muted-foreground text-label inline-flex items-center gap-1">
		<ArrowLeft size={18} aria-hidden="true" />
		{t('mealPlan.back')}
	</a>

	<div class="mt-3">
		<Label for="meal-plan-name">{t('mealPlan.name')}</Label>
		<Input
			id="meal-plan-name"
			value={plan.name}
			onchange={rename}
			data-test-id="meal-plan-name"
		/>
	</div>

	<Button
		variant="outline"
		onclick={() => picker?.show()}
		data-test-id="meal-plan-pick"
		class="fl-press mt-4"
	>
		<Plus size={18} aria-hidden="true" />
		{t('mealPlan.pickRecipes')}
	</Button>

	<MealPlanRecipePicker bind:this={picker} mealPlanId={planId} />

	{#if entries.length === 0}
		<EmptyState illustration="lists" text={t('mealPlan.noneYet')} testId="meal-plan-recipes-empty" />
	{:else}
		<ul class="mt-4 space-y-3" data-test-id="meal-plan-recipes">
			{#each entries as entry (entry.id)}
				{@const recipe = recipeOf(entry.recipeId)}
				{#if recipe}
					<li class="bg-card rounded-xl border p-3">
						<div class="flex items-center gap-3">
							<span aria-hidden="true" class="text-h2">{recipe.emoji}</span>
							<span class="text-label min-w-0 flex-1 truncate font-medium">{recipe.name}</span>
							<button
								type="button"
								onclick={() => removeEntry(entry.id)}
								aria-label={t('mealPlan.removeRecipe', { name: recipe.name })}
								data-test-class="meal-plan-recipe-remove"
								class="fl-press text-muted-foreground hover:bg-muted grid min-h-[44px] min-w-[44px] place-items-center rounded-full"
							>
								<Trash2 size={18} aria-hidden="true" />
							</button>
						</div>

						<div class="mt-2 grid grid-cols-2 gap-2">
							<div>
								<Label for="meal-plan-people-{entry.id}">{t('mealPlan.people')}</Label>
								<IconField icon={Users}>
									<Input
										id="meal-plan-people-{entry.id}"
										type="number"
										value={entry.people}
										min={MIN_SERVINGS}
										max={MAX_SERVINGS}
										onchange={(event) => setPeople(entry.id, Number(event.currentTarget.value))}
										data-test-class="meal-plan-people"
									/>
								</IconField>
							</div>

							<div>
								<Label for="meal-plan-day-{entry.id}">{t('mealPlan.day.label')}</Label>
								<select
									id="meal-plan-day-{entry.id}"
									value={entry.dayIndex ?? ''}
									onchange={(event) => setDay(entry.id, event.currentTarget.value)}
									data-test-class="meal-plan-day"
									class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border"
								>
									<option value="">{t('mealPlan.day.none')}</option>
									{#each Array.from({ length: DAY_COUNT }, (_, index) => index) as day (day)}
										<option value={day}>{t(`mealPlan.day.${day}`)}</option>
									{/each}
								</select>
							</div>
						</div>
					</li>
				{/if}
			{/each}
		</ul>

		<div class="bg-card mt-4 space-y-3 rounded-xl border p-4">
			<h2 class="text-h2 font-semibold">{t('mealPlan.generate')}</h2>

			<div>
				<Label for="meal-plan-target">{t('mealPlan.target')}</Label>
				<select
					id="meal-plan-target"
					bind:value={target}
					data-test-id="meal-plan-target"
					class="border-input bg-background min-h-[max(2.75rem,44px)] w-full rounded-md border"
				>
					<option value="">{t('mealPlan.targetNew')}</option>
					{#each data.lists as list (list.id)}
						<option value={list.id}>{list.emoji} {list.name}</option>
					{/each}
				</select>
			</div>

			<Button onclick={generate} data-test-id="meal-plan-generate-list" class="fl-press">
				<ShoppingBasket size={18} aria-hidden="true" />
				{t('mealPlan.generateSubmit')}
			</Button>
		</div>
	{/if}

	<div class="mt-6 border-t pt-4">
		{#if toDelete}
			<p class="text-label">{t('mealPlan.deleteConfirm', { name: plan.name })}</p>
			<div class="mt-2 flex flex-wrap gap-2">
				<Button
					variant="outline"
					onclick={removePlan}
					data-test-id="meal-plan-delete-confirm"
					class="fl-press"
				>
					{t('mealPlan.deleteYes')}
				</Button>
				<Button variant="outline" onclick={() => (toDelete = false)} class="fl-press">
					{t('common.cancel')}
				</Button>
			</div>
		{:else}
			<Button
				variant="outline"
				onclick={() => (toDelete = true)}
				data-test-id="meal-plan-delete"
				class="fl-press"
			>
				<Trash2 size={18} aria-hidden="true" />
				{t('mealPlan.delete')}
			</Button>
		{/if}
	</div>
{/if}
