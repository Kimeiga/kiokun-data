import { rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const outputDir = '.svelte-kit/cloudflare';
const generatedLargeAssets = [
	'assets/databases/KiokunDictionarySQLite.db',
	// The source-of-truth corpus is consumed by the Rust shard publisher. The
	// production app receives cards from those per-entry shards, and Pages has
	// a 25 MiB per-asset limit.
	'research/mnemonics/semantic_mnemonics_all_best_available.json'
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
