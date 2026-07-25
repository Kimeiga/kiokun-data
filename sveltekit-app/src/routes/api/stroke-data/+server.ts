import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const STROKE_DATA_ORIGIN =
	'https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest';

function isSingleCharacter(value: string): boolean {
	return [...value].length === 1;
}

export const GET: RequestHandler = async ({ url, fetch }) => {
	const character = url.searchParams.get('char')?.trim() ?? '';
	if (!isSingleCharacter(character)) {
		throw error(400, 'A single character is required');
	}

	const upstream = await fetch(
		`${STROKE_DATA_ORIGIN}/${encodeURIComponent(character)}.json`
	);
	if (upstream.status === 404) {
		return new Response(null, {
			status: 204,
			headers: {
				'Cache-Control': 'public, max-age=86400'
			}
		});
	}
	if (!upstream.ok) {
		throw error(502, `Stroke data source unavailable (${upstream.status})`);
	}

	return new Response(upstream.body, {
		status: 200,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'public, max-age=604800, immutable'
		}
	});
};
