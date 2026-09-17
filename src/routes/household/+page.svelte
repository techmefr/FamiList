<script lang="ts">
	import { goto } from '$app/navigation';
	import { supabase } from '$db/supabase';
	import { session } from '$stores/session.svelte';
	import { householdErrorKey } from '$domain/household-error';
	import { readInviteOutcome } from '$domain/invite-outcome';
	import { data } from '$stores/data.svelte';
	import { sync } from '$lib/sync/index.svelte';
	import { t, i18n } from '$lib/i18n/index.svelte';
	import { tintForWhiteText } from '$domain/tint';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Users, Copy, Check, KeyRound, CircleDot } from '@lucide/svelte';
	import IconField from '$components/app/IconField.svelte';

	let invite = $state<{ code: string; expires: string } | null>(null);
	let joinCode = $state('');
	let renaming = $state('');

	const circleName = $derived(data.circleName(data.circle));
	let error = $state<string | null>(null);
	let secondFacteurRequis = $state(false);
	let busy = $state(false);
	let copied = $state(false);

	/**
	 * Un refus de la base, dit dans la langue de la personne — et, quand la cause est une session
	 * restée au mot de passe, avec la porte pour en sortir.
	 *
	 * Le niveau d'authentification est relu avant de conclure : « compte non valide » recouvre
	 * aussi bien un compte en attente qu'un deuxième facteur pas encore présenté, et ce que le
	 * client croit savoir de la session peut dater d'une lecture qui a échoué.
	 */
	async function montrerRefus(message: string) {
		await session.refreshLevels();
		secondFacteurRequis = session.needsSecondFactor;
		error = t(householdErrorKey(message, secondFacteurRequis));
	}

	async function createInvite() {
		busy = true;
		error = null;

		const { data: code, error: rpcError } = await supabase.rpc('create_invite');

		busy = false;
		if (rpcError) {
			await montrerRefus(rpcError.message);
			return;
		}

		const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000);
		invite = {
			code: code as unknown as string,
			expires: new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'long' }).format(expires)
		};
	}

	async function copyCode() {
		if (!invite) return;

		await navigator.clipboard.writeText(invite.code);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	async function join(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = null;

		const { data: reponse, error: rpcError } = await supabase.rpc('redeem_invite', {
			invite_code: joinCode
		});

		if (rpcError) {
			busy = false;
			await montrerRefus(rpcError.message);
			return;
		}

		// Un code refusé n'arrive plus par une exception : la base doit pouvoir retenir la tentative,
		// ce qu'une transaction annulée lui interdirait.
		const issue = readInviteOutcome(reponse);

		if (issue.errorKey) {
			busy = false;
			error = t(issue.errorKey);
			return;
		}

		// On reste membre du foyer précédent — rejoindre n'en fait plus quitter un. C'est donc ici
		// qu'on dit lequel regarder, sinon la relecture reprendrait le plus ancien.
		if (issue.householdId) sync.adopt(issue.householdId);

		// Le foyer affiché a changé : tout le cache local appartient à l'autre, on repart du serveur.
		await data.reload();
		busy = false;
		joinCode = '';
	}

	/**
	 * Le nom du cercle, que le sélecteur est le premier à rendre nécessaire : deux cercles créés à
	 * l'inscription portent le même nom par défaut, et une liste de doublons ne se choisit pas.
	 */
	async function rename(event: SubmitEvent) {
		event.preventDefault();

		const nom = renaming.trim();
		if (!nom || !sync.householdId) return;

		busy = true;
		error = null;

		const { error: rpcError } = await supabase
			.from('households')
			.update({ name: nom })
			.eq('id', sync.householdId);

		busy = false;
		if (rpcError) {
			await montrerRefus(rpcError.message);
			return;
		}

		renaming = '';
		await sync.households();
	}

	async function leave() {
		if (!sync.householdId) return;

		busy = true;
		error = null;

		const { error: rpcError } = await supabase.rpc('leave_household', { target: sync.householdId });

		if (rpcError) {
			busy = false;
			await montrerRefus(rpcError.message);
			return;
		}

		await data.reload();
		busy = false;
	}
</script>

<svelte:head>
	<title>{t('household.title')} — {t('app.name')}</title>
</svelte:head>

<h1 class="text-h1 font-semibold">{t('household.title')}</h1>

{#if error}
	<div class="mt-6" role="alert" data-test-id="household-error">
		<p class="text-destructive">{error}</p>

		<!--
			Le seul refus qui a une sortie immédiate : la personne a bien son code de vérification,
			il ne lui manque que l'écran où le taper.
		-->
		{#if secondFacteurRequis}
			<Button
				variant="outline"
				onclick={() => goto('/auth/mfa')}
				data-test-id="household-second-factor"
				class="mt-3"
			>
				{t('household.goToSecondFactor')}
			</Button>
		{/if}
	</div>
{/if}

<!--
	Les cercles, et celui qu'on regarde.

	Un seul cercle est actif à la fois : c'est lui qui décide des listes, des magasins, des rayons et
	des cartes affichés, et c'est dans lui qu'atterrit ce qu'on crée. Les autres restent lus et en
	cache — basculer ne relit rien et marche sans réseau.

	La carte disparaît quand il n'y a qu'un cercle : il n'y a alors rien à choisir, et une liste d'un
	seul élément ne ferait que demander à quoi elle sert.
-->
{#if data.circles.length > 1}
	<Card.Root class="mt-6">
		<Card.Header>
			<Card.Title class="text-h2 flex items-center gap-2">
				<CircleDot size={20} aria-hidden="true" />
				{t('household.circles')}
			</Card.Title>
		</Card.Header>
		<Card.Content>
			<p class="text-muted-foreground text-label">{t('household.circlesHint')}</p>

			<ul class="mt-4 space-y-1">
				{#each data.circles as circle (circle.id)}
					{@const actif = circle.id === data.circle}
					<li>
						<button
							type="button"
							onclick={() => data.switchCircle(circle.id)}
							aria-current={actif ? 'true' : undefined}
							data-test-class="circle-option"
							class="fl-press hover:bg-muted flex min-h-[max(3.5rem,56px)] w-full items-center gap-3 rounded-lg px-3 text-start"
							class:bg-muted={actif}
						>
							<span class="text-product min-w-0 flex-1 font-medium">{circle.name}</span>
							{#if actif}
								<span class="text-secondary text-caption inline-flex shrink-0 items-center gap-1 font-semibold">
									<Check size={16} aria-hidden="true" />
									{t('household.circleShown')}
								</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		</Card.Content>
	</Card.Root>
{/if}

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2 flex items-center gap-2">
			<Users size={20} aria-hidden="true" />
			{t('household.members')}
		</Card.Title>
	</Card.Header>
	<Card.Content>
		<!--
			Le nom du cercle affiché. Il ne servait à rien tant qu'on n'en voyait qu'un ; il devient ce
			qui distingue deux cercles dans le sélecteur, et tous naissent avec le même nom par défaut.
		-->
		<form onsubmit={rename} class="mb-6">
			<Label for="circle-name">{t('household.nameLabel')}</Label>
			<div class="mt-2 flex flex-wrap items-center gap-3">
				<Input
					id="circle-name"
					value={renaming || circleName}
					oninput={(event) => (renaming = event.currentTarget.value)}
					data-test-id="circle-name"
					class="min-w-0 flex-1 basis-[12rem]"
				/>
				<Button type="submit" variant="outline" disabled={busy} data-test-id="circle-rename">
					{t('household.rename')}
				</Button>
			</div>
		</form>

		<ul class="space-y-2">
			{#each data.members as member (member.key)}
				<li class="flex flex-wrap items-center gap-3" data-test-class="household-member">
					<span
						class="text-caption grid size-9 shrink-0 place-items-center rounded-full font-semibold text-white"
						style="background: {tintForWhiteText(member.tint)}"
						aria-hidden="true"
					>
						{member.initial}
					</span>
					<span class="text-product min-w-0 flex-1 basis-[8rem]">{member.name}</span>
					<span class="text-muted-foreground text-caption">{t(`household.role.${member.role}`)}</span>
				</li>
			{/each}
		</ul>

		{#if data.members.length > 1}
			<Button variant="outline" onclick={leave} disabled={busy} data-test-id="household-leave" class="mt-4">
				{t('household.leave')}
			</Button>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('household.inviteTitle')}</Card.Title>
	</Card.Header>
	<Card.Content>
		<p class="text-muted-foreground text-label">{t('household.inviteHint')}</p>

		{#if invite}
			<div class="mt-4 flex flex-wrap items-center gap-3">
				<p class="text-display font-mono tracking-[0.3em]" data-test-id="invite-code">{invite.code}</p>
				<Button variant="outline" onclick={copyCode} data-test-id="invite-copy">
					{#if copied}
						<Check size={16} aria-hidden="true" />
						{t('household.copied')}
					{:else}
						<Copy size={16} aria-hidden="true" />
						{t('household.copy')}
					{/if}
				</Button>
			</div>
			<p class="text-muted-foreground text-caption mt-2">
				{t('household.inviteExpires', { date: invite.expires })}
			</p>
		{:else}
			<Button onclick={createInvite} disabled={busy} data-test-id="invite-create" class="mt-4">
				{t('household.createInvite')}
			</Button>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">{t('household.joinTitle')}</Card.Title>
	</Card.Header>
	<Card.Content>
		<p class="text-muted-foreground text-label">{t('household.joinHint')}</p>

		<form onsubmit={join} class="mt-4 flex flex-wrap items-end gap-3" data-test-id="join-form">
			<div class="flex-1">
				<Label for="join-code">{t('household.code')}</Label>
				<IconField icon={KeyRound}>
					<Input
						id="join-code"
						bind:value={joinCode}
						data-test-id="join-code"
						maxlength={6}
						autocapitalize="characters"
						class="font-mono tracking-[0.3em] uppercase"
						required
						placeholder={t('household.codePlaceholder')}
					/>
				</IconField>
			</div>
			<Button type="submit" disabled={busy} data-test-id="join-submit">{t('household.join')}</Button>
		</form>
	</Card.Content>
</Card.Root>
