import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const GET: RequestHandler = async ({ params }) => {
	const { word } = params;
	
	try {
		// In development, serve from local output_dictionary folder
		const filePath = join(process.cwd(), '..', 'output_dictionary', `${word}.json`);
		const content = await readFile(filePath, 'utf-8');
		const data = JSON.parse(content);
		
		return json(data);
	} catch (err) {
		console.error(`Failed to load dictionary file for "${word}":`, err);
		throw error(404, `Dictionary entry for "${word}" not found`);
	}
};

