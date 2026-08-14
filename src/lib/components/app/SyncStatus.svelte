<script lang="ts">
	import { sync } from '$lib/sync/index.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { CloudOff, TriangleAlert } from '@lucide/svelte';

	/**
	 * Rien à afficher quand tout va bien : l'application est faite pour être utilisée en marchant,
	 * un bandeau permanent n'apporterait qu'un encombrement. On ne parle que des deux cas où
	 * l'utilisateur a besoin de savoir que ce qu'il fait n'est pas encore parti.
	 */
	const trouble = $derived(sync.state === 'offline' || sync.state === 'error');
</script>

{#if trouble}
	<p
		class="text-caption bg-card text-muted-foreground flex items-center justify-center gap-2 border-b px-4 py-2"
		role="status"
		data-test="sync-status"
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
