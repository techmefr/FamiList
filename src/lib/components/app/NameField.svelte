<script lang="ts">
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import { Input } from '$components/ui/input';
	import { Label } from '$components/ui/label';
	import { Check } from '@lucide/svelte';

	const me = $derived(data.members.find((m) => m.id === data.me));

	let firstName = $state<string | null>(null);
	let name = $state<string | null>(null);
	let displayed = $state<string | null>(null);
	let busy = $state(false);
	let saved = $state(false);
	let error = $state('');

	/**
	 * The fields fill with what the sync brings back, then keep quiet: an update coming from the server must
	 * not erase what is being written.
	 */
	$effect(() => {
		if (firstName === null && me) {
			firstName = me.firstName;
			name = me.lastName;
			displayed = me.name;
		}
	});

	const compose = (p: string, n: string) => `${p.trim()} ${n.trim()}`.trim();

	/**
	 * The display name follows the first and last name while it has not been customised — that is the most
	 * common case, and typing it a third time would teach nobody anything. As soon as it carries something
	 * else ("Granny", "Lulu"), it stops moving: that nickname is a choice, not a draft to be overwritten at
	 * the next keystroke.
	 */
	function setPart(field: 'prenom' | 'nom', value: string) {
		const before = compose(firstName ?? '', name ?? '');
		const custom = (displayed ?? '').trim() !== '' && (displayed ?? '').trim() !== before;

		if (field === 'prenom') firstName = value;
		else name = value;

		if (!custom) displayed = compose(firstName ?? '', name ?? '');
	}

	// While the account is not identified, we do not know which profile to write: the fields stay closed
	// rather than accept a keystroke that would go nowhere.
	const changed = $derived(
		!!me &&
			(displayed ?? '').trim().length > 0 &&
			((displayed ?? '').trim() !== me.name ||
				(firstName ?? '').trim() !== me.firstName ||
				(name ?? '').trim() !== me.lastName)
	);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!changed) return;

		const identity = {
			name: (displayed ?? '').trim(),
			firstName: (firstName ?? '').trim(),
			lastName: (name ?? '').trim()
		};

		busy = true;
		error = (await data.setMyName(identity)) ?? '';
		busy = false;

		if (error) {
			firstName = me?.firstName ?? '';
			name = me?.lastName ?? '';
			displayed = me?.name ?? '';
			return;
		}

		firstName = identity.firstName;
		name = identity.lastName;
		displayed = identity.name;
		saved = true;
		feedback.play('success');
		setTimeout(() => (saved = false), 2000);
	}
</script>

<!--
	The name is set at sign-up, and until now nothing allowed coming back to it: a typo stayed on display for
	the whole household. The first and last name, for their part, are only asked for here — not at sign-up,
	which stays short. The badge initials are computed again from these fields, they have nothing to enter on
	their own side.
-->
<form onsubmit={save} class="flex flex-wrap items-end gap-3" data-test-id="name-form">
	<div class="min-w-0 flex-1 basis-40">
		<Label for="first-name">{t('profile.firstName')}</Label>
		<Input
			id="first-name"
			bind:value={() => firstName ?? '', (v) => setPart('prenom', v)}
			data-test-id="first-name-input"
			disabled={!me}
			maxlength={60}
			autocomplete="given-name"
		/>
	</div>

	<div class="min-w-0 flex-1 basis-40">
		<Label for="last-name">{t('profile.lastName')}</Label>
		<Input
			id="last-name"
			bind:value={() => name ?? '', (v) => setPart('nom', v)}
			data-test-id="last-name-input"
			disabled={!me}
			maxlength={60}
			autocomplete="family-name"
		/>
	</div>

	<div class="min-w-0 flex-1 basis-48">
		<Label for="display-name">{t('profile.name')}</Label>
		<Input
			id="display-name"
			bind:value={() => displayed ?? '', (v) => (displayed = v)}
			data-test-id="name-input"
			disabled={!me}
			maxlength={60}
			autocomplete="nickname"
			placeholder={t('profile.namePlaceholder')}
		/>
		<p class="text-muted-foreground text-caption mt-1">{t('profile.nameHint')}</p>
	</div>

	<Button type="submit" disabled={busy || !changed} data-test-id="name-save" class="fl-press">
		{#if saved}
			<Check size={18} aria-hidden="true" data-test-id="name-saved" />
			{t('profile.nameSaved')}
		{:else}
			{t('profile.nameSave')}
		{/if}
	</Button>

	{#if error}
		<p class="text-destructive text-caption basis-full" role="alert" data-test-id="name-error">
			{t('profile.nameFailed')}
		</p>
	{/if}
</form>
