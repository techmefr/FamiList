<script lang="ts">
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { report } from '$stores/report.svelte';
	import { isReportKind } from '$domain/bug-report';
	import { Button } from '$lib/components/ui/button';
	import ReportForm from '$components/app/ReportForm.svelte';

	/**
	 * The page stays for direct links — a message saying "report it here" — but it is no longer the normal
	 * path: the help button opens a panel, which does not make the screen to be photographed disappear.
	 *
	 * The draft is the same on both sides, hence reading the state rather than a local copy: arriving here
	 * with a report started in the panel finds it again, instead of opening a second one alongside.
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
