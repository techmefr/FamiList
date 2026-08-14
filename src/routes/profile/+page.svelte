<script lang="ts">
	import { settings, type Theme, type TypeScale } from '$stores/settings.svelte';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';

	const themes: { value: Theme; label: string }[] = [
		{ value: 'light', label: 'Clair' },
		{ value: 'dark', label: 'Sombre' },
		{ value: 'system', label: 'Système' }
	];

	const scales: { value: TypeScale; label: string }[] = [
		{ value: 'compact', label: 'Compact' },
		{ value: 'normal', label: 'Normal' },
		{ value: 'large', label: 'Grand' }
	];
</script>

<svelte:head>
	<title>Profil — FamiList</title>
</svelte:head>

<h1 class="text-h1 font-semibold">Profil</h1>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title class="text-h2">Apparence</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-6">
		<fieldset>
			<legend class="text-label mb-2 font-medium">Thème</legend>
			<div class="flex flex-wrap gap-2">
				{#each themes as { value, label } (value)}
					<Label
						class="border-input has-checked:border-primary has-checked:bg-[var(--fl-primary-tint)]
							has-checked:text-primary flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2"
					>
						<input
							type="radio"
							name="theme"
							{value}
							checked={settings.theme === value}
							onchange={() => settings.setTheme(value)}
							data-test="theme-{value}"
							class="sr-only"
						/>
						{label}
					</Label>
				{/each}
			</div>
		</fieldset>

		<fieldset>
			<legend class="text-label mb-2 font-medium">Taille du texte</legend>
			<div class="flex flex-wrap gap-2">
				{#each scales as { value, label } (value)}
					<Label
						class="border-input has-checked:border-primary has-checked:bg-[var(--fl-primary-tint)]
							has-checked:text-primary flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2"
					>
						<input
							type="radio"
							name="type-scale"
							{value}
							checked={settings.typeScale === value}
							onchange={() => settings.setTypeScale(value)}
							data-test="scale-{value}"
							class="sr-only"
						/>
						{label}
					</Label>
				{/each}
			</div>
			<p class="text-product mt-4">Tomates grappe — 500 g</p>
			<p class="text-muted-foreground text-caption">
				Aperçu à la taille réelle d'un article dans une liste.
			</p>
		</fieldset>
	</Card.Content>
</Card.Root>
