<script lang="ts">
	import type { Item } from '$db/schema';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { unitKey } from '$domain/units';
	import { slugify } from '$domain/slug';
	import { formatAmount } from '$domain/price';
	import { longpress } from '$components/app/longpress.svelte';
	import { Star, Trash2, ArrowUp, ArrowDown, GripVertical, Pencil } from '@lucide/svelte';

	let {
		item,
		grip,
		onMoveUp,
		onMoveDown,
		onEdit,
		canMoveUp,
		canMoveDown
	}: {
		item: Item;
		grip: Record<string, unknown>;
		onMoveUp: () => void;
		onMoveDown: () => void;
		onEdit: () => void;
		canMoveUp: boolean;
		canMoveDown: boolean;
	} = $props();

	/**
	 * L'appui long ouvre la fiche. C'est le geste attendu sur téléphone, mais il n'existe pas au
	 * clavier ni au lecteur d'écran : le bouton crayon fait la même chose et reste le chemin
	 * annoncé.
	 */
	function editer() {
		feedback.play('tap');
		onEdit();
	}

	const inputId = $derived(`item-${item.id}`);

	/**
	 * Une unité inconnue s'affiche telle qu'elle a été écrite : un article saisi « douzaine » avant
	 * que le champ devienne une liste doit rester lisible, pas être remplacé par une unité voisine.
	 */
	const unitLabel = $derived.by(() => {
		const key = unitKey(item.unit);
		return key ? t(key) : item.unit;
	});

	/** `item.checked` est encore l'état d'avant : cocher monte, décocher descend. */
	function toggle() {
		feedback.play(item.checked ? 'uncheck' : 'check');
		data.toggleItem(item.id);
	}

	/**
	 * Ce qui est en train d'être tapé, tant que le champ n'a pas été quitté. `null` veut dire « rien
	 * en cours » : le champ affiche alors le prix enregistré, remis en forme dans la langue lue.
	 * Sans cet état, chaque frappe serait réécrite par le formatage et le champ deviendrait
	 * intapable.
	 */
	let draft = $state<string | null>(null);

	const recorded = $derived(data.priceOf(item));

	const priceValue = $derived(
		draft ??
			(recorded
				? i18n.number(recorded.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
				: '')
	);

	/**
	 * Le prix du même produit ailleurs, et seulement s'il est plus bas que celui d'ici.
	 *
	 * C'est toute la fonctionnalité en une ligne, posée au moment où elle sert : le produit est dans
	 * la main, devant le rayon. Rien à afficher quand on est déjà au moins cher — une ligne qui dit
	 * « vous avez bien fait » occupe la place sans rien apprendre.
	 */
	const cheaper = $derived.by(() => {
		if (!item.checked) return null;

		const best = data.priceComparison(slugify(item.name))[0];
		if (!best || best.shopId === data.activeShopId) return null;
		if (recorded && best.amount >= recorded.amount) return null;

		return best;
	});

	const cheaperShop = $derived(data.shops.find((shop) => shop.id === cheaper?.shopId));
</script>

<div
	class="bg-card flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 transition-colors"
	data-test-class="item-row"
>
	<!--
		La poignée. Elle double les flèches sans les remplacer : celles-ci restent le chemin du
		clavier, elle est le geste du pouce. Ni focalisable ni annoncée, pour la même raison —
		atteindre au clavier une poignée dont on ne peut rien faire au clavier serait un piège.
	-->
	<span
		{...grip}
		data-test-class="item-grip"
		aria-hidden="true"
		class="fl-reorder-grip text-muted-foreground -my-2 flex shrink-0 items-center self-stretch pe-1"
	>
		<GripVertical size={18} />
	</span>

	<!--
		La case est dans l'étiquette, pas à côté : seule, elle offrait une cible de 28 px là où il en
		faut 44. Englobée, c'est toute la ligne de texte qui coche, et la cible dépasse largement.
	-->
	<label
		for={inputId}
		use:longpress={editer}
		class="flex min-h-[max(2.75rem,44px)] min-w-0 flex-1 basis-[12rem] cursor-pointer items-center gap-3 py-1"
	>
		<input
			id={inputId}
			type="checkbox"
			checked={item.checked}
			onchange={toggle}
			data-test-class="item-check"
			class="accent-primary shrink-0"
		/>

		<span class="min-w-0">
			<span
				class="text-product block transition-colors {item.checked
					? 'text-muted-foreground line-through'
					: ''}"
			>
				{item.name}
			</span>
			<span class="text-muted-foreground text-caption">
				{item.qty}
				{unitLabel}{item.note ? ` — ${item.note}` : ''}
			</span>
		</span>
	</label>

	<div class="flex max-w-full shrink-0 flex-wrap items-center justify-end">
		<button
			type="button"
			onclick={onMoveUp}
			disabled={!canMoveUp}
			aria-label={t('list.moveUp', { name: item.name })}
			data-test-class="item-up"
			class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center disabled:opacity-30"
		>
			<ArrowUp size={18} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={onMoveDown}
			disabled={!canMoveDown}
			aria-label={t('list.moveDown', { name: item.name })}
			data-test-class="item-down"
			class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center disabled:opacity-30"
		>
			<ArrowDown size={18} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={editer}
			aria-label={t('list.edit', { name: item.name })}
			data-test-class="item-edit"
			class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center"
		>
			<Pencil size={18} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={() => {
				feedback.play('tap');
				data.togglePriority(item.id);
			}}
			aria-label={t('list.priority', { name: item.name })}
			aria-pressed={item.priority}
			data-test-class="item-priority"
			class="fl-press grid size-11 min-w-[44px] place-items-center {item.priority
				? 'text-primary'
				: 'text-muted-foreground'}"
		>
			<Star size={18} fill={item.priority ? 'currentColor' : 'none'} aria-hidden="true" />
		</button>
		<button
			type="button"
			onclick={() => {
				feedback.play('remove');
				data.removeItem(item.id);
			}}
			aria-label={t('list.remove', { name: item.name })}
			data-test-class="item-remove"
			class="fl-press text-muted-foreground grid size-11 min-w-[44px] place-items-center"
		>
			<Trash2 size={18} aria-hidden="true" />
		</button>
	</div>

	<!--
		Le prix, sur un article coché seulement.

		C'est le seul moment où quelqu'un l'a sous les yeux : l'étiquette est devant lui et le produit
		part dans le chariot. Le demander à l'ajout reviendrait à le faire deviner la veille sur le
		canapé, et le demander après la course obligerait à rouvrir chaque ligne de mémoire.

		Il prend toute la largeur sous la ligne, plutôt qu'une case coincée entre les boutons : un
		champ de saisie à côté de cinq cibles de 44 px se touche par erreur à chaque course.
	-->
	{#if item.checked}
		<div class="flex w-full flex-wrap items-center gap-x-3 gap-y-1 ps-9">
			<label class="text-caption text-muted-foreground flex items-center gap-2">
				<span>{t('list.price')}</span>
				<input
					type="text"
					inputmode="decimal"
					value={priceValue}
					placeholder={t('list.pricePlaceholder')}
					aria-label={t('list.priceOf', { name: item.name })}
					data-test-class="item-price"
					oninput={(event) => (draft = event.currentTarget.value)}
					onchange={(event) => {
						data.setItemPrice(item, event.currentTarget.value);
						draft = null;
					}}
					class="border-input bg-background text-label h-9 w-24 rounded-md border px-2"
				/>
			</label>

			{#if cheaper && cheaperShop}
				<p class="text-caption text-secondary font-medium" data-test-class="item-cheaper">
					{t('list.cheaperAt', {
						shop: cheaperShop.name,
						price: formatAmount(cheaper.amount, cheaper.currency, i18n.locale)
					})}
				</p>
			{/if}
		</div>
	{/if}
</div>
