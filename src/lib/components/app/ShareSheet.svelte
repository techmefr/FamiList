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

	const list = $derived(data.list(listId));

	/**
	 * Même contrat que la feuille de création : le navigateur tient l'état, on ne le double pas d'un
	 * booléen qui finirait par mentir dès qu'Échap ferme la feuille sans passer par nous.
	 */
	export function show() {
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	function toggle(userId: string, on: boolean) {
		feedback.play('tap');
		data.setListMember(listId, userId, on);
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

		<ul class="mt-4 space-y-1">
			{#each data.members as member (member.id)}
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

		{#if data.members.length <= 1}
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
