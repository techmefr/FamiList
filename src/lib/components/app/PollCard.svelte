<script lang="ts">
	import type { Poll } from '$db/schema';
	import { data } from '$stores/data.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Check, CalendarCheck, ListPlus, Pencil } from '@lucide/svelte';

	let { poll, listId }: { poll: Poll; listId: string } = $props();

	const options = $derived(data.optionsOf(poll.id));
	const totalVotes = $derived(options.reduce((sum, o) => sum + data.votersOf(o.id).length, 0));

	let editing = $state<string | null>(null);
	let draft = $state('');
	let pushed = $state<string | null>(null);

	function startEditing(optionId: string, ingredients: string[]) {
		editing = optionId;
		draft = ingredients.join('\n');
	}

	function saveIngredients(optionId: string) {
		data.setIngredients(optionId, draft.split('\n'));
		editing = null;
	}

	function push(optionId: string) {
		const added = data.pushIngredients(listId, optionId);
		pushed = t('chat.pushed', { count: added });
	}
</script>

<div class="bg-card mt-2 rounded-md border p-4" data-test="poll">
	<p class="text-product font-medium">{poll.question}</p>

	<ul class="mt-3 space-y-2">
		{#each options as option (option.id)}
			{@const voters = data.votersOf(option.id)}
			{@const mine = voters.includes(data.me)}
			{@const share = totalVotes === 0 ? 0 : Math.round((voters.length / totalVotes) * 100)}
			{@const owner = option.claimedBy ? data.member(option.claimedBy) : undefined}

			<li>
				{#if poll.kind === 'date'}
					<button
						type="button"
						onclick={() => data.toggleVote(poll.id, option.id)}
						data-test="poll-vote"
						class="border-input relative w-full overflow-hidden rounded-md border px-3 py-3 text-start
							{mine ? 'border-primary' : ''}"
						aria-pressed={mine}
					>
						<span
							class="absolute inset-y-0 start-0 bg-[var(--fl-primary-tint)]"
							style="width: {share}%"
							aria-hidden="true"
						></span>
						<span class="relative flex items-center gap-2">
							{#if mine}
								<Check size={16} class="text-primary shrink-0" aria-hidden="true" />
							{/if}
							<span class="flex-1">{option.label}</span>
							<span class="text-muted-foreground text-caption">
								{t('chat.votes', { count: voters.length })}
							</span>
						</span>
					</button>
				{:else}
					<div class="border-input rounded-md border p-3 {owner ? 'border-primary' : ''}">
						<div class="flex flex-wrap items-center gap-2">
							<span aria-hidden="true">{option.emoji ?? '🍽️'}</span>
							<span class="flex-1 font-medium">{option.label}</span>

							{#if owner}
								<span class="text-caption text-primary">{owner.name}</span>
							{/if}

							{#if !option.claimedBy || option.claimedBy === data.me}
								<Button
									variant={option.claimedBy ? 'outline' : 'default'}
									onclick={() => data.toggleClaim(option.id)}
									data-test="poll-claim"
								>
									{option.claimedBy ? t('chat.release') : t('chat.claim')}
								</Button>
							{/if}
						</div>

						{#if option.claimedBy === data.me}
							{#if editing === option.id}
								<textarea
									bind:value={draft}
									rows="3"
									placeholder={t('chat.ingredientsPlaceholder')}
									data-test="poll-ingredients"
									class="border-input bg-background mt-3 w-full rounded-md border p-2"
								></textarea>
								<Button onclick={() => saveIngredients(option.id)} data-test="poll-ingredients-save">
									{t('common.save')}
								</Button>
							{:else}
								<div class="mt-3 flex flex-wrap items-center gap-2">
									<Button
										variant="outline"
										onclick={() => startEditing(option.id, option.ingredients)}
										data-test="poll-ingredients-edit"
									>
										<Pencil size={16} aria-hidden="true" />
										{t('chat.ingredients')}
									</Button>

									{#if option.ingredients.length > 0}
										<Button onclick={() => push(option.id)} data-test="poll-push">
											<ListPlus size={16} aria-hidden="true" />
											{t('chat.pushToList')}
										</Button>
									{/if}
								</div>

								{#if option.ingredients.length > 0}
									<ul class="text-muted-foreground text-label mt-2 list-disc ps-5">
										{#each option.ingredients as ingredient (ingredient)}
											<li>{ingredient}</li>
										{/each}
									</ul>
								{/if}
							{/if}
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	{#if poll.kind === 'date'}
		{@const winner = options.reduce(
			(best, option) =>
				data.votersOf(option.id).length > data.votersOf(best.id).length ? option : best,
			options[0]
		)}
		{#if winner && totalVotes > 0}
			<Button
				variant="outline"
				onclick={() => data.setEventDate(listId, winner.label)}
				data-test="poll-set-date"
				class="mt-3"
			>
				<CalendarCheck size={16} aria-hidden="true" />
				{t('chat.setEventDate', { date: winner.label })}
			</Button>
		{/if}
	{/if}

	{#if pushed}
		<p class="text-primary text-caption mt-3" role="status" data-test="poll-pushed">{pushed}</p>
	{/if}
</div>
