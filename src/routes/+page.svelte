<script lang="ts">
	import { flip } from 'svelte/animate';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { motionMs, settings } from '$stores/settings.svelte';
	import { createIntent } from '$stores/create.svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { TINTS } from '$domain/tint';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import EmojiPicker from '$components/app/EmojiPicker.svelte';
	import Avatar from '$components/app/Avatar.svelte';
	import { longpress } from '$components/app/longpress.svelte';
	import { Plus, Trash2, Pencil, ListChecks, CalendarDays, Users, Lock } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';

	let creating = $state(false);
	let name = $state('');
	let emoji = $state('🛒');
	let picker = $state<EmojiPicker | null>(null);

	/** La liste en cours de renommage. Le même formulaire sert à créer et à corriger. */
	let renomme = $state<string | null>(null);

	/**
	 * Ouvrir le formulaire sur une liste existante, par appui long sur sa carte.
	 *
	 * Le nom et l'emoji se corrigent au même endroit qu'ils se posent : un second formulaire
	 * n'aurait fait que répéter les deux mêmes champs et la même palette.
	 */
	function renommer(list: { id: string; name: string; emoji: string }) {
		feedback.play('tap');
		renomme = list.id;
		name = list.name;
		emoji = list.emoji;
		creating = true;

		// Le formulaire est en haut de page, la carte peut être loin en dessous.
		window.scrollTo({ top: 0, behavior: settings.animates ? 'smooth' : 'auto' });
	}

	function annuler() {
		renomme = null;
		name = '';
		emoji = '🛒';
		creating = false;
	}

	/**
	 * Le bouton central annonce ce qu'il vient chercher. Ici, c'est le formulaire replié qu'il
	 * faut ouvrir : sans cela, le curseur n'aurait aucun champ où se poser en arrivant.
	 */
	$effect(() => {
		if (createIntent.take('list')) creating = true;
	});

	const stats = (listId: string) => {
		const items = data.itemsOf(listId);
		return { total: items.length, done: items.filter((i) => i.checked).length };
	};

	/**
	 * Qui voit cette liste.
	 *
	 * Les visages plutôt qu'un décompte : on reconnaît une pile de deux portraits sans la lire, là
	 * où « 2 membres » demande de s'arrêter dessus. Et la distinction privée / partagée est ce qui
	 * décide si on peut y écrire une surprise d'anniversaire.
	 */
	const membersOf = (list: { memberIds: string[] }) =>
		list.memberIds
			.map((id) => data.member(id))
			.filter((member): member is NonNullable<typeof member> => Boolean(member));

	/**
	 * La date d'un événement, écrite dans la langue de l'écran.
	 *
	 * Elle est stockée en ISO — une date n'est pas une chaîne à traduire — et mise en forme ici :
	 * « 14 février » en français, « February 14 » en anglais. Une date invalide est simplement
	 * ignorée plutôt que de faire apparaître « Invalid Date » sur la carte.
	 */
	function eventLabel(iso: string) {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';

		return new Intl.DateTimeFormat(i18n.locale, { day: 'numeric', month: 'long' }).format(date);
	}

	function create(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) return;

		if (renomme) {
			feedback.play('success');
			data.updateList(renomme, { name, emoji });
		} else {
			feedback.play('add');
			data.addList({ name, emoji, color: TINTS[data.lists.length % TINTS.length] });
		}

		annuler();
	}

	/**
	 * Les cartes entrent l'une après l'autre, de haut en bas. Le décalage est plafonné : à quinze
	 * listes, une cascade complète ferait attendre la dernière carte une seconde entière.
	 */
	const STAGGER_MS = 45;
	const STAGGER_MAX = 6;
	const delay = (index: number) => Math.min(index, STAGGER_MAX) * STAGGER_MS;
</script>

<svelte:head>
	<title>{t('lists.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('lists.title')}</h1>

{#if creating}
	<form
		onsubmit={create}
		transition:slide={{ duration: motionMs(220), easing: cubicOut }}
		class="bg-card mt-6 space-y-3 rounded-xl border p-4"
	>
		<div class="grid gap-3 sm:grid-cols-[auto_1fr]">
			<div class="w-20">
				<Label for="list-emoji">{t('lists.emoji')}</Label>
	<!-- Même palette que pour les rayons : un emoji ne se tape pas au clavier d'un ordinateur. -->
			<button
				type="button"
				id="list-emoji"
				onclick={() => picker?.show()}
				aria-haspopup="dialog"
				data-test-id="list-emoji"
				class="border-input bg-background fl-press grid min-h-[max(2.75rem,44px)] w-full place-items-center rounded-lg border text-2xl"
			>
				<span aria-hidden="true">{emoji}</span>
				<span class="sr-only">{t('emojiPicker.current', { emoji: emoji })}</span>
			</button>
			</div>
			<div>
				<Label for="list-name">{t('lists.name')}</Label>
				<IconField icon={ListChecks}>
					<Input
						id="list-name"
						bind:value={name}
						data-test-id="list-name"
						required
						placeholder={t('lists.namePlaceholder')}
					/>
				</IconField>
			</div>
		</div>
		<div class="flex flex-wrap items-stretch gap-2">
			<Button type="submit" data-test-id="list-create" class="fl-press">{t('common.save')}</Button>
			{#if renomme}
				<Button
					type="button"
					variant="outline"
					onclick={annuler}
					data-test-id="list-rename-cancel"
					class="fl-press"
				>
					{t('common.cancel')}
				</Button>
			{/if}
		</div>
	</form>
{/if}

{#if !data.ready}
	<p class="text-muted-foreground mt-6">{t('common.loading')}</p>
{:else if data.lists.length === 0}
	<EmptyState illustration="lists" text={t('lists.empty')} testId="lists-empty" />
{:else}
	<ul class="mt-6 space-y-3">
		{#each data.lists as list, index (list.id)}
			{@const { total, done } = stats(list.id)}
			<li
				class="fl-rise"
				style="animation-delay: {delay(index)}ms"
				animate:flip={{ duration: motionMs(280), easing: cubicOut }}
				out:slide={{ duration: motionMs(180), easing: cubicOut }}
			>
				<Card.Root data-test-class="list-card" class="fl-press">
					<Card.Content class="flex flex-wrap items-center gap-x-4 gap-y-3">
						<!--
							L'appui long ouvre le renommage : c'est le geste du pouce, et il évite d'ajouter
							un troisième bouton sur une carte qui en porte déjà. Le clavier et le lecteur
							d'écran passent par le crayon, à côté de la corbeille.
						-->
						<a
							href="/l/{list.id}"
							use:longpress={() => renommer(list)}
							class="flex min-w-0 flex-auto flex-wrap items-center gap-4"
						>
							<span class="text-h1" aria-hidden="true">{list.emoji}</span>
							<span class="min-w-0 flex-1 basis-[6rem]">
								<span class="text-product block font-medium break-words">{list.name}</span>
								<span class="text-muted-foreground text-label block">
									{t('lists.progress', { done, total })}
								</span>
								{#if list.eventDate && eventLabel(list.eventDate)}
									<!--
										La date d'un repas de famille ou d'un anniversaire : c'est elle qui dit
										jusqu'à quand la liste sert, et elle était modélisée sans jamais s'afficher.
									-->
									<span
										class="text-caption text-secondary mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--fl-secondary-tint)] px-2 py-0.5 font-semibold"
										data-test-class="list-date"
									>
										<CalendarDays size={12} aria-hidden="true" />
										{eventLabel(list.eventDate)}
									</span>
								{/if}
								<span class="bg-muted mt-1.5 block h-1 overflow-hidden rounded-full" aria-hidden="true">
									<span
										class="fl-grow bg-secondary block h-full rounded-full"
										style="width: {total ? Math.round((done / total) * 100) : 0}%"
									></span>
								</span>
							</span>
						</a>
						<!--
							Le décompte et la corbeille voyagent ensemble. Séparés, ils se disputaient la fin
							de la première ligne et la corbeille retombait seule à la ligne suivante, à
							gauche : l'action la plus destructive se retrouvait à la place la plus en vue.
						-->
						<div class="ms-auto flex shrink-0 items-center gap-2">
							<Badge variant="secondary">{t('lists.remaining', { count: total - done })}</Badge>
							<button
								type="button"
								onclick={() => renommer(list)}
								aria-label={t('lists.rename', { name: list.name })}
								data-test-class="list-rename"
								class="fl-press text-muted-foreground hover:text-foreground grid size-11 min-w-[44px] place-items-center rounded-md transition-colors"
							>
								<Pencil size={18} aria-hidden="true" />
							</button>
							<button
								type="button"
								onclick={() => {
									feedback.play('remove');
									data.removeList(list.id);
								}}
								aria-label={t('lists.delete', { name: list.name })}
								data-test-class="list-delete"
								class="fl-press text-muted-foreground hover:text-destructive grid size-11 min-w-[44px] place-items-center rounded-md transition-colors"
							>
								<Trash2 size={18} aria-hidden="true" />
							</button>
						</div>
					</Card.Content>

					<!--
						Le pied de carte répond à « qui d'autre voit ça ». Les portraits se chevauchent parce
						qu'un foyer en compte rarement plus de cinq et qu'une pile serrée se lit d'un coup ;
						le mot à côté est là parce que la pile seule ne dit pas si on est seul.
					-->
					<Card.Footer class="text-caption text-muted-foreground flex items-center gap-2">
						{@const membres = membersOf(list)}
						{#if membres.length > 1}
							<span class="flex items-center" data-test-class="list-members">
								{#each membres.slice(0, 4) as membre, rang (membre.id)}
									<span class={rang === 0 ? '' : '-ms-2'}>
										<Avatar member={membre} size={26} ring />
									</span>
								{/each}
								{#if membres.length > 4}
									<span class="ms-1.5">+{membres.length - 4}</span>
								{/if}
							</span>
							<span class="inline-flex items-center gap-1 font-medium">
								<Users size={13} aria-hidden="true" />
								{t('lists.shared')}
							</span>
						{:else}
							<span class="inline-flex items-center gap-1 font-medium" data-test-class="list-private">
								<Lock size={13} aria-hidden="true" />
								{t('lists.private')}
							</span>
						{/if}
					</Card.Footer>
				</Card.Root>
			</li>
		{/each}
	</ul>
{/if}

<!--
	Ajouter une liste depuis la fin de la pile.

	Le bouton du haut existe toujours, mais on ne s'aperçoit qu'il manque une liste qu'après avoir
	parcouru celles qu'on a. Le trait tireté la distingue des vraies sans en faire une commande de
	plus à ignorer ; elle disparaît quand le formulaire est déjà ouvert, pour ne pas offrir deux
	fois la même chose.
-->
{#if data.ready && !creating}
	<button
		type="button"
		onclick={() => {
			feedback.play('tap');
			creating = true;
		}}
		data-test-id="new-list-card"
		class="fl-press border-input text-primary text-label mt-3 flex min-h-[max(3.5rem,56px)] w-full items-center justify-center gap-2 rounded-xl border border-dashed font-medium"
	>
		<Plus size={20} aria-hidden="true" />
		{t('lists.new')}
	</button>
{/if}

<EmojiPicker bind:this={picker} value={emoji} onpick={(choix) => (emoji = choix)} />
