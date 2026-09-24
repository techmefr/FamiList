<script lang="ts">
	import type { LoyaltyCard } from '$db/schema';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { requestCardShare, withdrawCardShare } from '$stores/card-account';
	import { canRequest } from '$domain/card-share';
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import { X } from '@lucide/svelte';

	let { card }: { card: LoyaltyCard } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);
	let busy = $state<string | null>(null);
	let error = $state('');

	const otherCircles = $derived(data.circles.filter((circle) => circle.id !== card.householdId));

	export function show() {
		error = '';
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	async function act(householdId: string, request: boolean) {
		feedback.play('tap');
		busy = householdId;
		const result = request
			? await requestCardShare(card.id, householdId)
			: await withdrawCardShare(card.id, householdId);
		error = result.ok ? '' : result.error;
		busy = null;
	}
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="card-share-title"
	data-test-id="card-share-sheet"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="card-share-title" class="text-h2 pe-12 font-semibold">{t('cards.shareTitle')}</h2>
		<p class="text-muted-foreground text-caption mt-1 pe-12">{t('cards.shareNote')}</p>

		{#if otherCircles.length === 0}
			<p class="text-muted-foreground text-label mt-4" data-test-id="card-share-empty">
				{t('cards.shareEmpty')}
			</p>
		{:else}
			<ul class="mt-4 space-y-1">
				{#each otherCircles as circle (circle.id)}
					{@const status = data.cardShareStatus(card.id, circle.id)}
					<li
						class="flex min-h-[max(3.5rem,56px)] items-center gap-3 rounded-lg px-2"
						data-test-class="card-share-circle"
					>
						<span class="text-label min-w-0 flex-1 font-medium">{circle.name}</span>
						{#if status !== 'none'}
							<span class="text-muted-foreground text-caption" data-test-class="card-share-status">
								{t(`cards.shareStatus.${status}`)}
							</span>
						{/if}
						{#if canRequest(status)}
							<Button
								variant="outline"
								disabled={busy === circle.id}
								onclick={() => act(circle.id, true)}
								data-test-class="card-share-request"
							>
								{t('cards.shareRequest')}
							</Button>
						{/if}
						{#if status === 'pending' || status === 'accepted'}
							<Button
								variant="outline"
								disabled={busy === circle.id}
								onclick={() => act(circle.id, false)}
								data-test-class="card-share-withdraw"
							>
								{t('cards.shareWithdraw')}
							</Button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}

		{#if error}
			<p class="text-destructive text-caption mt-3" role="alert" data-test-id="card-share-error">
				{t('cards.shareError', { error })}
			</p>
		{/if}

		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="card-share-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
