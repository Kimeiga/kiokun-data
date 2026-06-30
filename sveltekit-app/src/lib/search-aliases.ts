import aliasData from '$lib/generated/search-aliases.json';

interface SearchAliasData {
	japaneseToCanonical: Record<string, string>;
	aliases: Record<string, string[]>;
	characterVariants: Record<string, string[]>;
}

const data = aliasData as SearchAliasData;
const DEFAULT_MAX_TERMS = 24;

function addTerm(terms: Set<string>, term: string, maxTerms: number): boolean {
	const normalized = term.trim();
	if (!normalized || terms.has(normalized)) return terms.size < maxTerms;
	if (terms.size >= maxTerms) return false;
	terms.add(normalized);
	return true;
}

function expandCharacterVariants(query: string, maxTerms: number): string[] {
	let combinations = [''];

	for (const char of Array.from(query)) {
		const options = [char, ...(data.characterVariants[char] ?? [])];
		const uniqueOptions = [...new Set(options)];
		const next: string[] = [];

		for (const prefix of combinations) {
			for (const option of uniqueOptions) {
				next.push(prefix + option);
				if (next.length >= maxTerms) break;
			}
			if (next.length >= maxTerms) break;
		}

		combinations = next;
	}

	return combinations;
}

export function getSearchTarget(word: string, language: string): string {
	if (language === 'japanese') {
		return data.japaneseToCanonical[word] ?? word;
	}
	return word;
}

export function getCjkSearchTerms(query: string, maxTerms = DEFAULT_MAX_TERMS): string[] {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const terms = new Set<string>();
	addTerm(terms, trimmed, maxTerms);

	for (const alias of data.aliases[trimmed] ?? []) {
		addTerm(terms, alias, maxTerms);
	}

	for (const variant of expandCharacterVariants(trimmed, maxTerms)) {
		addTerm(terms, variant, maxTerms);
	}

	// Character expansion can produce a canonical form that has exact whole-word
	// aliases, e.g. 地图 -> 地圖 -> 地図.
	for (const term of [...terms]) {
		for (const alias of data.aliases[term] ?? []) {
			addTerm(terms, alias, maxTerms);
		}
	}

	return [...terms];
}
