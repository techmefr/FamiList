<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<!--
	Décorative, donc muette : la marque est toujours posée à côté du nom écrit, et « FamiList
	FamiList » ne rendrait service à personne. La version parlante vit dans static/logo.svg.

	Hauteur en `em`, couleur en `currentColor` : le dessin suit le texte voisin, y compris quand on
	agrandit la police. `shrink-0` parce qu'un SVG est un élément remplacé — il se laisserait écraser
	en largeur au lieu de pousser.
-->
<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="6 9 54 47"
	class="h-[1.15em] w-auto shrink-0 {className}"
	aria-hidden="true"
	focusable="false"
>
	<g fill="currentColor" transform="translate(0 -1.5)">
		<path
			d="M8.8 14.5h6.1l2.3 7"
			fill="none"
			stroke="currentColor"
			stroke-width="4.4"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path
			d="M17.5 21.5H55.5L50 41.5H25.5Z M30.5 24H44V28.5H35.5V30.5H40.5V34.7H35.5V38H30.5Z"
			fill-rule="evenodd"
		/>
		<circle cx="27.5" cy="49.2" r="4.4" />
		<circle cx="45.5" cy="49.2" r="4.4" />
	</g>
</svg>
