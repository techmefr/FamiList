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
		CalendarDays,
		Search
	} from '@lucide/svelte';
	import { i18n, t } from '$i18n/index.svelte';
	import { data } from '$stores/data.svelte';
	import { session } from '$stores/session.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { ai } from '$stores/ai.svelte';
	import { navDirection } from '$domain/motion';
	import { pushAppearance, syncAppearance } from '$sync/appearance';
	import { registerServiceWorker } from '$native/pwa';
	import { watchCrashes } from '$crash/reporter';
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
	import SetupNeeded from '$components/app/SetupNeeded.svelte';
	import { isConfigured } from '$db/supabase';

	let { children } = $props();

	let menu = $state<CreateMenu | null>(null);
	let search = $state<SearchSheet | null>(null);

	/**
	 * The measured height of the navigation element, published as a CSS variable.
	 *
	 * A page's floating controls — a list's filters — must sit just above the bottom bar. That height is
	 * not a constant: the bar grows with the text size and with the device notch, and a hard-coded value
	 * would put the button underneath from the first size step.
	 *
	 * It is deliberately a raw measurement and not `--fl-navbar-h`: in the other two regimes the
	 * navigation is a column as tall as the screen, and publishing its height under that name would make
	 * the floating controls believe a 900px floor blocks the bottom of the page. The stylesheet decides
	 * where the measurement counts.
	 */
	let navbarH = $state(0);

	i18n.init();
	registerServiceWorker();

	// The session is the first thing that calls the database. On an instance that has none, opening it
	// would only produce failed requests behind the setup screen, and a session stuck on loading.
	if (isConfigured) session.init();

	/**
	 * The error nets, set up before anything else on the page.
	 *
	 * A crash at startup is the most costly — the application does not open at all — and it is exactly
	 * the one we would miss by hooking the listeners later. The two listeners cost nothing as long as
	 * nothing breaks.
	 */
	watchCrashes();

	/**
	 * The opening counter starts here, at launch, and not when the banner appears: what we want to
	 * measure is precisely the fact of coming back. The `beforeinstallprompt` listener must be set up
	 * right away too — the event only passes once, and missed, it is lost for the whole session.
	 */
	install.init();

	/**
	 * The date reminders, re-set as a whole on every change.
	 *
	 * Here and not on the lists page because the device must stay up to date even if you never go back
	 * there: a date chosen by somebody else in the household arrives through the sync, and it is this
	 * effect that turns it into an alarm. Each device schedules its own reminders from its copy — nobody
	 * sends anything to anyone, and everybody is warned.
	 *
	 * Replayed at launch, it also catches up what the system lost: a phone restart or a reinstall empties
	 * the pending alarms.
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
	 * The proximity watch, re-set on every change.
	 *
	 * Here and not on the cards page: you pass a shop while doing something else, and the cards page is
	 * precisely the one you do not open when you have forgotten you had a card. The effect only passes on
	 * the current state — shops, cards, setting — and the native layer alone decides whether there is a
	 * watch to start or to stop.
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

	// Exact comparison: /auth/pending speaks about an account, so it assumes a session. A
	// startsWith('/auth') would make it public and leave the waiting screen up after a sign-out.
	const PUBLIC_ROUTES = ['/auth', '/auth/reset', '/welcome'];
	const isPublic = $derived(PUBLIC_ROUTES.includes(page.url.pathname));

	/**
	 * First opening: we go through the welcome journey, which lets the text size be set before asking
	 * anything. The order is what matters — someone who cannot read the sign-in form cannot read the link
	 * to the settings either.
	 */
	const signedOutHome = $derived(settings.hasSeenWelcome ? '/auth' : '/welcome');

	/**
	 * The access lock is in the database: an unapproved account reads nothing, even calling the API
	 * directly. This redirect is only here to avoid showing an empty shell.
	 */
	$effect(() => {
		if (session.loading) return;

		if (!session.isSignedIn) {
			if (!isPublic) goto(signedOutHome);
			return;
		}

		/**
		 * A recovery link signs a person in on purpose, to let them set a new password — not because they
		 * proved they know one. This session is confined to that one screen regardless of where the link's
		 * redirect actually landed: checking the current route alone (`pathname === '/auth/reset'`) would
		 * only protect a person who happens to already be there, and grant full access to anyone who isn't
		 * — a misconfigured redirect-URL allowlist on the Supabase project, for one, falls back to the
		 * site's root.
		 */
		if (session.isPasswordRecovery) {
			if (page.url.pathname !== '/auth/reset') goto('/auth/reset');
			return;
		}

		/**
		 * The session exists but stopped at the password, while the account requires a second factor. This
		 * is not an account awaiting approval: sending them to the waiting screen would tell them something
		 * false, and above all would not give them the field to type their code in.
		 *
		 * The database already refuses every read in this state; this detour additionally avoids starting
		 * the sync, which empties the local tables before filling them.
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
	 * The AI key is re-read for each account, and forgotten between two.
	 *
	 * The id is read inside the effect so that an account change on the same device re-triggers it:
	 * without it, the previous person's key would stay in memory, and the recipes screen would offer to
	 * spend their credit for somebody else.
	 */
	$effect(() => {
		const id = session.user?.id;

		if (!session.isApproved || !id) {
			ai.reset();
			return;
		}

		ai.load();
	});

	/**
	 * The tour plays once, on the home screen, once the account is approved.
	 *
	 * driver.js and its stylesheet are loaded on demand: they only serve once in the life of an account,
	 * and making them come down on every opening would be paid by everyone for nobody. The delay lets the
	 * list paint — a bubble pointing at a button not yet rendered lands in the void.
	 *
	 * Being shown counts as seen, abandonment included: offering it again on every start would turn help
	 * into an obstacle. It can be replayed from the profile.
	 */
	$effect(() => {
		if (!session.isApproved || settings.hasSeenTour) return;
		if (page.url.pathname !== '/') return;

		let cancelled = false;
		let timer: ReturnType<typeof setTimeout>;

		// Up to five tries, three quarters of a second apart: `startTour` reports back when it found no
		// target at all, which happens when the delay landed before the navigation bar had finished
		// painting. Giving up after one silent miss would leave the account stuck without a tour and no way
		// to know it — retrying a few times covers a slow first paint without polling forever.
		const attempt = (triesLeft: number) => {
			timer = setTimeout(async () => {
				const { startTour } = await import('$tour');
				if (cancelled) return;

				const started = startTour(page.url.pathname, () => settings.setTourSeen(true));
				if (!started && triesLeft > 1) attempt(triesLeft - 1);
			}, 700);
		};

		attempt(5);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	});

	/**
	 * This account's first contact with this device: we decide once and for all which of the device or
	 * the database carries the most recent preferences.
	 *
	 * This effect depends only on the id, never on the settings themselves: re-reading it on every colour
	 * change would restart an arbitration in the middle of an edit.
	 */
	$effect(() => {
		const id = session.user?.id;
		if (id) void syncAppearance(settings, id);
	});

	/**
	 * Then every changed setting goes back to the database. The delay groups bursts — dragging the size
	 * slider crosses six steps, which would make six writes for a single gesture.
	 */
	$effect(() => {
		// Explicit read: it is what subscribes the effect to the whole of the settings.
		settings.snapshot();

		const id = session.user?.id;
		if (!id) return;

		const timer = setTimeout(() => void pushAppearance(settings, id), 600);
		return () => clearTimeout(timer);
	});

	/**
	 * One table for the three regimes, and a field saying where each entry belongs.
	 *
	 * Four regimes of destinations for three CSS regimes: the tablet in portrait mostly takes the phone's,
	 * because the rail is a narrow column, it carries icons above a short word, not nine destinations — but
	 * it has a hand free where the phone does not, so it can take one more than the phone.
	 *
	 * `handheld`: phone and tablet in portrait, that is, everything held in the hand. The magnifier uses
	 * the rear camera in front of a product label — a tablet has one, a computer screen would have nothing
	 * to show.
	 *
	 * `desktop`: the full column only. In a thumb bar as in a rail, five tabs are a maximum: beyond that,
	 * the labels crowd and the targets fall below the finger threshold. So it holds the four daily
	 * round trips — lists, magnifier, chats, cards. Shops drop out: the create button already adds an
	 * aisle and a shop, and you only go to that screen to tidy up, not while shopping. The accounts and the
	 * profile are destinations you visit rarely; outside the full column you reach them through the header
	 * and the profile, in the column they get their tab like the rest.
	 *
	 * `tablet-and-desktop`: the rail and the full column, not the phone. The household — its members, diets,
	 * the switcher between households — and the weekly meal plan are rarer stops than the four daily ones
	 * but not as rare as the accounts or the profile settings, and unlike them they stay reachable from a
	 * thumb: a tablet held with both hands can spare the extra icons, a phone held in one cannot. On the
	 * phone they stay where they always were — the household tucked under the profile, the meal plan reached
	 * from the recipes screen and the create menu.
	 *
	 * The magnifier comes second, against the lists: it is the tool you open in the aisle, one hand on the
	 * trolley, and the edge of the thumb reaches it without crossing the bar.
	 */
	const nav = [
		{ href: '/', key: 'nav.lists', icon: ListChecks, place: 'partout' },
		{ href: '/magnifier', key: 'nav.magnifier', icon: ZoomIn, place: 'handheld' },
		{ href: '/chat', key: 'nav.chat', icon: MessagesSquare, place: 'partout' },
		{ href: '/cards', key: 'nav.cards', icon: CreditCard, place: 'partout' },
		{ href: '/recipes', key: 'nav.recipes', icon: CookingPot, place: 'partout' },
		{ href: '/shops', key: 'nav.shops', icon: Store, place: 'desktop' },
		{ href: '/prices', key: 'nav.prices', icon: Tags, place: 'desktop' },
		{ href: '/household', key: 'nav.household', icon: Users, place: 'tablet-and-desktop' },
		{ href: '/meal-plan', key: 'nav.mealPlan', icon: CalendarDays, place: 'tablet-and-desktop' },
		{ href: '/admin', key: 'nav.admin', icon: ShieldCheck, place: 'desktop', admin: true },
		{ href: '/profile', key: 'nav.profile', icon: User, place: 'desktop' }
	] as const;

	/** Accounts only show for those who can manage them. */
	const entries = $derived(nav.filter((entry) => !('admin' in entry) || session.isAdmin));

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	/**
	 * Ctrl+K, ⌘K on Mac: the shortcut everyone already tries in order to search. It doubles the header
	 * button, it does not replace it — on a phone there is no keyboard to type it, and that is where the
	 * application serves most.
	 */
	function surRaccourci(event: KeyboardEvent) {
		if (event.key !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey) return;
		if (!session.isApproved) return;

		event.preventDefault();
		void search?.show();
	}

	/** The magnifier takes the whole surface to enlarge a label: nothing floats over it. */
	const hidesCreate = $derived(page.url.pathname.startsWith('/magnifier'));

	/**
	 * Page transition through the View Transitions API: the browser photographs the screen, lets
	 * SvelteKit replace the content, then animates the two images. Nothing stays transformed afterwards,
	 * unlike an animated container around the page — the prototype's created a stacking context that
	 * trapped the magnifier and the full-screen card.
	 *
	 * What slides is the root capture, and the navigation bar is named so as to be excluded from it (see
	 * app.css): naming `<main>` would make it a stacking context, and the trap would close the same way.
	 *
	 * The slide direction is set on <html> before starting: the CSS only has to read it. Without browser
	 * support, or with motion refused, navigation stays instant.
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

			// An interrupted transition rejects its promises — a redirect chained by the access lock, a hidden
			// tab, the next navigation taking over. Without these nets, the console gets an unhandled error
			// while the navigation itself did happen.
			//
			// No "one transition at a time" lock here: the second replaces the first, and a flag to reset always
			// ends up stuck on a promise that never settles — a hidden page, for instance — which would remove
			// transitions for the rest of the session.
			void transition.ready.catch(() => {});
			void transition.updateCallbackDone.catch(() => {});
			void transition.finished.catch(() => {});
		});
	});
</script>

<svelte:window onkeydown={surRaccourci} />

{#if !isConfigured}
	<SetupNeeded />
{:else if session.loading}
	<main class="grid min-h-dvh place-items-center px-4">
		<p class="text-muted-foreground">{t('common.loading')}</p>
	</main>
{:else if !session.isApproved}
	<!--
		The signed-out screens fit in a single card: set at the top, they left two thirds of a page empty
		below them on a large screen. `safe` is the whole rule — when the content exceeds the available
		height, the alignment falls back to the top instead of cutting off the start, which happens as soon
		as a software keyboard opens.
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
			<!-- The household name does not fit in a 5.5rem rail: in portrait it stays in the header. -->
			<p class="text-h2 hidden items-center gap-2.5 px-6 py-6 font-semibold full:flex">
				<Logo />
				{t('app.name')}
			</p>

			<!--
				The create button: on a phone, a solid disc above the bar, on the side of the hand holding the
				device — right by default, the place Android recommends. That is where the thumb lands without
				the hand changing grip, and it is the place people look for by themselves; `fl-thumb-side` moves
				it for a left-handed person.

				In the centre, it fell in the middle of the Magnifier tab: the main target half covered a
				destination. The rim in the background colour is still useful — it is what detaches the disc from
				the content scrolling behind.

				It disappears on the magnifier, and only on a phone: there the disc floats over the label you are
				trying to read. As soon as the navigation is a column — rail included — it goes back into the flow
				there, covers nothing, and stays. In the rail it keeps its label hidden: the column is too narrow
				for a word next to an icon.

				One element for both screen sizes, and not two with one hidden: two buttons would carry the same
				test marker, and the guided tour would end up pointing at an invisible one.
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
						class:phone:hidden={place === 'tablet-and-desktop'}
					>
						<a
							{href}
							data-test-id="nav-{href}"
							aria-current={active ? 'page' : undefined}
							class="fl-press text-caption full:text-label relative flex flex-col items-center gap-1 px-2 py-2 full:flex-row full:gap-3 full:rounded-md full:px-3 full:py-3
								{active ? 'text-primary' : 'text-muted-foreground'}"
						>
							<!--
								The active tab badge is a separate element, named for the transition: it slides from one tab
								to the next during the page change. Naming the whole link would slide its text, which would
								blend into the next tab's.

								Its shape is in app.css: a pill behind the icon on a phone, a full line in the column. The
								wrapper decides, by ceasing to be its containing block beyond 48rem.
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
							<!-- The weight repeats the active tab: colour must not say it on its own. -->
							<span class="fl-nav-label relative {active ? 'font-medium' : ''}">{t(key)}</span>
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
				The header. Help is in the same place on every screen and at every size: looking for the question
				mark somewhere else depending on the page would cost more time than it saves.

				Everywhere the navigation only shows the daily destinations — phone and tablet in portrait — it
				also carries what the full column shows by itself: the logo and the name, which say where you are,
				and the profile. A setting is looked for at the top of the screen; a round trip is made with the
				thumb, on the edge.
			-->
			<header class="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 pt-3">
				<p class="text-h2 flex items-center gap-2 font-semibold full:hidden">
					<Logo />
					{t('app.name')}
				</p>

				<div class="ms-auto flex items-center gap-1">
					<!--
						Search is in the header, next to help, and in the same place at both screen sizes. It does not
						go in the bottom bar: that one carries destinations, one per tab, and search is not one — it
						opens a sheet over the page and gives it back afterwards. Adding a fifth tab on a phone would
						also have squeezed the other four below the finger threshold.
					-->
					<button
						type="button"
						onclick={() => {
							feedback.play('tap');
							void search?.show();
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

			<!--
				The bottom padding used to be a flat `pb-36`: close enough to clear the create button most of the
				time, but the button's own footprint — the navigation bar plus its 58 px disc and margin — is not
				a constant, it grows with the text size just like `--fl-navbar-h` does. A page whose last card
				landed right at that boundary (the avatar hint on `/profile`, the join button on `/household`, a
				busy poll's last option) ended up with it half hidden behind the disc. The formula mirrors
				`fl-above-nav`'s so the two amounts cannot drift apart.
			-->
			<main
				class="mx-auto w-full max-w-5xl px-4 pt-2 pb-[calc(var(--fl-navbar-h,4rem)+58px+1.5rem)] md:pb-10"
			>
				{@render children()}
			</main>
		</div>

		<!--
			The report panel is placed here, inside the grid, and not beside it: this element is what
			publishes `--fl-navbar-measured`, which the panel needs so as not to slip under the tabs. It lives
			outside the pages so it survives a navigation — you can go and reproduce the problem elsewhere, the
			draft follows.
		-->
		<ReportPanel />
	</div>

	<CreateMenu bind:this={menu} />
	<SearchSheet bind:this={search} />
{/if}
