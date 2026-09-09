<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { goto, onNavigate } from '$app/navigation';
	import { ListChecks, Store, CreditCard, User, ZoomIn, Plus } from '@lucide/svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { data } from '$stores/data.svelte';
	import { session } from '$stores/session.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { navDirection } from '$domain/motion';
	import { pushAppearance, syncAppearance } from '$lib/sync/appearance';
	import SyncStatus from '$components/app/SyncStatus.svelte';
	import CreateMenu from '$components/app/CreateMenu.svelte';
	import Logo from '$components/app/Logo.svelte';

	let { children } = $props();

	let menu = $state<CreateMenu | null>(null);

	/**
	 * La hauteur de la barre du bas, publiée en variable CSS.
	 *
	 * Les commandes flottantes d'une page — les filtres d'une liste — doivent se poser juste
	 * au-dessus d'elle. Cette hauteur n'est pas une constante : la barre grandit avec la taille du
	 * texte et avec l'encoche de l'appareil, et une valeur écrite en dur mettrait le bouton dessous
	 * dès le premier cran d'agrandissement.
	 */
	let navbarH = $state(0);

	i18n.init();
	session.init();

	// Comparaison exacte : /auth/pending parle d'un compte, il suppose donc une session.
	// Un startsWith('/auth') le rendrait public et laisserait l'écran d'attente affiché
	// après une déconnexion.
	const PUBLIC_ROUTES = ['/auth', '/welcome'];
	const isPublic = $derived(PUBLIC_ROUTES.includes(page.url.pathname));

	/**
	 * Première ouverture : on passe par le parcours d'accueil, qui laisse régler la taille du texte
	 * avant de demander quoi que ce soit. C'est l'ordre qui compte — quelqu'un qui ne lit pas le
	 * formulaire de connexion ne peut pas non plus lire le lien vers les réglages.
	 */
	const signedOutHome = $derived(settings.hasSeenWelcome ? '/auth' : '/welcome');

	/**
	 * Le verrou d'accès est en base : un compte non approuvé ne lit rien, même en appelant l'API
	 * directement. Cette redirection n'est là que pour éviter d'afficher une coquille vide.
	 */
	$effect(() => {
		if (session.loading) return;

		if (!session.isSignedIn) {
			if (!isPublic) goto(signedOutHome);
			return;
		}

		if (!session.isApproved) {
			if (page.url.pathname !== '/auth/pending') goto('/auth/pending');
			return;
		}

		if (isPublic || page.url.pathname.startsWith('/auth')) goto('/');
	});

	$effect(() => {
		if (session.isApproved) data.load();
	});

	/**
	 * Le tour se joue une fois, sur l'accueil, une fois le compte validé.
	 *
	 * driver.js et sa feuille de style sont chargés à la demande : ils ne servent qu'une fois dans
	 * la vie d'un compte, les faire descendre à chaque ouverture serait payé par tout le monde pour
	 * personne. Le délai laisse la liste se peindre — une bulle qui désigne un bouton pas encore
	 * rendu se pose dans le vide.
	 *
	 * Être montré vaut vu, abandon compris : le reproposer à chaque démarrage ferait d'une aide un
	 * obstacle. Il se relance depuis le profil.
	 */
	$effect(() => {
		if (!session.isApproved || settings.hasSeenTour) return;
		if (page.url.pathname !== '/') return;

		let cancelled = false;
		const timer = setTimeout(async () => {
			const { startTour } = await import('$lib/tour');
			if (cancelled) return;

			startTour(() => settings.setTourSeen(true));
		}, 700);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	});

	/**
	 * Premier contact de ce compte avec cet appareil : on décide une fois pour toutes qui, de
	 * l'appareil ou de la base, porte les préférences les plus récentes.
	 *
	 * Cet effet ne dépend que de l'identifiant, jamais des réglages eux-mêmes : le relire à chaque
	 * changement de couleur relancerait un arbitrage au milieu d'une modification.
	 */
	$effect(() => {
		const id = session.user?.id;
		if (id) void syncAppearance(id);
	});

	/**
	 * Ensuite, chaque réglage modifié repart vers la base. Le délai regroupe les rafales — glisser
	 * le curseur de taille traverse six crans, ce qui ferait six écritures pour un seul geste.
	 */
	$effect(() => {
		// Lecture explicite : c'est elle qui abonne l'effet à l'ensemble des réglages.
		settings.snapshot();

		const id = session.user?.id;
		if (!id) return;

		const timer = setTimeout(() => void pushAppearance(id), 600);
		return () => clearTimeout(timer);
	});

	/**
	 * Cinq onglets, pas plus : au-delà, les libellés se serrent et les cibles passent sous le seuil
	 * du doigt. Le foyer et la gestion des comptes sont donc allés dans le profil, qui est déjà
	 * l'écran des réglages — ce sont des destinations qu'on visite rarement, pas des allers-retours.
	 *
	 * La loupe vient en deuxième, contre les listes : c'est l'outil qu'on ouvre en rayon, une main
	 * sur le chariot, et le bord du pouce y arrive sans traverser la barre.
	 *
	 * Elle se sert de l'appareil photo arrière, devant une étiquette de produit : c'est un geste de
	 * téléphone. Sur un écran d'ordinateur elle n'aurait rien à montrer, on ne la propose pas.
	 */
	const nav = [
		{ href: '/', key: 'nav.lists', icon: ListChecks, handheld: false },
		{ href: '/magnifier', key: 'nav.magnifier', icon: ZoomIn, handheld: true },
		{ href: '/shops', key: 'nav.shops', icon: Store, handheld: false },
		{ href: '/cards', key: 'nav.cards', icon: CreditCard, handheld: false },
		{ href: '/profile', key: 'nav.profile', icon: User, handheld: false }
	];

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	/** La loupe occupe toute la surface pour agrandir une étiquette : rien ne flotte par-dessus. */
	const hidesCreate = $derived(page.url.pathname.startsWith('/magnifier'));

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
	<!--
		Les écrans hors session tiennent en une carte : posés en haut, ils laissaient sur un grand
		écran un vide de deux tiers de page sous eux. `safe` fait toute la règle — quand le contenu
		dépasse la hauteur disponible, l'alignement retombe sur le haut au lieu de couper le début,
		ce qui arrive dès qu'un clavier logiciel s'ouvre.
	-->
	<main class="fl-rise mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center-safe px-4 py-10">
		{@render children()}
	</main>
{:else}
	<div class="min-h-dvh md:grid md:grid-cols-[16rem_1fr]" style="--fl-navbar-h: {navbarH}px">
		<nav
			bind:clientHeight={navbarH}
			class="fl-navbar bg-card fixed inset-x-0 bottom-0 z-10 border-t md:sticky md:top-0 md:h-dvh md:border-t-0 md:border-e"
			style="view-transition-name: nav"
			aria-label={t('nav.main')}
		>
			<p class="text-h2 hidden items-center gap-2.5 px-6 py-6 font-semibold md:flex">
				<Logo />
				{t('app.name')}
			</p>

			<!--
				Le bouton de création : sur téléphone, un disque plein posé en bas à droite, au-dessus de
				la barre, à la place que recommande Android. C'est là que le pouce arrive sans que la
				main change de prise, et c'est la place que les gens cherchent d'eux-mêmes.

				Au centre, il tombait au milieu de l'onglet Loupe : la cible principale masquait à demi
				une destination. Le liseré à la couleur du fond reste utile — c'est lui qui détache le
				disque du contenu qui défile derrière.

				Il disparaît sur la loupe, et seulement sur téléphone : là-bas le disque flotte sur
				l'étiquette qu'on essaie de lire. Sur grand écran il est dans la colonne, il ne
				recouvre rien, il y reste.

				Un seul élément pour les deux tailles d'écran, et non deux dont un masqué : deux boutons
				porteraient le même repère de test, et la visite guidée finirait par en désigner un
				invisible.
			-->
			<button
				type="button"
				onclick={() => {
					feedback.play('tap');
					menu?.show();
				}}
				data-test-id="nav-create"
				aria-haspopup="dialog"
				class="fl-press bg-primary text-primary-foreground shadow-fl-3 absolute end-4 bottom-full mb-4 flex size-[58px] items-center justify-center gap-0 rounded-full border-4 border-[var(--background)]
					md:static md:mx-3 md:mb-3 md:h-[max(2.75rem,44px)] md:w-[calc(100%-1.5rem)] md:justify-start md:gap-3 md:rounded-lg md:border-0 md:px-3 md:shadow-none
					{hidesCreate ? 'max-md:hidden' : ''}"
			>
				<Plus size={26} aria-hidden="true" />
				<span class="text-label sr-only font-medium md:not-sr-only">{t('nav.create')}</span>
			</button>

			<ul class="flex overflow-x-auto md:flex-col md:gap-1 md:overflow-x-visible md:px-3">
				{#each nav as { href, key, icon: Icon, handheld } (href)}
					{@const active = isActive(href)}
					<li class="min-w-fit flex-1" class:md:hidden={handheld}>
						<a
							{href}
							data-test-id="nav-{href}"
							aria-current={active ? 'page' : undefined}
							class="fl-press text-caption md:text-label relative flex flex-col items-center gap-1 px-2 py-2 md:flex-row md:gap-3 md:rounded-md md:px-3 md:py-3
								{active ? 'text-primary' : 'text-muted-foreground'}"
						>
							<!--
								La pastille de l'onglet actif est un élément à part, nommé pour la transition :
								elle glisse d'un onglet à l'autre pendant le changement de page. Nommer le lien
								entier ferait glisser son texte, qui se fondrait dans celui de l'onglet suivant.

								Sa forme est dans app.css : capsule derrière l'icône sur téléphone, ligne pleine
								dans la colonne. C'est l'enveloppe qui décide, en cessant d'être son bloc
								conteneur au-delà de 48rem.
							-->
							<span class="fl-nav-icon">
								{#if active}
									<span
										class="fl-nav-pill"
										style="view-transition-name: nav-active"
										aria-hidden="true"
									></span>
								{/if}
								<Icon size={22} class="relative" aria-hidden="true" />
							</span>
							<!-- La graisse redit l'onglet actif : la couleur ne doit pas le dire toute seule. -->
							<span class="relative {active ? 'font-medium' : ''}">{t(key)}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<div>
			<SyncStatus />
			<main class="mx-auto w-full max-w-3xl px-4 pt-6 pb-36 md:pb-10">
				{@render children()}
			</main>
		</div>
	</div>

	<CreateMenu bind:this={menu} />
{/if}
