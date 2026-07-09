import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

function buildId(): string {
	if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA;
	if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
	try {
		return execSync('git rev-parse --short=12 HEAD').toString().trim();
	} catch {
		return 'local';
	}
}

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		__KIOKUN_BUILD_ID__: JSON.stringify(buildId())
	},
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
