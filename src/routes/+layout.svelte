<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { goto, onNavigate } from '$app/navigation';
	import {
		ListChecks,
		Store,
		CreditCard,
		User,
		ZoomIn,
		Plus,
		MessagesSquare,
		Users,
		ShieldCheck,
		Tags,
		CookingPot,
		Search
	} from '@lucide/svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { data } from '$stores/data.svelte';
	import { session } from '$stores/session.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { navDirection } from '$domain/motion';
	import { pushAppearance, syncAppearance } from '$lib/sync/appearance';
	import { registerServiceWorker } from '$native/pwa';
	import { install } from '$stores/install.svelte';
	import { reminderPlans } from '$domain/reminder';
	import { applyReminders } from '$native/reminders';
	import { applyNearbyWatch } from '$native/nearby';
	import SyncStatus from '$components/app/SyncStatus.svelte';
	import InstallBanner from '$components/app/InstallBanner.svelte';
	import CreateMenu from '$components/app/CreateMenu.svelte';
	import Logo from '$components/app/Logo.svelte';
	import HelpButton from '$components/app/HelpButton.svelte';
	import ReportPanel from '$components/app/ReportPanel.svelte';
	import SearchSheet from '$components/app/SearchSheet.svelte';
	import ListPanel from '$components/app/ListPanel.svelte';

	let { children } = $props();

	let menu = $state<CreateMenu | null>(null);
	let recherche = $state<SearchSheet | null>(null);

	/**
	 * La hauteur mesurée de l'élément de navigation, publiée en variable CSS.
	 *
	 * Les commandes flottantes d'une page — les filtres d'une liste — doivent se poser juste
	 * au-dessus de la barre du bas. Cette hauteur n'est pas une constante : la barre grandit avec la
	 * taille du texte et avec l'encoche de l'appareil, et une valeur écrite en dur mettrait le
	 * bouton dessous dès le premier cran d'agrandissement.
	 *
	 * C'est bien une mesure brute et non `--fl-navbar-h` : dans les deux autres régimes la
	 * navigation est une colonne haute comme l'écran, et publier sa hauteur sous ce nom ferait
	 * croire aux commandes flottantes qu'un plancher de 900 px leur barre le bas de la page. La
	 * feuille de style décide où la mesure compte.
	 */
	let navbarH = $state(0);

	i18n.init();
	session.init();
	registerServiceWorker();

	/**
	 * Le compteur d'ouvertures démarre ici, au lancement, et non quand le bandeau s'affiche : ce
	 * qu'on veut mesurer est justement le fait de revenir. L'écoute de `beforeinstallprompt` doit
	 * elle aussi être posée tout de suite — l'événement ne passe qu'une fois, et manqué, il est
	 * perdu pour toute la session.
	 */
	install.init();

	/**
	 * Les rappels de date, reposés d'un bloc à chaque changement.
	 *
	 * C'est ici et pas sur la page des listes parce que l'appareil doit rester à jour même si on
	 * n'y repasse jamais : une date choisie par quelqu'un d'autre du foyer arrive par la
	 * synchronisation, et c'est cet effet qui la transforme en alarme. Chaque appareil programme
	 * ses propres rappels depuis sa copie — personne n'envoie rien à personne, et tout le monde est
	 * prévenu.
	 *
	 * Rejoué au lancement, il rattrape aussi ce que le système a perdu : un redémarrage du
	 * téléphone ou une réinstallation vident les alarmes en attente.
	 */
	$effect(() => {
		const plans = reminderPlans(
			data.lists.map((list) => {
				const items = data.itemsOf(list.id);

				return {
					listId: list.id,
					name: list.name,
					eventDate: list.eventDate,
					total: items.length,
					done: items.filter((item) => item.checked).length
				};
			}),
			new Date()
		);

		void applyReminders(plans, (plan) => ({
			title: t('lists.reminderTitle', { name: plan.name }),
			body: t('lists.reminderBody', {
				date: new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'long' }).format(
					new Date(plan.eventDate)
				)
			})
		}));
	});

	/**
	 * La veille de proximité, reposée à chaque changement.
	 *
	 * Ici et pas sur la page des cartes : le magasin se croise en faisant autre chose, et la page
	 * des cartes est justement celle qu'on n'ouvre pas quand on a oublié qu'on avait une carte.
	 * L'effet ne fait que transmettre l'état courant — magasins, cartes, réglage — la couche native
	 * décide seule s'il y a une veille à démarrer ou à couper.
	 */
	$effect(() => {
		void applyNearbyWatch(settings.nearbyCards && session.isApproved, {
			shops: data.shops.map((shop) => ({
				shopId: shop.id,
				name: shop.name,
				brand: shop.brand,
				lat: shop.lat,
				lng: shop.lng
			})),
			cards: data.cards.map((card) => ({
				cardId: card.id,
				name: card.name,
				shopId: card.shopId,
				brand: card.brand
			})),
			texts: (alert) => ({
				title: t('cards.nearbyTitle', { shop: alert.shopName }),
				body: t('cards.nearbyBody', { card: alert.cardName })
			}),
			onOpen: (cardId) => goto(`/cards?card=${cardId}`)
		});
	});

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

		/**
		 * La session existe mais s'est arrêtée au mot de passe, alors que le compte exige un
		 * deuxième facteur. Ce n'est pas un compte en attente de validation : le renvoyer vers
		 * l'écran d'attente lui dirait quelque chose de faux, et surtout ne lui donnerait pas le
		 * champ où taper son code.
		 *
		 * La base refuse déjà toute lecture dans cet état ; ce détour évite en plus de lancer la
		 * synchronisation, qui vide les tables locales avant de les remplir.
		 */
		if (session.needsSecondFactor) {
			if (page.url.pathname !== '/auth/mfa') goto('/auth/mfa');
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

			startTour(page.url.pathname, () => settings.setTourSeen(true));
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
	 * Une seule table pour les trois régimes, et un champ qui dit où l'entrée a sa place.
	 *
	 * Trois régimes, mais deux jeux d'entrées seulement : la tablette en portrait reprend celui du
	 * téléphone. Ce n'est pas un raccourci, c'est la place disponible — le rail est une colonne
	 * étroite, elle porte des icônes surmontées d'un mot court, pas neuf destinations.
	 *
	 * `handheld` : téléphone et tablette en portrait, c'est-à-dire tout ce qui se tient à la main.
	 * La loupe se sert de l'appareil photo arrière devant une étiquette de produit — une tablette en
	 * a un, un écran d'ordinateur n'aurait rien à montrer.
	 *
	 * `desktop` : la colonne complète seulement. Dans une barre au pouce comme dans un rail, cinq
	 * onglets sont un maximum : au-delà, les libellés se serrent et les cibles passent sous le seuil
	 * du doigt. Y tiennent donc les quatre allers-retours du quotidien — les listes, la loupe, les
	 * discussions, les cartes. Les magasins en sortent : le bouton de création pose déjà un rayon et
	 * un magasin, et on ne va sur cet écran que pour ranger, pas en faisant ses courses. Le foyer,
	 * les comptes et le profil sont des destinations qu'on visite rarement ; hors de la colonne
	 * complète on y arrive par l'en-tête et par le profil, dans la colonne ils ont leur onglet comme
	 * le reste.
	 *
	 * La loupe vient en deuxième, contre les listes : c'est l'outil qu'on ouvre en rayon, une main
	 * sur le chariot, et le bord du pouce y arrive sans traverser la barre.
	 */
	const nav = [
		{ href: '/', key: 'nav.lists', icon: ListChecks, place: 'partout' },
		{ href: '/magnifier', key: 'nav.magnifier', icon: ZoomIn, place: 'handheld' },
		{ href: '/chat', key: 'nav.chat', icon: MessagesSquare, place: 'partout' },
		{ href: '/cards', key: 'nav.cards', icon: CreditCard, place: 'partout' },
		{ href: '/recipes', key: 'nav.recipes', icon: CookingPot, place: 'desktop' },
		{ href: '/shops', key: 'nav.shops', icon: Store, place: 'desktop' },
		{ href: '/prices', key: 'nav.prices', icon: Tags, place: 'desktop' },
		{ href: '/household', key: 'nav.household', icon: Users, place: 'desktop' },
		{ href: '/admin', key: 'nav.admin', icon: ShieldCheck, place: 'desktop', admin: true },
		{ href: '/profile', key: 'nav.profile', icon: User, place: 'desktop' }
	] as const;

	/** Les comptes ne s'affichent que pour qui peut les gérer. */
	const entries = $derived(nav.filter((entry) => !('admin' in entry) || session.isAdmin));

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	/**
	 * Ctrl+K, ⌘K sur Mac : le raccourci que tout le monde essaie déjà pour chercher. Il double le
	 * bouton de l'en-tête, il ne le remplace pas — sur téléphone il n'y a pas de clavier pour le
	 * taper, et c'est là que l'application sert le plus.
	 */
	function surRaccourci(event: KeyboardEvent) {
		if (event.key !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey) return;
		if (!session.isApproved) return;

		event.preventDefault();
		void recherche?.show();
	}

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

<svelte:window onkeydown={surRaccourci} />

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
	<div class="fl-shell" style="--fl-navbar-measured: {navbarH}px">
		<nav
			bind:clientHeight={navbarH}
			class="fl-navbar bg-card fixed inset-x-0 bottom-0 z-10 border-t"
			style="view-transition-name: nav"
			aria-label={t('nav.main')}
		>
			<!-- Le nom du foyer n'entre pas dans un rail de 5,5rem : en portrait il reste dans l'en-tête. -->
			<p class="text-h2 hidden items-center gap-2.5 px-6 py-6 font-semibold full:flex">
				<Logo />
				{t('app.name')}
			</p>

			<!--
				Le bouton de création : sur téléphone, un disque plein posé au-dessus de la barre, du côté
				de la main qui tient l'appareil — à droite par défaut, la place que recommande Android.
				C'est là que le pouce arrive sans que la main change de prise, et c'est la place que les
				gens cherchent d'eux-mêmes ; `fl-thumb-side` la déplace pour un gaucher.

				Au centre, il tombait au milieu de l'onglet Loupe : la cible principale masquait à demi
				une destination. Le liseré à la couleur du fond reste utile — c'est lui qui détache le
				disque du contenu qui défile derrière.

				Il disparaît sur la loupe, et seulement sur téléphone : là-bas le disque flotte sur
				l'étiquette qu'on essaie de lire. Dès que la navigation est une colonne — rail compris —
				il y reprend sa place dans le flux, ne recouvre rien, et y reste. En rail il garde son
				libellé caché : la colonne est trop étroite pour un mot à côté d'une icône.

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
				class="fl-press fl-thumb-side bg-primary text-primary-foreground shadow-fl-3 absolute bottom-full mb-4 flex size-[58px] items-center justify-center gap-0 rounded-full border-4 border-[var(--background)]
					md:static md:mx-3 md:mb-3 md:h-[max(2.75rem,44px)] md:w-[calc(100%-1.5rem)] md:rounded-lg md:border-0 md:px-3 md:shadow-none
					full:justify-start full:gap-3
					{hidesCreate ? 'phone:hidden' : ''}"
			>
				<Plus size={26} aria-hidden="true" />
				<span class="text-label sr-only font-medium full:not-sr-only">{t('nav.create')}</span>
			</button>

			<ul class="flex overflow-x-auto md:gap-1 md:px-3">
				{#each entries as { href, key, icon: Icon, place } (href)}
					{@const active = isActive(href)}
					<li
						class="min-w-fit flex-1 md:flex-none"
						class:full:hidden={place === 'handheld'}
						class:compact:hidden={place === 'desktop'}
					>
						<a
							{href}
							data-test-id="nav-{href}"
							aria-current={active ? 'page' : undefined}
							class="fl-press text-caption full:text-label relative flex flex-col items-center gap-1 px-2 py-2 full:flex-row full:gap-3 full:rounded-md full:px-3 full:py-3
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

		<ListPanel />

		<div>
			<SyncStatus />
			<InstallBanner />

			<!--
				L'en-tête. L'aide y est à la même place sur tous les écrans et à toutes les tailles :
				chercher le point d'interrogation ailleurs selon la page ferait perdre plus de temps
				qu'il n'en fait gagner.

				Partout où la navigation n'affiche que les destinations du quotidien — téléphone et
				tablette en portrait — elle porte en plus ce que la colonne complète montre d'elle-même :
				le logo et le nom, qui disent où l'on est, et le profil. Un réglage se cherche en haut
				de l'écran ; un aller-retour se fait avec le pouce, sur le bord.
			-->
			<header class="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 pt-3">
				<p class="text-h2 flex items-center gap-2 font-semibold full:hidden">
					<Logo />
					{t('app.name')}
				</p>

				<div class="ms-auto flex items-center gap-1">
					<!--
						La recherche est dans l'en-tête, à côté de l'aide, et à la même place sur les deux
						tailles d'écran. Elle n'entre pas dans la barre du bas : celle-ci porte des
						destinations, une par onglet, et la recherche n'en est pas une — elle ouvre une
						feuille par-dessus la page et la rend ensuite. Ajouter un cinquième onglet sur
						téléphone aurait en plus resserré les quatre autres sous le seuil du doigt.
					-->
					<button
						type="button"
						onclick={() => {
							feedback.play('tap');
							void recherche?.show();
						}}
						data-test-id="header-search"
						aria-label={t('search.open')}
						aria-haspopup="dialog"
						class="fl-press text-muted-foreground hover:text-foreground flex size-[max(2.5rem,44px)] items-center justify-center rounded-full"
					>
						<Search size={22} aria-hidden="true" />
					</button>
					<HelpButton />
					<a
						href="/profile"
						data-test-id="header-profile"
						aria-label={t('nav.profile')}
						aria-current={isActive('/profile') ? 'page' : undefined}
						class="fl-press text-muted-foreground flex size-[max(2.5rem,44px)] items-center justify-center rounded-full full:hidden"
					>
						<User size={22} aria-hidden="true" />
					</a>
				</div>
			</header>

			<main class="mx-auto w-full max-w-3xl px-4 pt-2 pb-36 md:pb-10">
				{@render children()}
			</main>
		</div>

		<!--
			Le signalement est posé ici, dans la grille, et non à côté d'elle : c'est cet élément qui
			publie `--fl-navbar-measured`, dont le panneau a besoin pour ne pas passer sous les onglets.
			Il vit hors des pages pour survivre à une navigation — on peut aller reproduire le
			problème ailleurs, le brouillon suit.
		-->
		<ReportPanel />
	</div>

	<CreateMenu bind:this={menu} />
	<SearchSheet bind:this={recherche} />
{/if}
