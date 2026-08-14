<script lang="ts">
	import {
		settings,
		ACCENT_PRESETS,
		FONT_SCALE_PRESETS,
		type Theme
	} from '$stores/settings.svelte';
	import { i18n, t, LOCALES, type Locale } from '$lib/i18n/index.svelte';
	import { session } from '$stores/session.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { Check } from '@lucide/svelte';

	const themes: Theme[] = ['light', 'dark', 'system'];

	const optionClass =
		'border-input has-checked:border-primary has-checked:bg-[var(--fl-primary-tint)] ' +
		'has-checked:text-primary flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2';
</script>

<svelte:head>
	<title>{t('profile.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('profile.title')}</h1>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('profile.account')}</Card.Title>
	</Card.Header>
	<Card.Content class="flex flex-wrap items-center justify-between gap-4">
		<p class="text-muted-foreground text-label">
			{t('profile.signedInAs', { email: session.user?.email ?? '' })}
		</p>
		<Button variant="outline" onclick={() => session.signOut()} data-test="sign-out">
			{t('auth.signOut')}
		</Button>
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('profile.appearance')}</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-8">
		<fieldset>
			<legend class="text-label mb-2 font-medium">{t('profile.theme')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each themes as value (value)}
					<Label class={optionClass}>
						<input
							type="radio"
							name="theme"
							{value}
							checked={settings.theme === value}
							onchange={() => settings.setTheme(value)}
							data-test="theme-{value}"
							class="sr-only"
						/>
						{t(`theme.${value}`)}
					</Label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend class="text-label mb-2 font-medium">{t('profile.accent')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each ACCENT_PRESETS as accent (accent.id)}
					{@const active = settings.accentId === accent.id}
					<Label class={optionClass}>
						<input
							type="radio"
							name="accent"
							value={accent.id}
							checked={active}
							onchange={() => settings.setAccent(accent.id)}
							data-test="accent-{accent.id}"
							class="sr-only"
						/>
						<span
							class="fl-swatch-{accent.id} grid size-6 place-items-center rounded-full"
							aria-hidden="true"
						>
							{#if active}
								<Check size={14} color="var(--primary-foreground)" />
							{/if}
						</span>
						{t(accent.label)}
					</Label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend class="text-label mb-2 font-medium">{t('profile.textSize')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each FONT_SCALE_PRESETS as preset (preset.id)}
					<Label class={optionClass}>
						<input
							type="radio"
							name="font-scale"
							value={preset.id}
							checked={settings.fontScaleId === preset.id}
							onchange={() => settings.setFontScale(preset.id)}
							data-test="scale-{preset.id}"
							class="sr-only"
						/>
						{t(preset.label)}
					</Label>
				{/each}
			</div>

			<p class="text-product mt-4">{t('profile.previewItem')}</p>
			<p class="text-muted-foreground text-caption">{t('profile.previewNote')}</p>
		</fieldset>

		<fieldset>
			<legend class="text-label mb-2 font-medium">{t('profile.language')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each LOCALES as locale (locale.code)}
					<Label class={optionClass}>
						<input
							type="radio"
							name="locale"
							value={locale.code}
							checked={i18n.locale === locale.code}
							onchange={() => i18n.setLocale(locale.code as Locale)}
							data-test="locale-{locale.code}"
							class="sr-only"
						/>
						<span lang={locale.code}>{locale.native}</span>
					</Label>
				{/each}
			</div>
		</fieldset>
	</Card.Content>
</Card.Root>
