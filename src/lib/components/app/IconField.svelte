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
	An icon set inside the field, not beside it: it says what this is about without taking one more line, which
	counts on a phone and even more at the large text steps. The label stays — the icon illustrates it, it does
	not replace it, and a drawing alone is not read the same way by everybody.

	`start-3` as a logical property: in Arabic, the field reads the other way round and the icon moves to the
	right with no need to plan for it. The indent making room for it is in app.css: it holds for input, select
	and textarea, and no caller has to think about it.

	`align` exists for the textarea: over several lines, a vertically centred icon would float in the middle of
	what is being typed instead of announcing the field.

	The icon takes the accent colour when the field receives focus. It is the only movement, and it serves: on
	the keyboard, it says again where you are, at the same time as the focus outline.

	`data-slot="field"` takes app.css's label / control gap: the wrapper comes between the two, and without
	this marker the label would fall back stuck to the field.

	`action` is the place reserved for a control at the end of the field — the password eye, the three-letter
	code recompute. It is in the field and not beside it: that is where you look while typing, and on a phone
	a box placed underneath ends up under the keyboard. The indent making room for it is in app.css, triggered
	by the very presence of the control.

	The icon is optional, and that is the only case where it is missing: a field of three centred characters
	does not have the width for a leading icon and a trailing button, and its label is enough.
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
