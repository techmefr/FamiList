<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n/index.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { Bug } from '@lucide/svelte';

	/**
	 * L'écran ouvert part avec la personne, en paramètre d'URL : c'est ce qui évite de lui demander
	 * de redécrire où elle se trouvait, et ce qui donne au signalement de quoi être reproduit.
	 */
	function signaler() {
		feedback.play('tap');
		goto(`/report?from=${encodeURIComponent(page.url.pathname)}`);
	}
</script>

<button
	type="button"
	onclick={signaler}
	data-test-id="report-bug"
	class="fl-press text-muted-foreground text-label hover:bg-muted flex min-h-[max(2.25rem,36px)] items-center gap-1.5 rounded-full px-3"
>
	<Bug size={18} aria-hidden="true" />
	{t('bugReport.button')}
</button>
