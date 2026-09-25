<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '$i18n/index.svelte';
	import { settings } from '$stores/settings.svelte';
	import { categoryById } from '$domain/settings-categories';
	import * as Card from '$components/ui/card';
	import { Button } from '$components/ui/button';

	const category = categoryById('help');

	/**
	 * Restarting the tour means clearing the marker and going back through the home screen: the layout deals
	 * with the rest. Triggering it from here would mean duplicating the same condition in two places, with
	 * the risk that they one day stop saying the same thing.
	 */
	function replayTour() {
		settings.setTourSeen(false);
		goto('/');
	}
</script>

<svelte:head>
	<title>{t(category.title)} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t(category.title)}</h1>

<Card.Root class="mt-6">
	<Card.Content>
		<div id="setting-tour" tabindex="-1" class="fl-setting flex flex-wrap items-center justify-between gap-4">
			<p class="text-muted-foreground text-label">{t('profile.tourHint')}</p>
			<Button onclick={replayTour} data-test-id="replay-tour" class="fl-press">
				{t('profile.replayTour')}
			</Button>
		</div>
	</Card.Content>
</Card.Root>
