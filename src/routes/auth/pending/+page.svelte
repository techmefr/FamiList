<script lang="ts">
	import { session } from '$stores/session.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Clock, Ban } from '@lucide/svelte';

	const rejected = $derived(session.profile?.status === 'rejected');
</script>

<svelte:head>
	<title>{t('auth.pendingTitle')} — {t('app.name')}</title>
</svelte:head>

<Card.Root class="mt-10">
	<Card.Content class="space-y-4 text-center">
		{#if rejected}
			<Ban size={40} class="text-destructive mx-auto" aria-hidden="true" />
			<h1 class="text-h1 font-semibold">{t('auth.rejectedTitle')}</h1>
			<p class="text-muted-foreground">{t('auth.rejectedBody')}</p>
		{:else}
			<Clock size={40} class="text-primary mx-auto" aria-hidden="true" />
			<h1 class="text-h1 font-semibold">{t('auth.pendingTitle')}</h1>
			<p class="text-muted-foreground">{t('auth.pendingBody')}</p>
		{/if}

		<Button variant="outline" onclick={() => session.signOut()} data-test="sign-out">
			{t('auth.signOut')}
		</Button>
	</Card.Content>
</Card.Root>
