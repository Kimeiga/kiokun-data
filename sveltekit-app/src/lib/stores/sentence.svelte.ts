/**
 * Sentence context utilities for URL-based sentence mode
 *
 * Sentences are stored in URL parameters for shareability:
 * - `s` = the full sentence text
 * - `i` = current word index (0-based, optional, defaults to 0)
 *
 * Example: /私?s=私は日本語を勉強しています&i=0
 */
import { tokenizeSentence, type TokenizedSentence, type SupportedLanguage } from '$lib/utils/sentence-tokenizer';

export interface SentenceContext {
	/** The original sentence */
	sentence: string;
	/** The tokenized sentence data */
	tokenized: TokenizedSentence;
	/** Current word index */
	currentIndex: number;
}

/**
 * Parse sentence context from URL search params
 * Returns null if no sentence is present
 *
 * URL params:
 * - `s` = sentence text
 * - `i` = word index (optional, defaults to 0)
 * - `c` = character-by-character mode flag (optional)
 */
export function parseSentenceFromURL(searchParams: URLSearchParams): SentenceContext | null {
	const sentence = searchParams.get('s');
	if (!sentence) return null;

	const isCharMode = searchParams.get('c') === '1';

	let tokenized: TokenizedSentence;

	if (isCharMode) {
		// Character-by-character mode: split into individual characters
		const chars = Array.from(sentence);
		tokenized = {
			original: sentence,
			language: detectCJKLanguage(sentence),
			tokens: chars.map((char, idx) => ({
				segment: char,
				index: idx,
				isWordLike: /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(char)
			}))
		};
	} else {
		tokenized = tokenizeSentence(sentence);
	}

	const words = tokenized.tokens.filter(t => t.isWordLike);

	if (words.length === 0) return null;

	// Parse index, default to 0
	const indexParam = searchParams.get('i');
	let currentIndex = 0;
	if (indexParam) {
		const parsed = parseInt(indexParam, 10);
		if (!isNaN(parsed) && parsed >= 0 && parsed < words.length) {
			currentIndex = parsed;
		}
	}

	return {
		sentence,
		tokenized,
		currentIndex
	};
}

/**
 * Simple language detection for CJK text
 */
function detectCJKLanguage(text: string): SupportedLanguage {
	// Check for Korean first (Hangul)
	if (/[\uac00-\ud7af]/.test(text)) return 'ko';
	// Check for Japanese hiragana/katakana
	if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
	// Default to Chinese
	return 'zh';
}

/**
 * Build URL params for sentence context
 */
export function buildSentenceParams(sentence: string, wordIndex: number = 0): URLSearchParams {
	const params = new URLSearchParams();
	params.set('s', sentence);
	if (wordIndex > 0) {
		params.set('i', wordIndex.toString());
	}
	return params;
}

/**
 * Build a full URL for a word within a sentence context
 */
export function buildSentenceWordURL(
	word: string,
	sentence: string,
	wordIndex: number,
	additionalParams?: Record<string, string>
): string {
	const params = buildSentenceParams(sentence, wordIndex);

	if (additionalParams) {
		for (const [key, value] of Object.entries(additionalParams)) {
			params.set(key, value);
		}
	}

	return `/${encodeURIComponent(word)}?${params.toString()}`;
}

/**
 * Build the standalone sentence-reader URL.
 *
 * This route can render immediately without waiting for a dictionary entry, so
 * it is the right target for pasted full sentences from search boxes.
 */
export function buildSentenceReaderURL(
	sentence: string,
	options?: {
		language?: SupportedLanguage;
		translation?: string;
		pinyin?: string;
		from?: string;
	}
): string {
	const params = new URLSearchParams();
	params.set('text', sentence);
	params.set('lang', options?.language ?? tokenizeSentence(sentence).language);

	if (options?.translation) params.set('en', options.translation);
	if (options?.pinyin) params.set('py', options.pinyin);
	if (options?.from) params.set('from', options.from);

	return `/sentence?${params.toString()}`;
}

/**
 * Get words from a sentence (helper for navigation)
 */
export function getSentenceWords(sentence: string): Array<{ segment: string; index: number }> {
	const tokenized = tokenizeSentence(sentence);
	return tokenized.tokens
		.filter(t => t.isWordLike)
		.map((t, idx) => ({ segment: t.segment, index: idx }));
}

/**
 * Legacy compatibility - returns language from sentence
 */
export function getSentenceLanguage(sentence: string): SupportedLanguage {
	const tokenized = tokenizeSentence(sentence);
	return tokenized.language;
}
