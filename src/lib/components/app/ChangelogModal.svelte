<script lang="ts">
	import { i18n, t } from '$i18n/index.svelte';
	import { settings } from '$stores/settings.svelte';
	import { session } from '$stores/session.svelte';
	import { whatsNew } from '$stores/whats-new.svelte';
	import { NOTE_GROUPS, notesFor, releasesSince } from '$domain/changelog';
	import { RELEASES } from '$lib/changelog/releases';
	import { X } from '@lucide/svelte';
	import { version as currentVersion } from '../../../../package.json';

	let dialog = $state<HTMLDialogElement | null>(null);
	let heading = $state<HTMLHeadingElement | null>(null);

	/** "Ignorer cette fois" and Escape: gone until the next launch, without recording anything as seen. */
	let dismissed = $state(false);

	const unseen = $derived(releasesSince(RELEASES, settings.lastSeenChangelogVersion));

	/**
	 * Shown by itself once an account is approved, has already been through the welcome journey — the
	 * changelog is not what somebody mid-signup needs to read — and this device has not yet acknowledged the
	 * current version.
	 */
	const pending = $derived(
		session.isApproved &&
			settings.hasSeenWelcome &&
			settings.lastSeenChangelogVersion !== currentVersion &&
			unseen.length > 0 &&
			!dismissed
	);

	/**
	 * Asked for from the help menu, the modal becomes the whole history, newest first: somebody looking
	 * for "what changed lately" wants the latest on top, whereas after an update the releases they missed
	 * read best in the order they happened.
	 */
	const history = $derived(whatsNew.open);
	const shown = $derived(history ? RELEASES : unseen);

	const formatDate = (date: string) =>
		new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'long' }).format(new Date(`${date}T12:00:00`));

	/**
	 * The dialog element is driven imperatively rather than with `{#if}`: `showModal()` is what brings
	 * Escape-to-close, focus trapping and focus returning to the help button, none of which a conditionally
	 * rendered `<div>` gets for free. Focus goes to the title rather than the first button, so a screen
	 * reader starts with what this is instead of "Close".
	 */
	$effect(() => {
		if (!dialog) return;

		const visible = history || pending;
		if (visible && !dialog.open) {
			dialog.showModal();
			heading?.focus();
		}
		if (!visible && dialog.open) dialog.close();
	});

	/**
	 * Every way out goes through the dialog's `close` event, Escape included. Reading the history counts as
	 * having seen the current version: otherwise closing it would make the update modal pop up behind.
	 */
	function onClose() {
		if (history) {
			whatsNew.hide();
			settings.setChangelogSeen(currentVersion);
		} else {
			dismissed = true;
		}
	}

	function acknowledge() {
		settings.setChangelogSeen(currentVersion);
	}

	/**
	 * "Ignorer jusqu'à la prochaine mise à jour" has the same effect as acknowledging today: both record the
	 * current version as seen, so neither shows the modal again until a later release bumps the version.
	 * They are kept as two distinct actions because they answer two different questions from the person —
	 * "I've read this" versus "I don't want this now, and I don't want it again for this release".
	 */
	function dismissUntilNextUpdate() {
		settings.setChangelogSeen(currentVersion);
	}

	function close() {
		dialog?.close();
	}

	/**
	 * "Revoir tout le guide" reuses the existing per-screen tour rather than building a second, cross-route
	 * sequencer. `startTour` already falls back to the navigation overview (`NAV_STEPS`) for any path with
	 * no screen-specific steps — calling it with `/` is that overview, the closest thing this app has to a
	 * single "whole guide" tour, and it is exactly what plays on first sign-in.
	 *
	 * Seeing the changelog and choosing to also replay the guide still counts as having seen the changelog.
	 */
	async function replayTour() {
		settings.setChangelogSeen(currentVersion);
		close();
		const { startTour } = await import('$tour');
		startTour('/', () => settings.setTourSeen(true));
	}
</script>

<dialog
	bind:this={dialog}
	onclose={onClose}
	onclick={(event) => {
		if (event.target === dialog) close();
	}}
	class="fl-sheet"
	aria-labelledby="changelog-title"
	data-test-id="changelog-modal"
>
	<div
		class="bg-card relative max-h-[85dvh] overflow-y-auto rounded-t-2xl border px-4 pt-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2
			bind:this={heading}
			id="changelog-title"
			tabindex="-1"
			class="text-h2 pe-12 font-semibold outline-none"
		>
			{t('changelog.title')}
		</h2>
		<p class="text-body text-muted-foreground mt-1" data-test-id="changelog-current-version">
			{t('changelog.currentVersion', { version: currentVersion })}
		</p>

		<!--
			The whole sheet scrolls, not a box inside it: at the comfort text size a nested scroll area was left
			with two lines of room between the title and the buttons. The buttons stay pinned at the bottom.
		-->
		<section class="mt-2" aria-labelledby="changelog-title" data-test-id="changelog-releases">
			{#each shown as release (release.version)}
				{@const notes = notesFor(release, i18n.locale)}
				<article class="mt-4" data-test-class="changelog-release" data-version={release.version}>
					<h3 class="text-label font-semibold">
						{t('changelog.entryTitle', { version: release.version })}
						<span class="text-muted-foreground font-normal">· {formatDate(release.date)}</span>
					</h3>
					{#each NOTE_GROUPS as group (group)}
						{#if notes[group].length > 0}
							<h4 class="text-label text-primary mt-3 font-medium">{t(`changelog.groups.${group}`)}</h4>
							<ul class="text-body mt-1 list-disc space-y-1.5 ps-6" data-test-class="changelog-{group}">
								{#each notes[group] as item, index (index)}
									<li>{item}</li>
								{/each}
							</ul>
						{/if}
					{/each}
				</article>
			{/each}
		</section>

		<div class="bg-card sticky bottom-0 -mx-4 mt-4 flex flex-col gap-2 border-t px-4 pt-3 pb-4">
			{#if history}
				<button
					type="button"
					onclick={close}
					data-test-id="changelog-done"
					class="fl-press bg-primary text-primary-foreground text-label flex min-h-[max(2.75rem,44px)] w-full items-center justify-center rounded-lg font-medium"
				>
					{t('common.close')}
				</button>
			{:else}
				<button
					type="button"
					onclick={acknowledge}
					data-test-id="changelog-acknowledge"
					class="fl-press bg-primary text-primary-foreground text-label flex min-h-[max(2.75rem,44px)] w-full items-center justify-center rounded-lg font-medium"
				>
					{t('changelog.acknowledge')}
				</button>
			{/if}

			<button
				type="button"
				onclick={replayTour}
				data-test-id="changelog-replay-tour"
				class="fl-press text-primary hover:bg-muted text-label flex min-h-[max(2.75rem,44px)] w-full items-center justify-center rounded-lg font-medium"
			>
				{t('changelog.replayTour')}
			</button>

			{#if !history}
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						onclick={close}
						data-test-id="changelog-dismiss-once"
						class="fl-press text-muted-foreground hover:bg-muted text-caption flex min-h-[max(2.75rem,44px)] flex-1 items-center justify-center rounded-lg px-2"
					>
						{t('changelog.dismissOnce')}
					</button>

					<button
						type="button"
						onclick={dismissUntilNextUpdate}
						data-test-id="changelog-dismiss-until-next-update"
						class="fl-press text-muted-foreground hover:bg-muted text-caption flex min-h-[max(2.75rem,44px)] flex-1 items-center justify-center rounded-lg px-2"
					>
						{t('changelog.dismissUntilNextUpdate')}
					</button>
				</div>
			{/if}
		</div>

		<button
			type="button"
			onclick={close}
			aria-label={t('common.close')}
			data-test-id="changelog-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
