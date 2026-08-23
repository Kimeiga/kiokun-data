// @ts-ignore - tiny-segmenter has no type declarations
import TinySegmenter from 'tiny-segmenter';
// @ts-ignore - jieba-wasm types
import { cut as jiebaCut } from 'jieba-wasm';

const jaSegmenter = new TinySegmenter();

const JAPANESE_FIXED_EXPRESSIONS = [
	'ませんでした',
	'よろしくお願いします',
	'ごちそうさまでした',
	'おはようございます',
	'いってらっしゃい',
	'ありがとうございます',
	'ありがとうございました',
	'お願いします',
	'いってきます',
	'おかえりなさい',
	'どうやって',
	'すみません',
	'こんにちは',
	'こんばんは',
	'ありがとう',
	'ください',
	'ません',
	'ました',
	'でした',
] as const;
const CONNECTED_LATIN_RE = /^[\p{Script=Latin}\p{N}]+(?:[\-‐‑‒–—./・][\p{Script=Latin}\p{N}]+)+$/u;
const JAPANESE_ADVERB_PREFIXES = [
	'あまり', 'もっと', 'とても', 'すぐ', '少し', '全く', 'よく', 'もう', 'まだ',
] as const;

function splitJapaneseAdverbPrefix(segment: string): string[] {
	const prefix = JAPANESE_ADVERB_PREFIXES.find((candidate) =>
		segment.startsWith(candidate) && segment.length >= candidate.length + 2
	);
	return prefix ? [prefix, segment.slice(prefix.length)] : [segment];
}

function mergeJapaneseSegments(segments: string[]): string[] {
	const merged: string[] = [];
	for (let index = 0; index < segments.length; index += 1) {
		let match = '';
		let end = index;

		for (let cursor = index; cursor < segments.length; cursor += 1) {
			const candidate = segments.slice(index, cursor + 1).join('');
			if (
				JAPANESE_FIXED_EXPRESSIONS.includes(candidate as typeof JAPANESE_FIXED_EXPRESSIONS[number]) ||
				CONNECTED_LATIN_RE.test(candidate)
			) {
				match = candidate;
				end = cursor;
			}
			if (candidate.length > 24 || /\s/u.test(candidate)) break;
		}

		if (match) {
			merged.push(match);
			index = end;
		} else {
			merged.push(...splitJapaneseAdverbPrefix(segments[index]));
		}
	}
	return merged;
}

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
		return mergeJapaneseSegments(segments);
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
	return trimmed.length > 0 && !/^[.,;:!?，：；。、！？「」『』（）〈〉《》【】〔〕・…―─ー～\s※●⚠️＜＞〜？]+$/.test(trimmed);
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
