<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { report } from '$stores/report.svelte';
	import { settings } from '$stores/settings.svelte';
	import { Button } from '$components/ui/button';
	import ReportForm from '$components/app/ReportForm.svelte';
	import { ChevronDown, ChevronUp, X } from '@lucide/svelte';

	const title = $derived(t(`bugReport.title.${report.kind}`));

	/**
	 * Escape shrinks, it does not close.
	 *
	 * That is the opposite of the dialog convention, and it is intended: here the expected gesture is "let me
	 * see my screen again", not "throw away what I have just written". Closing stays possible, through a
	 * button nobody presses by reflex.
	 */
	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && report.open && !report.minimized) {
			event.preventDefault();
			report.minimize();
		}
	}
</script>

<svelte:window onkeydown={onKeyDown} />

{#if report.open}
	<!--
		A panel, not a page, and above all not a modal dialog.

		The form asks for a capture of the screen where the problem happened. A page replaces it, a modal makes
		it inert behind a veil: in both cases, what needs photographing has disappeared at the precise moment we
		want to show it. Hence `aria-modal="false"` and the absence of a veil — the rest of the screen goes on
		living, you can scroll, reopen a menu, reproduce the bug while the panel waits.

		It sits above the navigation bar (`--fl-navbar-h`), which is fixed at the bottom on a phone: without
		that, the send button would fall under the tabs.
	-->
	<div
		role="dialog"
		aria-modal="false"
		aria-labelledby="report-title"
		data-test-id="report-panel"
		data-minimized={report.minimized ? 'true' : 'false'}
		class="bg-card shadow-fl-3 fixed inset-x-0 bottom-[var(--fl-navbar-h,0px)] z-20 mx-auto w-full max-w-xl rounded-t-2xl border md:inset-x-auto md:end-4 md:bottom-4 md:mx-0 md:rounded-2xl"
		class:fl-rise={settings.animates && !report.minimized}
	>
		<div class="flex items-center gap-2 px-4 py-3">
			<h2 id="report-title" class="text-h2 min-w-0 flex-1 truncate font-semibold">
				{title}
			</h2>

			{#if report.minimized}
				<Button
					variant="outline"
					onclick={() => report.restore()}
					data-test-id="report-restore"
					class="fl-press"
				>
					<ChevronUp size={18} aria-hidden="true" />
					<!--
						On a phone, the word gives way to the title, which was being cut off. The arrow is enough at that
						point: a shrunk panel offers only that gesture. The label stays read out by the screen reader.
					-->
					<span class="max-md:sr-only">{t('bugReport.resume')}</span>
				</Button>
			{:else}
				<Button
					variant="outline"
					onclick={() => report.minimize()}
					data-test-id="report-minimize"
					class="fl-press"
				>
					<ChevronDown size={18} aria-hidden="true" />
					<span class="max-md:sr-only">{t('bugReport.minimize')}</span>
				</Button>
			{/if}

			<button
				type="button"
				onclick={() => report.close()}
				aria-label={t('common.close')}
				data-test-id="report-close"
				class="fl-press text-muted-foreground hover:bg-muted grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
			>
				<X size={22} aria-hidden="true" />
			</button>
		</div>

		{#if report.minimized}
			<!--
				Shrunk, the panel keeps only one line: enough to know a report is in progress, and enough to reopen
				it. The draft is not shown but it is there — it is the state, not the component, that holds it.
			-->
			<p class="text-muted-foreground text-caption px-4 pb-3" data-test-id="report-minimized-hint">
				{t('bugReport.minimizedHint')}
			</p>
		{:else}
			<div class="max-h-[60dvh] overflow-y-auto px-4 pb-4">
				<p class="text-muted-foreground text-caption">
					{t(`bugReport.subtitle.${report.kind}`)}
				</p>

				<div class="mt-4">
					<ReportForm />
				</div>

				{#if report.sent}
					<Button onclick={() => report.close()} class="fl-press mt-4" data-test-id="report-done">
						{t('common.close')}
					</Button>
				{/if}
			</div>
		{/if}
	</div>
{/if}
