<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, tick } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { i18n, t, LOCALES } from '$i18n/index.svelte';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { aiRecipeConversation } from '$stores/ai-recipe-conversation.svelte';
	import type { SuggestedRecipe } from '$domain/ai-recipe';
	import { conflictingIngredients, tableConstraints, type TableGuest } from '$domain/ai-recipe-chat';
	import { draftFromSuggestion, type RecipeDraft } from '$domain/recipe-draft';
	import {
		appendTranscript,
		bcp47LocaleOf,
		isSpeechRecognitionSupported,
		speechRecognitionCtor,
		type SpeechRecognitionGlobals
	} from '$domain/speech-dictation';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import RecipeSuggestionCard from '$components/app/RecipeSuggestionCard.svelte';
	import { Check, Mic, MicOff, Send, Sparkles, UserPlus, X } from '@lucide/svelte';

	interface Props {
		/** A kept suggestion goes to the recipe form as a draft: nothing is ever saved from the chat (#313). */
		onDraft: (draft: RecipeDraft) => void;
	}

	const { onDraft }: Props = $props();

	/**
	 * The "ask the AI" chat of "Create a recipe" (#313): the person says what they feel like eating, the
	 * assistant may ask a short question back, then writes a recipe that opens in the editable form.
	 *
	 * What leaves is the person's own messages and the allergies and diets of whoever is at the table —
	 * never their names. The thread lives in `aiRecipeConversation` for this tab only, and ends with the screen.
	 */
	const conversation = aiRecipeConversation;
	const language = $derived(LOCALES.find((l) => l.code === i18n.locale)?.native ?? 'Français');

	let message = $state('');
	let thread = $state<HTMLOListElement | null>(null);
	let field = $state<HTMLTextAreaElement | null>(null);

	onDestroy(() => {
		conversation.reset();
		stopDictation();
	});

	/**
	 * Who eats: every household member starts ticked, as every dietary note used to be sent (#228), and
	 * the person unticks whoever is not there. Guests are added for this meal only and forgotten with it.
	 */
	const absent = new SvelteSet<string>();
	let guests = $state<(TableGuest & { id: number })[]>([]);
	let nextGuestId = 0;

	let addingGuest = $state(false);
	let guestName = $state('');
	let guestNotes = $state('');

	const persons = $derived(data.householdPersons);
	const atTable = $derived([
		...persons
			.filter((person) => !absent.has(person.id))
			.map((person) => ({ name: person.name, notes: person.dietaryNotes ?? '' })),
		...guests
	]);
	const constraints = $derived(tableConstraints(atTable));
	const constraintsShown = $derived(
		atTable
			.filter((person) => person.notes.trim())
			.map((person) => ({ who: person.name, notes: person.notes.trim() }))
	);

	function togglePerson(id: string) {
		feedback.play('tap');
		if (absent.has(id)) absent.delete(id);
		else absent.add(id);
	}

	function openGuestForm() {
		addingGuest = true;
		void tick().then(() => document.getElementById('ai-guest-name')?.focus());
	}

	function addGuest(event: SubmitEvent) {
		event.preventDefault();
		feedback.play('add');
		guests.push({
			id: nextGuestId++,
			name: guestName.trim() || t('ai.chat.guestDefault', { number: guests.length + 1 }),
			notes: guestNotes.trim()
		});
		guestName = '';
		guestNotes = '';
		addingGuest = false;
	}

	function removeGuest(id: number) {
		guests = guests.filter((guest) => guest.id !== id);
	}

	/**
	 * Voice dictation (#265): entirely the browser's own `SpeechRecognition`, so a transcript never leaves
	 * the device on its own — it only lands in `message`, exactly as if it had been typed.
	 */
	interface SpeechRecognitionResultLike {
		0?: { transcript?: string };
	}
	interface SpeechRecognitionEventLike {
		results: ArrayLike<SpeechRecognitionResultLike>;
	}
	interface SpeechRecognitionLike {
		lang: string;
		interimResults: boolean;
		continuous: boolean;
		onresult: ((event: SpeechRecognitionEventLike) => void) | null;
		onerror: (() => void) | null;
		onend: (() => void) | null;
		start(): void;
		stop(): void;
	}

	const dictationSupported =
		browser && isSpeechRecognitionSupported(window as unknown as SpeechRecognitionGlobals);
	let listening = $state(false);
	let dictationError = $state(false);
	let recognition: SpeechRecognitionLike | null = null;

	function startDictation() {
		const Ctor = speechRecognitionCtor(window as unknown as SpeechRecognitionGlobals);
		if (!Ctor) return;

		dictationError = false;
		recognition = new Ctor() as unknown as SpeechRecognitionLike;
		recognition.lang = bcp47LocaleOf(i18n.locale);
		recognition.interimResults = false;
		recognition.continuous = false;

		recognition.onresult = (event) => {
			const transcript = Array.from(event.results)
				.map((result) => result[0]?.transcript ?? '')
				.join(' ');
			message = appendTranscript(message, transcript);
		};
		recognition.onerror = () => {
			dictationError = true;
			listening = false;
		};
		recognition.onend = () => {
			listening = false;
		};

		listening = true;
		recognition.start();
	}

	function stopDictation() {
		recognition?.stop();
	}

	function toggleDictation() {
		if (listening) stopDictation();
		else startDictation();
	}

	async function send(text: string) {
		await conversation.ask(text, {
			language,
			servings: atTable.length > 0 ? atTable.length : null,
			constraints
		});

		const last = conversation.turns.at(-1);
		if (last?.recipe) feedback.play('success');

		await tick();
		thread?.lastElementChild?.scrollIntoView({ block: 'nearest' });
		field?.focus({ preventScroll: true });
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const text = message;
		message = '';
		await send(text);
	}

	/** Enter sends, as in any messaging app; Shift+Enter still starts a new line. The button stays the way. */
	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
		event.preventDefault();
		(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
	}

	function avoid(recipe: SuggestedRecipe) {
		const names = conflictingIngredients(recipe, constraints).map((c) => c.ingredient);
		void send(t('ai.chat.avoidMessage', { ingredients: names.join(', ') }));
	}

	function accept(suggestion: SuggestedRecipe) {
		feedback.play('add');
		onDraft(draftFromSuggestion(suggestion));
	}
</script>

<!--
	Big bubbles, each with who speaks written above it, never told apart by colour or side alone. The thread is
	a `log`, so a screen reader announces each new message; the "writing" line is a status region that stays
	in the page, since a live region only speaks for changes made after it exists.
-->
<div class="space-y-5" data-test-id="ai-request-block">
	<fieldset class="bg-card space-y-3 rounded-xl border p-4" data-test-id="ai-chat-table">
		<legend class="text-label px-1 font-semibold">{t('ai.chat.tableTitle')}</legend>
		<p class="text-muted-foreground text-caption">{t('ai.chat.tableHint')}</p>

		{#if persons.length > 0 || guests.length > 0}
			<ul class="flex flex-wrap gap-2">
				{#each persons as person (person.id)}
					{@const present = !absent.has(person.id)}
					<li>
						<button
							type="button"
							onclick={() => togglePerson(person.id)}
							aria-pressed={present}
							data-test-class="ai-chat-person"
							data-test-state={present ? 'present' : 'absent'}
							class="fl-press text-label flex min-h-[max(2.75rem,44px)] items-center gap-2 rounded-full border-2 px-4 font-medium {present
								? 'border-primary bg-[var(--fl-primary-tint)]'
								: 'border-input bg-background text-muted-foreground'}"
						>
							{#if present}
								<Check size={18} aria-hidden="true" />
							{:else}
								<X size={18} aria-hidden="true" />
							{/if}
							<span class="[overflow-wrap:anywhere]">{person.name}</span>
							<span class="sr-only">
								{present ? t('ai.chat.present') : t('ai.chat.absent')}
							</span>
						</button>
					</li>
				{/each}
				{#each guests as guest (guest.id)}
					<li
						class="border-primary text-label flex min-h-[max(2.75rem,44px)] items-center gap-1 rounded-full border-2 bg-[var(--fl-primary-tint)] ps-4 font-medium"
						data-test-class="ai-chat-guest"
					>
						<span class="[overflow-wrap:anywhere]">{guest.name}</span>
						<button
							type="button"
							onclick={() => removeGuest(guest.id)}
							aria-label={t('ai.chat.removeGuest', { name: guest.name })}
							data-test-class="ai-chat-guest-remove"
							class="fl-press hover:bg-muted grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
						>
							<X size={18} aria-hidden="true" />
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if addingGuest}
			<form onsubmit={addGuest} class="space-y-3 rounded-lg border p-3" data-test-id="ai-chat-guest-form">
				<div class="space-y-1.5">
					<Label for="ai-guest-name">{t('ai.chat.guestName')}</Label>
					<Input id="ai-guest-name" bind:value={guestName} data-test-id="ai-chat-guest-name" />
				</div>
				<div class="space-y-1.5">
					<Label for="ai-guest-notes">{t('ai.chat.guestNotes')}</Label>
					<Input
						id="ai-guest-notes"
						bind:value={guestNotes}
						placeholder={t('ai.chat.guestNotesPlaceholder')}
						data-test-id="ai-chat-guest-notes"
					/>
				</div>
				<div class="flex flex-wrap gap-2">
					<Button type="submit" data-test-id="ai-chat-guest-save">{t('ai.chat.guestSave')}</Button>
					<Button type="button" variant="outline" onclick={() => (addingGuest = false)}>
						{t('common.cancel')}
					</Button>
				</div>
			</form>
		{:else}
			<Button variant="outline" onclick={openGuestForm} data-test-id="ai-chat-add-guest">
				<UserPlus size={18} aria-hidden="true" />
				{t('ai.chat.addGuest')}
			</Button>
		{/if}

		<div data-test-id="ai-chat-constraints">
			<h2 class="text-label font-semibold">{t('ai.chat.constraintsTitle')}</h2>
			{#if constraintsShown.length > 0}
				<ul class="mt-2 flex flex-wrap gap-2">
					{#each constraintsShown as constraint, index (index)}
						<li
							class="bg-muted text-label rounded-lg px-3 py-2 [overflow-wrap:anywhere]"
							data-test-class="ai-chat-constraint"
						>
							{t('ai.chat.constraintOf', { who: constraint.who, notes: constraint.notes })}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-muted-foreground text-label mt-1">{t('ai.chat.constraintsNone')}</p>
			{/if}
		</div>
	</fieldset>

	<ol
		bind:this={thread}
		role="log"
		aria-label={t('ai.chat.threadLabel')}
		class="space-y-4"
		data-test-id="ai-chat-thread"
	>
		<li class="max-w-[92%] space-y-1">
			<p class="text-caption text-muted-foreground flex items-center gap-1.5 font-semibold">
				<Sparkles size={14} aria-hidden="true" />
				{t('ai.chat.assistant')}
			</p>
			<p class="bg-card text-body rounded-2xl rounded-ss-sm border p-4">{t('ai.chat.greeting')}</p>
		</li>

		{#each conversation.turns as turn, index (index)}
			{#if turn.role === 'user'}
				<li class="ms-auto max-w-[92%] space-y-1" data-test-class="ai-chat-user">
					<p class="text-caption text-muted-foreground text-end font-semibold">{t('ai.chat.you')}</p>
					<p
						class="bg-primary text-primary-foreground text-body rounded-2xl rounded-se-sm p-4 whitespace-pre-line [overflow-wrap:anywhere]"
					>
						{turn.text}
					</p>
				</li>
			{:else if turn.error}
				<li class="space-y-2">
					<p
						class="border-destructive text-destructive text-body rounded-2xl border-2 p-4"
						role="alert"
						data-test-id="ai-request-error"
					>
						{turn.error.detail
							? t(`ai.error.${turn.error.reason}Detail`, { detail: turn.error.detail })
							: t(`ai.error.${turn.error.reason}`)}
					</p>
					<Button variant="outline" onclick={() => conversation.retry()} disabled={conversation.busy}>
						{t('ai.retry')}
					</Button>
				</li>
			{:else if turn.question}
				<li class="max-w-[92%] space-y-1" data-test-class="ai-chat-question">
					<p class="text-caption text-muted-foreground flex items-center gap-1.5 font-semibold">
						<Sparkles size={14} aria-hidden="true" />
						{t('ai.chat.assistant')}
					</p>
					<p
						class="bg-card text-body rounded-2xl rounded-ss-sm border p-4 whitespace-pre-line [overflow-wrap:anywhere]"
					>
						{turn.question}
					</p>
				</li>
			{:else if turn.recipe && !turn.discarded}
				{@const recipe = turn.recipe}
				<li>
					<RecipeSuggestionCard
						suggestion={recipe}
						busy={conversation.busy}
						conflicts={conflictingIngredients(recipe, constraints)}
						onAvoid={() => avoid(recipe)}
						onAccept={() => accept(recipe)}
						onRetry={() => conversation.retry()}
						onDiscard={() => conversation.discard(index)}
					/>
				</li>
			{/if}
		{/each}
	</ol>

	<p
		role="status"
		class="text-label text-muted-foreground flex min-h-6 items-center gap-2 font-medium"
		data-test-id="ai-chat-status"
	>
		{#if conversation.busy}
			<Sparkles size={18} aria-hidden="true" />
			<span data-test-id="ai-request-asking">{t('ai.chat.writing')}</span>
		{:else if listening}
			<Mic size={18} aria-hidden="true" />
			<span data-test-id="ai-request-listening">{t('ai.request.listening')}</span>
		{/if}
	</p>

	{#if dictationError}
		<p class="text-destructive text-label" role="alert" data-test-id="ai-request-dictate-error">
			{t('ai.request.dictateError')}
		</p>
	{/if}

	<form onsubmit={submit} class="bg-card space-y-3 rounded-xl border p-4" data-test-id="ai-chat-form">
		<Label for="ai-chat-message">{t('ai.chat.messageLabel')}</Label>
		<textarea
			id="ai-chat-message"
			bind:this={field}
			bind:value={message}
			onkeydown={onKeydown}
			rows="3"
			placeholder={conversation.hasStarted
				? t('ai.request.followUpPlaceholder')
				: t('ai.request.placeholder')}
			data-test-id="ai-request-input"
			required
			class="border-input bg-background text-body focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border p-3 outline-none focus-visible:ring-3"
		></textarea>
		<div class="fl-chat-actions flex flex-wrap gap-2">
			{#if dictationSupported}
				<Button
					type="button"
					class="text-label min-h-[max(3rem,48px)] px-5"
					variant={listening ? 'default' : 'outline'}
					disabled={conversation.busy}
					onclick={toggleDictation}
					aria-pressed={listening}
					data-test-id="ai-request-dictate"
				>
					{#if listening}
						<MicOff size={20} aria-hidden="true" />
						{t('ai.request.stopDictate')}
					{:else}
						<Mic size={20} aria-hidden="true" />
						{t('ai.request.dictate')}
					{/if}
				</Button>
			{/if}
			<Button type="submit" class="text-label min-h-[max(3rem,48px)] px-5" disabled={conversation.busy} data-test-id="ai-request-submit">
				<Send size={20} aria-hidden="true" class="rtl:-scale-x-100" />
				{t('ai.chat.send')}
			</Button>
		</div>
	</form>
</div>

<style>
	/*
	 * The send button sits on the thumb's side, whatever the reading direction: a left hand stays a left hand
	 * in Arabic (see `.fl-thumb-side` in app.css). The row is laid out physically, then flipped for a left hand.
	 */
	.fl-chat-actions {
		flex-direction: row;
		justify-content: flex-end;
	}

	:global([dir='rtl']) .fl-chat-actions,
	:global([data-hand='left']) .fl-chat-actions {
		flex-direction: row-reverse;
	}

	:global([dir='rtl'][data-hand='left']) .fl-chat-actions {
		flex-direction: row;
	}
</style>
