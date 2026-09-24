import { readFileSync } from 'node:fs';
import type { CapacitorConfig } from '@capacitor/cli';

const NON_FREE_PLUGINS = ['@capacitor-mlkit/barcode-scanning'];

const isFdroid = process.env.FAMILIST_FLAVOR === 'fdroid';

function freePlugins(): string[] {
	const { dependencies } = JSON.parse(readFileSync('package.json', 'utf8')) as {
		dependencies: Record<string, string>;
	};

	return Object.keys(dependencies).filter(
		(name) =>
			name.startsWith('@capacitor') &&
			!NON_FREE_PLUGINS.includes(name) &&
			!['@capacitor/core', '@capacitor/android', '@capacitor/ios'].includes(name)
	);
}

const config: CapacitorConfig = {
	appId: 'fr.techmefr.familist',
	appName: 'FamiList',
	webDir: 'build',
	android: {
		adjustMarginsForEdgeToEdge: 'auto',
		flavor: isFdroid ? 'fdroid' : 'play',
		...(isFdroid ? { includePlugins: freePlugins() } : {})
	},
	plugins: {
		SplashScreen: {
			launchAutoHide: false,
			backgroundColor: '#F1EDE5'
		}
	}
};

export default config;
