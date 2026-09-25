import { ai } from './ai.svelte';
import type { SuggestedRecipe } from '$domain/ai-recipe';
import {
	MAX_FOLLOW_UP_QUESTIONS,
	recipeChatPrompt,
	type ChatPromptOptions
} from '$domain/ai-recipe-chat';
import type { ConversationTurn } from '$domain/ai';

/**
 * One bubble of the thread shown on screen: the person's own words for a `user` turn; for an `assistant`
 * turn, its question, a parsed recipe, or a failure. The raw JSON answer never reaches the screen.
 */
export interface ThreadTurn {
	role: 'user' | 'assistant';
	text: string;
	question?: string;
	recipe?: SuggestedRecipe;
	error?: { reason: 'network' | 'provider' | 'unreadable' | 'unsupported'; detail: string };
	/** The person discarded this suggestion; kept in place, on the record, but no longer shown as a card. */
	discarded?: boolean;
}

/** What the screen knows when the person sends a message; the store adds whether a question is still allowed. */
export type AskOptions = Omit<ChatPromptOptions, 'mayAsk'>;

/**
 * A single "ask the AI for a recipe" conversation, kept only for the current browser tab (#226): a plain
 * `$state`, never written to Dexie or Supabase, and reset the moment the thread closes — matching the
 * BYOK posture that nothing about what is discussed leaves the device except straight to the person's own
 * provider.
 */
class AiRecipeConversationStore {
	turns = $state<ThreadTurn[]>([]);
	busy = $state(false);

	/**
	 * The provider-facing history, in the exact shape sent back on every turn: the wrapped instruction for
	 * each user message, and the raw text of each assistant answer — never the display-only `turns` above,
	 * which lag behind on a failed call (see `#send`).
	 */
	#history: ConversationTurn[] = [];
	#lastUserText = '';
	#lastOptions: AskOptions = { language: 'Français', servings: null, constraints: [] };

	get hasStarted() {
		return this.turns.length > 0;
	}

	/** Questions the assistant already asked: past the limit, it is told to write the recipe. */
	get questionsAsked() {
		return this.turns.filter((turn) => turn.question).length;
	}

	reset() {
		this.turns = [];
		this.#history = [];
		this.busy = false;
		this.#lastUserText = '';
	}

	#prompt(text: string, options: AskOptions): string {
		return recipeChatPrompt(
			text,
			{ ...options, mayAsk: this.questionsAsked < MAX_FOLLOW_UP_QUESTIONS },
			this.#history.length === 0
		);
	}

	async ask(userText: string, options: AskOptions) {
		const text = userText.trim();
		if (!text || this.busy) return;

		this.#lastUserText = text;
		this.#lastOptions = options;

		const prompt = this.#prompt(text, options);
		this.turns.push({ role: 'user', text });
		await this.#send(prompt);
	}

	/**
	 * Asks again for the same last message, replacing whatever it produced — a network hiccup, an
	 * unreadable answer, or simply a recipe the person does not like.
	 */
	async retry() {
		if (!this.#lastUserText || this.busy) return;

		// The user's own turn just above stays exactly as shown; only its answer is replaced.
		if (this.turns.at(-1)?.role === 'assistant') {
			this.turns.pop();
			// A successful answer was committed to the history: it goes too, or the provider would see the
			// same message twice in a row, which Anthropic's dialect rejects.
			if (this.#history.at(-1)?.role === 'assistant') this.#history = this.#history.slice(0, -2);
		}

		await this.#send(this.#prompt(this.#lastUserText, this.#lastOptions));
	}

	/**
	 * Discarding a suggestion (#226) only hides that one card — it does not close the thread or drop the
	 * turn from the history sent to the provider, so the person can keep asking follow-ups from what was
	 * already discussed instead of starting over.
	 */
	discard(index: number) {
		const turn = this.turns[index];
		if (turn) turn.discarded = true;
	}

	async #send(prompt: string) {
		this.busy = true;

		const candidate = [...this.#history, { role: 'user' as const, content: prompt }];
		const outcome = await ai.continueRecipeChat(candidate);

		this.busy = false;

		if (!outcome.ok) {
			// Not committed to `#history`: a failed call leaves no assistant turn, and replaying the same
			// candidate on retry is exactly what should happen — Anthropic's dialect also rejects two
			// consecutive `user` turns, so an uncommitted failure must never linger there either.
			this.turns.push({
				role: 'assistant',
				text: '',
				error: { reason: outcome.reason, detail: outcome.detail }
			});
			return;
		}

		this.#history = [...candidate, { role: 'assistant', content: outcome.raw }];
		this.turns.push(
			outcome.reply.kind === 'question'
				? { role: 'assistant', text: '', question: outcome.reply.text }
				: { role: 'assistant', text: '', recipe: outcome.reply.recipe }
		);
	}
}

export const aiRecipeConversation = new AiRecipeConversationStore();
