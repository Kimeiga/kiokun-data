// @ts-ignore - tiny-segmenter has no type declarations
import TinySegmenter from 'tiny-segmenter';

const jaSegmenter = new TinySegmenter();

/**
 * Segment CJK text into word tokens.
 * Uses TinySegmenter for Japanese (much better verb/okurigana handling than Intl.Segmenter).
 * Falls back to Intl.Segmenter for Chinese/Korean.
 */
export function segmentText(text: string, language: string): string[] {
	if (language === 'ja') {
		// TinySegmenter sometimes mis-segments short strings that start with
		// honorific prefixes (e.g., ご使用 → ご使|用). Adding a sentence-boundary
		// prefix gives it context to segment correctly, then we strip it.
		const segments: string[] = jaSegmenter.segment('。' + text);
		if (segments.length > 0 && segments[0] === '。') {
			segments.shift();
		} else if (segments.length > 0 && segments[0].startsWith('。')) {
			segments[0] = segments[0].slice(1);
		}
		return segments;
	}

	// Chinese and Korean: use Intl.Segmenter
	try {
		const locale = language === 'zh' ? 'zh-CN' : 'ko-KR';
		const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
		return [...segmenter.segment(text)].map(s => s.segment);
	} catch {
		return text.split('');
	}
}

/**
 * Check if a token is a "word" (not punctuation or whitespace)
 */
export function isWordToken(segment: string): boolean {
	const trimmed = segment.trim();
	return trimmed.length > 0 && !/^[.,;:!?。、！？「」『』（）〈〉《》【】〔〕・…―─ー～\s※●⚠️＜＞〜]+$/.test(trimmed);
}

/**
 * Build word tokens with positions from segmented text.
 * Returns array of { wordSlug, surfaceForm, position } for non-punctuation tokens.
 */
export function buildWordTokens(text: string, language: string): { wordSlug: string; surfaceForm: string; position: number }[] {
	const segments = segmentText(text, language);
	const words: { wordSlug: string; surfaceForm: string; position: number }[] = [];

	let pos = 0;
	for (const seg of segments) {
		if (isWordToken(seg)) {
			words.push({ wordSlug: seg, surfaceForm: seg, position: pos });
		}
		pos += seg.length;
	}

	return words;
}
