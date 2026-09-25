// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** The source opened on the "Create a recipe" screen, kept in history so Back returns to the tiles. */
			recipeSource?: import('$components/app/recipe-sources').RecipeSourceId;
		}
		// interface Platform {}
	}

	/** Written by `config.js`, served beside the app and replaced by whoever hosts it. */
	var __FAMILIST_CONFIG__: { url?: string; anonKey?: string; sentryDsn?: string } | undefined;
}

export {};
