<script lang="ts">
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { t } from '$lib/i18n/index.svelte';
	import { install } from '$stores/install.svelte';
	import { settings, motionMs } from '$stores/settings.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { Download, Share, Plus, WifiOff, House, X } from '@lucide/svelte';

	let dialog = $state<HTMLDialogElement | null>(null);

	/**
	 * Le dialogue natif est piloté depuis le magasin : l'explication s'ouvre aussi bien depuis le
	 * bandeau que depuis le menu d'aide, qui vit ailleurs dans la page. `showModal()` apporte au
	 * passage la fermeture par Échap et le renvoi du focus, qu'une div n'aurait pas.
	 */
	$effect(() => {
		if (!dialog) return;

		if (install.detailsOpen && !dialog.open) dialog.showModal();
		if (!install.detailsOpen && dialog.open) dialog.close();
	});

	function installer() {
		feedback.play('tap');
		if (install.isManual) install.showDetails();
		else void install.accept();
	}

	function plusTard() {
		feedback.play('tap');
		install.refuse();
	}

	const BENEFITS = [
		{ key: 'home', icon: House },
		{ key: 'browser', icon: Download },
		{ key: 'offline', icon: WifiOff }
	] as const;
</script>

<!--
	Le bandeau d'installation, à la place des bandeaux de l'application — au-dessus du contenu, sous
	la barre du haut, là où `SyncStatus` parle déjà.

	Il ne se montre qu'à la troisième ouverture, et jamais dans la coquille Capacitor : la règle est
	dans `$domain/install`, ce composant ne fait que la rendre. Le texte dit ce que l'installation
	apporte — une icône, un lancement sans réseau — parce que « installer l'application » ne répond
	pas à la seule question que la personne se pose : pourquoi.

	`aria-live="polite"` et non `role="alert"` : ce n'est pas une urgence, l'annonce doit attendre
	la fin de ce que le lecteur d'écran est en train de dire. Rien ne capte le focus, et « Plus
	tard » est au clavier comme au doigt : une proposition dont on ne peut pas sortir serait pire
	que pas de proposition du tout.
-->
{#if install.offers}
	<section
		transition:slide={{ duration: motionMs(220), easing: cubicOut }}
		aria-labelledby="install-banner-title"
		aria-live="polite"
		data-test-id="install-banner"
		class="bg-card flex flex-col gap-2 border-b px-4 py-3"
	>
		<p id="install-banner-title" class="text-label flex items-center gap-2 font-medium">
			<Download size={18} aria-hidden="true" />
			{t('install.title')}
		</p>
		<p class="text-caption text-muted-foreground">{t('install.body')}</p>

		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={installer}
				data-test-id="install-accept"
				class="fl-press bg-primary text-primary-foreground text-label flex min-h-[max(2.25rem,36px)] items-center rounded-full px-4 font-medium"
			>
				{install.isManual ? t('install.how') : t('install.action')}
			</button>

			{#if !install.isManual}
				<button
					type="button"
					onclick={() => install.showDetails()}
					data-test-id="install-more"
					class="fl-press text-muted-foreground text-label hover:bg-muted flex min-h-[max(2.25rem,36px)] items-center rounded-full px-4"
				>
					{t('install.more')}
				</button>
			{/if}

			<button
				type="button"
				onclick={plusTard}
				data-test-id="install-later"
				class="fl-press text-muted-foreground text-label hover:bg-muted ms-auto flex min-h-[max(2.25rem,36px)] items-center rounded-full px-4"
			>
				{t('install.later')}
			</button>
		</div>
	</section>
{/if}

<dialog
	bind:this={dialog}
	onclose={() => install.hideDetails()}
	onclick={(event) => {
		if (event.target === dialog) install.hideDetails();
	}}
	class="fl-sheet"
	aria-labelledby="install-details-title"
	data-test-id="install-details"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="install-details-title" class="text-h2 pe-12 font-semibold">
			{t('install.detailsTitle')}
		</h2>

		<ul class="mt-4 space-y-3">
			{#each BENEFITS as { key, icon: Icon } (key)}
				<li class="flex items-start gap-3">
					<span
						class="bg-[var(--fl-primary-tint)] text-primary grid size-11 shrink-0 place-items-center rounded-full"
					>
						<Icon size={22} aria-hidden="true" />
					</span>
					<span class="text-label self-center">{t(`install.benefit.${key}`)}</span>
				</li>
			{/each}
		</ul>

		<!--
			La marche à suivre de Safari, et seulement là : sur iPhone et iPad, aucun code ne peut
			ouvrir l'invite du système. Les deux libellés cités sont ceux du menu de partage, mot pour
			mot — une paraphrase ferait chercher un bouton qui n'existe pas sous ce nom.
		-->
		{#if install.isManual}
			<div class="bg-muted mt-4 rounded-lg p-3">
				<p class="text-label flex items-center gap-2 font-medium">
					<Share size={18} aria-hidden="true" />
					{t('install.iosTitle')}
				</p>
				<ol class="text-caption text-muted-foreground mt-2 space-y-1">
					<li class="flex items-start gap-2">
						<Share size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
						{t('install.iosShare')}
					</li>
					<li class="flex items-start gap-2">
						<Plus size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
						{t('install.iosAdd')}
					</li>
				</ol>
			</div>
		{:else}
			<button
				type="button"
				onclick={() => {
					install.hideDetails();
					void install.accept();
				}}
				data-test-id="install-details-accept"
				class="fl-press bg-primary text-primary-foreground text-label mt-4 flex min-h-[max(2.75rem,44px)] w-full items-center justify-center rounded-lg font-medium"
			>
				{t('install.action')}
			</button>
		{/if}

		<p class="text-caption text-muted-foreground mt-4">{t('install.note')}</p>

		<button
			type="button"
			onclick={() => install.hideDetails()}
			aria-label={t('common.close')}
			data-test-id="install-details-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
