import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const { word } = params;

	try {
		// Get D1 database from platform bindings
		const db = platform?.env?.DB;
		
		if (!db) {
			throw new Error('Database not available');
		}

		// Query the database
		const result = await db
			.prepare('SELECT data FROM dictionary_entries WHERE word = ?')
			.bind(word)
			.first();

		if (!result) {
			throw error(404, `Character "${word}" not found`);
		}

		// Parse the JSON data
		const data = JSON.parse(result.data as string);

		// Return with cache headers
		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
			},
		});
	} catch (err) {
		console.error(`Failed to fetch dictionary entry for "${word}":`, err);
		throw error(500, 'Internal server error');
	}
};

