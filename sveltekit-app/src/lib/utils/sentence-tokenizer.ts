/**
 * Sentence tokenizer for Japanese, Chinese, and Korean using Intl.Segmenter
 * 
 * Intl.Segmenter is a native browser API (Baseline 2024) that provides
 * locale-sensitive text segmentation for word, sentence, and grapheme boundaries.
 */

export type SupportedLanguage = 'ja' | 'zh' | 'ko';

export interface TokenizedWord {
	/** The segmented word/token */
	segment: string;
	/** Starting index in the original string */
	index: number;
	/** Whether this is a word-like segment (vs punctuation/whitespace) */
	isWordLike: boolean;
}

export interface TokenizedSentence {
	/** The original sentence */
	original: string;
	/** Detected or specified language */
	language: SupportedLanguage;
	/** Array of tokenized words */
	tokens: TokenizedWord[];
}

/**
 * Detect the language of a text based on character ranges
 */
export function detectLanguage(text: string): SupportedLanguage {
	// Count characters in different script ranges
	let japanese = 0; // Hiragana and Katakana
	let chinese = 0;  // CJK without Japanese-specific scripts
	let korean = 0;   // Hangul

	for (const char of text) {
		const code = char.codePointAt(0) || 0;

		// Hiragana: U+3040-U+309F
		// Katakana: U+30A0-U+30FF
		if ((code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)) {
			japanese++;
		}
		// Hangul: U+AC00-U+D7AF (Syllables), U+1100-U+11FF (Jamo)
		else if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF)) {
			korean++;
		}
		// CJK Unified Ideographs: U+4E00-U+9FFF
		else if (code >= 0x4E00 && code <= 0x9FFF) {
			chinese++; // Could be Chinese or Japanese kanji
		}
	}

	// If we have hiragana/katakana, it's Japanese
	if (japanese > 0) return 'ja';
	// If we have hangul, it's Korean
	if (korean > 0) return 'ko';
	// Default to Chinese for CJK characters
	return 'zh';
}

/**
 * Get the locale string for Intl.Segmenter based on language
 */
function getLocale(language: SupportedLanguage): string {
	switch (language) {
		case 'ja': return 'ja-JP';
		case 'ko': return 'ko-KR';
		case 'zh': return 'zh-CN';
	}
}

/**
 * Tokenize a sentence into words using Intl.Segmenter
 * 
 * @param sentence - The sentence to tokenize
 * @param language - Optional language override (auto-detected if not provided)
 * @returns TokenizedSentence with tokens
 */
export function tokenizeSentence(
	sentence: string,
	language?: SupportedLanguage
): TokenizedSentence {
	const detectedLanguage = language || detectLanguage(sentence);
	const locale = getLocale(detectedLanguage);

	// Check if Intl.Segmenter is available
	if (typeof Intl.Segmenter === 'undefined') {
		// Fallback: split by character for CJK, by space for others
		console.warn('Intl.Segmenter not available, using fallback tokenization');
		const tokens: TokenizedWord[] = [];
		let index = 0;
		for (const char of sentence) {
			tokens.push({
				segment: char,
				index,
				isWordLike: !/\s/.test(char) && !/[。、！？,.!?]/.test(char)
			});
			index += char.length;
		}
		return { original: sentence, language: detectedLanguage, tokens };
	}

	// Use Intl.Segmenter for word segmentation
	const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
	const segments = segmenter.segment(sentence);

	const tokens: TokenizedWord[] = [];
	for (const segment of segments) {
		tokens.push({
			segment: segment.segment,
			index: segment.index,
			isWordLike: segment.isWordLike ?? false
		});
	}

	return {
		original: sentence,
		language: detectedLanguage,
		tokens
	};
}

/**
 * Get only the word-like tokens (filtering out punctuation and whitespace)
 */
export function getWords(tokenized: TokenizedSentence): TokenizedWord[] {
	return tokenized.tokens.filter(t => t.isWordLike);
}

/**
 * Check if Intl.Segmenter is supported in the current environment
 */
export function isSegmenterSupported(): boolean {
	return typeof Intl !== 'undefined' && typeof Intl.Segmenter !== 'undefined';
}

