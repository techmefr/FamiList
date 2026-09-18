<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { sync } from '$sync/index.svelte';
	import { motionMs } from '$stores/settings.svelte';
	import { t } from '$i18n/index.svelte';
	import { CloudOff, TriangleAlert } from '@lucide/svelte';

	/**
	 * Nothing to show when all is well: the application is made to be used while walking, and a permanent
	 * banner would only add clutter. We speak only of the two cases where the user needs to know that what
	 * they are doing has not left yet.
	 *
	 * The banner unfolds rather than appearing at once: popping up pushes the page down under the finger, and
	 * makes people miss the target they were aiming at.
	 */
	const trouble = $derived(sync.state === 'offline' || sync.state === 'error');
</script>

{#if trouble}
	<p
		transition:slide={{ duration: motionMs(220), easing: cubicOut }}
		class="text-caption bg-card text-muted-foreground flex items-center justify-center gap-2 border-b px-4 py-2"
		role="status"
		data-test-id="sync-status"
	>
		{#if sync.state === 'offline'}
			<CloudOff size={16} aria-hidden="true" />
			{t('sync.offline')}
		{:else}
			<TriangleAlert size={16} class="text-destructive" aria-hidden="true" />
			{t('sync.error')}
		{/if}
	</p>
{/if}
