<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n/index.svelte';
	import {
		settings,
		ACCENT_PRESETS,
		FONT_SCALE_PRESETS,
		type Theme
	} from '$stores/settings.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import AuthForm from '$components/app/AuthForm.svelte';
	import { ArrowRight, Check } from '@lucide/svelte';

	const STEPS = 3;

	let step = $state(1);
	let heading = $state<HTMLHeadingElement | null>(null);

	/**
	 * L'invite ne sert qu'une fois : dès que le curseur a bougé, la personne a compris qu'il bouge.
	 * La laisser tourner ensuite ne fait que réclamer l'attention pour rien.
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
	 * Le titre reçoit le focus à chaque étape : sans cela, un lecteur d'écran reste sur le bouton
	 * « Continuer » et n'annonce jamais l'écran qui vient de s'ouvrir.
	 */
	function go(next: number) {
		step = next;
		heading?.focus();

		// Arriver jusqu'au compte suffit : on ne repropose pas le parcours à quelqu'un qui l'a
		// traversé, même s'il quitte l'application avant de s'inscrire.
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
	Le titre change à chaque étape et porte le focus : c'est lui qui annonce où l'on est. `tabindex`
	à -1 le rend focalisable sans l'insérer dans l'ordre de tabulation.
-->
<h1 bind:this={heading} tabindex="-1" class="text-h1 mt-1 font-semibold outline-none">
	{#if step === 1}
		{t('welcome.sizeTitle')}
	{:else if step === 2}
		{t('welcome.lookTitle')}
	{:else}
		{t('welcome.accountTitle')}
	{/if}
</h1>

{#if step === 1}
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
{:else if step === 2}
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
{:else}
	<p class="text-muted-foreground mt-2">{t('welcome.accountBody')}</p>

	<AuthForm mode="signup" />
{/if}

<div class="mt-8 flex flex-wrap items-center gap-3">
	{#if step > 1}
		<Button variant="outline" class="fl-press" onclick={() => go(step - 1)} data-test-id="welcome-back">
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
	Sortie de secours, présente à toutes les étapes : quelqu'un qui a déjà un compte n'a rien à
	régler ici, ses préférences l'attendent dans son profil.
-->
<Button variant="ghost" class="mt-4 w-full" onclick={finish} data-test-id="welcome-skip">
	{step === STEPS ? t('welcome.skip') : t('welcome.haveAccount')}
</Button>
