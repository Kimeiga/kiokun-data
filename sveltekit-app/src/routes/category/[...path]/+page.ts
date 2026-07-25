import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';
import { buildCategorySeo, type PageSeo } from '$lib/seo';

/**
 * Character taxonomy mapping (char to category path array)
 */
interface CharTaxonomy {
	[char: string]: string[];
}

/**
 * Character gloss mapping (char to unique English keyword)
 */
interface CharGlosses {
	[char: string]: string;
}

/**
 * Character entry for display
 */
export interface CharacterEntry {
	char: string;
	gloss: string;
	taxonomy: string[];
}

/**
 * Page data returned by the load function
 */
export interface PageData {
	categoryPath: string[];
	characters: CharacterEntry[];
	subcategories: string[];
	seo: PageSeo;
}

// SSR enabled: fetches static JSON which SvelteKit serves on the server

export const load: PageLoad<PageData> = async ({ params, fetch }) => {
	const pathString = params.path || '';
	const categoryPath = pathString ? pathString.split('/') : [];

	try {
		// Load character glosses
		const glossesResponse = await fetch('/game_data/component_glosses.json');
		if (!glossesResponse.ok) {
			throw error(500, 'Failed to load character glosses');
		}
		const charGlosses: CharGlosses = await glossesResponse.json();

		// Load character taxonomy
		const taxonomyResponse = await fetch('/game_data/char_taxonomy.json');
		if (!taxonomyResponse.ok) {
			throw error(500, 'Failed to load character taxonomy');
		}
		const charTaxonomy: CharTaxonomy = await taxonomyResponse.json();

		// Find all characters that match this category path
		const characters: CharacterEntry[] = [];
		const subcategoriesSet = new Set<string>();

		for (const [char, taxonomy] of Object.entries(charTaxonomy)) {
			// Check if this character's taxonomy starts with our category path
			if (categoryPath.length === 0 || 
				(taxonomy.length >= categoryPath.length && 
				 categoryPath.every((cat, i) => taxonomy[i] === cat))) {
				
				// If the taxonomy is exactly our path, add the character
				if (taxonomy.length === categoryPath.length) {
					characters.push({
						char,
						gloss: charGlosses[char] || '',
						taxonomy
					});
				}
				// If there's more depth, track the next subcategory
				else if (taxonomy.length > categoryPath.length) {
					subcategoriesSet.add(taxonomy[categoryPath.length]);
				}
			}
		}

		// Sort subcategories alphabetically
		const subcategories = Array.from(subcategoriesSet).sort();

		// Sort characters by gloss
		characters.sort((a, b) => a.gloss.localeCompare(b.gloss));

		return {
			categoryPath,
			characters,
			subcategories,
			seo: buildCategorySeo(categoryPath)
		};
	} catch (err) {
		console.error('Failed to load category:', err);
		throw error(500, 'Failed to load category');
	}
};
