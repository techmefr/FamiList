<script lang="ts">
	import { flip } from 'svelte/animate';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { motionMs, settings } from '$stores/settings.svelte';
	import { createIntent } from '$stores/create.svelte';
	import { i18n, t } from '$i18n/index.svelte';
	import { TINTS, DEFAULT_TINT } from '$domain/tint';
	import { reminderStatus } from '$domain/reminder';
	import { remindersSupported, requestReminderPermission } from '$native/reminders';
	import * as Card from '$components/ui/card';
	import { Badge } from '$components/ui/badge';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import EmojiPicker from '$components/app/EmojiPicker.svelte';
	import Avatar from '$components/app/Avatar.svelte';
	import { longpress } from '$components/app/longpress.svelte';
	import {
		Plus,
		Trash2,
		Pencil,
		Copy,
		ListChecks,
		CalendarDays,
		Users,
		Lock,
		Check
	} from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';
	import EmptyState from '$components/app/EmptyState.svelte';

	let creating = $state(false);
	let name = $state('');
	let emoji = $state('🛒');
	let picker = $state<EmojiPicker | null>(null);
	let eventDate = $state('');

	/** Set only after a save, when the person refused notifications. */
	let reminderRefused = $state(false);

	/** The list being renamed. The same form serves to create and to correct. */
	let renamed = $state<string | null>(null);

	/**
	 * Opening the form on an existing list, by long-pressing its card.
	 *
	 * The name and the emoji are corrected in the same place they are set: a second form would only have
	 * repeated the same two fields and the same palette.
	 */
	function rename(list: { id: string; name: string; emoji: string; eventDate?: string }) {
		feedback.play('tap');
		renamed = list.id;
		name = list.name;
		emoji = list.emoji;
		eventDate = list.eventDate ?? '';
		reminderRefused = false;
		creating = true;

		// The form is at the top of the page, the card can be far below.
		window.scrollTo({ top: 0, behavior: settings.animates ? 'smooth' : 'auto' });
	}

	function cancel() {
		renamed = null;
		name = '';
		emoji = '🛒';
		eventDate = '';
		reminderRefused = false;
		creating = false;
	}

	/**
	 * The central button announces what it comes for. Here it is the folded form that has to open:
	 * without that, the cursor would have no field to land in on arrival.
	 */
	$effect(() => {
		if (createIntent.take('list')) creating = true;
	});

	const stats = (listId: string) => {
		const items = data.itemsOf(listId);
		return { total: items.length, done: items.filter((i) => i.checked).length };
	};

	/**
	 * Who sees this list.
	 *
	 * Faces rather than a count: you recognise a stack of two avatars without reading it, where "2 members"
	 * asks you to stop on it. And the private / shared distinction is what decides whether you can write a
	 * birthday surprise in it.
	 */
	const membersOf = (list: { memberIds: string[] }) =>
		list.memberIds
			.map((id) => data.member(id))
			.filter((member): member is NonNullable<typeof member> => Boolean(member));

	/**
	 * An event date, written in the screen's language.
	 *
	 * It is stored as ISO — a date is not a string to translate — and formatted here: "14 février" in
	 * French, "February 14" in English. An invalid date is simply ignored rather than making "Invalid Date"
	 * appear on the card.
	 */
	function eventLabel(iso: string) {
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';

		return new Intl.DateTimeFormat(i18n.locale, { day: 'numeric', month: 'long' }).format(date);
	}

	/**
	 * What the reminder will really do, written under the field at the moment the date is typed.
	 *
	 * The application is a static bundle with no server: the reminder is an alarm set on the device, and
	 * the browser cannot set one. Rather than suggesting a reminder that will never fire, we say so at the
	 * exact place the promise is made.
	 */
	const reminderNotice = $derived.by(() => {
		if (!eventDate) return '';
		if (!remindersSupported()) return t('lists.reminderWeb');

		const { status, at } = reminderStatus(eventDate, new Date());
		if (status === 'invalid') return t('lists.reminderInvalid');
		if (status === 'late') return t('lists.reminderLate');

		const when = new Intl.DateTimeFormat(i18n.locale, {
			dateStyle: 'long',
			timeStyle: 'short'
		}).format(at as Date);

		return t('lists.reminderPlanned', { when });
	});

	/**
	 * The permission is asked for here, on the gesture that sets the date, and not at launch.
	 *
	 * Android 13 only offers it twice: spending it at startup, before anyone has expressed the need for a
	 * reminder, would amount to losing it. A refusal blocks nothing — the date is already saved, only the
	 * notification is missing, and we say so.
	 */
	async function requestReminder() {
		const permission = await requestReminderPermission();
		reminderRefused = permission === 'denied';
	}

	function create(event: SubmitEvent) {
		event.preventDefault();
		if (!name.trim()) return;

		const hasDate = Boolean(eventDate);

		if (renamed) {
			feedback.play('success');
			data.updateList(renamed, { name, emoji, eventDate });
		} else {
			feedback.play('add');
			data.addList({ name, emoji, eventDate, color: TINTS[data.lists.length % TINTS.length] });
		}

		cancel();
		if (hasDate) void requestReminder();
	}

	/**
	 * The cards come in one after another, top to bottom. The delay is capped: at fifteen lists, a full
	 * cascade would make the last card wait a whole second.
	 */
	const STAGGER_MS = 45;
	const STAGGER_MAX = 6;
	const delay = (index: number) => Math.min(index, STAGGER_MAX) * STAGGER_MS;

	/** The shape of the stack while it loads: three cards, the usual size of a household's home. */
	const SKELETON_COUNT = 3;

	const actionClass =
		'fl-press text-muted-foreground hover:text-foreground hover:bg-muted grid size-11 min-w-[44px] ' +
		'place-items-center rounded-full transition-colors';

	function openCreate() {
		feedback.play('tap');
		creating = true;
	}
</script>

<svelte:head>
	<title>{t('lists.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('lists.title')}</h1>

{#if creating}
	<form
		onsubmit={create}
		transition:slide={{ duration: motionMs(220), easing: cubicOut }}
		class="fl-home-card bg-card mt-6 space-y-3 p-4"
	>
		<div class="grid gap-3 sm:grid-cols-[auto_1fr]">
			<div class="w-20">
				<Label for="list-emoji">{t('lists.emoji')}</Label>
	<!-- Same palette as for aisles: an emoji is not typed on a computer keyboard. -->
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
		<div>
			<Label for="list-event-date">{t('lists.eventDate')}</Label>
			<IconField icon={CalendarDays}>
				<Input
					id="list-event-date"
					type="date"
					bind:value={eventDate}
					data-test-id="list-event-date"
					aria-describedby="list-event-date-help"
				/>
			</IconField>
			<p id="list-event-date-help" class="text-caption text-muted-foreground mt-1">
				{reminderNotice || t('lists.eventDateClear')}
			</p>
		</div>
		<div class="flex flex-wrap items-stretch gap-2">
			<Button type="submit" data-test-id="list-create" class="fl-press flex-auto rounded-full">
				{t('common.save')}
			</Button>
			{#if renamed}
				<Button
					type="button"
					variant="outline"
					onclick={cancel}
					data-test-id="list-rename-cancel"
					class="fl-press rounded-full"
				>
					{t('common.cancel')}
				</Button>
			{/if}
		</div>
	</form>
{/if}

<!--
	The refusal arrives after the form closes: the system's answer is asynchronous, and showing it in a
	field already put away would go unseen. It is announced, not only displayed — it is the only
	information on the page that cannot be guessed by looking.
-->
{#if reminderRefused}
	<p class="text-caption text-destructive mt-4" role="status" data-test-id="reminder-denied">
		{t('lists.reminderDenied')}
	</p>
{/if}

{#if !data.ready}
	<!--
		The placeholders draw the stack that is about to appear, so the screen does not jump from a sentence
		to three cards. The sentence stays for the screen reader, which cannot read a shape.
	-->
	<p class="sr-only" role="status">{t('common.loading')}</p>
	<ul class="mt-6 space-y-3" aria-hidden="true">
		{#each { length: SKELETON_COUNT } as _, index (index)}
			<li class="fl-home-card bg-card flex items-center gap-4 p-4">
				<span class="fl-home-skeleton size-12 shrink-0 rounded-2xl"></span>
				<span class="flex-1 space-y-2.5">
					<span class="fl-home-skeleton block h-4 w-2/5"></span>
					<span class="fl-home-skeleton block h-3 w-3/5"></span>
				</span>
			</li>
		{/each}
	</ul>
{:else if data.lists.length === 0}
	<!--
		The first screen of a new household. It borrows the sign-in screen's glow and card: the person has just
		come from there, and the home should feel like the same product welcoming them, not a blank table. The
		one thing to do is a real button, not a dashed outline at the bottom of nothing.
	-->
	<div class="fl-auth-glow" aria-hidden="true"></div>
	<div class="fl-auth-card fl-rise mt-6">
		<EmptyState illustration="lists" text={t('lists.empty')} testId="lists-empty">
			{#snippet action()}
				{#if !creating}
					<Button
						type="button"
						onclick={openCreate}
						data-test-id="new-list-card"
						class="fl-press fl-auth-submit mt-2 w-full max-w-xs"
					>
						<Plus size={20} aria-hidden="true" />
						{t('lists.new')}
					</Button>
					{#if data.recipes.length > 0}
						<a
							href="/meal-plan"
							data-test-id="lists-empty-meal-plan-link"
							class="text-accent-foreground text-label mt-3 inline-flex items-center gap-1 font-medium"
						>
							<CalendarDays size={18} aria-hidden="true" />
							{t('lists.mealPlanSuggestion')}
						</a>
					{/if}
				{/if}
			{/snippet}
		</EmptyState>
	</div>
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
				<Card.Root data-test-class="list-card" class="fl-home-card fl-press ring-0">
					<Card.Content class="flex flex-wrap items-center gap-x-4 gap-y-3">
						<!--
							The long press opens renaming: it is the thumb's gesture, and it avoids adding a third button to a
							card that already carries some. The keyboard and the screen reader go through the pencil, next to
							the bin.
						-->
						<a
							href="/l/{list.id}"
							use:longpress={() => rename(list)}
							class="flex min-w-0 flex-auto flex-wrap items-center gap-4"
						>
							<span
								class="fl-home-emoji text-h1"
								style="--fl-home-tint: {list.color || DEFAULT_TINT}"
								aria-hidden="true"
							>
								{list.emoji}
							</span>
							<span class="min-w-0 flex-1 basis-[6rem]">
								<span class="text-product block font-semibold break-words">{list.name}</span>
								<span class="text-muted-foreground text-label block">
									{t('lists.progress', { done, total })}
								</span>
								{#if list.eventDate && eventLabel(list.eventDate)}
									<!--
										The date of a family meal or a birthday: it is what says how long the list is useful for, and it
										was modelled without ever being displayed.
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
							The count and the bin travel together. Apart, they fought over the end of the first line and the bin
							fell alone onto the next one, on the left: the most destructive action ended up in the most visible
							place.
						-->
						<div class="ms-auto flex shrink-0 items-center gap-1.5">
							<!--
								A finished list earns its tick: "0 remaining" is true but reads like an error, where the green
								pill says the errand is done. The number keeps speaking for every other state.
							-->
							{#if total > 0 && done === total}
								<Badge
									variant="secondary"
									class="text-secondary gap-1 rounded-full bg-[var(--fl-secondary-tint)] font-semibold"
								>
									<Check size={12} aria-hidden="true" />
									{t('lists.remaining', { count: 0 })}
								</Badge>
							{:else}
								<Badge variant="secondary" class="rounded-full">
									{t('lists.remaining', { count: total - done })}
								</Badge>
							{/if}
							<button
								type="button"
								onclick={() => rename(list)}
								aria-label={t('lists.rename', { name: list.name })}
								data-test-class="list-rename"
								class={actionClass}
							>
								<Pencil size={18} aria-hidden="true" />
							</button>
							<!--
								Duplication lives on the card, with the pencil and the bin, and not inside the opened list: this is
								where you see your lists side by side and recognise the one that comes back every week. The bottom
								bar carries navigation only.
							-->
							<button
								type="button"
								onclick={() => {
									feedback.play('add');
									data.duplicateList(list.id);
								}}
								aria-label={t('lists.duplicate', { name: list.name })}
								data-test-class="list-duplicate"
								class={actionClass}
							>
								<Copy size={18} aria-hidden="true" />
							</button>
							<button
								type="button"
								onclick={() => {
									feedback.play('remove');
									data.removeList(list.id);
								}}
								aria-label={t('lists.delete', { name: list.name })}
								data-test-class="list-delete"
								class="{actionClass} hover:text-destructive"
							>
								<Trash2 size={18} aria-hidden="true" />
							</button>
						</div>
					</Card.Content>

					<!--
						The card footer answers "who else sees this". The avatars overlap because a household rarely has
						more than five and a tight stack reads at a glance; the word beside it is there because the stack
						alone does not say whether you are alone.
					-->
					<Card.Footer class="text-caption text-muted-foreground flex items-center gap-2">
						{@const members = membersOf(list)}
						{#if members.length > 1}
							<span class="flex items-center" data-test-class="list-members">
								{#each members.slice(0, 4) as member, rank (member.id)}
									<span class={rank === 0 ? '' : '-ms-2'}>
										<Avatar member={member} size={26} ring />
									</span>
								{/each}
								{#if members.length > 4}
									<span class="ms-1.5">+{members.length - 4}</span>
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
	Adding a list from the end of the stack.

	The button at the top still exists, but you only notice a list is missing after going through the ones
	you have. The dashed outline tells it from the real ones without making it one more control to ignore;
	it disappears when the form is already open, so as not to offer the same thing twice.
-->
{#if data.ready && !creating && data.lists.length > 0}
	<button
		type="button"
		onclick={openCreate}
		data-test-id="new-list-card"
		class="fl-press border-input text-primary text-label hover:bg-[var(--fl-primary-tint)] mt-3 flex min-h-[max(3.5rem,56px)] w-full items-center justify-center gap-2 rounded-[1.375rem] border border-dashed font-medium transition-colors"
	>
		<Plus size={20} aria-hidden="true" />
		{t('lists.new')}
	</button>
{/if}

<EmojiPicker bind:this={picker} value={emoji} onpick={(choices) => (emoji = choices)} />
