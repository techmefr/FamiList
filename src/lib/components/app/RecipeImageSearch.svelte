<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { data } from '$stores/data.svelte';
	import { toasts } from '$stores/toast.svelte';
	import { photoFailureKey, type ImageSearchResult, type PhotoFailure } from '$domain/ai-image';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { LoaderCircle, RotateCw, Search, X } from '@lucide/svelte';

	interface Props {
		recipeId: string;
		recipeName: string;
	}

	let { recipeId, recipeName }: Props = $props();

	let dialog = $state<HTMLDialogElement | null>(null);
	let query = $state('');
	let searching = $state(false);
	let results = $state<ImageSearchResult[]>([]);
	let failure = $state<PhotoFailure | null>(null);
	let pickingId = $state<string | null>(null);

	export function show() {
		query = recipeName.trim();
		results = [];
		failure = null;
		dialog?.showModal();
		void run();
	}

	function hide() {
		dialog?.close();
	}

	async function run() {
		const trimmed = query.trim();
		if (!trimmed || searching) return;

		searching = true;
		failure = null;
		const outcome = await ai.searchRecipePhotos(trimmed);
		searching = false;

		if (outcome.ok) {
			results = outcome.results;
		} else {
			results = [];
			failure = outcome.reason;
		}
	}

	async function pick(result: ImageSearchResult) {
		if (pickingId) return;

		pickingId = result.id;
		failure = null;
		const outcome = await ai.fetchRecipePhoto(data.circle, recipeId, result.previewUrl);
		pickingId = null;

		if (!outcome.ok) {
			failure = outcome.reason;
			return;
		}

		data.setRecipePhoto(recipeId, outcome.path);
		hide();
		toasts.success(t('ai.photoSaved'));
	}
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="recipe-image-search-title"
	data-test-id="recipe-image-search"
>
	<div class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl">
		<h2 id="recipe-image-search-title" class="text-h2 pe-12 font-semibold">
			{t('ai.photoSearchTitle')}
		</h2>

		<form
			class="mt-4 flex flex-wrap items-end gap-2"
			onsubmit={(event) => {
				event.preventDefault();
				void run();
			}}
		>
			<div class="min-w-48 flex-1 space-y-1">
				<Label for="recipe-image-search-query">{t('ai.photoSearchQuery')}</Label>
				<Input
					id="recipe-image-search-query"
					type="search"
					bind:value={query}
					data-test-id="recipe-image-search-query"
					class="h-12 text-base"
				/>
			</div>
			<Button
				type="submit"
				loading={searching}
				disabled={!query.trim() || pickingId !== null}
				data-test-id="recipe-image-search-submit"
				class="fl-press h-12 px-4 text-base"
			>
				{#if !searching}<Search size={20} aria-hidden="true" />{/if}
				{searching ? t('ai.photoSearching') : t('ai.photoSearchSubmit')}
			</Button>
		</form>

		<div class="mt-4" aria-live="polite">
			{#if searching}
				<p class="text-muted-foreground text-label" data-test-id="recipe-image-search-loading">
					{t('ai.photoSearching')}
				</p>
			{:else if failure}
				<div class="space-y-2" role="alert" data-test-id="recipe-image-search-error">
					<p class="text-label">{t(photoFailureKey(failure))}</p>
					{#if failure === 'not-found'}
						<p class="text-muted-foreground text-label">{t('ai.photoSearchNotFoundHint')}</p>
					{:else}
						<Button variant="outline" onclick={() => void run()} class="fl-press h-11 px-4 text-base">
							<RotateCw size={18} aria-hidden="true" />
							{t('ai.photoRetry')}
						</Button>
					{/if}
				</div>
			{:else if results.length}
				<p class="text-muted-foreground text-label">{t('ai.photoSearchHint')}</p>
			{/if}
		</div>

		{#if results.length}
			<ul
				class="mt-3 grid max-h-[55vh] grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 overflow-y-auto pb-1"
				data-test-id="recipe-image-search-results"
			>
				{#each results as result (result.id)}
					<li>
						<button
							type="button"
							onclick={() => void pick(result)}
							disabled={pickingId !== null}
							aria-label={t('ai.photoPick', { title: result.title || recipeName })}
							aria-busy={pickingId === result.id || undefined}
							data-test-class="recipe-image-search-result"
							class="fl-press focus-visible:ring-ring/50 relative block w-full overflow-hidden rounded-lg border text-start outline-none focus-visible:ring-3 disabled:opacity-60"
						>
							<img
								src={result.previewUrl}
								alt=""
								loading="lazy"
								onerror={() => (results = results.filter((other) => other.id !== result.id))}
								class="aspect-square w-full object-cover"
							/>
							{#if result.creator || result.license}
								<span class="text-caption text-muted-foreground block truncate px-2 py-1">
									{[result.creator, result.license].filter(Boolean).join(' · ')}
								</span>
							{/if}
							{#if pickingId === result.id}
								<span class="bg-background/70 absolute inset-0 grid place-items-center">
									<LoaderCircle size={32} class="animate-spin motion-reduce:animate-none" aria-hidden="true" />
									<span class="sr-only">{t('ai.photoUsing')}</span>
								</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="recipe-image-search-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
