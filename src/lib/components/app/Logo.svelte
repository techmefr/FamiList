<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<!--
	Decorative, therefore silent: the brand is always placed next to the written name, and "FamiList FamiList"
	would serve nobody. The speaking version lives in static/logo.svg.

	Height in `em`, colour in `currentColor`: the drawing follows the neighbouring text, including when the
	font is enlarged. `shrink-0` because an SVG is a replaced element — it would let itself be squashed in
	width instead of pushing.
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
