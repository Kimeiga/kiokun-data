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

// Han-only text needs more than a script-range check: kanji and hanzi share the
// same Unicode block. These character forms are strong evidence because modern
// Japanese and simplified Chinese normally use different variants.
const JAPANESE_FORM_MARKERS = /[働込峠辻畑榊栃匂凪駅円気発広辺沢黒関営済実験処図専団楽帰払]/u;
const SIMPLIFIED_CHINESE_MARKERS = /[这们吗为发后个门见时实认让请进过还从对开关间车东业书长云电广边泽图气应专团乐归处验码钟员]/u;

// Common Japanese compound/register patterns help with signage and noun
// phrases that contain only kanji. A threshold prevents a shared word such as
// 募集 or 禁止 on its own from being treated as conclusive.
const JAPANESE_HAN_CONTEXT = [
	'入居',
	'退居',
	'者募集',
	'募集中',
	'募集要項',
	'立入',
	'取扱',
	'受付',
	'申込',
	'引越',
	'乗換',
	'払戻',
	'持込',
	'持帰',
	'貸出',
	'駐車',
	'駐輪',
	'営業時間',
	'定休日',
	'関係者',
	'無断',
	'厳禁',
	'禁止',
	'専用',
	'無料',
	'有料',
] as const;

const CHINESE_HAN_CONTEXT = [
	'入住',
	'招募',
	'招聘',
	'人员',
	'人員',
	'验证码',
	'驗證碼',
	'分钟',
	'分鐘',
	'请勿',
	'請勿',
	'您的',
	'我们',
	'我們',
	'他们',
	'他們',
	'这个',
	'這個',
	'有效期',
] as const;

function contextScore(text: string, markers: readonly string[]): number {
	let score = 0;
	for (const marker of markers) {
		if (text.includes(marker)) score += Array.from(marker).length;
	}
	return score;
}

function detectHanOnlyLanguage(text: string): SupportedLanguage {
	if (SIMPLIFIED_CHINESE_MARKERS.test(text)) return 'zh';
	if (JAPANESE_FORM_MARKERS.test(text)) return 'ja';

	const japaneseScore = contextScore(text, JAPANESE_HAN_CONTEXT);
	const chineseScore = contextScore(text, CHINESE_HAN_CONTEXT);

	// Require multiple characters of contextual evidence and a clear margin.
	// Unresolved Han-only strings remain Chinese for backwards compatibility.
	if (japaneseScore >= 4 && japaneseScore >= chineseScore + 2) return 'ja';
	return 'zh';
}

/**
 * Detect the language of a text based on character ranges
 */
export function detectLanguage(text: string): SupportedLanguage {
	// Count characters in different script ranges
	let japanese = 0; // Hiragana and Katakana
	let han = 0;      // Shared Chinese hanzi / Japanese kanji
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
			han++;
		}
	}

	// If we have hiragana/katakana, it's Japanese
	if (japanese > 0) return 'ja';
	// If we have hangul, it's Korean
	if (korean > 0) return 'ko';
	if (han > 0) return detectHanOnlyLanguage(text);
	// Preserve the existing fallback for non-CJK text.
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
