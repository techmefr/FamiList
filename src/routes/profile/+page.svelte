<script lang="ts">
	import type { Component } from 'svelte';
	import { settings, FONT_PRESETS, FONT_SCALE_PRESETS } from '$stores/settings.svelte';
	import { t } from '$i18n/index.svelte';
	import { session } from '$stores/session.svelte';
	import {
		searchSettings,
		settingHref,
		categoryById,
		visibleCategories,
		type SettingsCategoryId
	} from '$domain/settings-categories';
	import * as Card from '$components/ui/card';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import IconField from '$components/app/IconField.svelte';
	import SettingsRow from '$components/app/SettingsRow.svelte';
	import InstallEntry from '$components/app/InstallEntry.svelte';
	import {
		ALargeSmall,
		Images,
		LifeBuoy,
		Monitor,
		PlugZap,
		Scale,
		Search,
		ShieldCheck,
		Sparkles,
		UserCog,
		UserRound,
		Users,
		Volume2
	} from '@lucide/svelte';

	const ICONS: Record<SettingsCategoryId, Component> = {
		account: UserRound,
		household: Users,
		display: Monitor,
		feedback: Volume2,
		security: ShieldCheck,
		ai: Sparkles,
		images: Images,
		connection: PlugZap,
		help: LifeBuoy,
		legal: Scale,
		admin: UserCog
	};

	const categories = $derived(visibleCategories(session.isAdmin));

	let query = $state('');
	const matches = $derived(searchSettings(query, categories, (key) => t(key)));
	const searching = $derived(query.trim() !== '');

	const display = categoryById('display');
	const readingSummary = $derived(
		[
			FONT_SCALE_PRESETS.find((preset) => preset.id === settings.fontScaleId)?.label,
			FONT_PRESETS.find((preset) => preset.id === settings.fontId)?.label
		]
			.filter((label): label is string => Boolean(label))
			.map((label) => t(label))
			.join(' · ')
	);
</script>

<svelte:head>
	<title>{t('profile.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('profile.title')}</h1>

<!--
	Text size and font sit above everything, search included: the people who need them cannot read the rest
	of the screen until they are set, so they get there in one tap without having to find the right row.
-->
<Card.Root class="mt-6 gap-0 py-0">
	<SettingsRow
		href={settingHref(display, 'setting-text-size')}
		icon={ALargeSmall}
		title={t('profile.readingShortcut')}
		hint={readingSummary}
		testId="profile-reading-shortcut"
	/>
</Card.Root>

<div role="search" class="mt-6">
	<Label for="settings-search">{t('profile.search')}</Label>
	<IconField icon={Search}>
		<Input
			id="settings-search"
			type="search"
			bind:value={query}
			autocomplete="off"
			data-test-id="settings-search"
		/>
	</IconField>
</div>

{#if searching}
	<h2 class="sr-only">{t('profile.searchResults')}</h2>
	{#if matches.length > 0}
		<Card.Root class="mt-4 gap-0 py-0">
			<ul class="divide-border divide-y" data-test-id="settings-results">
				{#each matches as match (match.key)}
					<li>
						<SettingsRow
							href={match.href}
							title={match.label}
							hint={match.category !== match.label ? match.category : undefined}
							testClass="settings-result"
						/>
					</li>
				{/each}
			</ul>
		</Card.Root>
	{:else}
		<p class="text-muted-foreground text-label mt-4" data-test-id="settings-no-result">
			{t('profile.searchEmpty', { query: query.trim() })}
		</p>
	{/if}
{:else}
	<Card.Root class="mt-4 gap-0 py-0">
		<ul class="divide-border divide-y" data-test-id="profile-categories">
			{#each categories as category (category.id)}
				<li>
					<SettingsRow
						href={category.route}
						icon={ICONS[category.id]}
						title={t(category.title)}
						hint={t(category.hint)}
						testId="profile-category-{category.id}"
					/>
				</li>
			{/each}
		</ul>
	</Card.Root>
{/if}

<p class="sr-only" role="status">
	{searching && matches.length === 0 ? t('profile.searchEmpty', { query: query.trim() }) : ''}
</p>

<InstallEntry />
