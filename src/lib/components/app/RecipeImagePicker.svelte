<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { data } from '$stores/data.svelte';
	import { imageBanks } from '$stores/image-banks.svelte';
	import { toasts } from '$stores/toast.svelte';
	import {
		recipeImagePrompt,
		photoFailureKey,
		type ImageSearchResult,
		type PhotoFailure
	} from '$domain/ai-image';
	import { IMAGE_BANKS } from '$domain/image-bank';
	import {
		fitWithin,
		RECIPE_PHOTO_MAX_BYTES,
		RECIPE_PHOTO_MAX_SIDE,
		RECIPE_PHOTO_QUALITY
	} from '$domain/photo-resize';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import {
		ArrowLeft,
		Camera,
		Images,
		LoaderCircle,
		RotateCw,
		Search,
		Sparkles,
		Trash2,
		X
	} from '@lucide/svelte';

	interface Props {
		recipeId: string;
		recipeName: string;
		ingredientNames: string[];
		photoPath?: string;
		imagePrompt?: string;
	}

	let { recipeId, recipeName, ingredientNames, photoPath, imagePrompt }: Props = $props();

	type Source = 'search' | 'camera' | 'gallery' | 'generate' | 'remove';

	let dialog = $state<HTMLDialogElement | null>(null);
	let cameraInput = $state<HTMLInputElement | null>(null);
	let galleryInput = $state<HTMLInputElement | null>(null);

	let view = $state<'menu' | 'search'>('menu');
	let busy = $state<Source | null>(null);
	let menuFailure = $state<PhotoFailure | 'too-big' | null>(null);

	let query = $state('');
	let searching = $state(false);
	let results = $state<ImageSearchResult[]>([]);
	let searchFailure = $state<PhotoFailure | null>(null);
	let pickingId = $state<string | null>(null);

	const savedBanks = $derived(IMAGE_BANKS.filter((bank) => imageBanks.saved.includes(bank.id)));
	const sourceNames = $derived(['Openverse', ...savedBanks.map((bank) => bank.name)].join(', '));
	const locked = $derived(busy !== null || pickingId !== null);

	export function show() {
		view = 'menu';
		busy = null;
		menuFailure = null;
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	function done() {
		hide();
		toasts.success(t('ai.photoSaved'));
	}

	function openSearch() {
		view = 'search';
		query = recipeName.trim();
		results = [];
		searchFailure = null;
		void runSearch();
	}

	async function runSearch() {
		const trimmed = query.trim();
		if (!trimmed || searching) return;

		searching = true;
		searchFailure = null;
		const outcome = await imageBanks.search(trimmed);
		searching = false;

		if (outcome.ok) {
			results = outcome.results;
		} else {
			results = [];
			searchFailure = outcome.reason;
		}
	}

	async function pick(result: ImageSearchResult) {
		if (locked) return;

		pickingId = result.id;
		searchFailure = null;
		const outcome = await ai.fetchRecipePhoto(data.circle, recipeId, result.imageUrl);
		pickingId = null;

		if (!outcome.ok) {
			searchFailure = outcome.reason;
			return;
		}

		data.setRecipePhoto(recipeId, outcome.path);
		done();
	}

	async function generate() {
		if (locked) return;

		if (!ai.generatesImages) {
			menuFailure = 'no-key';
			return;
		}

		busy = 'generate';
		menuFailure = null;

		let described = imagePrompt;
		if (!described && ai.configured) {
			const steps = data.stepsOf(recipeId).map((step) => step.body);
			described = (await ai.describeDish(recipeName, ingredientNames, steps)) ?? undefined;
			if (described) data.setRecipeImagePrompt(recipeId, described);
		}

		const prompt = recipeImagePrompt(described, recipeName, ingredientNames);
		const outcome = await ai.generateRecipePhoto(data.circle, recipeId, prompt);
		busy = null;

		if (!outcome.ok) {
			menuFailure = outcome.reason;
			return;
		}

		data.setRecipePhoto(recipeId, outcome.path);
		done();
	}

	async function resized(file: File): Promise<Blob> {
		const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
		const size = fitWithin(bitmap.width, bitmap.height, RECIPE_PHOTO_MAX_SIDE);
		const canvas = document.createElement('canvas');
		canvas.width = size.width;
		canvas.height = size.height;
		canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height);
		bitmap.close();

		return new Promise((resolve, reject) =>
			canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode'))), 'image/jpeg', RECIPE_PHOTO_QUALITY)
		);
	}

	async function useDevicePhoto(source: 'camera' | 'gallery', input: HTMLInputElement) {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;

		menuFailure = null;
		if (file.size > RECIPE_PHOTO_MAX_BYTES) {
			menuFailure = 'too-big';
			return;
		}

		busy = source;
		let photo: Blob;
		try {
			photo = await resized(file);
		} catch {
			busy = null;
			menuFailure = 'upload';
			return;
		}

		const outcome = await ai.uploadRecipePhoto(data.circle, recipeId, photo);
		busy = null;

		if (!outcome.ok) {
			menuFailure = outcome.reason;
			return;
		}

		data.setRecipePhoto(recipeId, outcome.path);
		done();
	}

	async function remove() {
		if (!photoPath || locked) return;

		busy = 'remove';
		const removed = photoPath;
		data.setRecipePhoto(recipeId, undefined);
		await ai.removeRecipePhoto(removed);
		busy = null;
		hide();
		toasts.success(t('ai.photoRemoved'));
	}
</script>

{#snippet sourceButton(id: Source, Icon: typeof Search, label: string, hint: string, onclick: () => void)}
	<li>
		<button
			type="button"
			{onclick}
			disabled={locked}
			aria-busy={busy === id || undefined}
			data-test-id="recipe-image-source-{id}"
			class="fl-press hover:bg-muted flex min-h-[max(3.5rem,56px)] w-full items-center gap-3 rounded-xl border p-3 text-start disabled:opacity-60 {id ===
			'remove'
				? 'text-destructive'
				: ''}"
		>
			{#if busy === id}
				<LoaderCircle size={24} class="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
			{:else}
				<Icon size={24} class="shrink-0" aria-hidden="true" />
			{/if}
			<span class="min-w-0 flex-1">
				<span class="text-label block font-semibold">{label}</span>
				{#if hint}<span class="text-muted-foreground text-caption block">{hint}</span>{/if}
			</span>
		</button>
	</li>
{/snippet}

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog && !locked) hide();
	}}
	class="fl-sheet"
	aria-labelledby="recipe-image-picker-title"
	data-test-id="recipe-image-picker"
>
	<div class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl">
		{#if view === 'menu'}
			<h2 id="recipe-image-picker-title" class="text-h2 pe-12 font-semibold">
				{photoPath ? t('ai.photoChange') : t('ai.photoAdd')}
			</h2>

			<ul class="mt-4 space-y-2">
				{@render sourceButton('search', Search, t('ai.photoSearch'), sourceNames, openSearch)}
				{@render sourceButton('camera', Camera, t('ai.photoCamera'), '', () => cameraInput?.click())}
				{@render sourceButton('gallery', Images, t('ai.photoGallery'), '', () => galleryInput?.click())}
				{@render sourceButton(
					'generate',
					Sparkles,
					busy === 'generate' ? t('ai.photoGenerating') : t('ai.photoGenerate'),
					ai.generatesImages ? t('ai.photoGenerateHint') : t('ai.photoGenerateNeedsKey'),
					() => void generate()
				)}
				{#if photoPath}
					{@render sourceButton('remove', Trash2, t('ai.photoRemove'), '', () => void remove())}
				{/if}
			</ul>

			<div aria-live="polite" class="mt-3">
				{#if busy === 'camera' || busy === 'gallery'}
					<p class="text-muted-foreground text-label">{t('ai.photoUsing')}</p>
				{:else if menuFailure}
					<p class="text-label" role="alert" data-test-id="recipe-image-picker-error">
						{menuFailure === 'too-big' ? t('ai.photoTooBig') : t(photoFailureKey(menuFailure))}
						{#if menuFailure === 'no-key' || menuFailure === 'no-credit'}
							<a
								href={menuFailure === 'no-key' ? '/profile/ai' : 'https://openrouter.ai/settings/credits'}
								target={menuFailure === 'no-key' ? undefined : '_blank'}
								rel={menuFailure === 'no-key' ? undefined : 'noreferrer noopener'}
								class="text-primary underline underline-offset-2"
								data-test-id="recipe-image-picker-error-link"
							>
								{menuFailure === 'no-key' ? t('ai.photoErrorNoKeyLink') : t('ai.photoErrorNoCreditLink')}
							</a>
						{/if}
					</p>
				{/if}
			</div>

			<input
				bind:this={cameraInput}
				type="file"
				accept="image/*"
				capture="environment"
				class="sr-only"
				tabindex="-1"
				aria-hidden="true"
				data-test-id="recipe-image-camera-input"
				onchange={(event) => void useDevicePhoto('camera', event.currentTarget)}
			/>
			<input
				bind:this={galleryInput}
				type="file"
				accept="image/*"
				class="sr-only"
				tabindex="-1"
				aria-hidden="true"
				data-test-id="recipe-image-gallery-input"
				onchange={(event) => void useDevicePhoto('gallery', event.currentTarget)}
			/>
		{:else}
			<div class="flex items-center gap-2 pe-12">
				<button
					type="button"
					onclick={() => (view = 'menu')}
					disabled={locked}
					aria-label={t('ai.photoBack')}
					data-test-id="recipe-image-search-back"
					class="fl-press text-muted-foreground hover:bg-muted grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
				>
					<ArrowLeft size={22} aria-hidden="true" class="rtl:rotate-180" />
				</button>
				<h2 id="recipe-image-picker-title" class="text-h2 font-semibold">{t('ai.photoSearchTitle')}</h2>
			</div>

			<form
				class="mt-4 flex flex-wrap items-end gap-2"
				onsubmit={(event) => {
					event.preventDefault();
					void runSearch();
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

			<div class="mt-4 space-y-2" aria-live="polite">
				{#if searching}
					<p class="text-muted-foreground text-label" data-test-id="recipe-image-search-loading">
						{t('ai.photoSearching')}
					</p>
				{:else if searchFailure}
					<div class="space-y-2" role="alert" data-test-id="recipe-image-search-error">
						<p class="text-label">{t(photoFailureKey(searchFailure))}</p>
						{#if searchFailure === 'not-found'}
							<p class="text-muted-foreground text-label">{t('ai.photoSearchNotFoundHint')}</p>
						{:else}
							<Button variant="outline" onclick={() => void runSearch()} class="fl-press h-11 px-4 text-base">
								<RotateCw size={18} aria-hidden="true" />
								{t('ai.photoRetry')}
							</Button>
						{/if}
					</div>
				{:else if results.length}
					<p class="text-muted-foreground text-label">{t('ai.photoSearchHint')}</p>
				{/if}
				{#if !searching && savedBanks.length === 0}
					<p class="text-muted-foreground text-caption" data-test-id="recipe-image-banks-hint">
						{t('ai.photoBanksHint')}
						<a href="/profile/images" class="text-primary underline underline-offset-2">{t('imageBanks.title')}</a>
					</p>
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
								disabled={locked}
								aria-label={t('ai.photoPick', { title: result.title || recipeName })}
								aria-busy={pickingId === result.id || undefined}
								data-test-class="recipe-image-search-result"
								data-source={result.source}
								class="fl-press focus-visible:ring-ring/50 relative block w-full overflow-hidden rounded-lg border text-start outline-none focus-visible:ring-3 disabled:opacity-60"
							>
								<img
									src={result.previewUrl}
									alt=""
									loading="lazy"
									onerror={() => (results = results.filter((other) => other.id !== result.id))}
									class="aspect-square w-full object-cover"
								/>
								<span class="text-caption text-muted-foreground block truncate px-2 py-1">
									{[result.creator, result.license].filter(Boolean).join(' · ')}
								</span>
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
		{/if}

		<button
			type="button"
			onclick={hide}
			disabled={locked}
			aria-label={t('common.close')}
			data-test-id="recipe-image-picker-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
