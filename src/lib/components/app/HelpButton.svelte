<script lang="ts">
	import { page } from '$app/state';
	import { t } from '$lib/i18n/index.svelte';
	import { report } from '$stores/report.svelte';
	import { settings } from '$stores/settings.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { install } from '$stores/install.svelte';
	import { CircleQuestionMark, GraduationCap, Lightbulb, Bug, Download, X } from '@lucide/svelte';

	let dialog = $state<HTMLDialogElement | null>(null);

	function show() {
		feedback.play('tap');
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	/**
	 * The tour tells of the open screen, not of the application in general: it is chosen from the current
	 * path.
	 *
	 * driver.js and its stylesheet only come down here, on demand. They weigh a hundred kilobytes or so for a
	 * need that, for most people, comes up once.
	 */
	async function tour() {
		hide();
		const { startTour } = await import('$lib/tour');
		startTour(page.url.pathname, () => settings.setTourSeen(true));
	}

	/**
	 * The report opens over the screen, without leaving it.
	 *
	 * The form asks for a capture of what is wrong: navigating would make exactly what needs photographing
	 * disappear. The panel, for its part, shrinks and lets the screen be seen again. Where you started from
	 * is noted in passing, so it does not have to be described.
	 */
	function openReport(kind: 'bug' | 'suggestion') {
		hide();
		report.show(kind, page.url.pathname);
	}

	/**
	 * Installing only appears here where it means something: not in the Capacitor application, not once put
	 * on the home screen, and not in a browser offering no path. It does however stay after a "later" — the
	 * banner keeps quiet for six months, but coming back of your own accord must stay possible the next day.
	 */
	const ACTIONS = $derived([
		{ key: 'tutorial', icon: GraduationCap, action: tour },
		...(install.canExplain
			? [{ key: 'install', icon: Download, action: () => explainInstall() }]
			: []),
		{ key: 'suggestion', icon: Lightbulb, action: () => openReport('suggestion') },
		{ key: 'bug', icon: Bug, action: () => openReport('bug') }
	]);

	function explainInstall() {
		hide();
		install.showDetails();
	}
</script>

<!--
	Help you find without looking for it.

	It is in the same place on every screen, at the top right of the content: that is where you look for it,
	and it does not take a sixth tab in a bar that holds five. The label is visible and not only read out by
	the screen reader — a question mark on its own is mistaken for decoration, and it is precisely the person
	who hesitates who needs the word.
-->
<button
	type="button"
	onclick={show}
	data-test-id="help"
	class="fl-press text-muted-foreground text-label hover:bg-muted flex min-h-[max(2.25rem,36px)] items-center gap-1.5 rounded-full px-3"
>
	<CircleQuestionMark size={18} aria-hidden="true" />
	{t('helpMenu.button')}
</button>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="help-menu-title"
	data-test-id="help-menu"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="help-menu-title" class="text-h2 pe-12 font-semibold">{t('helpMenu.button')}</h2>

		<ul class="mt-4 space-y-1">
			{#each ACTIONS as { key, icon: Icon, action } (key)}
				<li>
					<button
						type="button"
						onclick={action}
						data-test-id="help-menu-{key}"
						class="fl-press hover:bg-muted flex min-h-[max(3.5rem,56px)] w-full items-center gap-3 rounded-lg px-2 text-start"
					>
						<span
							class="bg-[var(--fl-primary-tint)] text-primary grid size-11 shrink-0 place-items-center rounded-full"
						>
							<Icon size={22} aria-hidden="true" />
						</span>
						<span class="text-label font-medium">{t(`helpMenu.${key}`)}</span>
					</button>
				</li>
			{/each}
		</ul>

		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="help-menu-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
