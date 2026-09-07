<script lang="ts">
	import { Switch as SwitchPrimitive } from "bits-ui";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		checked = $bindable(false),
		size = "default",
		...restProps
	}: WithoutChildrenOrChild<SwitchPrimitive.RootProps> & {
		size?: "sm" | "default" | "lg";
	} = $props();
</script>

<!--
	Le modèle shadcn stylait l'état sur des variantes data-checked:, que bits-ui n'émet pas — il pose
	data-state="checked". Fond de la piste et déplacement du bouton vivent donc dans app.css, sous
	[data-slot='switch'] : deux règles claires plutôt que des variantes enchaînées dont l'ordre de
	génération faisait gagner « coché » dans les deux états.

	La taille lg reprend les proportions du prototype (52 × 31). C'est celle des réglages :
	l'application vise aussi des personnes qui grossissent le texte, un interrupteur de 18 px de haut
	y est un obstacle.
-->

<SwitchPrimitive.Root
	bind:ref
	bind:checked
	data-slot="switch"
	data-size={size}
	class={cn(
		"shrink-0 rounded-full border border-transparent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] data-[size=lg]:h-[31px] data-[size=lg]:w-[52px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 peer group/switch relative inline-flex items-center outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50",
		className
	)}
	{...restProps}
>
	<SwitchPrimitive.Thumb
		data-slot="switch-thumb"
		class="bg-background shadow-fl-1 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=lg]/switch:size-[25px] pointer-events-none block rounded-full ring-0"
	/>
</SwitchPrimitive.Root>
