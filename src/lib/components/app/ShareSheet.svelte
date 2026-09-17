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
	 * The circle aimed at, chosen explicitly.
	 *
	 * A personal list does not have one yet: sharing is precisely designating one, and taking the one being
	 * looked at would open to colleagues what was meant for the family. Empty until the sheet has been
	 * opened — the active circle then makes the default.
	 */
	let chosen = $state('');

	const list = $derived(data.list(listId));

	/** The list's circle if it has one; otherwise the one being designated. */
	const circle = $derived(list?.householdId ?? (chosen || data.circle));

	/** An already shared list does not change circle: its own says who it can open to. */
	const settled = $derived(!!list?.householdId);

	const roster = $derived(data.membersOf(circle));

	/**
	 * Same contract as the creation sheet: the browser holds the state, we do not double it with a boolean
	 * that would end up lying as soon as Escape closes the sheet without going through us.
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
			With which circle. The question only comes up once, while the list is personal: once shared, it belongs
			to that circle, and the circle says who can be on it. Nor does it come up when there is only one circle
			— there would be nothing to choose.
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
							Your own box is locked: unticking here would make the list disappear from the screen on the spot,
							with no warning. Leaving a list shared by somebody else is a separate gesture, and remains to be
							built.
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

		<!-- The close button after the list: first focus must land on a choice, not on the way out. -->
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
