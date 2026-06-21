import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		exclude: ['@snap-engine/asset-base-svelte', '@snap-engine/snapsort-svelte']
	},
	server: {
		fs: {
			// Allow serving files from the parent directory.
			allow: ['..']
		}
	}
});
