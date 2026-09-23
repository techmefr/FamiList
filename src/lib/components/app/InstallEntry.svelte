<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { install } from '$stores/install.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import * as Card from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import { Download } from '@lucide/svelte';

	function trigger() {
		feedback.play('tap');
		if (install.route === 'prompt') void install.accept();
		else install.showDetails();
	}
</script>

<!--
	The profile page's permanent fallback, next to the banner rather than instead of it: `beforeinstallprompt`
	is inconsistent across browsers and even across accounts on the same device, so the banner's own timing
	(third opening, six months of silence after a refusal) cannot be the only way in. This entry stays as
	long as installing still means anything — see `canOfferManualInstall`.
-->
{#if install.canInstallManually}
	<Card.Root class="mt-6">
		<Card.Header>
			<Card.Title class="text-h2">{t('install.title')}</Card.Title>
		</Card.Header>
		<Card.Content class="flex flex-wrap items-center justify-between gap-4">
			<p class="text-muted-foreground text-label">{t('install.body')}</p>
			<Button onclick={trigger} data-test-id="install-manual" class="fl-press">
				<Download size={18} aria-hidden="true" />
				{install.route === 'prompt' ? t('install.action') : t('install.how')}
			</Button>
		</Card.Content>
	</Card.Root>
{/if}
