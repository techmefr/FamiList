import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'fr.techmefr.familist',
	appName: 'FamiList',
	webDir: 'build',
	android: {
		adjustMarginsForEdgeToEdge: 'auto'
	},
	plugins: {
		SplashScreen: {
			launchAutoHide: false,
			backgroundColor: '#F1EDE5'
		}
	}
};

export default config;
