<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { decideCardShare, pendingCardShares, type PendingCardShare } from '$stores/card-account';
	import type { CardShareDecision } from '$domain/card-share';
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';

	let requests = $state<PendingCardShare[]>([]);
	let error = $state('');

	async function load() {
		const result = await pendingCardShares();
		if (result.ok) requests = result.value;
		error = result.ok ? '' : result.error;
	}

	$effect(() => {
		void data.cardShares;
		void load();
	});

	async function answer(request: PendingCardShare, decision: CardShareDecision) {
		feedback.play('tap');
		const result = await decideCardShare(request.cardId, request.householdId, decision);
		error = result.ok ? '' : result.error;
		if (result.ok) {
			requests = requests.filter(
				(other) => other.cardId !== request.cardId || other.householdId !== request.householdId
			);
		}
	}
</script>

{#if requests.length > 0 || error}
	<section
		class="bg-card mt-6 rounded-xl border p-4"
		aria-labelledby="card-requests-title"
		data-test-id="card-share-requests"
	>
		<h2 id="card-requests-title" class="text-h2 font-semibold">{t('cards.requestsTitle')}</h2>
		<ul class="mt-3 space-y-3">
			{#each requests as request (`${request.cardId}::${request.householdId}`)}
				<li class="flex flex-wrap items-center gap-2" data-test-class="card-share-request-item">
					<p class="text-label min-w-0 flex-1">
						{t('cards.requestFrom', { name: request.cardName, person: request.sharedByName })}
						<span class="text-muted-foreground text-caption block">
							{data.circleName(request.householdId)}
						</span>
					</p>
					<Button
						onclick={() => answer(request, 'accepted')}
						aria-label={t('cards.requestAcceptLabel', { name: request.cardName })}
						data-test-class="card-share-accept"
					>
						{t('cards.requestAccept')}
					</Button>
					<Button
						variant="outline"
						onclick={() => answer(request, 'declined')}
						aria-label={t('cards.requestDeclineLabel', { name: request.cardName })}
						data-test-class="card-share-decline"
					>
						{t('cards.requestDecline')}
					</Button>
				</li>
			{/each}
		</ul>
		{#if error}
			<p class="text-destructive text-caption mt-3" role="alert">{t('cards.shareError', { error })}</p>
		{/if}
	</section>
{/if}
