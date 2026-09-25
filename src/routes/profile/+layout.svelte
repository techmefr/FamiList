<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { t } from '$i18n/index.svelte';
	import { highlightSettingTarget } from '$components/app/setting-target';
	import { ChevronLeft } from '@lucide/svelte';

	let { children }: { children: Snippet } = $props();

	const isRoot = $derived(page.url.pathname === '/profile');

	let cameFromProfile = $state(false);

	afterNavigate(({ from, to }) => {
		if (from?.url.pathname !== to?.url.pathname) cameFromProfile = from?.url.pathname === '/profile';
		highlightSettingTarget(to?.url);
	});

	/**
	 * Going back through history rather than forward to `/profile` when that is where the person came from:
	 * the system back button and this one then agree, and neither piles up a trail of profile pages to undo.
	 */
	function back(event: MouseEvent) {
		if (!cameFromProfile) return;
		event.preventDefault();
		history.back();
	}
</script>

{#if !isRoot}
	<a
		href="/profile"
		onclick={back}
		data-test-id="profile-back"
		class="fl-press text-primary text-label -ms-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 font-medium"
	>
		<ChevronLeft size={22} aria-hidden="true" class="rtl:rotate-180" />
		{t('profile.back')}
	</a>
{/if}

{@render children()}
