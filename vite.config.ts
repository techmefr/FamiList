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
