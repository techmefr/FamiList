<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import AdminPanel from '$components/app/AdminPanel.svelte';
</script>

<svelte:head>
	<title>{t('admin.title')} — {t('app.name')}</title>
</svelte:head>

<AdminPanel />
