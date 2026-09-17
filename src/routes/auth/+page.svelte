<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
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

<!--
	The brand before everything else: this is the application's first screen, and until now nothing on it said
	where you were. Decorative twice over — the name is written beside it, and the title says it again.
-->
<p class="text-h2 text-primary flex items-center justify-center gap-2.5 font-semibold">
	<Logo />
	{t('app.name')}
</p>

<h1 class="text-h1 mt-8 text-center font-semibold">{title}</h1>
<p class="text-muted-foreground mt-2 text-center text-balance">{body}</p>

<AuthForm bind:mode />
