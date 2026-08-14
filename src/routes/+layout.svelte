<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { ListChecks, Store, CreditCard, User, ShieldCheck, Users } from '@lucide/svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { data } from '$stores/data.svelte';
	import { session } from '$stores/session.svelte';
	import SyncStatus from '$components/app/SyncStatus.svelte';

	let { children } = $props();

	i18n.init();
	session.init();

	// Comparaison exacte : /auth/pending parle d'un compte, il suppose donc une session.
	// Un startsWith('/auth') le rendrait public et laisserait l'écran d'attente affiché
	// après une déconnexion.
	const PUBLIC_ROUTES = ['/auth'];
	const isPublic = $derived(PUBLIC_ROUTES.includes(page.url.pathname));

	/**
	 * Le verrou d'accès est en base : un compte non approuvé ne lit rien, même en appelant l'API
	 * directement. Cette redirection n'est là que pour éviter d'afficher une coquille vide.
	 */
	$effect(() => {
		if (session.loading) return;

		if (!session.isSignedIn) {
			if (!isPublic) goto('/auth');
			return;
		}

		if (!session.isApproved) {
			if (page.url.pathname !== '/auth/pending') goto('/auth/pending');
			return;
		}

		if (page.url.pathname.startsWith('/auth')) goto('/');
	});

	$effect(() => {
		if (session.isApproved) data.load();
	});

	const nav = $derived([
		{ href: '/', key: 'nav.lists', icon: ListChecks },
		{ href: '/shops', key: 'nav.shops', icon: Store },
		{ href: '/cards', key: 'nav.cards', icon: CreditCard },
		{ href: '/household', key: 'nav.household', icon: Users },
		{ href: '/profile', key: 'nav.profile', icon: User },
		...(session.isAdmin ? [{ href: '/admin', key: 'nav.admin', icon: ShieldCheck }] : [])
	]);

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

{#if session.loading}
	<main class="grid min-h-dvh place-items-center px-4">
		<p class="text-muted-foreground">{t('common.loading')}</p>
	</main>
{:else if !session.isApproved}
	<main class="mx-auto w-full max-w-md px-4 py-10">
		{@render children()}
	</main>
{:else}
	<div class="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
		<nav
			class="bg-card fixed inset-x-0 bottom-0 z-10 border-t md:sticky md:top-0 md:h-dvh md:border-t-0 md:border-e"
			aria-label={t('nav.main')}
		>
			<p class="text-h2 hidden px-6 py-6 font-semibold md:block">{t('app.name')}</p>

			<ul class="flex md:flex-col md:gap-1 md:px-3">
				{#each nav as { href, key, icon: Icon } (href)}
					{@const active = isActive(href)}
					<li class="flex-1">
						<a
							{href}
							data-test="nav-{href}"
							aria-current={active ? 'page' : undefined}
							class="text-caption md:text-label flex flex-col items-center gap-1 px-2 py-3 md:flex-row md:gap-3 md:rounded-md md:px-3
								{active ? 'text-primary bg-[var(--fl-primary-tint)]' : 'text-muted-foreground'}"
						>
							<Icon size={22} aria-hidden="true" />
							{t(key)}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<div>
			<SyncStatus />
			<main class="mx-auto w-full max-w-3xl px-4 pt-6 pb-28 md:pb-10">
				{@render children()}
			</main>
		</div>
	</div>
{/if}
