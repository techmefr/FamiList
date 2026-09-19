<script lang="ts">
	import { goto } from '$app/navigation';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import * as Card from '$components/ui/card';
	import EmptyState from '$components/app/EmptyState.svelte';
	import { CalendarDays, Plus, ChevronRight } from '@lucide/svelte';

	const plans = $derived(data.mealPlans);

	async function create() {
		feedback.play('add');
		const plan = data.addMealPlan(t('mealPlan.defaultName'));
		await goto(`/meal-plan/${plan.id}`);
	}

	function recipeCount(planId: string) {
		return data.recipesInPlan(planId).length;
	}
</script>

<svelte:head>
	<title>{t('mealPlan.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('mealPlan.title')}</h1>
<p class="text-muted-foreground text-label mt-1">{t('mealPlan.intro')}</p>

<Button onclick={create} data-test-id="meal-plan-create" class="fl-press mt-4">
	<Plus size={18} aria-hidden="true" />
	{t('mealPlan.new')}
</Button>

{#if plans.length === 0}
	<EmptyState illustration="lists" text={t('mealPlan.empty')} testId="meal-plan-empty" />
{:else}
	<ul class="mt-4 space-y-3" data-test-id="meal-plan-list">
		{#each plans as plan (plan.id)}
			<li>
				<a href="/meal-plan/{plan.id}" data-test-class="meal-plan-open">
					<Card.Root class="fl-press hover:bg-muted/50 transition-colors">
						<Card.Content class="flex items-center gap-3">
							<CalendarDays size={22} aria-hidden="true" class="text-muted-foreground shrink-0" />
							<div class="min-w-0 flex-1">
								<p class="text-label truncate font-medium">{plan.name}</p>
								<p class="text-muted-foreground text-caption">
									{t('mealPlan.recipeCount', { count: recipeCount(plan.id) })}
								</p>
							</div>
							<ChevronRight size={18} aria-hidden="true" class="text-muted-foreground shrink-0" />
						</Card.Content>
					</Card.Root>
				</a>
			</li>
		{/each}
	</ul>
{/if}
