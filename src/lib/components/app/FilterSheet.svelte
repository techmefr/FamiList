<script lang="ts">
	import type { Snippet } from 'svelte';
	import { settings } from '$stores/settings.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import { X } from '@lucide/svelte';

	/**
	 * The frame shared by the app's filter sheets: a title, the filters themselves, a button emptying them,
	 * and the close button in the corner. The list's two switches and the recipes' two-column catalogue
	 * (#316) are both a `children` of it, so the two sheets open, close and reset the same way.
	 */
	let {
		title,
		active,
		onReset,
		resetLabel,
		testPrefix = 'filter',
		wide = false,
		onOpen,
		children,
		actions
	}: {
		title: string;
		/** How many filters are on: the reset button is off at zero, there is nothing to empty. */
		active: number;
		onReset: () => void;
		resetLabel?: string;
		/** `filter` gives the list's historical markers: `filter-sheet`, `filter-reset`, `filter-sheet-close`. */
		testPrefix?: string;
		/** Room for two columns: a catalogue of filters does not fit the width of two switches. */
		wide?: boolean;
		onOpen?: () => void;
		children: Snippet;
		/** Buttons set next to the reset one, at the bottom, where the thumb already is. */
		actions?: Snippet;
	} = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	const titleId = $derived(`${testPrefix}-sheet-title`);

	/** Same contract as the other sheets: it is the browser that holds the open state. */
	export function show() {
		onOpen?.();
		dialog?.showModal();
	}

	export function hide() {
		dialog?.close();
	}

	function reset() {
		feedback.play('tap');
		onReset();
	}
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	class:fl-sheet-wide={wide}
	aria-labelledby={titleId}
	data-test-id="{testPrefix}-sheet"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id={titleId} class="text-h2 pe-12 font-semibold">{title}</h2>

		{@render children()}

		<div class="mt-4 flex flex-wrap gap-2">
			<Button
				variant="outline"
				onclick={reset}
				disabled={active === 0}
				data-test-id="{testPrefix}-reset"
				class="h-auto min-h-[max(2.75rem,44px)] min-w-0 flex-1 basis-40 whitespace-normal"
			>
				{resetLabel ?? t('list.filtersReset')}
			</Button>
			{@render actions?.()}
		</div>

		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="{testPrefix}-sheet-close"
			class="bg-muted text-foreground absolute end-4 top-4 grid size-11 place-items-center rounded-full"
		>
			<X size={18} aria-hidden="true" />
		</button>
	</div>
</dialog>
