<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import ConnectionSetup from '$components/app/ConnectionSetup.svelte';
</script>

<svelte:head>
	<title>{t('connection.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('connection.title')}</h1>
<p class="text-muted-foreground mt-1">{t('connection.subtitle')}</p>

<div class="mt-6">
	<ConnectionSetup />
</div>
