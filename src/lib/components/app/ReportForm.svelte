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
	let errorText = $state('');
	let busy = $state(false);

	/**
	 * Shrunk here, in the browser, before leaving: a phone capture weighs several megabytes, and the database
	 * column caps at 1.5 MB of text. `createImageBitmap` also applies the EXIF orientation, without which a
	 * capture taken in portrait comes out lying down.
	 */
	async function shrink(file: File): Promise<string> {
		const source = await createImageBitmap(file, { imageOrientation: 'from-image' });
		const { width, height } = fitWithin(source.width, source.height, SCREENSHOT_MAX_DIM);

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;

		const pinceau = canvas.getContext('2d');
		if (!pinceau) throw new Error('canvas indisponible');

		pinceau.drawImage(source, 0, 0, width, height);
		source.close();

		return canvas.toDataURL('image/jpeg', 0.75);
	}

	async function choose(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;

		errorText = '';

		if (file.size > SCREENSHOT_MAX_BYTES) {
			errorText = t('bugReport.tooBig');
			return;
		}

		try {
			report.screenshot = await shrink(file);
		} catch {
			errorText = t('bugReport.captureFailed');
		} finally {
			if (input) input.value = '';
		}
	}

	async function send(event: SubmitEvent) {
		event.preventDefault();
		if (!report.description.trim()) return;

		errorText = '';
		busy = true;

		const { data, error } = await supabase.rpc('submit_bug_report', {
			description: report.description.trim(),
			screenshot: report.screenshot ?? '',
			path: report.path,
			user_agent: navigator.userAgent,
			kind: report.kind
		});

		busy = false;

		if (error) {
			errorText = error.message;
			feedback.play('error');
			return;
		}

		// A cap reached does not arrive as an exception: Postgres would only speak English, and the person needs
		// to know whether to wait or to remove their capture.
		const issue = readReportOutcome(data);

		if (issue.errorKey) {
			errorText = t(issue.errorKey);
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
		The short number is the only reference the person can quote if they write back to us: the row identifier
		is a UUID, unreadable and unusable out loud. It only appears if the database managed to return it — a
		successful send does not turn into a failure over so little.
	-->
	{#if report.number !== null}
		<p class="text-muted-foreground text-label mt-2" data-test-id="bug-reference">
			{t('bugReport.reference', { number: report.number })}
		</p>
	{/if}
{:else}
	<form onsubmit={send} class="space-y-4" data-test-id="bug-form">
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
			onchange={choose}
			aria-label={t('bugReport.screenshotAdd')}
			data-test-id="bug-screenshot-input"
			class="sr-only"
		/>

		{#if errorText}
			<p class="text-destructive" role="alert" data-test-id="bug-error">{errorText}</p>
		{/if}

		<Button type="submit" disabled={busy} data-test-id="bug-submit" class="fl-press">
			{t('bugReport.submit')}
		</Button>
	</form>
{/if}
