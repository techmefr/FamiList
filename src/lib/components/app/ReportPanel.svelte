<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import { report } from '$stores/report.svelte';
	import { settings } from '$stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import ReportForm from '$components/app/ReportForm.svelte';
	import { ChevronDown, ChevronUp, X } from '@lucide/svelte';

	const titre = $derived(t(`bugReport.title.${report.kind}`));

	/**
	 * Échap réduit, il ne ferme pas.
	 *
	 * C'est l'inverse de la convention des boîtes de dialogue, et c'est voulu : ici le geste
	 * attendu est « laisse-moi revoir mon écran », pas « jette ce que je viens d'écrire ». Fermer
	 * reste possible, par un bouton qu'on ne presse pas par réflexe.
	 */
	function auClavier(event: KeyboardEvent) {
		if (event.key === 'Escape' && report.open && !report.minimized) {
			event.preventDefault();
			report.minimize();
		}
	}
</script>

<svelte:window onkeydown={auClavier} />

{#if report.open}
	<!--
		Un panneau, pas une page, et surtout pas un dialogue modal.

		Le formulaire demande une capture de l'écran où le problème s'est produit. Une page le
		remplace, un modal le rend inerte derrière un voile : dans les deux cas, ce qu'il faut
		photographier a disparu au moment précis où on veut le montrer. D'où `aria-modal="false"`
		et l'absence de voile — le reste de l'écran continue de vivre, on peut faire défiler,
		rouvrir un menu, reproduire le bug pendant que le panneau attend.

		Il se pose au-dessus de la barre de navigation (`--fl-navbar-h`), qui est fixée en bas sur
		téléphone : sans ça, le bouton d'envoi tomberait sous les onglets.
	-->
	<div
		role="dialog"
		aria-modal="false"
		aria-labelledby="report-title"
		data-test-id="report-panel"
		data-minimized={report.minimized ? 'true' : 'false'}
		class="bg-card shadow-fl-3 fixed inset-x-0 bottom-[var(--fl-navbar-h,0px)] z-20 mx-auto w-full max-w-xl rounded-t-2xl border md:inset-x-auto md:end-4 md:bottom-4 md:mx-0 md:rounded-2xl"
		class:fl-rise={settings.animates && !report.minimized}
	>
		<div class="flex items-center gap-2 px-4 py-3">
			<h2 id="report-title" class="text-h2 min-w-0 flex-1 truncate font-semibold">
				{titre}
			</h2>

			{#if report.minimized}
				<Button
					variant="outline"
					onclick={() => report.restore()}
					data-test-id="report-restore"
					class="fl-press"
				>
					<ChevronUp size={18} aria-hidden="true" />
					<!--
						Sur téléphone, le mot cède la place au titre, qui se faisait couper. La flèche
						suffit à ce moment-là : le panneau réduit ne propose que ce geste-là. Le libellé
						reste lu par la synthèse vocale.
					-->
					<span class="max-md:sr-only">{t('bugReport.resume')}</span>
				</Button>
			{:else}
				<Button
					variant="outline"
					onclick={() => report.minimize()}
					data-test-id="report-minimize"
					class="fl-press"
				>
					<ChevronDown size={18} aria-hidden="true" />
					<span class="max-md:sr-only">{t('bugReport.minimize')}</span>
				</Button>
			{/if}

			<button
				type="button"
				onclick={() => report.close()}
				aria-label={t('common.close')}
				data-test-id="report-close"
				class="fl-press text-muted-foreground hover:bg-muted grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
			>
				<X size={22} aria-hidden="true" />
			</button>
		</div>

		{#if report.minimized}
			<!--
				Réduit, le panneau ne garde qu'une ligne : de quoi savoir qu'un signalement est en
				cours, et de quoi le rouvrir. Le brouillon n'est pas affiché mais il est là — c'est
				l'état, pas le composant, qui le tient.
			-->
			<p class="text-muted-foreground text-caption px-4 pb-3" data-test-id="report-minimized-hint">
				{t('bugReport.minimizedHint')}
			</p>
		{:else}
			<div class="max-h-[60dvh] overflow-y-auto px-4 pb-4">
				<p class="text-muted-foreground text-caption">
					{t(`bugReport.subtitle.${report.kind}`)}
				</p>

				<div class="mt-4">
					<ReportForm />
				</div>

				{#if report.sent}
					<Button onclick={() => report.close()} class="fl-press mt-4" data-test-id="report-done">
						{t('common.close')}
					</Button>
				{/if}
			</div>
		{/if}
	</div>
{/if}
