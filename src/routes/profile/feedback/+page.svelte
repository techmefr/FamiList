<script lang="ts">
	import {
		settings,
		motionMs,
		MOTION_PREFERENCES,
		type MotionPreference
	} from '$stores/settings.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { fade } from 'svelte/transition';
	import { t } from '$i18n/index.svelte';
	import { nearbySupported, requestNearbyPermission } from '$native/nearby';
	import { categoryById } from '$domain/settings-categories';
	import * as Card from '$components/ui/card';
	import { Label } from '$components/ui/label';
	import { Button } from '$components/ui/button';
	import { Switch } from '$components/ui/switch';
	import { Volume2 } from '@lucide/svelte';

	const category = categoryById('feedback');

	/**
	 * Sound is judged by ear, not in a label: the preview plays the end-of-shopping feedback, the one that
	 * carries furthest. It also serves to check the device is not on silent.
	 */
	function preview() {
		feedback.play('success');
	}

	let nearbyRefused = $state(false);

	/**
	 * Location permission is asked for at the moment it is switched on, never before.
	 *
	 * Asking at launch would waste the only chance of getting it, and nobody understands why a shopping list
	 * wants to know where they are until they have decided it here. A refusal leaves the setting off: better
	 * an honest switch than one that is on and triggers nothing.
	 */
	async function toggleNearby(enabled: boolean) {
		nearbyRefused = false;

		if (!enabled) {
			settings.setNearbyCards(false);
			return;
		}

		const permission = await requestNearbyPermission();
		nearbyRefused = permission === 'denied';
		settings.setNearbyCards(permission === 'granted');
	}
</script>

<svelte:head>
	<title>{t(category.title)} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t(category.title)}</h1>

<Card.Root class="mt-6">
	<Card.Content class="fl-divided">
		<fieldset id="setting-motion" tabindex="-1" class="fl-setting">
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

		<div id="setting-sound" tabindex="-1" class="fl-setting flex flex-wrap items-center justify-between gap-4">
			<div class="min-w-0">
				<Label for="sound">{t('profile.sound')}</Label>
				<p class="text-muted-foreground text-caption mt-1">{t('profile.soundHint')}</p>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<Button variant="outline" onclick={preview} data-test-id="sound-preview" class="fl-press">
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

		<div id="setting-haptics" tabindex="-1" class="fl-setting flex flex-wrap items-center justify-between gap-4">
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

		<div id="setting-nearby" tabindex="-1" class="fl-setting flex flex-wrap items-center justify-between gap-4">
			<div class="min-w-0">
				<Label for="nearby">{t('profile.nearbyCards')}</Label>
				<p class="text-muted-foreground text-caption mt-1">
					{nearbySupported() ? t('profile.nearbyCardsHint') : t('profile.nearbyCardsWeb')}
				</p>
				{#if nearbyRefused}
					<p class="text-caption text-destructive mt-1" role="status" data-test-id="nearby-denied">
						{t('profile.nearbyCardsDenied')}
					</p>
				{/if}
			</div>
			<Switch
				id="nearby"
				size="lg"
				disabled={!nearbySupported()}
				checked={settings.nearbyCards}
				onCheckedChange={(checked) => toggleNearby(checked)}
				data-test-id="nearby-toggle"
			/>
		</div>
	</Card.Content>
</Card.Root>
