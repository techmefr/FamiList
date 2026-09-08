<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';
	import Logo from '$components/app/Logo.svelte';
	import AuthForm from '$components/app/AuthForm.svelte';

	/**
	 * Le titre suit l'onglet choisi : la page annonçait « Connexion » au-dessus d'un formulaire
	 * d'inscription, ce qui est exactement le genre de détail qui fait douter d'avoir cliqué au bon
	 * endroit.
	 */
	let mode = $state<'signin' | 'signup'>('signin');

	const title = $derived(mode === 'signin' ? t('auth.title') : t('auth.signUp'));
	const body = $derived(mode === 'signin' ? t('auth.signInBody') : t('auth.signUpBody'));
</script>

<svelte:head>
	<title>{title} — {t('app.name')}</title>
</svelte:head>

<!--
	La marque avant tout le reste : c'est le premier écran de l'application, et jusqu'ici rien n'y
	disait où l'on était. Décorative deux fois — le nom est écrit à côté, et le titre le redit.
-->
<p class="text-h2 text-primary flex items-center justify-center gap-2.5 font-semibold">
	<Logo />
	{t('app.name')}
</p>

<h1 class="text-h1 mt-8 text-center font-semibold">{title}</h1>
<p class="text-muted-foreground mt-2 text-center text-balance">{body}</p>

<AuthForm bind:mode />
