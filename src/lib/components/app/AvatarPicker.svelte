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
	 * La photo est réduite ici, dans le navigateur, avant de partir.
	 *
	 * Une photo de téléphone pèse quelques mégaoctets ; on n'en garde qu'un carré de 128 px, ce qui
	 * tombe à une poignée de kilo-octets. Le rognage est centré et non déformant : un visage écrasé
	 * pour tenir dans un carré se remarque immédiatement.
	 *
	 * `createImageBitmap` plutôt qu'un `<img>` : il ne dépend pas du cycle de chargement du DOM, et
	 * il applique l'orientation EXIF, sans quoi une photo prise en portrait ressort couchée.
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
	Le portrait, et la façon d'en changer.

	Par défaut ce sont les initiales sur la couleur du membre : beaucoup de gens ne mettront jamais
	de photo, et deux lettres sur un fond coloré se distinguent mieux dans une pile qu'une
	silhouette générique répétée quatre fois. La photo est une option, pas une case à remplir.
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
		Le champ est masqué mais reste dans le DOM et gardé accessible : c'est lui que le bouton
		déclenche, et c'est lui que voit un pilote de test ou un lecteur d'écran qui l'atteindrait.
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
