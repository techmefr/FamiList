<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { report } from '$stores/report.svelte';
	import { isReportKind } from '$domain/bug-report';
	import { Button } from '$lib/components/ui/button';
	import ReportForm from '$components/app/ReportForm.svelte';

	/**
	 * La page reste pour les liens directs — un message qui dit « signale-le ici » — mais ce n'est
	 * plus le chemin normal : le bouton d'aide ouvre un panneau, qui ne fait pas disparaître
	 * l'écran à photographier.
	 *
	 * Le brouillon est le même des deux côtés, d'où la lecture de l'état plutôt qu'une copie
	 * locale : arriver ici avec un signalement commencé dans le panneau le retrouve, au lieu d'en
	 * ouvrir un second à côté.
	 */
	const rawKind = page.url.searchParams.get('kind');
	const kind = isReportKind(rawKind) ? rawKind : 'bug';

	untrack(() => {
		if (!report.hasDraft) {
			report.kind = kind;
			report.path = page.url.searchParams.get('from') ?? '';
			report.sent = false;
		}
	});
</script>

<svelte:head>
	<title>{t(`bugReport.title.${report.kind}`)} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t(`bugReport.title.${report.kind}`)}</h1>
<p class="text-muted-foreground mt-2">{t(`bugReport.subtitle.${report.kind}`)}</p>

<div class="mt-6">
	<ReportForm />
</div>

{#if report.sent}
	<Button href="/" onclick={() => report.close()} class="fl-press mt-4">
		{t('bugReport.backHome')}
	</Button>
{/if}
