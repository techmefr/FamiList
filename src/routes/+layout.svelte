<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { ListChecks, ScanBarcode, CreditCard, User } from '@lucide/svelte';

	let { children } = $props();

	const nav = [
		{ href: '/', label: 'Listes', icon: ListChecks },
		{ href: '/scan', label: 'Scanner', icon: ScanBarcode },
		{ href: '/cards', label: 'Cartes', icon: CreditCard },
		{ href: '/profile', label: 'Profil', icon: User }
	];

	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<div class="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
	<nav
		class="bg-card fixed inset-x-0 bottom-0 z-10 border-t md:sticky md:top-0 md:h-dvh md:border-t-0 md:border-r"
		aria-label="Navigation principale"
	>
		<p class="hidden px-6 py-6 text-h2 font-semibold md:block">FamiList</p>

		<ul class="flex md:flex-col md:gap-1 md:px-3">
			{#each nav as { href, label, icon: Icon } (href)}
				{@const active = isActive(href)}
				<li class="flex-1">
					<a
						{href}
						data-test="nav-{label.toLowerCase()}"
						aria-current={active ? 'page' : undefined}
						class="flex flex-col items-center gap-1 px-2 py-3 text-caption md:flex-row md:gap-3 md:rounded-md md:px-3 md:text-label
							{active ? 'text-primary bg-[var(--fl-primary-tint)]' : 'text-muted-foreground'}"
					>
						<Icon size={22} aria-hidden="true" />
						{label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<main class="mx-auto w-full max-w-3xl px-4 pt-6 pb-28 md:pb-10">
		{@render children()}
	</main>
</div>
