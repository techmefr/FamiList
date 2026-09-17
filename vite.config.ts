import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter({ fallback: 'index.html' }),

			// Registered by hand in $native/pwa: the same build is packaged by Capacitor, where a service worker
			// would be of no use and might serve the previous version again after an application update.
			serviceWorker: { register: false },

			alias: {
				$components: 'src/lib/components',
				$domain: 'src/lib/domain',
				$stores: 'src/lib/stores',
				$db: 'src/lib/db',
				$native: 'src/lib/native'
			}
		})
	]
});
