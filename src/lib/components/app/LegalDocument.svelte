<script lang="ts">
	import { i18n, t } from '$i18n/index.svelte';
	import { Button } from '$components/ui/button';
	import {
		LEGAL_DOCUMENTS,
		legalLanguage,
		legalPath,
		legalText,
		splitPlaceholders,
		type LegalDocumentId
	} from '$domain/legal';

	let { doc }: { doc: LegalDocumentId } = $props();

	const text = $derived(legalText(doc, i18n.locale));
	const lang = $derived(legalLanguage(i18n.locale));
	const others = $derived(LEGAL_DOCUMENTS.filter((id) => id !== doc));
</script>

<svelte:head>
	<title>{text.title} — {t('app.name')}</title>
</svelte:head>

{#snippet rich(value: string)}
	{#each splitPlaceholders(value) as part, index (index)}
		{#if part.placeholder}
			<mark class="bg-destructive/15 text-destructive rounded px-1 font-medium" data-test-class="legal-placeholder"
				>{part.text}</mark
			>
		{:else}
			{part.text}
		{/if}
	{/each}
{/snippet}

<article {lang} class="flex flex-col gap-6" data-test-id="legal-{doc}">
	<header>
		<h1 class="text-h1 font-semibold" data-test-id="legal-title">{text.title}</h1>
		<p class="text-muted-foreground text-caption mt-1">
			{t('legal.updated')}
			{@render rich(text.updated)}
		</p>
	</header>

	{#each text.sections as section (section.heading)}
		<section class="flex flex-col gap-2">
			<h2 class="text-h2 font-semibold">{section.heading}</h2>
			{#each section.paragraphs ?? [] as paragraph (paragraph)}
				<p>{@render rich(paragraph)}</p>
			{/each}
			{#if section.items}
				<ul class="flex list-disc flex-col gap-1 ps-6">
					{#each section.items as item (item)}
						<li>{@render rich(item)}</li>
					{/each}
				</ul>
			{/if}
			{#if section.link}
				<p>
					<Button href={section.link.href} variant="outline" data-test-id="legal-section-link" class="fl-press">
						{section.link.label}
					</Button>
				</p>
			{/if}
		</section>
	{/each}

	<nav aria-label={t('legal.title')} class="border-t pt-4">
		<ul class="flex flex-wrap gap-x-4 gap-y-2">
			{#each others as id (id)}
				<li>
					<a href={legalPath(id)} class="text-primary text-label hover:underline" data-test-id="legal-link-{id}">
						{t(`legal.${id}`)}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</article>
