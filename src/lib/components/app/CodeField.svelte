<script lang="ts">
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';

	let {
		id,
		label,
		hint,
		value = $bindable(''),
		normalize,
		length,
		testId,
		numeric = true
	}: {
		id: string;
		label: string;
		hint?: string;
		value?: string;
		normalize: (input: string) => string;
		length: number;
		testId: string;
		numeric?: boolean;
	} = $props();
</script>

<!--
	Un seul champ, et non une case par caractère.

	Les six petites cases sont partout, et elles sont mauvaises : un lecteur d'écran y annonce six
	champs sans nom, le collage n'y marche qu'au prix d'un bricolage, revenir en arrière d'un
	caractère demande de deviner quelle case a le focus, et un clavier logiciel se rouvre à chaque
	saut. Un champ unique reçoit le code collé d'un courriel, se corrige au retour arrière, et
	s'annonce une fois.

	`autocomplete="one-time-code"` est ce qui compte vraiment : sur un téléphone, le code reçu par
	SMS ou par courriel est proposé au-dessus du clavier, et il n'y a plus rien à recopier.
-->
<Label for={id}>{label}</Label>
<Input
	{id}
	{value}
	oninput={(event) => {
		const champ = event.currentTarget as HTMLInputElement;
		value = normalize(champ.value);
		// Réécrire la valeur : sans cela un caractère refusé resterait affiché, l'état et l'écran ne
		// diraient plus la même chose, et la personne croirait avoir tapé ce qu'on a jeté.
		champ.value = value;
	}}
	inputmode={numeric ? 'numeric' : 'text'}
	autocomplete="one-time-code"
	autocapitalize="characters"
	spellcheck={false}
	maxlength={numeric ? length : length + 1}
	aria-describedby={hint ? `${id}-hint` : undefined}
	data-test-id={testId}
	required
	class="text-product text-center font-medium tracking-[0.3em]"
/>

{#if hint}
	<p id="{id}-hint" class="text-muted-foreground text-caption mt-2">{hint}</p>
{/if}
