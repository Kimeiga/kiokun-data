// @ts-ignore - tiny-segmenter has no type declarations
import TinySegmenter from 'tiny-segmenter';
// @ts-ignore - jieba-wasm types
import { cut as jiebaCut } from 'jieba-wasm';

const jaSegmenter = new TinySegmenter();

/**
 * Segment CJK text into word tokens.
 * - Japanese: TinySegmenter (lightweight, good okurigana handling)
 * - Chinese: jieba-wasm (proper word segmentation via WASM)
 * - Korean: Intl.Segmenter fallback
 */
export function segmentText(text: string, language: string): string[] {
	if (language === 'ja') {
		// TinySegmenter needs context prefix for short strings
		const segments: string[] = jaSegmenter.segment('。' + text);
		if (segments.length > 0 && segments[0] === '。') {
			segments.shift();
		} else if (segments.length > 0 && segments[0].startsWith('。')) {
			segments[0] = segments[0].slice(1);
		}
		return segments;
	}

	if (language === 'zh') {
		// jieba-wasm for proper Chinese word segmentation
		try {
			return jiebaCut(text);
		} catch {
			// Fallback to Intl.Segmenter if jieba fails
		}
	}

	// Korean and fallback: use Intl.Segmenter
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
	return trimmed.length > 0 && !/^[.,;:!?。、！？「」『』（）〈〉《》【】〔〕・…―─ー～\s※●⚠️＜＞〜？]+$/.test(trimmed);
}

/**
 * Build word tokens with positions from segmented text.
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
