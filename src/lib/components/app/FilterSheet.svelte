<script lang="ts">
	import { settings } from '$stores/settings.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { X } from '@lucide/svelte';

	let {
		priorityOnly = $bindable(),
		hideChecked = $bindable()
	}: { priorityOnly: boolean; hideChecked: boolean } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	/** Même contrat que les autres feuilles : c'est le navigateur qui tient l'état ouvert. */
	export function show() {
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	function reset() {
		feedback.play('tap');
		priorityOnly = false;
		hideChecked = false;
	}

	const actifs = $derived(Number(priorityOnly) + Number(hideChecked));
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="filter-sheet-title"
	data-test-id="filter-sheet"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="filter-sheet-title" class="text-h2 pe-12 font-semibold">{t('list.filters')}</h2>

		<div class="mt-4 space-y-1">
			<label
				class="hover:bg-muted flex min-h-[max(3.5rem,56px)] cursor-pointer items-center gap-3 rounded-lg px-3 transition-colors"
			>
				<input
					type="checkbox"
					bind:checked={priorityOnly}
					data-test-id="filter-priority"
					class="accent-primary size-5 shrink-0"
				/>
				<span class="min-w-0 flex-1">
					<span class="text-label block font-medium">{t('list.priorityOnly')}</span>
					<span class="text-muted-foreground text-caption block">{t('list.priorityOnlyHint')}</span>
				</span>
			</label>

			<label
				class="hover:bg-muted flex min-h-[max(3.5rem,56px)] cursor-pointer items-center gap-3 rounded-lg px-3 transition-colors"
			>
				<input
					type="checkbox"
					bind:checked={hideChecked}
					data-test-id="filter-hide-checked"
					class="accent-primary size-5 shrink-0"
				/>
				<span class="min-w-0 flex-1">
					<span class="text-label block font-medium">{t('list.hideChecked')}</span>
					<span class="text-muted-foreground text-caption block">{t('list.hideCheckedHint')}</span>
				</span>
			</label>
		</div>

		<Button
			variant="outline"
			onclick={reset}
			disabled={actifs === 0}
			data-test-id="filter-reset"
			class="mt-4 w-full"
		>
			{t('list.filtersReset')}
		</Button>

		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="filter-sheet-close"
			class="bg-muted text-foreground absolute end-4 top-4 grid size-11 place-items-center rounded-full"
		>
			<X size={18} aria-hidden="true" />
		</button>
	</div>
</dialog>
