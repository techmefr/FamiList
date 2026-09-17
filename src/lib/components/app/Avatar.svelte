<script lang="ts">
	import { tintForWhiteText } from '$domain/tint';
	import type { Member } from '$db/schema';

	let {
		member,
		size = 44,
		ring = false
	}: { member: Member; size?: number; ring?: boolean } = $props();

	/** The photo fills the badge; with no photo, it is the initials on the member's colour. */
	const background = $derived(tintForWhiteText(member.tint));
</script>

<!--
	The portrait is decorative: the person's name is always written beside it, or carried by the text around
	the stack. Doubling it with an `alt` would say the same first name twice.

	The border is only there for overlapping stacks — without it, four touching discs form a continuous blob
	where the heads can no longer be counted.
-->
<span
	class="grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white {ring
		? 'border-card border-2'
		: ''}"
	style="width: {size}px; height: {size}px; background: {background}; font-size: {Math.round(size * 0.4)}px"
	data-test-class="avatar"
	aria-hidden="true"
>
	{#if member.avatar}
		<img src={member.avatar} alt="" class="size-full object-cover" />
	{:else}
		{member.initial}
	{/if}
</span>
