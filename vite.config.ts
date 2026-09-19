import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';

const CONFIG_PATH = 'config.js';

/**
 * Writes the instance configuration next to the app instead of into it.
 *
 * `$env/static/public` would inline the two values in the bundle, which ties a build to one database and
 * makes a publishable image impossible: every family would have to rebuild to point the app at their own.
 * Here the same file is loaded by a plain script tag before the app starts, so the values can be replaced
 * on the machine that serves it — a container rewrites this one file at start-up, and nothing else moves.
 *
 * Read from the environment all the same, `.env` included: there is still only one place to say where the
 * database is, and the hosted build keeps working with the variables it already has.
 */
function instanceConfig(mode: string): Plugin {
	const body = () => {
		const env = loadEnv(mode, process.cwd(), 'PUBLIC_');

		return `window.__FAMILIST_CONFIG__ = ${JSON.stringify({
			url: env.PUBLIC_SUPABASE_URL ?? '',
			anonKey: env.PUBLIC_SUPABASE_ANON_KEY ?? '',
			// Facultatif : DSN Sentry propre a cette instance. Absent partout ailleurs, il ne change rien.
			sentryDsn: env.PUBLIC_SENTRY_DSN ?? ''
		})};\n`;
	};

	// Served rather than written to `static/`: a generated file sitting in the source tree is one more
	// thing to ignore in git, and one more way to end up committing somebody's database address.
	const serve = (server: { middlewares: Connect.Server }) => {
		server.middlewares.use(`/${CONFIG_PATH}`, (_request, response) => {
			response.setHeader('content-type', 'text/javascript');
			response.end(body());
		});
	};

	return {
		name: 'familist-instance-config',

		configureServer: serve,
		configurePreviewServer: serve,

		generateBundle() {
			this.emitFile({ type: 'asset', fileName: CONFIG_PATH, source: body() });
		}
	};
}

export default defineConfig(({ mode }) => ({
	plugins: [
		tailwindcss(),
		instanceConfig(mode),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			adapter: adapter({ fallback: 'index.html' }),

			// Registered by hand in $native/pwa: the same build is packaged by Capacitor, where a service worker
			// would be of no use and might serve the previous version again after an application update.
			serviceWorker: { register: false },

			// One entry per folder of `src/lib`, so that no import has to choose between `$db/supabase` and
			// `$lib/db/supabase` for the same file: a half-declared table gives two spellings for one module,
			// and a search for the callers of something then only turns up half of them.
			alias: {
				$components: 'src/lib/components',
				$domain: 'src/lib/domain',
				$stores: 'src/lib/stores',
				$db: 'src/lib/db',
				$native: 'src/lib/native',
				$sync: 'src/lib/sync',
				$i18n: 'src/lib/i18n',
				$crash: 'src/lib/crash',
				$scan: 'src/lib/scan',
				$tour: 'src/lib/tour',
				$utils: 'src/lib/utils.ts'
			}
		})
	]
}));
