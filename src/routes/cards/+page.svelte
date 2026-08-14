<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
</script>

<svelte:head>
	<title>{t('cards.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('cards.title')}</h1>
<p class="text-muted-foreground text-label mt-2">{t('common.comingSoon')}</p>
