import { ai } from './ai.svelte';
import {
	recipeFromRequestPrompt,
	recipeFollowUpPrompt,
	type SuggestedRecipe,
	type PromptOptions
} from '$domain/ai-recipe';
import type { ConversationTurn } from '$domain/ai';

/**
 * One line of the thread shown on screen: the person's own words for a `user` turn, or — per the
 * "always restate the full recipe" decision documented in `ai-recipe.ts` — a parsed recipe or a failure for
 * an `assistant` turn. There is never a plain-text assistant reply to show: every provider answer is
 * expected to be the same JSON object `RecipeSuggestionCard` already knows how to review.
 */
export interface ThreadTurn {
	role: 'user' | 'assistant';
	text: string;
	recipe?: SuggestedRecipe;
	error?: { reason: 'network' | 'provider' | 'unreadable'; detail: string };
	/** The person discarded this suggestion; kept in place, on the record, but no longer shown as a card. */
	discarded?: boolean;
	/** The person already turned this suggestion into a household recipe. */
	accepted?: boolean;
}

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
	 * each user message, and the raw JSON text of each accepted assistant answer — never the display-only
	 * `turns` above, which lag behind on a failed call (see `#send`).
	 */
	#history: ConversationTurn[] = [];
	#lastUserText = '';
	#lastOptions: PromptOptions = { language: 'français', servings: 4 };

	get hasStarted() {
		return this.turns.length > 0;
	}

	reset() {
		this.turns = [];
		this.#history = [];
		this.busy = false;
		this.#lastUserText = '';
	}

	async ask(userText: string, options: PromptOptions) {
		const text = userText.trim();
		if (!text || this.busy) return;

		this.#lastUserText = text;
		this.#lastOptions = options;

		const prompt =
			this.#history.length === 0
				? recipeFromRequestPrompt(text, options)
				: recipeFollowUpPrompt(text, options);

		this.turns.push({ role: 'user', text });
		await this.#send(prompt);
	}

	/**
	 * Asks again for the same last message, replacing whatever it produced — a network hiccup, an
	 * unreadable answer, or simply a recipe the person does not like, exactly as the one-shot version's
	 * "retry" already worked.
	 */
	async retry() {
		if (!this.#lastUserText || this.busy) return;

		const prompt =
			this.#history.length === 0
				? recipeFromRequestPrompt(this.#lastUserText, this.#lastOptions)
				: recipeFollowUpPrompt(this.#lastUserText, this.#lastOptions);

		// The user's own turn just above stays exactly as shown; only its answer is replaced.
		if (this.turns.at(-1)?.role === 'assistant') this.turns.pop();

		await this.#send(prompt);
	}

	/**
	 * Discarding a suggestion (#226) only hides that one card — it does not close the thread or drop the
	 * turn from the history sent to the provider, so the person can keep asking follow-ups ("bon, essaie
	 * plutot avec des lentilles") from what was already discussed instead of starting over.
	 */
	discard(index: number) {
		const turn = this.turns[index];
		if (turn) turn.discarded = true;
	}

	accept(index: number) {
		const turn = this.turns[index];
		if (turn) turn.accepted = true;
	}

	async #send(prompt: string) {
		this.busy = true;

		const candidate = [...this.#history, { role: 'user' as const, content: prompt }];
		const outcome = await ai.continueRecipeConversation(candidate);

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

		this.#history = [
			...candidate,
			{ role: 'assistant', content: JSON.stringify(outcome.recipe) }
		];
		this.turns.push({ role: 'assistant', text: '', recipe: outcome.recipe });
	}
}

export const aiRecipeConversation = new AiRecipeConversationStore();
