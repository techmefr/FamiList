<script lang="ts">
	import { supabase } from '$db/supabase';
	import { t } from '$lib/i18n/index.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { report } from '$stores/report.svelte';
	import { SCREENSHOT_MAX_DIM, SCREENSHOT_MAX_BYTES, fitWithin } from '$domain/screenshot';
	import { readReportOutcome } from '$domain/report-outcome';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import IconField from '$components/app/IconField.svelte';
	import { Camera, ImageOff, MessageSquareWarning } from '@lucide/svelte';

	let input = $state<HTMLInputElement | null>(null);
	let erreur = $state('');
	let occupe = $state(false);

	/**
	 * Réduite ici, dans le navigateur, avant de partir : une capture de téléphone pèse plusieurs
	 * mégaoctets, la colonne en base plafonne à 1,5 Mo de texte. `createImageBitmap` applique aussi
	 * l'orientation EXIF, sans quoi une capture prise en portrait ressort couchée.
	 */
	async function reduire(fichier: File): Promise<string> {
		const source = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
		const { width, height } = fitWithin(source.width, source.height, SCREENSHOT_MAX_DIM);

		const toile = document.createElement('canvas');
		toile.width = width;
		toile.height = height;

		const pinceau = toile.getContext('2d');
		if (!pinceau) throw new Error('canvas indisponible');

		pinceau.drawImage(source, 0, 0, width, height);
		source.close();

		return toile.toDataURL('image/jpeg', 0.75);
	}

	async function choisir(event: Event) {
		const fichier = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!fichier) return;

		erreur = '';

		if (fichier.size > SCREENSHOT_MAX_BYTES) {
			erreur = t('bugReport.tooBig');
			return;
		}

		try {
			report.screenshot = await reduire(fichier);
		} catch {
			erreur = t('bugReport.captureFailed');
		} finally {
			if (input) input.value = '';
		}
	}

	async function envoyer(event: SubmitEvent) {
		event.preventDefault();
		if (!report.description.trim()) return;

		erreur = '';
		occupe = true;

		const { data, error } = await supabase.rpc('submit_bug_report', {
			description: report.description.trim(),
			screenshot: report.screenshot ?? '',
			path: report.path,
			user_agent: navigator.userAgent,
			kind: report.kind
		});

		occupe = false;

		if (error) {
			erreur = error.message;
			feedback.play('error');
			return;
		}

		// Un plafond atteint n'arrive pas par une exception : Postgres ne parlerait qu'anglais, et
		// la personne a besoin de savoir si elle doit attendre ou retirer sa capture.
		const issue = readReportOutcome(data);

		if (issue.errorKey) {
			erreur = t(issue.errorKey);
			feedback.play('error');
			return;
		}

		feedback.play('success');
		report.number = issue.number;
		report.sent = true;
	}
</script>

{#if report.sent}
	<p class="text-primary" role="status" data-test-id="bug-success">
		{t('bugReport.success')}
	</p>

	<!--
		Le numéro court est la seule référence que la personne puisse citer si elle nous réécrit :
		l'identifiant de la ligne est un UUID, illisible et inutilisable à l'oral. Il n'apparaît que
		si la base a su le rendre — un envoi abouti ne se transforme pas en échec pour si peu.
	-->
	{#if report.number !== null}
		<p class="text-muted-foreground text-label mt-2" data-test-id="bug-reference">
			{t('bugReport.reference', { number: report.number })}
		</p>
	{/if}
{:else}
	<form onsubmit={envoyer} class="space-y-4" data-test-id="bug-form">
		<div>
			<Label for="bug-description">{t('bugReport.description')}</Label>
			<IconField icon={MessageSquareWarning} align="top">
				<textarea
					id="bug-description"
					bind:value={report.description}
					rows="5"
					required
					placeholder={t(`bugReport.descriptionPlaceholder.${report.kind}`)}
					data-test-id="bug-description"
					class="border-input bg-background w-full rounded-md border p-2"
				></textarea>
			</IconField>
		</div>

		{#if report.screenshot}
			<div class="relative w-fit">
				<img
					src={report.screenshot}
					alt={t('bugReport.screenshotAlt')}
					class="max-h-48 rounded-lg border"
					data-test-id="bug-screenshot-preview"
				/>
				<Button
					type="button"
					variant="outline"
					onclick={() => (report.screenshot = null)}
					data-test-id="bug-screenshot-remove"
					class="fl-press absolute end-2 top-2"
				>
					<ImageOff size={16} aria-hidden="true" />
					{t('bugReport.screenshotRemove')}
				</Button>
			</div>
		{:else}
			<Button
				type="button"
				variant="outline"
				onclick={() => input?.click()}
				data-test-id="bug-screenshot-add"
				class="fl-press"
			>
				<Camera size={18} aria-hidden="true" />
				{t('bugReport.screenshotAdd')}
			</Button>
		{/if}

		<input
			bind:this={input}
			type="file"
			accept="image/*"
			onchange={choisir}
			aria-label={t('bugReport.screenshotAdd')}
			data-test-id="bug-screenshot-input"
			class="sr-only"
		/>

		{#if erreur}
			<p class="text-destructive" role="alert" data-test-id="bug-error">{erreur}</p>
		{/if}

		<Button type="submit" disabled={occupe} data-test-id="bug-submit" class="fl-press">
			{t('bugReport.submit')}
		</Button>
	</form>
{/if}
