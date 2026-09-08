<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import AuthForm from '$components/app/AuthForm.svelte';
</script>

<svelte:head>
	<title>{t('auth.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('auth.title')}</h1>

<AuthForm />
