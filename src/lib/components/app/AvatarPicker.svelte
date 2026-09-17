<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { AVATAR_SIZE, AVATAR_MAX_BYTES, coverSquare } from '$domain/avatar';
	import Avatar from '$components/app/Avatar.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Camera, Trash2 } from '@lucide/svelte';

	let input = $state<HTMLInputElement | null>(null);
	let erreur = $state('');
	let occupe = $state(false);

	const moi = $derived(data.members.find((m) => m.id === data.me));

	/**
	 * The photo is shrunk here, in the browser, before leaving.
	 *
	 * A phone photo weighs a few megabytes; we keep only a 128 px square of it, which comes down to a handful
	 * of kilobytes. The crop is centred and not distorting: a face squashed to fit a square is noticed
	 * immediately.
	 *
	 * `createImageBitmap` rather than an `<img>`: it does not depend on the DOM loading cycle, and it applies
	 * the EXIF orientation, without which a photo taken in portrait comes out lying down.
	 */
	async function vignette(fichier: File): Promise<string> {
		const source = await createImageBitmap(fichier, { imageOrientation: 'from-image' });
		const { sx, sy, taille } = coverSquare(source.width, source.height);

		const toile = document.createElement('canvas');
		toile.width = AVATAR_SIZE;
		toile.height = AVATAR_SIZE;

		const pinceau = toile.getContext('2d');
		if (!pinceau) throw new Error('canvas indisponible');

		pinceau.drawImage(source, sx, sy, taille, taille, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
		source.close();

		return toile.toDataURL('image/jpeg', 0.82);
	}

	async function choisir(event: Event) {
		const fichier = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!fichier) return;

		erreur = '';

		if (fichier.size > AVATAR_MAX_BYTES) {
			erreur = t('profile.avatarTooBig');
			return;
		}

		occupe = true;
		try {
			await data.setMyAvatar(await vignette(fichier));
			feedback.play('success');
		} catch {
			erreur = t('profile.avatarFailed');
		} finally {
			occupe = false;
			if (input) input.value = '';
		}
	}

	async function retirer() {
		feedback.play('remove');
		await data.setMyAvatar(undefined);
	}
</script>

<!--
	The portrait, and how to change it.

	By default it is the initials on the member's colour: many people will never set a photo, and two letters
	on a coloured ground stand out better in a stack than a generic silhouette repeated four times. The photo
	is an option, not a box to fill.
-->
{#if moi}
	<div class="flex flex-wrap items-center gap-4">
		<Avatar member={moi} size={72} />

		<div class="flex min-w-0 flex-1 basis-48 flex-col gap-2">
			<p class="text-muted-foreground text-caption">{t('profile.avatarHint')}</p>

			<div class="flex flex-wrap gap-2">
				<Button
					variant="outline"
					onclick={() => input?.click()}
					disabled={occupe}
					data-test-id="avatar-choose"
					class="fl-press"
				>
					<Camera size={18} aria-hidden="true" />
					{moi.avatar ? t('profile.avatarChange') : t('profile.avatarAdd')}
				</Button>

				{#if moi.avatar}
					<Button
						variant="outline"
						onclick={retirer}
						data-test-id="avatar-remove"
						class="fl-press"
					>
						<Trash2 size={18} aria-hidden="true" />
						{t('profile.avatarRemove')}
					</Button>
				{/if}
			</div>
		</div>
	</div>

	<!--
		The field is hidden but stays in the DOM and kept accessible: it is what the button triggers, and what a
		test driver or a screen reader reaching it sees.
	-->
	<input
		bind:this={input}
		type="file"
		accept="image/*"
		onchange={choisir}
		aria-label={t('profile.avatarAdd')}
		data-test-id="avatar-input"
		class="sr-only"
	/>

	{#if erreur}
		<p class="text-destructive text-caption" role="alert" data-test-id="avatar-error">{erreur}</p>
	{/if}
{/if}
