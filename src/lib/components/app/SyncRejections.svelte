<script lang="ts">
	import { sync } from '$sync/index.svelte';
	import { rejectedEntity } from '$sync/rejections';
	import { t } from '$i18n/index.svelte';
	import { TriangleAlert } from '@lucide/svelte';
</script>

<div role="alert" data-test-id="sync-rejections">
	{#each sync.rejections as rejection (rejection.key)}
		<div
			class="bg-card flex flex-wrap items-center justify-center gap-2 border-b px-4 py-2"
			data-test-id="sync-rejection"
		>
			<p class="text-caption flex items-center gap-2">
				<TriangleAlert size={16} class="text-destructive" aria-hidden="true" />
				{t('sync.rejected.message', {
					what: t(`sync.rejected.entities.${rejectedEntity(rejection)}`)
				})}
			</p>
			<div class="flex gap-2">
				<button
					type="button"
					class="text-caption min-h-11 min-w-11 rounded-md border px-3 font-medium"
					data-test-id="sync-rejection-retry"
					onclick={() => void sync.retry(rejection.key)}
				>
					{t('sync.rejected.retry')}
				</button>
				<button
					type="button"
					class="text-caption text-muted-foreground min-h-11 min-w-11 rounded-md px-3"
					data-test-id="sync-rejection-ignore"
					onclick={() => void sync.dismiss(rejection.key)}
				>
					{t('sync.rejected.ignore')}
				</button>
			</div>
		</div>
	{/each}
</div>
