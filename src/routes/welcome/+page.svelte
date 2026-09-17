<script lang="ts">
	import { goto } from '$app/navigation';
	import { i18n, t, LOCALES, type Locale } from '$lib/i18n/index.svelte';
	import { flagForLocale } from '$lib/i18n/flags';
	import {
		settings,
		ACCENT_PRESETS,
		FONT_SCALE_PRESETS,
		MOTION_PREFERENCES,
		type MotionPreference,
		type Theme
	} from '$stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import AuthForm from '$components/app/AuthForm.svelte';
	import { ArrowRight, Check } from '@lucide/svelte';

	const STEPS = 4;

	let step = $state(1);
	let heading = $state<HTMLHeadingElement | null>(null);

	/**
	 * The hint only serves once: as soon as the slider has moved, the person has understood that it moves.
	 * Leaving it running afterwards only asks for attention for nothing.
	 */
	let sizeTouched = $state(false);

	const themes: Theme[] = ['light', 'dark', 'system'];

	const scaleIndex = $derived(
		Math.max(
			0,
			FONT_SCALE_PRESETS.findIndex((preset) => preset.id === settings.fontScaleId)
		)
	);
	const scaleLabel = $derived(t(FONT_SCALE_PRESETS[scaleIndex].label));

	function chooseScale(index: number) {
		sizeTouched = true;
		settings.setFontScale(FONT_SCALE_PRESETS[index].id);
	}

	/**
	 * The heading takes focus at every step: without that, a screen reader stays on the "Continue" button and
	 * never announces the screen that has just opened.
	 */
	function go(next: number) {
		step = next;
		heading?.focus();

		// Getting as far as the account is enough: we do not offer the walkthrough again to somebody who has
		// been through it, even if they leave the application before signing up.
		if (next === STEPS) settings.setWelcomeSeen(true);
	}

	function finish() {
		settings.setWelcomeSeen(true);
		goto('/auth');
	}

	const optionClass =
		'border-input has-checked:border-primary has-checked:bg-[var(--fl-primary-tint)] ' +
		'has-checked:text-primary flex min-h-[max(2.75rem,44px)] cursor-pointer items-center gap-2 rounded-md ' +
		'border px-4 py-2';
</script>

<svelte:head>
	<title>{t('welcome.title')} — {t('app.name')}</title>
</svelte:head>

<p class="text-muted-foreground text-caption" data-test-id="welcome-step">
	{t('welcome.step', { current: step, total: STEPS })}
</p>

<!--
	The gauge says again in a picture what the line above says in words: how many are left. Four screens with
	no visual landmark give the impression of a form that never ends, and that is the moment people give up.
	It is decorative in the strict sense — the text already carries the information, and doubling it in the
	screen reader would only slow it down.
-->
<div class="bg-muted mt-2 h-1 overflow-hidden rounded-full" aria-hidden="true">
	<div
		class="bg-primary h-full rounded-full transition-[width] duration-300 ease-[var(--fl-ease)]"
		style="width: {(step / STEPS) * 100}%"
		data-test-id="welcome-progress"
	></div>
</div>

<!--
	The heading changes at every step and takes focus: it is what announces where you are. `tabindex` at -1
	makes it focusable without inserting it into the tab order.
-->
<h1 bind:this={heading} tabindex="-1" class="text-h1 mt-3 font-semibold outline-none">
	{#if step === 1}
		{t('welcome.langTitle')}
	{:else if step === 2}
		{t('welcome.sizeTitle')}
	{:else if step === 3}
		{t('welcome.lookTitle')}
	{:else}
		{t('welcome.accountTitle')}
	{/if}
</h1>

{#if step === 1}
	<!--
		Language comes before everything else, and it is the only step whose content does not depend on the
		current language: each name is written in its own language. Somebody opening the application in a
		language they cannot read cannot understand "Settings" in order to go and change it — but they
		recognise "Malagasy" in a list, and that is enough.
	-->
	<p class="text-muted-foreground mt-2">{t('welcome.langBody')}</p>

	<fieldset class="mt-6">
		<legend class="sr-only">{t('profile.language')}</legend>
		<div class="flex flex-wrap gap-2">
			{#each LOCALES as locale (locale.code)}
				{@const flag = flagForLocale(locale.code)}
				<Label class={optionClass}>
					<input
						type="radio"
						name="welcome-locale"
						checked={i18n.locale === locale.code}
						onchange={() => i18n.setLocale(locale.code as Locale)}
						data-test-id="welcome-locale-{locale.code}"
						class="sr-only"
					/>
					{#if flag}
						<span aria-hidden="true">{flag}</span>
					{/if}
					<span lang={locale.code} dir={locale.dir}>{locale.native}</span>
				</Label>
			{/each}
		</div>
	</fieldset>
{:else if step === 2}
	<p class="text-muted-foreground mt-2">{t('welcome.sizeBody')}</p>

	<div class="bg-card mt-6 rounded-xl border p-4">
		{#key settings.fontScaleId}
			<p class="text-product fl-pop-in font-medium" data-test-id="welcome-preview">
				{t('profile.previewItem')}
			</p>
		{/key}
		<p class="text-muted-foreground text-caption mt-1">{t('profile.previewNote')}</p>
	</div>

	<div class="mt-6 flex items-center gap-3">
		<input
			type="range"
			min="0"
			max={FONT_SCALE_PRESETS.length - 1}
			step="1"
			value={scaleIndex}
			oninput={(event) => chooseScale(Number(event.currentTarget.value))}
			aria-label={t('profile.textSize')}
			aria-valuetext={scaleLabel}
			data-test-id="welcome-size"
			class="h-[44px] min-w-0 flex-1 accent-[var(--primary)]"
		/>

		{#if !sizeTouched}
			<ArrowRight
				size={22}
				class="fl-nudge text-primary shrink-0"
				aria-hidden="true"
				data-test-id="welcome-nudge"
			/>
		{/if}
	</div>

	<p class="text-label mt-2 font-medium" data-test-id="welcome-size-label">{scaleLabel}</p>
	<p class="text-muted-foreground text-caption mt-1">{t('welcome.sizeHint')}</p>
{:else if step === 3}
	<p class="text-muted-foreground mt-2">{t('welcome.lookBody')}</p>

	<fieldset class="mt-6">
		<legend class="text-label mb-2 font-medium">{t('profile.theme')}</legend>
		<div class="flex flex-wrap gap-2">
			{#each themes as value (value)}
				<Label class={optionClass}>
					<input
						type="radio"
						name="welcome-theme"
						checked={settings.theme === value}
						onchange={() => settings.setTheme(value)}
						data-test-id="welcome-theme-{value}"
						class="sr-only"
					/>
					{t(`theme.${value}`)}
				</Label>
			{/each}
		</div>
	</fieldset>

	<fieldset class="mt-6">
		<legend class="text-label mb-2 font-medium">{t('profile.accent')}</legend>
		<div class="flex flex-wrap gap-2">
			{#each ACCENT_PRESETS as accent (accent.id)}
				{@const active = settings.accentId === accent.id}
				<Label class={optionClass}>
					<input
						type="radio"
						name="welcome-accent"
						checked={active}
						onchange={() => settings.setAccent(accent.id)}
						data-test-id="welcome-accent-{accent.id}"
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
		Motion is set here and not in a separate accessibility screen. Somebody who is made queasy by sliding
		does not have to cross the whole application to find the switch: the system setting is already honoured
		by default, and this choice serves those whose device does not carry it, or who want the opposite here
		precisely.
	-->
	<fieldset class="mt-6">
		<legend class="text-label mb-2 font-medium">{t('profile.motion')}</legend>
		<div class="flex flex-wrap gap-2">
			{#each MOTION_PREFERENCES as value (value)}
				<Label class={optionClass}>
					<input
						type="radio"
						name="welcome-motion"
						checked={settings.motion === value}
						onchange={() => settings.setMotion(value as MotionPreference)}
						data-test-id="welcome-motion-{value}"
						class="sr-only"
					/>
					{t(`motion.${value}`)}
				</Label>
			{/each}
		</div>
		<p class="text-muted-foreground text-caption mt-2">{t('profile.motionHint')}</p>
	</fieldset>
{:else}
	<p class="text-muted-foreground mt-2">{t('welcome.accountBody')}</p>

	<AuthForm mode="signup" />
{/if}

<div class="mt-8 flex flex-wrap items-center gap-3">
	{#if step > 1}
		<Button
			variant="outline"
			class="fl-press"
			onclick={() => go(step - 1)}
			data-test-id="welcome-back"
		>
			{t('welcome.back')}
		</Button>
	{/if}

	{#if step < STEPS}
		<Button class="fl-press flex-auto" onclick={() => go(step + 1)} data-test-id="welcome-next">
			{t('welcome.next')}
		</Button>
	{/if}
</div>

<!--
	Emergency exit, present at every step: somebody who already has an account has nothing to set here, their
	preferences are waiting for them in their profile.
-->
<Button variant="ghost" class="mt-4 w-full" onclick={finish} data-test-id="welcome-skip">
	{step === STEPS ? t('welcome.skip') : t('welcome.haveAccount')}
</Button>
