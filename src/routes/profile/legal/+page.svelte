<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { LEGAL_DOCUMENTS, legalPath } from '$domain/legal';
	import { PRIVACY_REQUEST_PATH } from '$domain/privacy-request';
	import { categoryById } from '$domain/settings-categories';
	import * as Card from '$components/ui/card';
	import SettingsRow from '$components/app/SettingsRow.svelte';
	import { Mail, Scale } from '@lucide/svelte';

	const category = categoryById('legal');
</script>

<svelte:head>
	<title>{t(category.title)} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t(category.title)}</h1>

<Card.Root class="mt-6 gap-0 py-0">
	<ul class="divide-border divide-y">
		{#each LEGAL_DOCUMENTS as id (id)}
			<li id="setting-legal-{id}" tabindex="-1" class="fl-setting">
				<SettingsRow href={legalPath(id)} icon={Scale} title={t(`legal.${id}`)} testId="go-legal-{id}" />
			</li>
		{/each}
		<li id="setting-privacy-request" tabindex="-1" class="fl-setting">
			<SettingsRow
				href={PRIVACY_REQUEST_PATH}
				icon={Mail}
				title={t('legal.makeRequest')}
				testId="go-privacy-request"
			/>
		</li>
	</ul>
</Card.Root>
