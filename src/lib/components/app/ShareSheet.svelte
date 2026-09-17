<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import Avatar from '$components/app/Avatar.svelte';
	import { t } from '$lib/i18n/index.svelte';
	import { Button } from '$lib/components/ui/button';
	import { X } from '@lucide/svelte';

	let { listId }: { listId: string } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	/**
	 * Le cercle visé, choisi explicitement.
	 *
	 * Une liste personnelle n'en a pas encore : partager, c'est justement en désigner un, et prendre
	 * celui qu'on regarde ouvrirait aux collègues ce qu'on destinait à la famille. Vide tant que la
	 * feuille n'a pas été ouverte — le cercle actif fait alors le défaut.
	 */
	let chosen = $state('');

	const list = $derived(data.list(listId));

	/** Le cercle de la liste s'il y en a un ; sinon celui qu'on est en train de désigner. */
	const circle = $derived(list?.householdId ?? (chosen || data.circle));

	/** Une liste déjà partagée ne change pas de cercle : c'est le sien qui dit à qui elle peut s'ouvrir. */
	const settled = $derived(!!list?.householdId);

	const roster = $derived(data.membersOf(circle));

	/**
	 * Même contrat que la feuille de création : le navigateur tient l'état, on ne le double pas d'un
	 * booléen qui finirait par mentir dès qu'Échap ferme la feuille sans passer par nous.
	 */
	export function show() {
		chosen = data.circle;
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	function toggle(userId: string, on: boolean) {
		feedback.play('tap');
		data.setListMember(listId, userId, on, circle);
	}
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="share-title"
	data-test-id="share-sheet"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="share-title" class="text-h2 pe-12 font-semibold">{t('share.title')}</h2>
		<p class="text-muted-foreground text-caption mt-1 pe-12">{t('share.note')}</p>

		<!--
			Avec quel cercle. La question ne se pose qu'une fois, tant que la liste est personnelle :
			une fois partagée, elle appartient à ce cercle-là, et c'est lui qui dit qui peut y figurer.
			Elle ne se pose pas non plus quand il n'y a qu'un cercle — il n'y aurait rien à choisir.
		-->
		{#if settled}
			<p class="text-muted-foreground text-caption mt-3" data-test-id="share-circle-settled">
				{t('share.sharedWithCircle', { name: data.circleName(circle) })}
			</p>
		{:else if data.circles.length > 1}
			<div class="mt-4">
				<label for="share-circle" class="text-label font-medium">{t('share.circle')}</label>
				<p class="text-muted-foreground text-caption mt-1">{t('share.circleHint')}</p>
				<select
					id="share-circle"
					bind:value={chosen}
					data-test-id="share-circle"
					class="border-input bg-card text-product mt-2 min-h-[max(2.75rem,44px)] w-full rounded-lg border px-3"
				>
					{#each data.circles as option (option.id)}
						<option value={option.id}>{option.name}</option>
					{/each}
				</select>
			</div>
		{/if}

		<ul class="mt-4 space-y-1">
			{#each roster as member (member.key)}
				{@const on = list?.memberIds.includes(member.id) ?? false}
				<li>
					<label
						data-test-class="share-member"
						class="hover:bg-muted flex min-h-[max(3.5rem,56px)] cursor-pointer items-center gap-3 rounded-lg px-2"
					>
						<Avatar {member} />
						<span class="text-label min-w-0 flex-1 font-medium">
							{member.name}
							{#if member.id === data.me}
								<span class="text-muted-foreground font-normal">· {t('share.you')}</span>
							{/if}
						</span>
						<!--
							Sa propre case est verrouillee : se decocher ici ferait disparaitre la liste de
							l'ecran sur-le-champ, sans que rien n'ait prevenu. Quitter une liste partagee par
							quelqu'un d'autre est un geste a part, qui reste a faire.
						-->
						<input
							type="checkbox"
							checked={on}
							disabled={member.id === data.me}
							onchange={(event) => toggle(member.id, event.currentTarget.checked)}
							data-test-class="share-toggle"
						/>
					</label>
				</li>
			{/each}
		</ul>

		<p class="text-muted-foreground text-caption mt-2">{t('share.youLocked')}</p>

		{#if roster.length <= 1}
			<p class="text-muted-foreground text-label mt-4">{t('share.alone')}</p>
			<Button variant="outline" href="/household" class="fl-press mt-3" data-test-id="share-invite">
				{t('share.invite')}
			</Button>
		{/if}

		<!-- La fermeture après la liste : le premier focus doit tomber sur un choix, pas sur la sortie. -->
		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="share-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
