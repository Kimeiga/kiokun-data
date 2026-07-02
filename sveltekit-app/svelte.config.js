import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isCapacitor = process.env.KIOKUN_CAPACITOR === '1';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: isCapacitor
			? adapterStatic({
					pages: 'build-capacitor',
					assets: 'build-capacitor',
					fallback: 'index.html',
					strict: false
				})
			: adapterCloudflare(),
		serviceWorker: {
			register: !isCapacitor
		}
	}
};

export default config;
