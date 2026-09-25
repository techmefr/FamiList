<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '$i18n/index.svelte';
	import { ai } from '$stores/ai.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { Button } from '$components/ui/button';
	import { Sparkles } from '@lucide/svelte';

	/**
	 * From a chat screen (#211), asking the AI for a recipe opens the "Create a recipe" chat itself (#313):
	 * the result then lands in the editable form like every other source, instead of being saved from here.
	 */
	async function open() {
		feedback.play('tap');
		await goto('/recipes/new', { state: { recipeSource: 'ai' } });
	}
</script>

{#if ai.configured}
	<Button variant="outline" onclick={open} data-test-id="ai-request-open">
		<Sparkles size={18} aria-hidden="true" />
		{t('ai.request.trigger')}
	</Button>
{/if}
