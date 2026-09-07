<script lang="ts">
	import { flip } from 'svelte/animate';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { CODE_TYPES, guessCodeType, type CodeType } from '$domain/code-format';
	import { normalizeEan13 } from '$domain/barcode';
	import LoyaltyCardFace from '$components/app/LoyaltyCardFace.svelte';
	import CardFullscreen from '$components/app/CardFullscreen.svelte';
	import ScanButton from '$components/app/ScanButton.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Plus, Trash2, ScanLine } from '@lucide/svelte';

	let openCardId = $state<string | null>(null);
	let adding = $state(false);

	let name = $state('');
	let code = $state('');
	let codeType = $state<CodeType | ''>('');
	let points = $state('0');

	const openCard = $derived(data.cards.find((c) => c.id === openCardId) ?? null);

	/** Le format suit la saisie tant que l'utilisateur n'en a pas imposé un. */
	const effectiveType = $derived(codeType || (code.trim() ? guessCodeType(code) : 'code_39'));
	const invalidEan = $derived(effectiveType === 'ean_13' && !normalizeEan13(code));

	const shopTint = (shopName: string) =>
		data.shops.find((s) => s.name === shopName)?.tint ?? '#5A4A2F';

	function reset() {
		adding = false;
		name = '';
		code = '';
		codeType = '';
		points = '0';
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim() || !code.trim() || invalidEan) return;

		const tint = shopTint(name.trim());

		feedback.play('add');
		data.addCard({
			shopId: data.shops.find((s) => s.name === name.trim())?.id ?? '',
			name: name.trim(),
			num: `•••• •••• ${code.trim().slice(-4)}`,
			code: code.trim(),
			codeType: effectiveType,
			points: Number(points) || 0,
			tint,
			grad: `linear-gradient(135deg, ${tint} 0%, #2E2518 100%)`
		});

		reset();
	}
</script>

<svelte:head>
	<title>{t('cards.title')} — {t('app.name')}</title>
</svelte:head>

<p class="text-label text-muted-foreground">{t('cards.wallet')}</p>
<h1 class="text-h1 font-semibold">{t('cards.title')}</h1>

{#if !data.ready}
	<p class="text-muted-foreground mt-6">{t('common.loading')}</p>
{:else}
	<p
		class="text-label text-primary mt-6 flex items-center gap-3 rounded-md bg-[var(--fl-primary-tint)] p-4"
	>
		<ScanLine size={20} aria-hidden="true" class="shrink-0" />
		{t('cards.tapHint')}
	</p>

	{#if data.cards.length === 0}
		<p class="text-muted-foreground mt-6" data-test="cards-empty">{t('cards.empty')}</p>
	{:else}
		<ul class="mt-6 space-y-4">
			{#each data.cards as card, index (card.id)}
				<li
					class="fl-rise relative"
					style="animation-delay: {Math.min(index, 6) * 45}ms"
					animate:flip={{ duration: motionMs(280), easing: cubicOut }}
					out:slide={{ duration: motionMs(180), easing: cubicOut }}
				>
					<button
						type="button"
						onclick={() => {
							feedback.play('tap');
							openCardId = card.id;
						}}
						class="fl-press block w-full text-start"
						data-test="card-open"
					>
						<LoyaltyCardFace {card} />
					</button>
					<button
						type="button"
						onclick={() => {
							feedback.play('remove');
							data.removeCard(card.id);
						}}
						aria-label={t('cards.delete', { name: card.name })}
						data-test="card-delete"
						class="fl-press absolute end-2 bottom-2 grid size-11 min-w-[44px] place-items-center text-white/70"
					>
						<Trash2 size={18} aria-hidden="true" />
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if adding}
		<form
			onsubmit={submit}
			transition:slide={{ duration: motionMs(220), easing: cubicOut }}
			class="bg-card mt-6 space-y-4 rounded-md border p-4"
			data-test="card-form"
		>
			<div>
				<Label for="card-name">{t('cards.name')}</Label>
				<Input id="card-name" bind:value={name} data-test="card-name" required />
			</div>

			<div>
				<Label for="card-code">{t('cards.code')}</Label>
				<Input id="card-code" bind:value={code} data-test="card-code" required />
				<ScanButton
					onScanned={(result) => {
						code = result.value;
						if (result.codeType) codeType = result.codeType;
					}}
				/>
				{#if invalidEan}
					<p class="text-destructive text-caption mt-1" role="alert" data-test="card-code-error">
						{t('cards.eanInvalid')}
					</p>
				{/if}
			</div>

			<div>
				<Label for="card-type">{t('cards.format')}</Label>
				<select
					id="card-type"
					bind:value={codeType}
					data-test="card-type"
					class="border-input bg-background mt-1 w-full rounded-md border px-3 py-2"
				>
					<option value="">{t('cards.formatAuto', { format: t(`cards.type.${effectiveType}`) })}</option>
					{#each CODE_TYPES as type (type)}
						<option value={type}>{t(`cards.type.${type}`)}</option>
					{/each}
				</select>
			</div>

			<div>
				<Label for="card-points">{t('cards.points')}</Label>
				<Input id="card-points" bind:value={points} inputmode="numeric" data-test="card-points" />
			</div>

			<div class="flex flex-wrap gap-2">
				<Button type="submit" data-test="card-submit" class="fl-press">{t('cards.save')}</Button>
				<Button type="button" variant="outline" onclick={reset}>{t('common.cancel')}</Button>
			</div>
		</form>
	{:else}
		<Button
			variant="outline"
			onclick={() => {
				feedback.play('tap');
				adding = true;
			}}
			data-test="card-add"
			class="fl-press mt-6 w-full border-dashed py-6"
		>
			<Plus size={20} aria-hidden="true" />
			{t('cards.add')}
		</Button>
	{/if}

	<p class="text-muted-foreground text-caption mt-6">{t('cards.secretNotice')}</p>
{/if}

{#if openCard}
	<CardFullscreen card={openCard} onClose={() => (openCardId = null)} />
{/if}
