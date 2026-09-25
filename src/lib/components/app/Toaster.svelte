<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { toasts } from '$stores/toast.svelte';
	import { CircleAlert, CircleCheck, X } from '@lucide/svelte';
</script>

<div
	class="fl-above-nav pointer-events-none z-50 flex flex-col gap-2 md:start-auto md:w-96"
	aria-live="polite"
	data-test-id="toaster"
>
	{#each toasts.items as toast (toast.id)}
		<div
			role={toast.tone === 'error' ? 'alert' : 'status'}
			data-test-class="toast"
			data-tone={toast.tone}
			class="bg-card text-card-foreground pointer-events-auto flex items-center gap-3 rounded-xl border p-3 shadow-lg {toast.tone ===
			'error'
				? 'border-destructive'
				: ''}"
		>
			{#if toast.tone === 'error'}
				<CircleAlert size={22} class="text-destructive shrink-0" aria-hidden="true" />
			{:else}
				<CircleCheck size={22} class="text-primary shrink-0" aria-hidden="true" />
			{/if}
			<p class="text-label min-w-0 flex-1">{toast.message}</p>
			<button
				type="button"
				onclick={() => toasts.dismiss(toast.id)}
				aria-label={t('common.close')}
				data-test-class="toast-close"
				class="fl-press text-muted-foreground hover:bg-muted grid min-h-[max(2.75rem,44px)] min-w-[44px] shrink-0 place-items-center rounded-full"
			>
				<X size={20} aria-hidden="true" />
			</button>
		</div>
	{/each}
</div>
