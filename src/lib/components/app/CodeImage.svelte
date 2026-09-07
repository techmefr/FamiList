<script lang="ts">
	import { qrEncode } from '$domain/qr';
	import { linearCode } from '$domain/barcode';
	import { isMatrixFormat } from '$domain/code-format';
	import { t } from '$lib/i18n/index.svelte';

	let {
		value,
		codeType,
		height = 130
	}: { value: string; codeType: string; height?: number } = $props();

	const matrix = $derived(isMatrixFormat(codeType));
	const qr = $derived(matrix ? qrEncode(value) : null);
	const bars = $derived(matrix ? null : linearCode(value, codeType));

	const QUIET = 2;

	/** Une suite de modules sombres devient un seul rectangle : moins de nœuds, tracé plus net. */
	const runs = $derived.by(() => {
		if (!qr) return [];

		const out: { x: number; y: number; width: number }[] = [];

		for (let row = 0; row < qr.size; row++) {
			let col = 0;
			while (col < qr.size) {
				if (!qr.modules[row][col]) {
					col++;
					continue;
				}

				let length = 1;
				while (col + length < qr.size && qr.modules[row][col + length]) length++;
				out.push({ x: col + QUIET, y: row + QUIET, width: length });
				col += length;
			}
		}

		return out;
	});

	const barGeometry = $derived.by(() => {
		if (!bars) return null;

		const QUIET_MODULES = 10;
		let x = QUIET_MODULES;
		const rects: { x: number; width: number }[] = [];

		for (const element of bars) {
			if (element.dark) rects.push({ x, width: element.width });
			x += element.width;
		}

		return { rects, total: x + QUIET_MODULES };
	});
</script>

{#if qr}
	{@const total = qr.size + QUIET * 2}
	<svg
		viewBox="0 0 {total} {total}"
		width={height + 100}
		height={height + 100}
		shape-rendering="crispEdges"
		role="img"
		aria-label={t('cards.qrLabel')}
		class="h-auto w-full max-w-[17rem]"
		data-test="code-qr"
	>
		<rect width={total} height={total} fill="#fff" />
		{#each runs as run (`${run.y}-${run.x}`)}
			<rect x={run.x} y={run.y} width={run.width} height="1" fill="#111" />
		{/each}
	</svg>
{:else if barGeometry}
	<svg
		viewBox="0 0 {barGeometry.total} {height}"
		width="100%"
		{height}
		preserveAspectRatio="none"
		shape-rendering="crispEdges"
		role="img"
		aria-label={t('cards.barcodeLabel')}
		data-test="code-barcode"
	>
		<rect width={barGeometry.total} height={height} fill="#fff" />
		{#each barGeometry.rects as bar (bar.x)}
			<rect x={bar.x} y="0" width={bar.width} height={height} fill="#111" />
		{/each}
	</svg>
{:else}
	<!--
		Un code invalide n'est pas dessiné : un tracé approximatif scannerait une autre donnée.

		Rouge fixe, pas `text-destructive` : ce message s'affiche sur le cartouche blanc de la carte,
		blanc en toutes circonstances pour rester scannable. Le jeton de thème, lui, s'éclaircit en thème
		sombre — le message tombait alors à 2,4:1 sur ce blanc.
	-->
	<p class="text-label px-4 py-6 text-center text-red-700" data-test="code-invalid">
		{t('cards.invalidCode')}
	</p>
{/if}
