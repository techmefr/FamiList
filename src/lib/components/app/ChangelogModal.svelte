<script lang="ts">
	import { page } from '$app/state';
	import { t, tList } from '$i18n/index.svelte';
	import { settings } from '$stores/settings.svelte';
	import { session } from '$stores/session.svelte';
	import { entriesSince } from '$domain/changelog';
	import { X } from '@lucide/svelte';
	import { version as currentVersion } from '../../../../package.json';

	let dialog = $state<HTMLDialogElement | null>(null);

	const entries = $derived(entriesSince(settings.lastSeenChangelogVersion));

	/**
	 * Shown once an account is approved, has already been through the welcome journey — the changelog is
	 * not what somebody mid-signup needs to read — and this device has not yet acknowledged the current
	 * version.
	 *
	 * The dialog element is driven imperatively rather than with `{#if}`: `showModal()` is what brings
	 * Escape-to-close and focus trapping, neither of which a conditionally rendered `<div>` gets for free.
	 */
	$effect(() => {
		if (!dialog) return;

		const shouldShow =
			session.isApproved &&
			settings.hasSeenWelcome &&
			settings.lastSeenChangelogVersion !== currentVersion &&
			entries.length > 0;

		if (shouldShow && !dialog.open) dialog.showModal();
		if (!shouldShow && dialog.open) dialog.close();
	});

	function acknowledge() {
		settings.setChangelogSeen(currentVersion);
	}

	/**
	 * "Ignorer jusqu'à la prochaine mise à jour" has the same effect as acknowledging today: both record the
	 * current version as seen, so neither shows the modal again until a later release bumps the version.
	 * They are kept as two distinct actions because they answer two different questions from the person —
	 * "I've read this" versus "I don't want this now, and I don't want it again for this release" — even
	 * though, with only one version tracked per device, there is currently nothing further to defer.
	 */
	function dismissUntilNextUpdate() {
		settings.setChangelogSeen(currentVersion);
	}

	/** Leaves `lastSeenChangelogVersion` untouched: the modal returns on the next launch. */
	function dismissOnce() {
		dialog?.close();
	}

	/**
	 * "Revoir tout le guide" reuses the existing per-screen tour rather than building a second, cross-route
	 * sequencer. `startTour` already falls back to the navigation overview (`NAV_STEPS`) for any path with
	 * no screen-specific steps — calling it with `/` is that overview, the closest thing this app has to a
	 * single "whole guide" tour, and it is exactly what plays on first sign-in. A true multi-screen sequence
	 * would need real navigation between each step, which driver.js does not drive on its own; scope for
	 * that is left for if a later release actually needs it.
	 *
	 * Seeing the changelog and choosing to also replay the guide still counts as having seen the changelog.
	 */
	async function replayTour() {
		settings.setChangelogSeen(currentVersion);
		const { startTour } = await import('$tour');
		startTour('/', () => settings.setTourSeen(true));
	}
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) dismissOnce();
	}}
	class="fl-sheet"
	aria-labelledby="changelog-title"
	data-test-id="changelog-modal"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="changelog-title" class="text-h2 pe-12 font-semibold">{t('changelog.title')}</h2>

		{#each entries as entry (entry.key)}
			<div class="mt-4">
				<p class="text-label font-medium">{t('changelog.entryTitle', { version: entry.version })}</p>
				<ul class="text-caption text-muted-foreground mt-2 list-disc space-y-1 ps-5">
					{#each tList(`changelog.${entry.key}.items`) as item (item)}
						<li>{item}</li>
					{/each}
				</ul>
			</div>
		{/each}

		<div class="mt-4 flex flex-col gap-2">
			<button
				type="button"
				onclick={acknowledge}
				data-test-id="changelog-acknowledge"
				class="fl-press bg-primary text-primary-foreground text-label flex min-h-[max(2.75rem,44px)] w-full items-center justify-center rounded-lg font-medium"
			>
				{t('changelog.acknowledge')}
			</button>

			<button
				type="button"
				onclick={replayTour}
				data-test-id="changelog-replay-tour"
				class="fl-press text-primary hover:bg-muted flex min-h-[max(2.75rem,44px)] w-full items-center justify-center rounded-lg text-label font-medium"
			>
				{t('changelog.replayTour')}
			</button>

			<div class="flex gap-2">
				<button
					type="button"
					onclick={dismissOnce}
					data-test-id="changelog-dismiss-once"
					class="fl-press text-muted-foreground hover:bg-muted text-caption flex min-h-[max(2.25rem,36px)] flex-1 items-center justify-center rounded-lg"
				>
					{t('changelog.dismissOnce')}
				</button>

				<button
					type="button"
					onclick={dismissUntilNextUpdate}
					data-test-id="changelog-dismiss-until-next-update"
					class="fl-press text-muted-foreground hover:bg-muted text-caption flex min-h-[max(2.25rem,36px)] flex-1 items-center justify-center rounded-lg"
				>
					{t('changelog.dismissUntilNextUpdate')}
				</button>
			</div>
		</div>

		<button
			type="button"
			onclick={dismissOnce}
			aria-label={t('common.close')}
			data-test-id="changelog-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
