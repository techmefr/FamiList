<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	let {
		icon: Icon,
		align = 'center',
		action,
		children
	}: {
		icon?: Component;
		align?: 'center' | 'top';
		action?: Snippet;
		children: Snippet;
	} = $props();
</script>

<!--
	Une icône posée dans le champ, pas à côté : elle dit de quoi il s'agit sans prendre une ligne
	de plus, ce qui compte sur un téléphone et davantage encore aux grands crans de texte. Le
	libellé reste — l'icône l'illustre, elle ne le remplace pas, et un dessin seul ne se lit pas de
	la même façon par tout le monde.

	`start-3` en propriété logique : en arabe, le champ se lit dans l'autre sens et
	l'icône passe à droite sans qu'on ait à le prévoir. Le retrait qui lui fait la place est dans
	app.css : il vaut pour input, select et textarea, et aucun appelant n'a à y penser.

	`align` existe pour la zone de texte : sur plusieurs lignes, une icône centrée verticalement
	flotterait au milieu de la saisie au lieu d'annoncer le champ.

	L'icône prend la couleur d'accent quand le champ reçoit le focus. C'est le seul mouvement, et
	il sert : au clavier, il redit où l'on est, en même temps que le contour de focus.

	`data-slot="field"` reprend l'écart libellé / commande d'app.css : l'enveloppe s'intercale entre
	les deux, et sans ce repère le libellé retomberait collé au champ.

	`action` est la place réservée à une commande en fin de champ — l'œil du mot de passe, le
	recalcul du trigramme. Elle est dans le champ et non à côté : c'est là qu'on regarde en tapant,
	et sur un téléphone une case posée en dessous se trouve sous le clavier. Le retrait qui lui fait
	la place est dans app.css, déclenché par la présence même de la commande.

	L'icône est facultative, et c'est le seul cas où elle manque : un champ de trois caractères
	centrés n'a pas la largeur pour une icône de tête et un bouton de fin, et son libellé suffit.
-->
<div class="relative" data-slot="field">
	{#if Icon}
		<Icon
			size={20}
			aria-hidden="true"
			class={'text-muted-foreground pointer-events-none absolute start-3 transition-colors ' +
				(align === 'top' ? 'top-3.5' : 'top-1/2 -translate-y-1/2')}
		/>
	{/if}
	{@render children()}
	{#if action}
		<div class="absolute inset-y-0 end-0 flex items-center" data-slot="field-action">
			{@render action()}
		</div>
	{/if}
</div>
