<script lang="ts">
	import { supabase } from '$db/supabase';
	import { t } from '$i18n/index.svelte';

	interface Props {
		recipeName: string;
		emoji: string;
		photoPath?: string;
	}

	let { recipeName, emoji, photoPath }: Props = $props();

	/** How long a signed URL to a private bucket stays usable before the card would need another one. */
	const SIGNED_URL_TTL_SECONDS = 3600;

	let signedUrl = $state<string | null>(null);

	/**
	 * The collapsed card's own small fetch of the photo, separate from `RecipePhoto`'s: that component only
	 * mounts once the card is expanded, so the closed accordion needs its own way to show the same picture
	 * at rest. Decorative only, like the photo everywhere else — a failure here just falls back to the emoji.
	 */
	$effect(() => {
		if (!photoPath) {
			signedUrl = null;
			return;
		}

		let cancelled = false;

		supabase.storage
			.from('recipe-photos')
			.createSignedUrl(photoPath, SIGNED_URL_TTL_SECONDS)
			.then(({ data: signed }) => {
				if (!cancelled) signedUrl = signed?.signedUrl ?? null;
			});

		return () => {
			cancelled = true;
		};
	});
</script>

{#if signedUrl}
	<img
		src={signedUrl}
		alt={t('recipes.photoAlt', { name: recipeName })}
		data-test-class="recipe-cover-photo"
		class="block w-full object-cover"
	/>
{:else}
	<div
		data-test-class="recipe-cover-emoji"
		class="grid aspect-square w-full place-items-center bg-[var(--fl-primary-tint)] text-6xl"
		aria-hidden="true"
	>
		{emoji}
	</div>
{/if}
