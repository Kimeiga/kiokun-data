import { buildCharacterSupportData, type CharacterSupportSource } from '$lib/character-support';
import { json, type RequestHandler } from '@sveltejs/kit';

let sourcePromise: Promise<CharacterSupportSource> | null = null;

async function readStaticJson<T>(fetchFn: typeof fetch, path: string): Promise<T> {
	const response = await fetchFn(path);
	if (!response.ok) {
		throw new Error(`Failed to load ${path}: ${response.status}`);
	}
	return response.json() as Promise<T>;
}

function loadSource(fetchFn: typeof fetch): Promise<CharacterSupportSource> {
	sourcePromise ??= Promise.all([
		readStaticJson<Record<string, string>>(fetchFn, '/game_data/component_glosses.json'),
		readStaticJson<Record<string, string[]>>(fetchFn, '/game_data/char_taxonomy.json'),
		readStaticJson<CharacterSupportSource['componentUses']>(fetchFn, '/game_data/component_uses.json')
	]).then(([charGlosses, charTaxonomy, componentUses]) => ({
		charGlosses,
		charTaxonomy,
		componentUses
	}));

	return sourcePromise;
}

export const GET: RequestHandler = async ({ fetch, url }) => {
	const source = await loadSource(fetch);
	const chars = url.searchParams.getAll('char');
	const components = url.searchParams.getAll('component');
	const support = buildCharacterSupportData(source, { chars, components });

	return json(support, {
		headers: {
			'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
		}
	});
};
