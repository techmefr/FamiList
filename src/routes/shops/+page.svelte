<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { tintForWhiteText } from '$domain/tint';
	import type { Shop } from '$lib/db/schema';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import EmojiPicker from '$components/app/EmojiPicker.svelte';
	import ShopForm from '$components/app/ShopForm.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { Plus, LayoutList, Pencil, Trash2 } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';

	let aisleName = $state('');
	let aisleEmoji = $state('🛒');
	let picker = $state<EmojiPicker | null>(null);

	/** The shop open for editing, and the one whose deletion is waiting to be confirmed. */
	let modifie = $state<string | null>(null);
	let aSupprimer = $state<string | null>(null);

	/**
	 * Deleting a shop asks for a confirmation, where deleting a card does not: the learned route goes with
	 * it, and it is not found again — redoing it means doing the shopping once more while tidying the aisles.
	 */
	function supprimer(shop: Shop) {
		feedback.play('remove');
		data.removeShop(shop.id);
		aSupprimer = null;
		if (modifie === shop.id) modifie = null;
	}

	function addAisle(event: SubmitEvent) {
		event.preventDefault();
		if (!aisleName.trim()) return;

		data.addAisle({ name: aisleName, emoji: aisleEmoji });
		aisleName = '';
		aisleEmoji = '🛒';
	}
</script>

<svelte:head>
	<title>{t('shops.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('shops.title')}</h1>

<div class="bg-card mt-6 rounded-xl border p-4">
	<ShopForm />
</div>

{#if data.shops.length === 0}
	<EmptyState illustration="shop" text={t('shops.empty')} testId="shops-empty" />
{:else}
	<ul class="mt-6 space-y-3">
		{#each data.shops as shop (shop.id)}
			{@const learned = data.layouts.find((l) => l.shopId === shop.id)?.learned}
			<li>
				<Card.Root data-test-class="shop-card">
					<Card.Content>
						<div class="flex flex-wrap items-center gap-x-4 gap-y-3">
							<span
								class="text-label grid size-11 shrink-0 place-items-center rounded-full font-semibold text-white"
								style="background: {tintForWhiteText(shop.tint)}"
								aria-hidden="true"
							>
								{shop.short}
							</span>
							<div class="min-w-0 flex-1 basis-[10rem]">
								<p class="text-product font-medium break-words">{shop.name}</p>
								{#if shop.address || shop.dist}
									<p class="text-muted-foreground text-caption break-words">
										{shop.address || shop.dist}
									</p>
								{/if}
							</div>
							<Badge variant={shop.isDefault ? 'outline' : learned ? 'default' : 'secondary'}>
								{shop.isDefault
									? t('shops.defaultBadge')
									: learned
										? t('shops.learned')
										: t('shops.notLearned')}
							</Badge>
						</div>

						<div class="mt-3 flex flex-wrap items-center gap-3">
							<Button
								variant="outline"
								onclick={() => {
									aSupprimer = null;
									modifie = modifie === shop.id ? null : shop.id;
								}}
								data-test-class="shop-edit"
							>
								<Pencil size={18} aria-hidden="true" />
								{t('shops.edit')}
							</Button>

							<Button
								variant="outline"
								onclick={() => (aSupprimer = aSupprimer === shop.id ? null : shop.id)}
								aria-label={t('shops.delete', { name: shop.name })}
								data-test-class="shop-delete"
							>
								<Trash2 size={18} aria-hidden="true" />
							</Button>
						</div>

						<!--
							The confirmation is placed where the click happened, not in a window covering the screen: the
							question stays next to the shop it is about.
						-->
						{#if aSupprimer === shop.id}
							<div
								class="border-destructive/40 mt-3 flex flex-wrap items-center gap-3 rounded-lg border p-3"
								data-test-class="shop-delete-confirm"
							>
								<p class="text-label min-w-0 flex-1 basis-[12rem]">
									{t('shops.deleteConfirm', { name: shop.name })}
								</p>
								<Button
									variant="destructive"
									onclick={() => supprimer(shop)}
									data-test-class="shop-delete-yes"
								>
									{t('shops.deleteYes')}
								</Button>
								<Button
									variant="outline"
									onclick={() => (aSupprimer = null)}
									data-test-class="shop-delete-no"
								>
									{t('shops.cancel')}
								</Button>
							</div>
						{/if}

						{#if modifie === shop.id}
							<div class="mt-3 border-t pt-3">
								<ShopForm
									prefix="edit-{shop.id}"
									{shop}
									onsaved={() => (modifie = null)}
									oncancel={() => (modifie = null)}
								/>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			</li>
		{/each}
	</ul>
{/if}

<h2 class="text-h2 mt-10 font-semibold">{t('aisles.title')}</h2>
<p class="text-muted-foreground text-label mt-1">{t('aisles.hint')}</p>

<form onsubmit={addAisle} class="bg-card mt-6 space-y-3 rounded-xl border p-4" data-test-id="add-aisle">
	<div class="grid gap-3 sm:grid-cols-[auto_1fr]">
		<div class="w-20">
			<Label for="aisle-emoji">{t('aisles.emoji')}</Label>
			<!--
				A text field for an emoji assumes a keyboard offering them: at a desk there is none, and you had to go
				and find one elsewhere to paste it here. The button shows the one chosen and opens the palette.
			-->
			<button
				type="button"
				id="aisle-emoji"
				onclick={() => picker?.show()}
				aria-haspopup="dialog"
				data-test-id="aisle-emoji"
				class="border-input bg-background fl-press grid min-h-[max(2.75rem,44px)] w-full place-items-center rounded-lg border text-2xl"
			>
				<span aria-hidden="true">{aisleEmoji}</span>
				<span class="sr-only">{t('emojiPicker.current', { emoji: aisleEmoji })}</span>
			</button>
		</div>
		<div>
			<Label for="aisle-name">{t('aisles.name')}</Label>
			<IconField icon={LayoutList}>
				<Input
					id="aisle-name"
					bind:value={aisleName}
					data-test-id="aisle-name"
					required
					placeholder={t('aisles.namePlaceholder')}
				/>
			</IconField>
		</div>
	</div>
	<Button type="submit" data-test-id="aisle-create">
		<Plus size={18} aria-hidden="true" />
		{t('aisles.new')}
	</Button>
</form>

<ul class="mt-6 flex flex-wrap gap-2">
	{#each data.aisles as aisle (aisle.id)}
		<li class="border-input rounded-full border px-4 py-2" data-test-class="aisle-chip">
			<span aria-hidden="true">{aisle.emoji}</span>
			<span class="text-label">{aisle.name}</span>
		</li>
	{/each}
</ul>

<EmojiPicker bind:this={picker} value={aisleEmoji} onpick={(choix) => (aisleEmoji = choix)} />
