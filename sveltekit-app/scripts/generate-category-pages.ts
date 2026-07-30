import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface KanjiDetail {
	frequency?: number | null;
}

interface SortableCharacterEntry {
	char: string;
	gloss: string;
	frequency: number | null;
}

interface CategoryPage {
	categoryPath: string[];
	characters: SortableCharacterEntry[];
	subcategories: string[];
	totalCharacters: number;
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, '..');
const gameDataDirectory = path.join(appDirectory, 'static', 'game_data');
const outputDirectory = path.join(appDirectory, 'static', 'category_data');

const [taxonomy, glosses, details] = await Promise.all([
	readFile(path.join(gameDataDirectory, 'char_taxonomy.json'), 'utf8').then(JSON.parse) as Promise<Record<string, string[]>>,
	readFile(path.join(gameDataDirectory, 'component_glosses.json'), 'utf8').then(JSON.parse) as Promise<Record<string, string>>,
	readFile(path.join(gameDataDirectory, 'kanji_details.json'), 'utf8').then(JSON.parse) as Promise<Record<string, KanjiDetail>>
]);

const pages = new Map<string, CategoryPage>();

function pageFor(categoryPath: string[]): CategoryPage {
	const key = categoryPath.join('/');
	let page = pages.get(key);
	if (!page) {
		page = {
			categoryPath,
			characters: [],
			subcategories: [],
			totalCharacters: 0
		};
		pages.set(key, page);
	}
	return page;
}

pageFor([]);

for (const [char, characterPath] of Object.entries(taxonomy)) {
	for (let depth = 0; depth <= characterPath.length; depth += 1) {
		const categoryPath = characterPath.slice(0, depth);
		const page = pageFor(categoryPath);
		page.totalCharacters += 1;

		if (depth < characterPath.length) {
			const subcategory = characterPath[depth];
			if (!page.subcategories.includes(subcategory)) page.subcategories.push(subcategory);
		} else {
			page.characters.push({
				char,
				gloss: glosses[char] ?? '',
				frequency: details[char]?.frequency ?? null
			});
		}
	}
}

await rm(outputDirectory, { recursive: true, force: true });

for (const page of pages.values()) {
	page.subcategories.sort((left, right) => left.localeCompare(right));
	page.characters.sort((left, right) => {
		const leftFrequency = left.frequency ?? Number.MAX_SAFE_INTEGER;
		const rightFrequency = right.frequency ?? Number.MAX_SAFE_INTEGER;
		return leftFrequency - rightFrequency || left.gloss.localeCompare(right.gloss) || left.char.localeCompare(right.char);
	});

	const pageDirectory = path.join(outputDirectory, ...page.categoryPath);
	const output = {
		...page,
		characters: page.characters.map(({ frequency: _frequency, ...entry }) => entry)
	};
	await mkdir(pageDirectory, { recursive: true });
	await writeFile(
		path.join(pageDirectory, 'index.json'),
		`${JSON.stringify(output)}\n`,
		'utf8'
	);
}

console.log(`Generated ${pages.size} compact category pages.`);
