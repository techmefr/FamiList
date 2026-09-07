<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { goto, onNavigate } from '$app/navigation';
	import { ListChecks, Store, CreditCard, User, ShieldCheck, Users, ZoomIn } from '@lucide/svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { data } from '$stores/data.svelte';
	import { session } from '$stores/session.svelte';
	import { settings } from '$stores/settings.svelte';
	import { navDirection } from '$domain/motion';
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

	// La loupe se sert de l'appareil photo arrière, devant une étiquette de produit : c'est un geste
	// de téléphone. Sur un écran d'ordinateur elle n'aurait rien à montrer, on ne la propose pas.
	const nav = $derived([
		{ href: '/', key: 'nav.lists', icon: ListChecks, handheld: false },
		{ href: '/shops', key: 'nav.shops', icon: Store, handheld: false },
		{ href: '/magnifier', key: 'nav.magnifier', icon: ZoomIn, handheld: true },
		{ href: '/cards', key: 'nav.cards', icon: CreditCard, handheld: false },
		{ href: '/household', key: 'nav.household', icon: Users, handheld: false },
		{ href: '/profile', key: 'nav.profile', icon: User, handheld: false },
		...(session.isAdmin
			? [{ href: '/admin', key: 'nav.admin', icon: ShieldCheck, handheld: false }]
			: [])
	]);

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	/**
	 * Transition de page par l'API View Transitions : le navigateur photographie l'écran, laisse
	 * SvelteKit remplacer le contenu, puis anime les deux images. Rien ne reste transformé après
	 * coup, contrairement à un conteneur animé autour de la page — celui du prototype créait un
	 * contexte d'empilement qui emprisonnait la loupe et la carte plein écran.
	 *
	 * Ce qui glisse, c'est la capture racine, et la barre de navigation est nommée pour en être
	 * exclue (cf. app.css) : nommer `<main>` en ferait un contexte d'empilement, et le piège se
	 * refermerait de la même façon.
	 *
	 * Le sens du glissement est posé sur <html> avant de démarrer : le CSS n'a plus qu'à le lire.
	 * Sans prise en charge du navigateur, ou mouvement refusé, la navigation reste instantanée.
	 */
	onNavigate((navigation) => {
		if (!settings.animates || !document.startViewTransition) return;
		if (!navigation.to?.url) return;

		document.documentElement.dataset.nav = navDirection(
			navigation.from?.url.pathname ?? '',
			navigation.to.url.pathname,
			nav.map((entry) => entry.href)
		);

		return new Promise((resolve) => {
			const transition = document.startViewTransition!(async () => {
				resolve();
				await navigation.complete;
			});

			// Une transition interrompue rejette ses promesses — redirection enchaînée par le verrou
			// d'accès, onglet caché, navigation suivante qui prend la main. Sans ces filets, la
			// console reçoit une erreur non traitée alors que la navigation, elle, a bien eu lieu.
			//
			// Aucun verrou « une transition à la fois » ici : la deuxième remplace la première, et un
			// drapeau à remettre à zéro finit toujours par rester coincé sur une promesse qui ne se
			// termine jamais — page cachée, par exemple — ce qui supprimerait les transitions pour
			// tout le reste de la session.
			void transition.ready.catch(() => {});
			void transition.updateCallbackDone.catch(() => {});
			void transition.finished.catch(() => {});
		});
	});
</script>

{#if session.loading}
	<main class="grid min-h-dvh place-items-center px-4">
		<p class="text-muted-foreground">{t('common.loading')}</p>
	</main>
{:else if !session.isApproved}
	<main class="fl-rise mx-auto w-full max-w-md px-4 py-10">
		{@render children()}
	</main>
{:else}
	<div class="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
		<nav
			class="bg-card fixed inset-x-0 bottom-0 z-10 border-t md:sticky md:top-0 md:h-dvh md:border-t-0 md:border-e"
			style="view-transition-name: nav"
			aria-label={t('nav.main')}
		>
			<p class="text-h2 hidden px-6 py-6 font-semibold md:block">{t('app.name')}</p>

			<ul class="flex overflow-x-auto md:flex-col md:gap-1 md:overflow-x-visible md:px-3">
				{#each nav as { href, key, icon: Icon, handheld } (href)}
					{@const active = isActive(href)}
					<li class="min-w-fit flex-1" class:md:hidden={handheld}>
						<a
							{href}
							data-test="nav-{href}"
							aria-current={active ? 'page' : undefined}
							class="fl-press text-caption md:text-label relative flex flex-col items-center gap-1 px-2 py-3 md:flex-row md:gap-3 md:rounded-md md:px-3
								{active ? 'text-primary' : 'text-muted-foreground'}"
						>
							<!--
								La pastille de l'onglet actif est un élément à part, nommé pour la transition :
								elle glisse d'un onglet à l'autre pendant le changement de page. Nommer le lien
								entier ferait glisser son texte, qui se fondrait dans celui de l'onglet suivant.
							-->
							{#if active}
								<span
									class="bg-[var(--fl-primary-tint)] absolute inset-0 md:rounded-md"
									style="view-transition-name: nav-active"
									aria-hidden="true"
								></span>
							{/if}
							<Icon size={22} class="relative" aria-hidden="true" />
							<span class="relative">{t(key)}</span>
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
