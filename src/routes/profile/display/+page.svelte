<script lang="ts">
	import {
		settings,
		ACCENT_PRESETS,
		FONT_PRESETS,
		FONT_SCALE_PRESETS,
		HANDS,
		type Theme
	} from '$stores/settings.svelte';
	import { i18n, t, LOCALES, type Locale } from '$i18n/index.svelte';
	import { flagForLocale } from '$i18n/flags';
	import { categoryById } from '$domain/settings-categories';
	import * as Card from '$components/ui/card';
	import { Label } from '$components/ui/label';
	import { Check } from '@lucide/svelte';

	const category = categoryById('display');
	const themes: Theme[] = ['light', 'dark', 'system'];
</script>

<svelte:head>
	<title>{t(category.title)} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t(category.title)}</h1>

<!--
	Size and font come first: whoever needs them cannot read what follows until they are set.
-->
<Card.Root class="mt-6">
	<Card.Content class="fl-divided">
		<fieldset id="setting-text-size" tabindex="-1" class="fl-setting">
			<legend class="text-label mb-2 font-medium">{t('profile.textSize')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each FONT_SCALE_PRESETS as preset (preset.id)}
					<Label class="fl-choice">
						<input
							type="radio"
							name="font-scale"
							value={preset.id}
							checked={settings.fontScaleId === preset.id}
							onchange={() => settings.setFontScale(preset.id)}
							data-test-id="scale-{preset.id}"
							class="sr-only"
						/>
						{t(preset.label)}
					</Label>
				{/each}
			</div>

			<p class="text-product mt-4">{t('profile.previewItem')}</p>
			<p class="text-muted-foreground text-caption">{t('profile.previewNote')}</p>
		</fieldset>

		<!--
			Each option is shown in its own typeface: a typography choice you cannot see is not chosen, it is
			guessed.
		-->
		<fieldset id="setting-font" tabindex="-1" class="fl-setting">
			<legend class="text-label mb-2 font-medium">{t('profile.font')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each FONT_PRESETS as preset (preset.id)}
					<Label class="fl-choice" style="font-family: var(--fl-font-{preset.id})">
						<input
							type="radio"
							name="font"
							value={preset.id}
							checked={settings.fontId === preset.id}
							onchange={() => settings.setFont(preset.id)}
							data-test-id="font-{preset.id}"
							class="sr-only"
						/>
						{t(preset.label)}
					</Label>
				{/each}
			</div>

			<p class="text-muted-foreground text-caption mt-2">{t('profile.fontNote')}</p>
		</fieldset>

		<fieldset id="setting-theme" tabindex="-1" class="fl-setting">
			<legend class="text-label mb-2 font-medium">{t('profile.theme')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each themes as value (value)}
					<Label class="fl-choice">
						<input
							type="radio"
							name="theme"
							{value}
							checked={settings.theme === value}
							onchange={() => settings.setTheme(value)}
							data-test-id="theme-{value}"
							class="sr-only"
						/>
						{t(`theme.${value}`)}
					</Label>
				{/each}
			</div>
		</fieldset>

		<fieldset id="setting-accent" tabindex="-1" class="fl-setting">
			<legend class="text-label mb-2 font-medium">{t('profile.accent')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each ACCENT_PRESETS as accent (accent.id)}
					{@const active = settings.accentId === accent.id}
					<Label class="fl-choice">
						<input
							type="radio"
							name="accent"
							value={accent.id}
							checked={active}
							onchange={() => settings.setAccent(accent.id)}
							data-test-id="accent-{accent.id}"
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

		<!--
			The dominant hand is a display setting: it changes nothing about what the application does, only
			the side the thumb-reachable controls sit on.
		-->
		<fieldset id="setting-hand" tabindex="-1" class="fl-setting">
			<legend class="text-label mb-2 font-medium">{t('profile.hand')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each HANDS as value (value)}
					<Label class="fl-choice">
						<input
							type="radio"
							name="hand"
							{value}
							checked={settings.hand === value}
							onchange={() => settings.setHand(value)}
							data-test-id="hand-{value}"
							class="sr-only"
						/>
						{t(`hand.${value}`)}
					</Label>
				{/each}
			</div>

			<p class="text-muted-foreground text-caption mt-2">{t('profile.handHint')}</p>
		</fieldset>

		<fieldset id="setting-language" tabindex="-1" class="fl-setting">
			<legend class="text-label mb-2 font-medium">{t('profile.language')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each LOCALES as locale (locale.code)}
					{@const flag = flagForLocale(locale.code)}
					<Label class="fl-choice">
						<input
							type="radio"
							name="locale"
							value={locale.code}
							checked={i18n.locale === locale.code}
							onchange={() => i18n.setLocale(locale.code as Locale)}
							data-test-id="locale-{locale.code}"
							class="sr-only"
						/>
						{#if flag}
							<span aria-hidden="true">{flag}</span>
						{/if}
						<span lang={locale.code}>{locale.native}</span>
					</Label>
				{/each}
			</div>
		</fieldset>
	</Card.Content>
</Card.Root>
