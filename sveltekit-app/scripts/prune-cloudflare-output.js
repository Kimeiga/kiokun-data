import { rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const outputDir = '.svelte-kit/cloudflare';
const generatedLargeAssets = [
	'assets/databases/KiokunDictionarySQLite.db'
];

for (const relativePath of generatedLargeAssets) {
	const fullPath = join(outputDir, relativePath);
	try {
		const file = await stat(fullPath);
		await rm(fullPath);
		console.log(`Removed ${relativePath} (${Math.round(file.size / 1024 / 1024)} MiB) from Pages output`);
	} catch (error) {
		if (error?.code !== 'ENOENT') {
			throw error;
		}
	}
}
