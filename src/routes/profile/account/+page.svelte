<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import { session } from '$stores/session.svelte';
	import { categoryById } from '$domain/settings-categories';
	import * as Card from '$components/ui/card';
	import { Button } from '$components/ui/button';
	import AvatarPicker from '$components/app/AvatarPicker.svelte';
	import NameField from '$components/app/NameField.svelte';

	const category = categoryById('account');
</script>

<svelte:head>
	<title>{t(category.title)} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t(category.title)}</h1>

<Card.Root class="mt-6">
	<Card.Content class="fl-divided">
		<div id="setting-name" tabindex="-1" class="fl-setting">
			<NameField />
		</div>

		<div id="setting-avatar" tabindex="-1" class="fl-setting">
			<h2 class="text-label mb-2 font-medium">{t('profile.avatar')}</h2>
			<AvatarPicker />
		</div>

		<div id="setting-sign-out" tabindex="-1" class="fl-setting flex flex-wrap items-center justify-between gap-4">
			<p class="text-muted-foreground text-label">
				{t('profile.signedInAs', { email: session.user?.email ?? '' })}
			</p>
			<Button onclick={() => session.signOut()} data-test-id="sign-out" class="fl-press">
				{t('auth.signOut')}
			</Button>
		</div>
	</Card.Content>
</Card.Root>
