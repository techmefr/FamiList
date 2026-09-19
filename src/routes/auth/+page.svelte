<script lang="ts">
	import { t } from '$i18n/index.svelte';
	import Logo from '$components/app/Logo.svelte';
	import AuthForm from '$components/app/AuthForm.svelte';

	/**
	 * The title follows the chosen tab: the page announced "Sign in" above a sign-up form, which is exactly
	 * the kind of detail that makes you doubt you clicked in the right place.
	 */
	let mode = $state<'signin' | 'signup'>('signin');

	const title = $derived(mode === 'signin' ? t('auth.title') : t('auth.signUp'));
	const body = $derived(mode === 'signin' ? t('auth.signInBody') : t('auth.signUpBody'));
</script>

<svelte:head>
	<title>{title} — {t('app.name')}</title>
</svelte:head>

<div class="fl-auth-glow" aria-hidden="true"></div>

<!--
	The brand mark, on its own, in a coloured badge: a single focal point at the top of an otherwise empty
	screen, the way a paid app's welcome screen introduces itself before asking anything.
-->
<div
	class="bg-primary text-primary-foreground shadow-fl-2 mx-auto flex size-16 items-center justify-center rounded-[1.375rem]"
>
	<Logo class="h-8" />
</div>

<p class="text-muted-foreground text-label mt-4 text-center font-medium tracking-wide uppercase">
	{t('app.name')}
</p>

<h1 class="text-display mt-2 text-center leading-tight font-semibold tracking-tight">{title}</h1>
<p class="text-muted-foreground mt-2 text-center text-balance">{body}</p>

<AuthForm bind:mode />
