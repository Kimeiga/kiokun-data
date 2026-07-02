import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
	appId: 'dev.kiokun.webnative',
	appName: 'Kiokun Web',
	webDir: 'build-capacitor',
	server: {
		iosScheme: 'capacitor',
		appStartPath: '/'
	},
	plugins: {
		CapacitorSQLite: {
			iosDatabaseLocation: 'Library/CapacitorDatabase',
			iosIsEncryption: false,
			iosKeychainPrefix: 'kiokun-webnative'
		}
	}
};

export default config;
