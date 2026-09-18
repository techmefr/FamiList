<script lang="ts">
	import { tick } from 'svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { t } from '$i18n/index.svelte';
	import { EMOJIS, EMOJI_GROUPS, customEmoji, searchEmojis, type EmojiEntry } from '$domain/emoji';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Search, X } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';

	let { value, onpick }: { value: string; onpick: (emoji: string) => void } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);
	let field = $state<HTMLInputElement | null>(null);
	let query = $state('');

	const name = (entry: EmojiEntry) => t(`emoji.${entry.key}`);
	const found = $derived(searchEmojis(query, name));
	const custom = $derived(customEmoji(query));

	/**
	 * Same contract as the other sheets: the browser holds the open / closed state, we do not double it with
	 * a boolean that would end up lying as soon as Escape closes the sheet without us.
	 */
	export async function show() {
		query = '';
		dialog?.showModal();

		// The search field takes focus, but only after rendering: `showModal` places focus itself on the first
		// focusable element, and doing it before would be overwritten.
		await tick();
		field?.focus();
	}

	function hide() {
		dialog?.close();
	}

	function pick(emoji: string) {
		feedback.play('tap');
		onpick(emoji);
		hide();
	}

	/** The emoji found, grouped — the grid keeps its subheadings during a search. */
	const sections = $derived(
		EMOJI_GROUPS.map((group) => ({
			group,
			entries: found.filter((entry) => entry.group === group)
		})).filter((section) => section.entries.length > 0)
	);
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="emoji-title"
	data-test-id="emoji-picker"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="emoji-title" class="text-h2 pe-12 font-semibold">{t('emojiPicker.title')}</h2>

		<div class="mt-4">
			<Label for="emoji-search">{t('emojiPicker.search')}</Label>
			<IconField icon={Search}>
				<Input
					id="emoji-search"
					bind:ref={field}
					bind:value={query}
					type="search"
					placeholder={t('emojiPicker.searchPlaceholder')}
					data-test-id="emoji-search"
					autocomplete="off"
				/>
			</IconField>
		</div>

		{#if custom}
			<!--
				The palette cannot foresee everything: a character pasted into the search becomes a choice in its own
				right rather than a dead end.
			-->
			<button
				type="button"
				onclick={() => pick(custom)}
				data-test-id="emoji-custom"
				class="fl-press hover:bg-muted mt-3 flex w-full items-center gap-3 rounded-lg border
					p-2 text-start"
			>
				<span class="text-2xl" aria-hidden="true">{custom}</span>
				<span>{t('emojiPicker.useCharacter', { emoji: custom })}</span>
			</button>
		{/if}

		<!--
			Bounded height and internal scrolling: a sheet growing past the screen would hide its own search field,
			the only way to cross the palette quickly.
		-->
		<div class="mt-4 max-h-[50vh] overflow-y-auto pe-1">
			{#each sections as section (section.group)}
				<h3 class="text-caption text-muted-foreground mt-3 font-medium first:mt-0">
					{t(`emojiGroup.${section.group}`)}
				</h3>
				<ul class="mt-1 grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1">
					{#each section.entries as entry (entry.char)}
						<li>
							<button
								type="button"
								onclick={() => pick(entry.char)}
								title={name(entry)}
								aria-label={name(entry)}
								aria-pressed={entry.char === value}
								data-test-class="emoji-choice"
								class="fl-press hover:bg-muted aria-pressed:bg-[var(--fl-primary-tint)]
									aria-pressed:ring-primary grid aspect-square w-full min-w-[44px]
									place-items-center rounded-lg text-2xl aria-pressed:ring-2"
							>
								<span aria-hidden="true">{entry.char}</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-muted-foreground py-6 text-center" data-test-id="emoji-empty">
					{t('emojiPicker.empty')}
				</p>
			{/each}
		</div>

		<!-- The close button after the grid: first focus must land on the search. -->
		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="emoji-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
