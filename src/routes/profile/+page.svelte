<script lang="ts">
	import {
		settings,
		motionMs,
		ACCENT_PRESETS,
		FONT_PRESETS,
		FONT_SCALE_PRESETS,
		MOTION_PREFERENCES,
		type MotionPreference,
		type Theme
	} from '$stores/settings.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { i18n, t, LOCALES, type Locale } from '$lib/i18n/index.svelte';
	import { session } from '$stores/session.svelte';
	import { data } from '$stores/data.svelte';
	import { tintForWhiteText } from '$domain/tint';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { Check, Volume2, Users, ShieldCheck } from '@lucide/svelte';
	import Avatar from '$components/app/Avatar.svelte';
	import AvatarPicker from '$components/app/AvatarPicker.svelte';
	import NameField from '$components/app/NameField.svelte';

	const themes: Theme[] = ['light', 'dark', 'system'];

	/**
	 * Le son se juge à l'oreille, pas dans un libellé : l'aperçu joue le retour de fin de courses,
	 * celui qui porte le plus loin. Il sert aussi à vérifier que l'appareil n'est pas en silencieux.
	 */
	function preview() {
		feedback.play('success');
	}

	/**
	 * Relancer le tour, c'est effacer le témoin et repasser par l'accueil : le gabarit s'occupe du
	 * reste. Le déclencher d'ici demanderait de dupliquer la même condition à deux endroits, avec
	 * le risque qu'ils cessent un jour de dire la même chose.
	 */
	function replayTour() {
		settings.setTourSeen(false);
		goto('/');
	}

</script>

<svelte:head>
	<title>{t('profile.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('profile.title')}</h1>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('profile.account')}</Card.Title>
	</Card.Header>
	<Card.Content class="fl-divided">
		<NameField />

		<div class="flex flex-wrap items-center justify-between gap-4">
			<p class="text-muted-foreground text-label">
				{t('profile.signedInAs', { email: session.user?.email ?? '' })}
			</p>
			<Button onclick={() => session.signOut()} data-test-id="sign-out" class="fl-press">
				{t('auth.signOut')}
			</Button>
		</div>
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('profile.avatar')}</Card.Title>
	</Card.Header>
	<Card.Content class="fl-divided">
		<AvatarPicker />
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('profile.sharing')}</Card.Title>
	</Card.Header>
	<Card.Content class="fl-divided">
		<!--
			Les personnes du foyer sont affichées ici, et pas seulement derrière le lien : « avec qui on
			peut partager » est une question à laquelle l'écran des réglages doit répondre tout seul.
		-->
		{#if data.members.length > 0}
			<ul class="flex flex-wrap gap-2" data-test-id="sharing-members">
				{#each data.members as member (member.id)}
					<li
						class="border-input flex items-center gap-2 rounded-full border py-1 ps-1 pe-3"
						data-test-class="sharing-member"
					>
						<Avatar {member} size={36} />
						<span class="text-label">{member.name}</span>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="flex flex-wrap items-center justify-between gap-4">
			<p class="text-muted-foreground text-label">{t('profile.householdHint')}</p>
			<Button href="/household" data-test-id="go-household" class="fl-press">
				<Users size={18} aria-hidden="true" />
				{t('nav.household')}
			</Button>
		</div>

	</Card.Content>
</Card.Root>

{#if session.isAdmin}
	<Card.Root class="mt-6">
		<Card.Header>
			<Card.Title class="text-h2">{t('profile.administration')}</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="flex flex-wrap items-center justify-between gap-4">
				<p class="text-muted-foreground text-label">{t('profile.adminHint')}</p>
				<Button href="/admin" data-test-id="go-admin" class="fl-press">
					<ShieldCheck size={18} aria-hidden="true" />
					{t('nav.admin')}
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
{/if}

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('profile.appearance')}</Card.Title>
	</Card.Header>
	<Card.Content class="fl-divided">
		<fieldset>
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

		<fieldset>
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

		<fieldset>
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
			Chaque option s'affiche dans sa propre police : un choix de typographie qu'on ne voit pas
			ne se choisit pas, il se devine.
		-->
		<fieldset>
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

		<fieldset>
			<legend class="text-label mb-2 font-medium">{t('profile.language')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each LOCALES as locale (locale.code)}
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
						<span lang={locale.code}>{locale.native}</span>
					</Label>
				{/each}
			</div>
		</fieldset>
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('profile.feedbackTitle')}</Card.Title>
	</Card.Header>
	<Card.Content class="fl-divided">
		<fieldset>
			<legend class="text-label mb-2 font-medium">{t('profile.motion')}</legend>
			<div class="flex flex-wrap gap-2">
				{#each MOTION_PREFERENCES as value (value)}
					<Label class="fl-choice">
						<input
							type="radio"
							name="motion"
							{value}
							checked={settings.motion === value}
							onchange={() => settings.setMotion(value as MotionPreference)}
							data-test-id="motion-{value}"
							class="sr-only"
						/>
						{t(`motion.${value}`)}
					</Label>
				{/each}
			</div>
			<p class="text-muted-foreground text-caption mt-2">{t('profile.motionHint')}</p>

			{#if settings.animates}
				<p
					class="text-caption text-primary mt-3 inline-block rounded-full bg-[var(--fl-primary-tint)] px-3 py-1"
					transition:fade={{ duration: motionMs(200) }}
					data-test-id="motion-preview"
				>
					{t('profile.motionPreview')}
				</p>
			{/if}
		</fieldset>

		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="min-w-0">
				<Label for="sound">{t('profile.sound')}</Label>
				<p class="text-muted-foreground text-caption mt-1">{t('profile.soundHint')}</p>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<Button
					variant="outline"
					onclick={preview}
					data-test-id="sound-preview"
					class="fl-press"
				>
					<Volume2 size={18} aria-hidden="true" />
					{t('profile.testFeedback')}
				</Button>
				<Switch
					id="sound"
					size="lg"
					checked={settings.sound}
					onCheckedChange={(checked) => settings.setSound(checked)}
					data-test-id="sound-toggle"
				/>
			</div>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="min-w-0">
				<Label for="haptics">{t('profile.haptics')}</Label>
				<p class="text-muted-foreground text-caption mt-1">{t('profile.hapticsHint')}</p>
			</div>
			<Switch
				id="haptics"
				size="lg"
				checked={settings.haptics}
				onCheckedChange={(checked) => settings.setHaptics(checked)}
				data-test-id="haptics-toggle"
			/>
		</div>
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('security.title')}</Card.Title>
	</Card.Header>
	<Card.Content class="flex flex-wrap items-center justify-between gap-4">
		<p class="text-muted-foreground text-label">{t('security.subtitle')}</p>
		<Button href="/profile/security" data-test-id="go-security" class="fl-press">
			<ShieldCheck size={18} aria-hidden="true" />
			{t('security.title')}
		</Button>
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('profile.help')}</Card.Title>
	</Card.Header>
	<Card.Content class="flex flex-wrap items-center justify-between gap-4">
		<p class="text-muted-foreground text-label">{t('profile.tourHint')}</p>
		<Button onclick={replayTour} data-test-id="replay-tour" class="fl-press">
			{t('profile.replayTour')}
		</Button>
	</Card.Content>
</Card.Root>
