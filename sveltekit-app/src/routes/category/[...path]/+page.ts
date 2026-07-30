import type { PageLoad } from './$types';
import { error, isHttpError } from '@sveltejs/kit';
import { buildCategorySeo, type PageSeo } from '$lib/seo';

export interface CharacterEntry {
	char: string;
	gloss: string;
}

export interface PageData {
	categoryPath: string[];
	characters: CharacterEntry[];
	subcategories: string[];
	totalCharacters: number;
	seo: PageSeo;
}

interface CategoryIndex {
	categoryPath: string[];
	characters: CharacterEntry[];
	subcategories: string[];
	totalCharacters: number;
}

export const load: PageLoad<PageData> = async ({ params, fetch }) => {
	const pathString = params.path || '';
	const categoryPath = pathString ? pathString.split('/') : [];
	const encodedPath = categoryPath.map(encodeURIComponent).join('/');
	const indexUrl = `/category_data/${encodedPath ? `${encodedPath}/` : ''}index.json`;

	try {
		const response = await fetch(indexUrl);
		if (response.status === 404) {
			throw error(404, 'Category not found');
		}
		if (!response.ok) {
			throw error(500, 'Failed to load category');
		}

		const category = await response.json() as CategoryIndex;
		return {
			...category,
			seo: buildCategorySeo(categoryPath)
		};
	} catch (err) {
		if (isHttpError(err)) throw err;
		console.error('Failed to load category:', err);
		throw error(500, 'Failed to load category');
	}
};
