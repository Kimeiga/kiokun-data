import { goto } from '$app/navigation';
import { getDictionaryUrl } from '$lib/shard-utils';
import { dev } from '$app/environment';
import { deinflect, formatReasonChains, WordType, posToWordType } from '$lib/utils/deinflect';
import { koreanDeinflect, formatKoreanReasons, isHangulOnly } from '$lib/utils/korean-deinflect';
import type { DictionaryEntry } from '$lib/types';
import { tokenizeSentence } from '$lib/utils/sentence-tokenizer';
import { buildSentenceWordURL, getSentenceWords } from '$lib/stores/sentence.svelte';

export interface DeinflectionResult {
	originalWord: string;
	dictionaryForm: string;
	conjugationInfo: string;
}

/**
 * Result with multiple alternative matches
 */
export interface DeinflectionResults {
	originalWord: string;
	primary: DeinflectionResult;
	alternatives: DeinflectionResult[];
}

/**
 * Check if a string contains only hiragana characters
 */
function isHiraganaOnly(str: string): boolean {
	// Hiragana range: U+3040 to U+309F
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i);
		if (code < 0x3040 || code > 0x309F) {
			return false;
		}
	}
	return str.length > 0;
}

/**
 * Extract combined WordType from a dictionary entry's part-of-speech tags
 * Checks all senses and combines their POS types
 */
function getEntryWordType(entry: DictionaryEntry): number {
	let wordType = 0;
	// Check Japanese words for POS tags
	for (const word of entry.japanese_words || []) {
		for (const sense of word.sense || []) {
			if (sense.partOfSpeech) {
				wordType |= posToWordType(sense.partOfSpeech);
			}
		}
	}
	return wordType;
}

/**
 * Check if a deinflection candidate's expected type matches the dictionary entry's POS
 * Returns true if there's an overlap between expected types
 */
function validatePosMatch(candidateType: number, entryType: number): boolean {
	// Mask out intermediate types (stems) - we only care about actual word types
	const actualTypes = WordType.All; // IchidanVerb | GodanVerb | IAdj | KuruVerb | SuruVerb | SpecialSuruVerb | NounVS
	const candidateActual = candidateType & actualTypes;
	const entryActual = entryType & actualTypes;

	// If candidate has no type restriction (0 or only intermediate types), allow any match
	if (candidateActual === 0) return true;

	// If entry has no recognized POS (not a verb/adjective), DON'T allow match
	// This forces a kanji fallback lookup for entries that only contain names
	// For example, くる.json contains names like 久留 but not the verb 来る
	if (entryActual === 0) return false;

	// Check if there's any overlap between expected and actual types
	return (candidateActual & entryActual) !== 0;
}

/**
 * Check if a Korean dictionary entry has valid verb/adjective content
 * Korean POS is stored as a string like "동사" (verb), "형용사" (adjective)
 */
function hasKoreanVerbOrAdjective(entry: DictionaryEntry): boolean {
	if (!entry.korean_words || entry.korean_words.length === 0) return false;

	const verbAdjectivePos = [
		'동사', '형용사', '보조 동사', '보조 형용사',  // Korean terms
		'verb', 'adjective', 'auxiliary verb',          // English terms
	];

	for (const word of entry.korean_words) {
		if (word.pos && verbAdjectivePos.some(pos => word.pos?.includes(pos))) {
			return true;
		}
	}
	return false;
}

/**
 * Check if a Korean dictionary entry has any meaningful content (definitions)
 */
function hasKoreanContent(entry: DictionaryEntry): boolean {
	if (!entry.korean_words || entry.korean_words.length === 0) return false;

	// Check if any Korean word has definitions
	return entry.korean_words.some(w => w.definitions && w.definitions.length > 0);
}

/**
 * Try to find kanji forms from hiragana reading using the lookup-reading API
 * Returns multiple forms if available (for ambiguous readings)
 */
async function findKanjiFormsFromReading(
	hiragana: string,
	fetchFn: typeof fetch = fetch
): Promise<string[]> {
	try {
		const response = await fetchFn(`/api/lookup-reading?q=${encodeURIComponent(hiragana)}&limit=10`);
		if (!response.ok) return [];

		const data = await response.json();
		if (data.results && data.results.length > 0) {
			// Return all kanji forms found
			return data.results.map((r: { word: string }) => r.word);
		}
	} catch {
		// API not available (e.g., during SSR or in dev without D1)
	}
	return [];
}

/**
 * Fetch and decompress a dictionary entry
 * Follows redirects (e.g., simplified -> traditional Chinese)
 * Returns null if not found or on error
 */
async function fetchDictionaryEntry(
	word: string,
	fetchFn: typeof fetch,
	maxRedirects: number = 3
): Promise<DictionaryEntry | null> {
	try {
		const url = await getDictionaryUrl(word, dev, fetchFn);
		const response = await fetchFn(url);
		if (!response.ok) return null;

		// Decompress the deflated response
		const buffer = await response.arrayBuffer();
		const decompressed = await new Response(
			new Blob([buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
		).text();

		const entry = JSON.parse(decompressed) as DictionaryEntry;

		// Follow redirect if present (e.g., simplified 学校 -> traditional 學校)
		if (entry.redirect && maxRedirects > 0) {
			return fetchDictionaryEntry(entry.redirect, fetchFn, maxRedirects - 1);
		}

		return entry;
	} catch {
		return null;
	}
}

/**
 * Try to find dictionary entries for a word, including deinflected forms
 * Returns multiple matches when a conjugated form could map to different words
 * Uses POS validation to filter out false positives
 *
 * @param word - The word to check
 * @param fetchFn - Optional fetch function
 * @param maxResults - Maximum number of results to return (default: 5)
 * @returns Object with primary match and alternatives, or null if not found
 */
export async function findWordsWithDeinflection(
	word: string,
	fetchFn: typeof fetch = fetch,
	maxResults: number = 5
): Promise<DeinflectionResults | null> {
	const trimmedWord = word.trim();
	if (!trimmedWord) return null;

	const matches: DeinflectionResult[] = [];
	const seenWords = new Set<string>();
	// Cache fetched entries to avoid duplicate requests
	const entryCache = new Map<string, DictionaryEntry | null>();

	// Helper to add a match if not already seen
	const addMatch = (dictionaryForm: string, conjugationInfo: string) => {
		if (!seenWords.has(dictionaryForm) && matches.length < maxResults) {
			seenWords.add(dictionaryForm);
			matches.push({
				originalWord: trimmedWord,
				dictionaryForm,
				conjugationInfo,
			});
		}
	};

	// Helper to fetch entry with caching
	const getEntry = async (w: string): Promise<DictionaryEntry | null> => {
		if (entryCache.has(w)) return entryCache.get(w) || null;
		const entry = await fetchDictionaryEntry(w, fetchFn);
		entryCache.set(w, entry);
		return entry;
	};

	// Detect if input is Korean (Hangul)
	const isKorean = isHangulOnly(trimmedWord);

	// First try the exact word (only add as match if it has actual word entries, not just names)
	// This prevents hiragana entries with only names from being the primary match
	// when the user typed a conjugated form expecting a verb/adjective
	const exactEntry = await getEntry(trimmedWord);
	if (exactEntry) {
		// Check if entry has actual word content based on language
		const hasActualWords = isKorean
			? hasKoreanContent(exactEntry)
			: exactEntry.japanese_words && exactEntry.japanese_words.length > 0;
		if (hasActualWords) {
			addMatch(trimmedWord, '');
		}
	}

	// Try deinflected forms based on language
	if (isKorean) {
		// Korean deinflection
		const koreanCandidates = koreanDeinflect(trimmedWord);

		// Skip the first candidate if it's the original word with no reasons
		const deinflectedCandidates = koreanCandidates.filter(
			c => c.word !== trimmedWord || c.reasons.length > 0
		);

		// Sort by number of conjugation reasons (prefer simpler deinflections)
		deinflectedCandidates.sort((a, b) => a.reasons.length - b.reasons.length);

		for (const candidate of deinflectedCandidates) {
			if (matches.length >= maxResults) break;

			try {
				const conjugationInfo = formatKoreanReasons(candidate.reasons);

				// Try direct dictionary lookup
				const entry = await getEntry(candidate.word);
				if (entry) {
					// For Korean, validate that entry has verb/adjective content
					// This prevents matching entries that only have nouns when we deinflected a verb form
					if (hasKoreanVerbOrAdjective(entry) || hasKoreanContent(entry)) {
						addMatch(candidate.word, conjugationInfo);
					}
				}
			} catch {
				// Continue to next candidate
			}
		}
	} else {
		// Japanese deinflection (existing logic)
		const candidates = deinflect(trimmedWord);

		// Skip the first candidate if it's the original word with no reasons
		const deinflectedCandidates = candidates.filter(
			c => c.word !== trimmedWord || c.reasonChains.length > 0
		);

		// Sort by number of conjugation steps (prefer simpler deinflections)
		deinflectedCandidates.sort((a, b) => {
			const aLen = a.reasonChains.reduce((sum, chain) => sum + chain.length, 0);
			const bLen = b.reasonChains.reduce((sum, chain) => sum + chain.length, 0);
			return aLen - bLen;
		});

		for (const candidate of deinflectedCandidates) {
			if (matches.length >= maxResults) break;

			try {
				const conjugationInfo = formatReasonChains(candidate.reasonChains);
				let foundMatch = false;

				// First try direct dictionary lookup
				const entry = await getEntry(candidate.word);
				if (entry) {
					// Validate that the entry's POS matches what the deinflection expects
					const entryType = getEntryWordType(entry);
					if (validatePosMatch(candidate.type, entryType)) {
						addMatch(candidate.word, conjugationInfo);
						foundMatch = true;
					}
					// If POS validation failed, the hiragana entry might only contain names (no POS)
					// We should still try kanji fallback below
				}

				// If no match yet and candidate is hiragana-only,
				// try to find kanji forms via the reading lookup API
				// This handles cases where the hiragana entry only has names but not the verb
				if (!foundMatch && isHiraganaOnly(candidate.word)) {
					const kanjiForms = await findKanjiFormsFromReading(candidate.word, fetchFn);
					for (const kanjiForm of kanjiForms) {
						if (matches.length >= maxResults) break;
						try {
							const kanjiEntry = await getEntry(kanjiForm);
							if (kanjiEntry) {
								// Validate POS for kanji form too
								const kanjiEntryType = getEntryWordType(kanjiEntry);
								if (validatePosMatch(candidate.type, kanjiEntryType)) {
									addMatch(kanjiForm, conjugationInfo);
								}
							}
						} catch {
							// Continue to next kanji form
						}
					}
				}
			} catch {
				// Continue to next candidate
			}
		}
	}

	if (matches.length === 0) {
		return null;
	}

	return {
		originalWord: trimmedWord,
		primary: matches[0],
		alternatives: matches.slice(1),
	};
}

/**
 * Legacy function - returns only the first match
 * @deprecated Use findWordsWithDeinflection for multiple results
 */
export async function findWordWithDeinflection(
	word: string,
	fetchFn: typeof fetch = fetch
): Promise<DeinflectionResult | null> {
	const results = await findWordsWithDeinflection(word, fetchFn, 1);
	return results?.primary || null;
}

/**
 * Check if the input looks like a sentence (multiple word-like tokens)
 * Returns true if the input has 2+ word-like tokens after tokenization
 */
export function isSentence(input: string): boolean {
	const trimmed = input.trim();
	if (!trimmed) return false;

	// For CJK text, we should always try tokenizing since even short phrases
	// like "我愛你" (3 chars) can be multiple words
	// Only skip tokenization for very short non-CJK text without punctuation
	const hasSentencePunctuation = /[。！？.!?]/.test(trimmed);
	const hasCJK = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(trimmed);
	const isLongEnough = trimmed.length > 6;

	// For non-CJK text without punctuation, require minimum length
	if (!hasCJK && !hasSentencePunctuation && !isLongEnough) return false;

	// Tokenize and check word count
	const tokenized = tokenizeSentence(trimmed);
	const words = tokenized.tokens.filter(t => t.isWordLike);

	return words.length >= 2;
}

/**
 * Handle sentence input: tokenize and navigate to first word with sentence in URL
 */
export async function handleSentenceInput(
	sentence: string,
	fetchFn: typeof fetch = fetch
): Promise<void> {
	const trimmed = sentence.trim();
	if (!trimmed) return;

	// Get the words from the sentence
	const words = getSentenceWords(trimmed);
	if (words.length === 0) return;

	const firstWord = words[0].segment;

	// Try to find the word in dictionary (with deinflection)
	const results = await findWordsWithDeinflection(firstWord, fetchFn);

	if (results) {
		const { primary } = results;
		const additionalParams: Record<string, string> = {};

		if (primary.conjugationInfo && primary.originalWord !== primary.dictionaryForm) {
			additionalParams.from = primary.originalWord;
			additionalParams.conj = primary.conjugationInfo;
		}

		const url = buildSentenceWordURL(primary.dictionaryForm, trimmed, 0, additionalParams);
		await goto(url);
	} else {
		// Word not in dictionary, still navigate to show the word page
		const url = buildSentenceWordURL(firstWord, trimmed, 0);
		await goto(url);
	}
}

/**
 * Check if input is CJK text that could be split into characters
 */
function isCJKText(input: string): boolean {
	return /^[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+$/.test(input);
}

/**
 * Handle character-by-character sentence mode for CJK text
 * Used when a phrase like "我爱你" isn't in the dictionary but we want to show each character
 *
 * For character-by-character mode, we use `c=1` flag to indicate the sentence
 * should be split into individual characters rather than word-tokenized
 */
async function handleCharacterSplit(text: string, fetchFn: typeof fetch = fetch): Promise<void> {
	// Create character-by-character "sentence"
	// The sentence is the original text, but we'll add a flag to indicate char-by-char mode
	const characters = Array.from(text);
	if (characters.length === 0) return;

	const firstChar = characters[0];

	// Try to find the character in dictionary
	const results = await findWordsWithDeinflection(firstChar, fetchFn);

	// Build URL with character-split flag
	const params = new URLSearchParams();
	params.set('s', text);
	params.set('c', '1'); // char-by-char mode flag

	if (results) {
		const { primary } = results;
		if (primary.conjugationInfo && primary.originalWord !== primary.dictionaryForm) {
			params.set('from', primary.originalWord);
			params.set('conj', primary.conjugationInfo);
		}
		await goto(`/${encodeURIComponent(primary.dictionaryForm)}?${params.toString()}`);
	} else {
		await goto(`/${encodeURIComponent(firstChar)}?${params.toString()}`);
	}
}

/**
 * Check if input is clearly a sentence (has spaces or sentence punctuation)
 * This is a quick heuristic check before trying deinflection
 */
function isClearlySentence(input: string): boolean {
	// Has spaces between words (common in Korean sentences, some mixed text)
	if (/\s/.test(input)) return true;
	// Has sentence-ending punctuation
	if (/[。！？.!?]/.test(input)) return true;
	// Very long input is likely a sentence (> 15 chars without spaces is unusual for a single word)
	if (input.length > 15) return true;
	return false;
}

/**
 * Navigate to a word if it exists in the dictionary, otherwise redirect to search
 *
 * This function:
 * 1. First tries deinflection for short CJK inputs without spaces (to handle conjugated words)
 * 2. If deinflection succeeds, navigates to the dictionary form
 * 3. If deinflection fails and input looks like a sentence, tokenizes and shows sentence bar
 * 4. If not found and is CJK text with multiple characters, splits into characters
 * 5. Otherwise, redirects to /search?q={word}
 *
 * @param word - The word or sentence to search for
 * @param fetchFn - Optional fetch function (defaults to global fetch)
 */
export async function navigateOrSearch(word: string, fetchFn: typeof fetch = fetch): Promise<void> {
	if (!word || word.trim().length === 0) {
		return;
	}

	const trimmedWord = word.trim();

	// If it's clearly a sentence (has spaces, punctuation, or is very long), go straight to sentence mode
	if (isClearlySentence(trimmedWord)) {
		if (isSentence(trimmedWord)) {
			await handleSentenceInput(trimmedWord, fetchFn);
			return;
		}
	}

	try {
		// Try deinflection first - this handles conjugated words like 食べている → 食べる
		const results = await findWordsWithDeinflection(trimmedWord, fetchFn);

		if (results) {
			const { primary, alternatives } = results;

			// Build URL with primary match
			let url = `/${primary.dictionaryForm}`;
			const params = new URLSearchParams();

			if (primary.conjugationInfo && primary.originalWord !== primary.dictionaryForm) {
				params.set('from', primary.originalWord);
				params.set('conj', primary.conjugationInfo);
			}

			// Add alternatives as JSON-encoded param
			if (alternatives.length > 0) {
				const altData = alternatives.map(a => ({
					word: a.dictionaryForm,
					conj: a.conjugationInfo,
				}));
				params.set('alt', JSON.stringify(altData));
			}

			const queryString = params.toString();
			if (queryString) {
				url += '?' + queryString;
			}

			await goto(url);
		} else {
			// Word not found via deinflection
			// Now check if it could be a sentence (multiple tokens)
			if (isSentence(trimmedWord)) {
				await handleSentenceInput(trimmedWord, fetchFn);
				return;
			}

			// Not a sentence either - try character split for CJK
			if (isCJKText(trimmedWord) && trimmedWord.length >= 2) {
				await handleCharacterSplit(trimmedWord, fetchFn);
			} else {
				// Not CJK or single character, redirect to search
				await goto(`/search?q=${encodeURIComponent(trimmedWord)}`);
			}
		}
	} catch (error) {
		// On error, redirect to search as fallback
		console.error('Error checking word existence:', error);
		await goto(`/search?q=${encodeURIComponent(trimmedWord)}`);
	}
}

