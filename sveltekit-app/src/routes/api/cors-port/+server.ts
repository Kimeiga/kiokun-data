import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFileSync } from 'fs';
import { join } from 'path';

export const GET: RequestHandler = async () => {
	try {
		// Read the port from the .cors_port file
		const portFilePath = join(process.cwd(), '..', 'output_dictionary', '.cors_port');
		const port = readFileSync(portFilePath, 'utf-8').trim();
		return json({ port: parseInt(port, 10) });
	} catch (error) {
		// Fallback to default port if file doesn't exist
		return json({ port: 8000 });
	}
};

