<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { recipeScan } from '$stores/recipe-scan.svelte';
	import { ocrEngine } from '$native/ocr';
	import type { RecipeDraft } from '$domain/recipe-draft';
	import { Button } from '$components/ui/button';
	import AiRecipePhoto from '$components/app/AiRecipePhoto.svelte';
	import { ArrowDown, ArrowUp, Camera, Images, Sparkles, Trash2 } from '@lucide/svelte';

	interface Props {
		onDraft: (draft: RecipeDraft) => void;
	}

	const { onDraft }: Props = $props();

	/**
	 * "Scan a recipe" (#312): pages read on the device, no key needed. The person's own AI, when it can read
	 * an image, stays offered as the better reader of handwriting, never as the default.
	 */
	const available = ocrEngine() !== null;
	const aiCanRead = $derived(ai.configured && ai.supportsVision);
	let useAi = $state(false);

	let camera = $state<HTMLInputElement | null>(null);
	let gallery = $state<HTMLInputElement | null>(null);

	const percent = $derived(Math.round(recipeScan.progress * 100));

	function pick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		recipeScan.add(input.files ?? []);
		input.value = '';
	}

	function open() {
		const draft = recipeScan.take();
		if (draft) onDraft(draft);
	}
</script>

{#if useAi}
	<div class="space-y-4" data-test-id="recipe-scan-ai">
		<Button variant="outline" onclick={() => (useAi = false)} data-test-id="recipe-scan-use-device" class="fl-press">
			{t('recipeScan.useDevice')}
		</Button>
		<AiRecipePhoto {onDraft} />
	</div>
{:else}
	<div class="space-y-4" data-test-id="recipe-scan" data-test-state={recipeScan.status}>
		{#if !available}
			<p class="text-label" role="status" data-test-id="recipe-scan-unavailable">{t('recipeScan.unavailable')}</p>
		{:else if recipeScan.status === 'ready'}
			<div class="bg-card space-y-3 rounded-xl border p-4" data-test-id="recipe-scan-ready">
				<p class="text-label font-semibold">{t('recipeScan.readyTitle')}</p>
				<p class="text-label">{t('recipeScan.readyBody')}</p>
				<Button onclick={open} data-test-id="recipe-scan-open" class="fl-press w-full">
					{t('recipeScan.open')}
				</Button>
				<Button variant="outline" onclick={() => recipeScan.clear()} data-test-id="recipe-scan-restart" class="fl-press w-full">
					{t('recipeScan.restart')}
				</Button>
			</div>
		{:else if recipeScan.reading}
			<div class="space-y-3" data-test-id="recipe-scan-reading">
				<p class="text-label font-semibold">{t('recipeScan.reading', { percent })}</p>
				<div
					role="progressbar"
					aria-label={t('recipeScan.readingToast')}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
					class="bg-muted h-3 overflow-hidden rounded-full"
				>
					<div class="bg-primary h-full rounded-full transition-[width]" style:width="{percent}%"></div>
				</div>
				<p class="text-muted-foreground text-label">{t('recipeScan.readingHint')}</p>
				<Button variant="outline" onclick={() => recipeScan.cancel()} data-test-id="recipe-scan-cancel" class="fl-press w-full">
					{t('recipeScan.cancel')}
				</Button>
			</div>
		{:else}
			<div class="bg-card rounded-xl border p-4">
				<p class="text-label font-semibold">{t('recipeScan.tipsTitle')}</p>
				<ul class="text-label mt-2 list-disc space-y-1 ps-5">
					<li>{t('recipeScan.tipSteady')}</li>
					<li>{t('recipeScan.tipLight')}</li>
					<li>{t('recipeScan.tipFrame')}</li>
				</ul>
			</div>

			{#if recipeScan.status === 'empty' || recipeScan.status === 'failed'}
				<p class="text-destructive text-label" role="alert" data-test-id="recipe-scan-error" data-test-state={recipeScan.status}>
					{t(recipeScan.status === 'empty' ? 'recipeScan.empty' : 'recipeScan.failed')}
				</p>
			{/if}

			<div class="grid gap-3 sm:grid-cols-2">
				<Button onclick={() => camera?.click()} disabled={recipeScan.full} data-test-id="recipe-scan-camera" class="fl-press h-auto min-h-[max(2.75rem,44px)] w-full whitespace-normal">
					<Camera size={18} aria-hidden="true" />
					{t('recipeScan.takePhoto')}
				</Button>
				<Button variant="outline" onclick={() => gallery?.click()} disabled={recipeScan.full} data-test-id="recipe-scan-gallery" class="fl-press h-auto min-h-[max(2.75rem,44px)] w-full whitespace-normal">
					<Images size={18} aria-hidden="true" />
					{t('recipeScan.choosePhotos')}
				</Button>
			</div>
			{#if recipeScan.full}
				<p class="text-muted-foreground text-label" data-test-id="recipe-scan-full">{t('recipeScan.full')}</p>
			{/if}

			{#if recipeScan.pages.length}
				<h2 class="text-label font-semibold">{t('recipeScan.pagesTitle')}</h2>
				<ol class="space-y-3" data-test-id="recipe-scan-pages">
					{#each recipeScan.pages as page, index (page.id)}
						{@const number = index + 1}
						<li class="bg-card flex flex-wrap items-center gap-3 rounded-xl border p-3" data-test-class="recipe-scan-page">
							<img src={page.url} alt="" class="size-16 shrink-0 rounded-lg object-cover" />
							<span class="text-label min-w-0 flex-1 font-medium" data-test-class="recipe-scan-page-label">{t('recipeScan.page', { number })}</span>
							<div class="flex flex-wrap gap-2">
								<Button variant="outline" disabled={index === 0} onclick={() => recipeScan.shift(page.id, -1)} aria-label={t('recipeScan.moveUpLabel', { number })} data-test-class="recipe-scan-page-up" class="fl-press min-h-[max(2.75rem,44px)]">
									<ArrowUp size={18} aria-hidden="true" />
									{t('recipeScan.moveUp')}
								</Button>
								<Button variant="outline" disabled={index === recipeScan.pages.length - 1} onclick={() => recipeScan.shift(page.id, 1)} aria-label={t('recipeScan.moveDownLabel', { number })} data-test-class="recipe-scan-page-down" class="fl-press min-h-[max(2.75rem,44px)]">
									<ArrowDown size={18} aria-hidden="true" />
									{t('recipeScan.moveDown')}
								</Button>
								<Button variant="outline" onclick={() => recipeScan.remove(page.id)} aria-label={t('recipeScan.removeLabel', { number })} data-test-class="recipe-scan-page-remove" class="fl-press min-h-[max(2.75rem,44px)]">
									<Trash2 size={18} aria-hidden="true" />
									{t('recipeScan.remove')}
								</Button>
							</div>
						</li>
					{/each}
				</ol>

				<Button onclick={() => void recipeScan.read()} data-test-id="recipe-scan-read" class="fl-press min-h-[max(2.75rem,44px)] w-full">
					{t('recipeScan.read')}
				</Button>
			{/if}
		{/if}

		{#if aiCanRead && !recipeScan.reading}
			<div class="bg-card space-y-2 rounded-xl border p-4" data-test-id="recipe-scan-ai-offer">
				<p class="text-label flex items-center gap-2 font-semibold">
					<Sparkles size={18} aria-hidden="true" />
					{t('recipeScan.aiTitle')}
				</p>
				<p class="text-label">{t('recipeScan.aiHint')}</p>
				<Button variant="outline" onclick={() => (useAi = true)} data-test-id="recipe-scan-use-ai" class="fl-press w-full">
					{t('recipeScan.useAi')}
				</Button>
			</div>
		{/if}
	</div>

	<input bind:this={camera} type="file" accept="image/*" capture="environment" onchange={pick} aria-label={t('recipeScan.takePhoto')} data-test-id="recipe-scan-camera-input" class="sr-only" tabindex="-1" />
	<input bind:this={gallery} type="file" accept="image/*" multiple onchange={pick} aria-label={t('recipeScan.choosePhotos')} data-test-id="recipe-scan-gallery-input" class="sr-only" tabindex="-1" />
{/if}
