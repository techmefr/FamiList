<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { ListChecks, ScanBarcode, CreditCard, User } from '@lucide/svelte';
	import { i18n, t } from '$lib/i18n/index.svelte';
	import { data } from '$stores/data.svelte';

	let { children } = $props();

	i18n.init();
	data.load();

	const nav = [
		{ href: '/', key: 'nav.lists', icon: ListChecks },
		{ href: '/scan', key: 'nav.scan', icon: ScanBarcode },
		{ href: '/cards', key: 'nav.cards', icon: CreditCard },
		{ href: '/profile', key: 'nav.profile', icon: User }
	];

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

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

	<main class="mx-auto w-full max-w-3xl px-4 pt-6 pb-28 md:pb-10">
		{@render children()}
	</main>
</div>
