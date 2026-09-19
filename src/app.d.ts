// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	/** Written by `config.js`, served beside the app and replaced by whoever hosts it. */
	var __FAMILIST_CONFIG__: { url?: string; anonKey?: string; sentryDsn?: string } | undefined;
}

export {};
