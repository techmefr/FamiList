<script lang="ts">
	import { page } from '$app/state';
	import { flip } from 'svelte/animate';
	import { fly, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { data } from '$stores/data.svelte';
	import { createIntent } from '$stores/create.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import type { Item } from '$db/schema';
	import ShopSwitcher from '$components/app/ShopSwitcher.svelte';
	import ItemRow from '$components/app/ItemRow.svelte';
	import SwipeRow from '$components/app/SwipeRow.svelte';
	import AisleCard from '$components/app/AisleCard.svelte';
	import AddItemSheet from '$components/app/AddItemSheet.svelte';
	import ShareSheet from '$components/app/ShareSheet.svelte';
	import FilterSheet from '$components/app/FilterSheet.svelte';
	import { createReorder, move } from '$components/app/reorder.svelte';
	import { Button } from '$lib/components/ui/button';
	import EmptyState from '$components/app/EmptyState.svelte';
	import {
		ArrowLeft,
		MessagesSquare,
		UsersRound,
		SlidersHorizontal,
		Plus,
		Check,
		Undo2,
		Trash2,
		Route
	} from '@lucide/svelte';

	const listId = $derived(page.params.id!);
	const list = $derived(data.list(listId));
	const groups = $derived(data.groupedItems(listId));

	const appris = $derived(
		data.layouts.find((l) => l.shopId === data.activeShopId)?.learned ?? false
	);

	let share = $state<ShareSheet | null>(null);
	let add = $state<AddItemSheet | null>(null);
	let filters = $state<FilterSheet | null>(null);

	/**
	 * Le bouton de création amène ici, puis demande la feuille : c'est le même aller-retour que pour
	 * une carte ou un magasin. La feuille n'existe pas encore quand la navigation se termine, d'où
	 * l'effet plutôt qu'un appel direct.
	 */
	$effect(() => {
		if (add && createIntent.take('item')) void add.show();
	});

	/**
	 * Les prénoms plutôt qu'un décompte : « Avec Hélène et Marc » se lit d'un coup d'œil, « 2
	 * participants » demande d'ouvrir la feuille pour savoir de qui il s'agit.
	 *
	 * `Intl.ListFormat` s'occupe du « et » et des virgules — ce sont des règles de langue, pas des
	 * chaînes à traduire, et elles diffèrent d'une langue à l'autre.
	 */
	const others = $derived(
		(list?.memberIds ?? [])
			.filter((id) => id !== data.me)
			.map((id) => data.member(id)?.name)
			.filter((name): name is string => Boolean(name))
	);

	const sharedWith = $derived(
		others.length === 0
			? t('share.aloneSummary')
			: t('share.summary', {
					names: new Intl.ListFormat(i18n.locale, { type: 'conjunction' }).format(others)
				})
	);

	let priorityOnly = $state(false);
	let hideChecked = $state(false);
	const filtresActifs = $derived(Number(priorityOnly) + Number(hideChecked));

	const visible = $derived(
		groups
			.map((group) => ({
				...group,
				items: group.items.filter(
					(item) => (!priorityOnly || item.priority) && (!hideChecked || !item.checked)
				)
			}))
			.filter((group) => group.items.length > 0)
	);

	const total = $derived(data.itemsOf(listId).length);
	const done = $derived(data.itemsOf(listId).filter((i) => i.checked).length);

	/**
	 * Quels rayons sont dépliés.
	 *
	 * Les deux premiers à l'ouverture, comme dans la maquette : tout déplier remplit trois écrans
	 * de téléphone, tout replier donne une page qui n'a l'air de rien contenir. On ne retient que
	 * ce que la personne a changé — le reste suit la règle, y compris pour les rayons qui
	 * apparaissent ensuite parce qu'on vient d'y ajouter un article.
	 */
	let plies = $state<Record<string, boolean>>({});
	const ouvert = (aisleId: string, index: number) => plies[aisleId] ?? index < 2;

	function basculer(aisleId: string, index: number) {
		feedback.play('tap');
		plies = { ...plies, [aisleId]: !ouvert(aisleId, index) };
	}

	/**
	 * L'écran ne montre que les rayons non vides : on réinjecte les rayons masqués à la fin, sinon
	 * réordonner ferait disparaître le parcours appris des rayons momentanément vides.
	 */
	function commitAisleOrder(visibleOrder: string[]) {
		const previous = data.activeLayout?.aisleOrder ?? data.aisles.map((a) => a.id);
		const hidden = previous.filter((id) => !visibleOrder.includes(id));
		data.reorderAisles([...visibleOrder, ...hidden]);
	}

	function moveAisle(from: number, to: number) {
		if (to < 0 || to >= visible.length) return;
		feedback.play('tap');
		commitAisleOrder(
			move(
				visible.map((g) => g.aisleId),
				from,
				to
			)
		);
	}

	function moveItem(aisleId: string, items: Item[], from: number, to: number) {
		if (to < 0 || to >= items.length) return;
		feedback.play('tap');
		data.reorderItems(aisleId, move(items, from, to));
	}

	const aisleReorder = createReorder(moveAisle);
</script>

<svelte:head>
	<title>{list?.name ?? t('lists.title')} — {t('app.name')}</title>
</svelte:head>

{#if !data.ready}
	<p class="text-muted-foreground">{t('common.loading')}</p>
{:else if !list}
	<p class="text-muted-foreground">{t('list.notFound')}</p>
	<a href="/" class="text-primary mt-4 inline-block underline">{t('list.back')}</a>
{:else}
	<a
		href="/"
		class="text-muted-foreground text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2"
	>
		<ArrowLeft size={16} aria-hidden="true" />
		{t('list.back')}
	</a>

	<h1 class="text-h1 mt-2 flex flex-wrap items-center gap-3 font-semibold">
		<span aria-hidden="true">{list.emoji}</span>
		<span class="min-w-0 break-words">{list.name}</span>
	</h1>
	<p class="text-muted-foreground text-label mt-1">{t('lists.progress', { done, total })}</p>

	<!-- Le texte au-dessus dit déjà l'avancement : la barre n'est là que pour le montrer bouger. -->
	<div class="bg-muted mt-2 h-1.5 overflow-hidden rounded-full" aria-hidden="true">
		<div
			class="fl-grow bg-secondary h-full rounded-full"
			style="width: {total ? Math.round((done / total) * 100) : 0}%"
			data-test-id="list-progress"
		></div>
	</div>

	<div class="mt-3 flex flex-wrap items-center gap-x-5">
		<a
			href="/l/{listId}/chat"
			data-test-id="open-chat"
			class="text-primary text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2 underline"
		>
			<MessagesSquare size={16} aria-hidden="true" />
			{t('chat.open')}
		</a>

		<button
			type="button"
			onclick={() => share?.show()}
			data-test-id="open-share"
			aria-haspopup="dialog"
			class="text-primary text-label inline-flex min-h-[max(2.75rem,44px)] items-center gap-2 underline"
		>
			<UsersRound size={16} aria-hidden="true" />
			{t('share.open')}
		</button>
	</div>

	<p class="text-muted-foreground text-caption" data-test-id="share-summary">{sharedWith}</p>

	<ShareSheet bind:this={share} {listId} />

	<!-- Sur téléphone, le magasin descend dans la barre du pouce, en bas : voir plus bas. -->
	<div class="mt-6 max-md:hidden">
		<ShopSwitcher />
	</div>

	<!--
		Les filtres sur grand écran seulement : sur téléphone, le même bouton flotte en bas à gauche,
		à portée du pouce. Un seul jeu de commandes pour les deux, dans la feuille.
	-->
	<div class="mt-4 flex flex-wrap items-center gap-2">
		<Button
			variant="outline"
			onclick={() => filters?.show()}
			aria-haspopup="dialog"
			data-test-id="open-filters"
			class="max-md:hidden"
		>
			<SlidersHorizontal size={18} aria-hidden="true" />
			{t('list.filters')}
			{#if filtresActifs > 0}
				<span
					class="bg-primary text-primary-foreground text-caption grid size-5 place-items-center rounded-full font-semibold"
				>
					{filtresActifs}
				</span>
			{/if}
		</Button>

		{#if done > 0}
			<Button
				variant="outline"
				onclick={() => {
					feedback.play('success');
					data.clearChecked(listId);
				}}
				data-test-id="clear-checked"
			>
				{t('list.clearChecked', { count: done })}
			</Button>
		{/if}
	</div>

	{#if visible.length === 0}
		<!--
			Deux vides qui ne veulent pas dire la même chose : une liste où personne n'a rien écrit, et
			une liste pleine dont les filtres ne laissent rien passer. Le second se répare en touchant
			les filtres, le premier en ajoutant un article — le dessin le dit avant la phrase.
		-->
		{#if filtresActifs > 0}
			<EmptyState illustration="filter" text={t('list.empty')} testId="list-empty">
				{#snippet action()}
					<Button variant="outline" onclick={() => filters?.show()} data-test-id="empty-filters">
						<SlidersHorizontal size={18} aria-hidden="true" />
						{t('list.filters')}
					</Button>
				{/snippet}
			</EmptyState>
		{:else}
			<EmptyState illustration="cart" text={t('list.noItems')} testId="list-empty">
				{#snippet action()}
					<Button onclick={() => add?.show()} data-test-id="empty-add-item">
						<Plus size={18} aria-hidden="true" />
						{t('add.submit')}
					</Button>
				{/snippet}
			</EmptyState>
		{/if}
	{:else}
		<!--
			Pourquoi les rayons sont dans cet ordre-là.

			L'ordre adaptatif est la promesse de l'application, et c'est aussi la seule chose qu'on ne
			voit pas : une liste rangée selon un parcours appris ressemble trait pour trait à une liste
			rangée par défaut. Sans cette phrase, réordonner un rayon a l'air d'un caprice sans effet.

			La maquette dit « glissez les rayons ou cochez » ; cocher n'apprend rien chez nous — seul un
			déplacement marque le parcours comme appris.
		-->
		<p
			class="text-label text-secondary mt-6 flex items-start gap-2 rounded-md bg-[var(--fl-secondary-tint)] px-3.5 py-2.5 font-medium"
			data-test-id="route-hint"
		>
			<Route size={18} class="mt-0.5 shrink-0" aria-hidden="true" />
			<span>{appris ? t('list.routeLearned') : t('list.routeDefault')}</span>
		</p>

		<div class="mt-4 space-y-3" data-reorder-zone>
			{#each visible as group, aisleIndex (group.aisleId)}
				{@const aisle = data.aisle(group.aisleId)}
				{@const nom = aisle?.name ?? group.aisleId}
				{@const itemReorder = createReorder((from, to) =>
					moveItem(group.aisleId, group.items, from, to)
				)}
				<!--
					Le déplacement des rayons est ce qui rend visible l'ordre adaptatif : changer de
					magasin ne recompose pas la page d'un coup, les rayons glissent vers leur nouvelle
					place. Pendant un geste au doigt la bascule est coupée — les cartes sont déjà là où il
					faut, c'est la poignée qui les y a mises, et animer par-dessus les ferait reculer.
				-->
				<div
					data-reorder-row
					data-held={aisleReorder.index === aisleIndex}
					class="fl-reorder-row rounded-xl"
					animate:flip={{
						duration: aisleReorder.busy ? 0 : motionMs(380),
						easing: cubicOut
					}}
				>
					<AisleCard
						name={nom}
						emoji={aisle?.emoji ?? '🛒'}
						rank={aisleIndex}
						done={group.items.filter((i) => i.checked).length}
						total={group.items.length}
						open={ouvert(group.aisleId, aisleIndex)}
						grip={aisleReorder.handle(aisleIndex)}
						onToggle={() => basculer(group.aisleId, aisleIndex)}
						onMoveUp={() => moveAisle(aisleIndex, aisleIndex - 1)}
						onMoveDown={() => moveAisle(aisleIndex, aisleIndex + 1)}
						canMoveUp={aisleIndex > 0}
						canMoveDown={aisleIndex < visible.length - 1}
					>
						<div data-reorder-zone class="space-y-2">
							{#each group.items as item, index (item.id)}
								<div
									data-reorder-row
									data-held={itemReorder.index === index}
									class="fl-reorder-row rounded-md"
									animate:flip={{
										duration: itemReorder.busy ? 0 : motionMs(280),
										easing: cubicOut
									}}
									in:fly={{ y: 10, duration: motionMs(220), easing: cubicOut }}
									out:slide={{ duration: motionMs(180), easing: cubicOut }}
								>
									<!--
										Le glissement double les boutons de la ligne, il ne les remplace pas : c'est
										le geste rapide du chariot, une main occupée, et il ne se devine pas tout
										seul. Supprimer demande d'aller plus loin que cocher — voir $domain/swipe.
									-->
									<SwipeRow
										start={{
											label: item.checked ? t('list.swipeUncheck') : t('list.swipeCheck'),
											icon: item.checked ? Undo2 : Check,
											tone: 'primary',
											run: () => {
												feedback.play(item.checked ? 'uncheck' : 'check');
												data.toggleItem(item.id);
											}
										}}
										end={{
											label: t('list.swipeDelete'),
											icon: Trash2,
											tone: 'destructive',
											run: () => {
												feedback.play('remove');
												data.removeItem(item.id);
											}
										}}
									>
										<ItemRow
											{item}
											grip={itemReorder.handle(index)}
											canMoveUp={index > 0}
											canMoveDown={index < group.items.length - 1}
											onMoveUp={() => moveItem(group.aisleId, group.items, index, index - 1)}
											onMoveDown={() => moveItem(group.aisleId, group.items, index, index + 1)}
										/>
									</SwipeRow>
								</div>
							{/each}
						</div>
					</AisleCard>
				</div>
			{/each}
		</div>
	{/if}

	<!--
		La barre du pouce.

		Sur téléphone, toute la navigation vit en bas : le magasin et les filtres, qu'on manipule
		autant que les onglets, n'ont rien à faire en haut de l'écran — il faudrait changer de prise
		de main à chaque fois. Le magasin passe devant parce que c'est lui qui commande l'ordre de
		tout le reste ; les filtres ne font que masquer.

		Le fond est flou : la barre flotte au-dessus d'une liste qui défile, et posée à plat elle se
		confondait avec les cartes qui passent dessous. Elle s'arrête avant le bouton de création,
		qui garde son coin.
	-->
	<div
		class="fl-above-nav fl-dock flex items-center gap-1 md:hidden"
		data-test-id="thumb-bar"
	>
		<ShopSwitcher compact />

		<button
			type="button"
			onclick={() => filters?.show()}
			aria-haspopup="dialog"
			data-test-id="open-filters-mobile"
			class="fl-press bg-muted text-foreground text-label flex min-h-[max(2.75rem,44px)] shrink-0 items-center gap-2 rounded-full px-3 font-medium"
		>
			<SlidersHorizontal size={18} aria-hidden="true" />
			<span class="sr-only">{t('list.filters')}</span>
			{#if filtresActifs > 0}
				<span
					class="bg-primary text-primary-foreground text-caption grid size-5 place-items-center rounded-full font-semibold"
				>
					{filtresActifs}
				</span>
			{/if}
		</button>
	</div>
{/if}

<FilterSheet bind:this={filters} bind:priorityOnly bind:hideChecked />
<AddItemSheet bind:this={add} {listId} />
