<script lang="ts">
	import { tick } from 'svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { EMOJIS, EMOJI_GROUPS, searchEmojis, type EmojiEntry } from '$domain/emoji';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Search, X } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';

	let { value, onpick }: { value: string; onpick: (emoji: string) => void } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);
	let field = $state<HTMLInputElement | null>(null);
	let query = $state('');

	const name = (entry: EmojiEntry) => t(`emoji.${entry.key}`);
	const found = $derived(searchEmojis(query, name));

	/**
	 * Même contrat que les autres feuilles : le navigateur tient l'état ouvert / fermé, on ne le
	 * double pas d'un booléen qui finirait par mentir dès qu'Échap ferme la feuille sans nous.
	 */
	export async function show() {
		query = '';
		dialog?.showModal();

		// Le champ de recherche prend le focus, mais seulement après le rendu : `showModal` place le
		// focus lui-même sur le premier élément focalisable, et le faire avant serait écrasé.
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

	/** Les emoji trouvés, regroupés — la grille garde ses intertitres pendant une recherche. */
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

		<!--
			Hauteur bornée et défilement interne : la palette tient cinquante-deux dessins, et une
			feuille qui pousse au-delà de l'écran cacherait son propre champ de recherche.
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

		<!-- La fermeture après la grille : le premier focus doit tomber sur la recherche. -->
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
