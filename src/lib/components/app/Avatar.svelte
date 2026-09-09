<script lang="ts">
	import { tintForWhiteText } from '$domain/tint';
	import type { Member } from '$db/schema';

	let {
		member,
		size = 44,
		ring = false
	}: { member: Member; size?: number; ring?: boolean } = $props();

	/** La photo remplit la pastille ; sans photo, ce sont les initiales sur la couleur du membre. */
	const fond = $derived(tintForWhiteText(member.tint));
</script>

<!--
	Le portrait est décoratif : le nom de la personne est toujours écrit à côté, ou porté par le
	texte qui entoure la pile. Le doubler d'un `alt` ferait dire deux fois le même prénom.

	La bordure n'est là que pour les piles qui se chevauchent — sans elle, quatre disques accolés
	forment une tache continue où on ne compte plus les têtes.
-->
<span
	class="grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white {ring
		? 'border-card border-2'
		: ''}"
	style="width: {size}px; height: {size}px; background: {fond}; font-size: {Math.round(size * 0.4)}px"
	data-test-class="avatar"
	aria-hidden="true"
>
	{#if member.avatar}
		<img src={member.avatar} alt="" class="size-full object-cover" />
	{:else}
		{member.initial}
	{/if}
</span>
