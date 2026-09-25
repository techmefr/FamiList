<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { data } from '$stores/data.svelte';
	import { feedback } from '$stores/feedback.svelte';
	import { settings } from '$stores/settings.svelte';
	import { createIntent, type CreateKind } from '$stores/create.svelte';
	import { t } from '$i18n/index.svelte';
	import {
		ShoppingBasket,
		ListPlus,
		LayoutList,
		Store,
		CreditCard,
		CookingPot,
		CalendarDays,
		X
	} from '@lucide/svelte';

	let dialog = $state<HTMLDialogElement | null>(null);

	/**
	 * Native `<dialog>` rather than a wrapper: the browser lays the scrim, traps the keyboard in the sheet,
	 * makes the rest of the page inert for screen readers and closes on Escape. Those are exactly the four
	 * behaviours a <div> would force us to rewrite, and to get wrong.
	 *
	 * Opening and closing go through these two functions, with no boolean alongside. A mirror of the state
	 * would have ended up lying: Escape closes the sheet without going through us, and a single missed
	 * `close` event is enough for the button to stay convinced it is already open and stop responding. Here
	 * the only truth is the browser's.
	 */
	export function show() {
		dialog?.showModal();
	}

	function hide() {
		dialog?.close();
	}

	/**
	 * An item is filed in a list: the one that is open, otherwise the last created. With no list at all, the
	 * offer makes no sense and disappears — "New list" then becomes the first gesture.
	 */
	function itemTarget() {
		const current = page.url.pathname.match(/^\/l\/([^/]+)/)?.[1];
		if (current) return `/l/${current}`;

		const last = data.lists.at(-1);
		return last ? `/l/${last.id}` : null;
	}

	const ACTIONS = [
		{ kind: 'item', icon: ShoppingBasket, target: itemTarget, field: null },
		{ kind: 'list', icon: ListPlus, target: () => '/', field: '[data-test-id="list-name"]' },
		// A recipe can start in several ways (typed, a link, a photo, the AI): the choice is its own screen.
		{ kind: 'recipe', icon: CookingPot, target: () => '/recipes/new', field: null },
		{ kind: 'mealPlan', icon: CalendarDays, target: () => '/meal-plan', field: null },
		{ kind: 'aisle', icon: LayoutList, target: () => '/shops', field: '[data-test-id="aisle-name"]' },
		{ kind: 'shop', icon: Store, target: () => '/shops', field: '[data-test-id="shop-name"]' },
		{ kind: 'card', icon: CreditCard, target: () => '/cards', field: '[data-test-id="card-name"]' }
	] satisfies { kind: CreateKind; icon: unknown; target: () => string | null; field: string | null }[];

	const available = $derived(ACTIONS.filter((action) => action.target() !== null));

	/**
	 * The field does not always exist when the navigation ends: the home and cards screens unfold their form
	 * on the next effect. We retry a few times rather than bet on a single delay.
	 *
	 * `setTimeout` and not `requestAnimationFrame`: the second does not fire in a hidden tab, and a creation
	 * started just before switching app would leave the cursor nowhere.
	 */
	function focusField(selector: string, tries = 12) {
		const field = document.querySelector<HTMLElement>(selector);

		if (field) {
			field.focus();
			field.scrollIntoView({ block: 'center', behavior: settings.animates ? 'smooth' : 'auto' });
			return;
		}

		if (tries > 0) setTimeout(() => focusField(selector, tries - 1), 24);
	}

	async function choose(action: (typeof ACTIONS)[number]) {
		const href = action.target();
		if (!href) return;

		feedback.play('tap');
		hide();
		createIntent.request(action.kind);

		await goto(href);
		await tick();

		// The item opens a sheet, which places its own focus. The others unfold a form already in the page:
		// there, we have to go and put the cursor in it.
		if (action.field) focusField(action.field);
	}
</script>

<dialog
	bind:this={dialog}
	onclick={(event) => {
		// The sheet is transparent and only the size of the card: a click reaching the sheet itself comes from
		// the scrim, so from beside it. We close, as any sheet would.
		if (event.target === dialog) hide();
	}}
	class="fl-sheet"
	aria-labelledby="create-title"
	data-test-id="create-menu"
>
	<div
		class="bg-card relative rounded-t-2xl border p-4 md:rounded-2xl"
		class:fl-rise={settings.animates}
	>
		<h2 id="create-title" class="text-h2 pe-12 font-semibold">{t('create.title')}</h2>

		<ul class="mt-4 space-y-1">
			{#each available as action (action.kind)}
				{@const Icon = action.icon}
				<li>
					<button
						type="button"
						onclick={() => choose(action)}
						data-test-id="create-{action.kind}"
						class="fl-press hover:bg-muted flex min-h-[max(3.5rem,56px)] w-full items-center gap-3 rounded-lg px-2 text-start"
					>
						<span
							class="bg-[var(--fl-primary-tint)] text-primary grid size-11 shrink-0 place-items-center rounded-full"
						>
							<Icon size={22} aria-hidden="true" />
						</span>
						<span class="text-label font-medium">{t(`create.${action.kind}`)}</span>
					</button>
				</li>
			{/each}
		</ul>

		<!--
			The close button comes after the list in the document, even though it shows at the top right. The
			browser gives first focus to the first reachable element: better that it is a choice than the way out,
			otherwise pressing Enter closes the sheet as soon as it opens.
		-->
		<button
			type="button"
			onclick={hide}
			aria-label={t('common.close')}
			data-test-id="create-close"
			class="fl-press text-muted-foreground hover:bg-muted absolute end-3 top-3 grid min-h-[max(2.75rem,44px)] min-w-[44px] place-items-center rounded-full"
		>
			<X size={22} aria-hidden="true" />
		</button>
	</div>
</dialog>
