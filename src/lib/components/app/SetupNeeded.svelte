<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import ConnectionSetup from './ConnectionSetup.svelte';
	import OfflineLists from './OfflineLists.svelte';

	/**
	 * What an instance shows when nobody has told it where its database is.
	 *
	 * The state is normal, not exceptional: it is what a container started without its variables does, and
	 * it is the first screen whoever installs this will see if they got something wrong. So it says what is
	 * missing and where to put it, rather than staying blank while the console fills with failed requests —
	 * and, since #257, lets it be typed in right here instead of requiring a rebuild.
	 *
	 * `OfflineLists` below it means this is no longer a dead end: connecting is offered, not required.
	 * Checklists made here stay on the device — see the store's own comment for why they need no migration
	 * the day a backend is connected.
	 */
</script>

<main class="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center-safe gap-3 px-4 py-10">
	<h1 class="text-h1 font-semibold" data-test-id="setup-title">{t('setup.title')}</h1>
	<p>{t('setup.body')}</p>
	<p class="text-muted-foreground text-caption">{t('setup.hint')}</p>

	<div class="mt-4">
		<ConnectionSetup />
	</div>

	<OfflineLists />
</main>
