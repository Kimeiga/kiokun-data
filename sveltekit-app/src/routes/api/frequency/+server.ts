import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface FrequencyWord {
	rank: number;
	word: string;
	reading: string;
	definition: string;
	common: boolean;
}

interface FrequencyList {
	japanese: FrequencyWord[];
	chinese: FrequencyWord[];
}

// Cache for frequency data - read once from static file
let cachedData: FrequencyList | null = null;

/**
 * GET /api/frequency
 *
 * Returns the top 1000 most common Japanese and Chinese words by frequency.
 * - Japanese: Uses JPDB frequency rank
 * - Chinese: Uses movie subtitle frequency rank
 *
 * Reads from a static JSON file generated during the Rust build process.
 */
export const GET: RequestHandler = async () => {
	// Return cached data if available
	if (cachedData) {
		return json(cachedData);
	}

	try {
		// Read from the static JSON file generated during build
		// In dev mode, the cwd is sveltekit-app, so we go up one level
		const jsonPath = dev
			? resolve(process.cwd(), '..', 'output_dictionary', 'frequency_list.json')
			: resolve(process.cwd(), 'output_dictionary', 'frequency_list.json');

		console.log('[FREQUENCY] Loading from static file:', jsonPath);

		const fileContent = readFileSync(jsonPath, 'utf-8');
		cachedData = JSON.parse(fileContent) as FrequencyList;

		console.log(`[FREQUENCY] Loaded ${cachedData.japanese.length} Japanese and ${cachedData.chinese.length} Chinese words`);

		return json(cachedData);

	} catch (e) {
		console.error('Failed to load frequency data:', e);
		throw error(500, `Failed to load frequency data: ${e instanceof Error ? e.message : 'Unknown error'}`);
	}
};
