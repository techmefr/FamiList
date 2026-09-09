<script module lang="ts">
	export type IllustrationName = 'cart' | 'lists' | 'cards' | 'chat' | 'shop' | 'inbox' | 'filter';
</script>

<script lang="ts">
	let { name, size = 140 }: { name: IllustrationName; size?: number } = $props();
</script>

<!--
	Les dessins des écrans vides.

	Du SVG écrit à la main plutôt qu'une bibliothèque d'animation ou des fichiers image : ils pèsent
	quelques centaines d'octets, ils suivent le thème clair et sombre tout seuls puisqu'ils sont
	peints avec les variables de couleur, et ils restent nets à n'importe quelle taille de texte.

	Ils sont décoratifs. La phrase en dessous dit tout ce qu'il y a à comprendre — un dessin qui
	porterait l'information laisserait sur le carreau qui ne le voit pas.
-->
<svg
	viewBox="0 0 160 160"
	width={size}
	height={size}
	role="presentation"
	aria-hidden="true"
	fill="none"
	data-test-class="illustration"
	data-illustration={name}
>
	<circle cx="80" cy="82" r="66" fill="var(--fl-primary-tint)" />

	{#if name === 'cart'}
		<path
			d="M34 66 Q80 52 126 66 L117 124 Q80 133 43 124 Z"
			stroke="var(--primary)"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<path
			d="M46 74 L52 122 M62 70 L66 126 M79 68 L79 128 M96 70 L92 126 M112 74 L106 122"
			stroke="var(--primary)"
			stroke-opacity="0.4"
			stroke-width="2"
		/>
		<path d="M40 68 Q80 60 120 68" stroke="var(--primary)" stroke-width="2.5" />
		<path
			d="M54 66 Q54 36 80 36 Q106 36 106 66"
			stroke="var(--secondary)"
			stroke-width="3"
			stroke-linecap="round"
		/>
	{:else if name === 'lists'}
		<rect
			x="42"
			y="38"
			width="76"
			height="94"
			rx="10"
			stroke="var(--primary)"
			stroke-width="3"
		/>
		<path
			d="M58 62 h44 M58 84 h44 M58 106 h28"
			stroke="var(--primary)"
			stroke-opacity="0.4"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<path
			d="M96 100 l8 9 16-19"
			stroke="var(--secondary)"
			stroke-width="4"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else if name === 'cards'}
		<rect
			x="30"
			y="58"
			width="88"
			height="56"
			rx="9"
			stroke="var(--primary)"
			stroke-opacity="0.4"
			stroke-width="3"
		/>
		<rect
			x="46"
			y="72"
			width="88"
			height="56"
			rx="9"
			fill="var(--card)"
			stroke="var(--primary)"
			stroke-width="3"
		/>
		<path
			d="M58 96 v14 M68 96 v14 M76 96 v14 M88 96 v14 M96 96 v14 M108 96 v14 M118 96 v14"
			stroke="var(--secondary)"
			stroke-width="3"
			stroke-linecap="round"
		/>
	{:else if name === 'chat'}
		<path
			d="M30 52 h74 a10 10 0 0 1 10 10 v34 a10 10 0 0 1 -10 10 h-40 l-20 16 v-16 h-14 a10 10 0 0 1 -10 -10 v-34 a10 10 0 0 1 10 -10 z"
			stroke="var(--primary)"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<path
			d="M48 72 h38 M48 88 h24"
			stroke="var(--primary)"
			stroke-opacity="0.4"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<circle cx="118" cy="60" r="12" fill="var(--secondary)" />
	{:else if name === 'shop'}
		<path
			d="M36 66 L46 42 h68 l10 24 z"
			stroke="var(--secondary)"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<path d="M42 66 v58 h76 v-58" stroke="var(--primary)" stroke-width="3" stroke-linejoin="round" />
		<path
			d="M68 124 v-30 h24 v30"
			stroke="var(--primary)"
			stroke-opacity="0.45"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<path d="M36 66 h88" stroke="var(--primary)" stroke-width="3" />
	{:else if name === 'inbox'}
		<path
			d="M34 88 L48 46 h64 l14 42 v34 a8 8 0 0 1 -8 8 h-80 a8 8 0 0 1 -8 -8 z"
			stroke="var(--primary)"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<path
			d="M34 88 h26 a4 4 0 0 1 4 4 a16 16 0 0 0 32 0 a4 4 0 0 1 4 -4 h26"
			stroke="var(--secondary)"
			stroke-width="3"
			stroke-linejoin="round"
		/>
	{:else if name === 'filter'}
		<path
			d="M40 48 h80 l-30 36 v34 l-20 10 v-44 z"
			stroke="var(--primary)"
			stroke-width="3"
			stroke-linejoin="round"
		/>
		<path
			d="M56 122 l48 -48"
			stroke="var(--secondary)"
			stroke-width="4"
			stroke-linecap="round"
		/>
	{/if}
</svg>
