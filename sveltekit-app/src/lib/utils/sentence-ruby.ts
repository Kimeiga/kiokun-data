import { dev } from '$app/environment';
import { getDictionaryUrl } from '$lib/shard-utils';
import type { DictionaryEntry } from '$lib/types';
import { findWordsWithDeinflection } from '$lib/utils/search-navigation';
import { alignChinesePinyinReadings } from './chinese-ruby';
import {
	mergeJapaneseCompoundTokens,
	selectPreferredJapaneseReading,
	trimJapaneseReadingSuffix
} from './japanese-ruby';
import { isWordToken, segmentText } from './segment';

export interface RubySegment {
	text: string;
	reading?: string;
	isWord: boolean;
}

const HAN_RE = /\p{Script=Han}/u;
const HANGUL_RE = /[\uAC00-\uD7A3]/u;
const JAPANESE_KANA_RE = /[\u3040-\u30FF\u31F0-\u31FFー]/u;
const WORD_CONTENT_RE = /[\p{Script=Han}\p{Script=Latin}\p{N}\uAC00-\uD7A3\u3040-\u30FF\u31F0-\u31FFー]/u;
const PUNCT_OR_SPACE_RE = /(\s+|[.,;:!?。、，！？“”"「」『』（）()[\]{}…]+)/u;

const KR_INITIALS = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const KR_MEDIALS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const KR_FINALS = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'p', 'l', 'l', 'l', 'p', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't'];

const dictionaryEntryCache = new Map<string, Promise<DictionaryEntry | null>>();
const japaneseReadingCache = new Map<string, Promise<string | null>>();
const japaneseSentenceAnalysisCache = new Map<string, Promise<RubySegment[] | null>>();

export function buildChineseRubySegments(text: string, pinyin: string): RubySegment[] {
	const textSegments = segmentText(text, 'zh')
		.flatMap(splitMixedSegment)
		.flatMap(splitShortHanSentenceSegment);
	const readings = alignChinesePinyinReadings(textSegments, pinyin);

	return textSegments.map((segment, index) => {
		if (hasHan(segment)) {
			return {
				text: segment,
				reading: readings[index],
				isWord: true
			};
		}

		return {
			text: segment,
			isWord: isWordToken(segment) && WORD_CONTENT_RE.test(segment)
		};
	});
}

export function buildJapaneseRubySegments(text: string): RubySegment[] {
	return segmentText(text, 'ja').flatMap(splitPunctuation).map((segment) => ({
		text: segment,
		isWord: isWordToken(segment) && WORD_CONTENT_RE.test(segment)
	}));
}

export async function enrichJapaneseRubySegments(
	segments: RubySegment[],
	fetchFn: typeof fetch = fetch
): Promise<RubySegment[]> {
	const text = segments.map((segment) => segment.text).join('');
	const analyzed = await analyzeJapaneseSentence(text, fetchFn);
	if (analyzed?.some((segment) => segment.reading)) {
		return enrichUnresolvedJapaneseSegments(analyzed, fetchFn);
	}

	return enrichUnresolvedJapaneseSegments(segments, fetchFn, true);
}

async function enrichUnresolvedJapaneseSegments(
	segments: RubySegment[],
	fetchFn: typeof fetch,
	mergeCompounds = false
): Promise<RubySegment[]> {
	let compoundSegments = segments;
	if (mergeCompounds) {
		try {
			compoundSegments = await mergeJapaneseCompoundTokens(
				segments,
				(surface) => getJapaneseReading(surface, fetchFn)
			);
		} catch {
			// A speculative compound lookup must never suppress the readings
			// already available for the rest of the sentence.
		}
	}

	const results = await Promise.allSettled(
		compoundSegments.map(async (segment, index) => {
			if (!segment.isWord || !hasHan(segment.text) || isAllKana(segment.text)) {
				return segment;
			}
			if (segment.reading) return segment;

			const reading = await getJapaneseReading(segment.text, fetchFn)
				?? await getReadingForSplitJapaneseToken(compoundSegments, index, fetchFn);
			if (!reading || reading === segment.text) return segment;
			return { ...segment, reading };
		})
	);

	return results.map((result, index) =>
		result.status === 'fulfilled' ? result.value : compoundSegments[index]
	);
}

interface JapaneseAnalysisToken {
	text: string;
	reading?: string | null;
	position: number;
	isWord: boolean;
}

async function analyzeJapaneseSentence(
	text: string,
	fetchFn: typeof fetch
): Promise<RubySegment[] | null> {
	if (!text || typeof window === 'undefined') return null;

	let request = japaneseSentenceAnalysisCache.get(text);
	if (!request) {
		request = fetchJapaneseSentenceAnalysis(text, fetchFn);
		japaneseSentenceAnalysisCache.set(text, request);
	}
	return request;
}

async function fetchJapaneseSentenceAnalysis(
	text: string,
	fetchFn: typeof fetch
): Promise<RubySegment[] | null> {
	try {
		const response = await fetchFn('/api/sentence/ruby', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text })
		});
		if (!response.ok) return null;

		const payload = await response.json() as { tokens?: JapaneseAnalysisToken[] };
		const tokens = [...(payload.tokens || [])]
			.filter((token) => token.text && token.position >= 0)
			.sort((left, right) => left.position - right.position);
		if (!tokens.length) return null;

		const result: RubySegment[] = [];
		let cursor = 0;
		for (const token of tokens) {
			let position = token.position;
			if (position < cursor || text.slice(position, position + token.text.length) !== token.text) {
				position = text.indexOf(token.text, cursor);
			}
			if (position < cursor) continue;

			if (position > cursor) {
				result.push({
					text: text.slice(cursor, position),
					isWord: false
				});
			}
			result.push({
				text: token.text,
				reading: token.reading || undefined,
				isWord: token.isWord
			});
			cursor = position + token.text.length;
		}
		if (cursor < text.length) result.push({ text: text.slice(cursor), isWord: false });

		return result.map((segment) => segment.text).join('') === text ? result : null;
	} catch {
		return null;
	}
}

async function getReadingForSplitJapaneseToken(
	segments: RubySegment[],
	index: number,
	fetchFn: typeof fetch
): Promise<string | null> {
	const surface = segments[index]?.text ?? '';
	if (!hasHan(surface) || !getTrailingKana(surface)) return null;

	let appendedKana = '';
	for (let offset = 1; offset <= 4; offset += 1) {
		const next = segments[index + offset];
		if (!next?.isWord || !isAllKana(next.text)) break;

		appendedKana += next.text;
		const combinedReading = await getJapaneseReading(surface + appendedKana, fetchFn);
		if (!combinedReading) continue;

		const prefixReading = trimJapaneseReadingSuffix(combinedReading, appendedKana);
		if (prefixReading) return prefixReading;
	}

	return null;
}

export function buildKoreanRubySegments(text: string): RubySegment[] {
	return text.split(PUNCT_OR_SPACE_RE).filter(Boolean).map((segment) => {
		const isWord = isWordToken(segment) && WORD_CONTENT_RE.test(segment);
		return {
			text: segment,
			reading: isWord && HANGUL_RE.test(segment) ? hangulToRomanization(segment) : undefined,
			isWord
		};
	});
}

function splitMixedSegment(segment: string): string[] {
	const parts: string[] = [];
	let current = '';
	let currentKind: 'han' | 'word' | 'space' | null = null;

	for (const char of segment) {
		const kind = getCharKind(char);
		if (kind === 'punct') {
			if (current) parts.push(current);
			current = '';
			currentKind = null;
			parts.push(char);
			continue;
		}

		if (current && currentKind !== kind) {
			parts.push(current);
			current = '';
		}

		current += char;
		currentKind = kind;
	}

	if (current) parts.push(current);
	return parts;
}

function splitShortHanSentenceSegment(segment: string): string[] {
	if (!/^[\u4e00-\u9fff]+$/.test(segment)) return [segment];

	const chars = Array.from(segment);
	if (chars.length < 3) return [segment];
	if (/^[我你他她它您咱]/.test(segment) || /[吗嗎呢吧啊呀嘛么麼]/.test(segment)) {
		return chars;
	}

	return [segment];
}

function splitPunctuation(segment: string): string[] {
	return segment.split(PUNCT_OR_SPACE_RE).filter(Boolean);
}

function getCharKind(char: string): 'han' | 'word' | 'space' | 'punct' {
	if (HAN_RE.test(char)) return 'han';
	if (/[\p{Script=Latin}\p{N}\uAC00-\uD7A3]/u.test(char) || JAPANESE_KANA_RE.test(char)) return 'word';
	if (/\s/u.test(char)) return 'space';
	return 'punct';
}

function hasHan(text: string): boolean {
	return HAN_RE.test(text);
}

function hangulToRomanization(text: string): string {
	let result = '';

	for (const char of text) {
		const code = char.charCodeAt(0);
		if (code >= 0xAC00 && code <= 0xD7A3) {
			const syllable = code - 0xAC00;
			const initial = Math.floor(syllable / (21 * 28));
			const medial = Math.floor((syllable % (21 * 28)) / 28);
			const final = syllable % 28;
			result += `${KR_INITIALS[initial]}${KR_MEDIALS[medial]}${KR_FINALS[final]}`;
		} else if (/[\p{Script=Latin}\p{N}]/u.test(char)) {
			result += char;
		}
	}

	return result;
}

function isAllKana(text: string): boolean {
	return /^[\u3040-\u30FF\u31F0-\u31FFー]+$/u.test(text);
}

async function getJapaneseReading(surface: string, fetchFn: typeof fetch): Promise<string | null> {
	if (!japaneseReadingCache.has(surface)) {
		japaneseReadingCache.set(surface, lookupJapaneseReading(surface, fetchFn));
	}
	return japaneseReadingCache.get(surface) ?? null;
}

async function lookupJapaneseReading(surface: string, fetchFn: typeof fetch): Promise<string | null> {
	const exactEntry = await fetchDictionaryEntry(surface, fetchFn);
	const exactReading = extractJapaneseReading(exactEntry, surface, surface);
	if (exactReading) return exactReading;

	const deinflected = await findWordsWithDeinflection(surface, fetchFn, 1);
	const dictionaryForm = deinflected?.primary?.dictionaryForm;
	if (!dictionaryForm || dictionaryForm === surface) return null;

	const dictionaryEntry = await fetchDictionaryEntry(dictionaryForm, fetchFn);
	const baseReading = extractJapaneseReading(dictionaryEntry, surface, dictionaryForm);
	if (!baseReading) return null;

	return deriveJapaneseSurfaceReading(surface, dictionaryForm, baseReading);
}

async function fetchDictionaryEntry(word: string, fetchFn: typeof fetch): Promise<DictionaryEntry | null> {
	const cacheKey = `${dev ? 'dev' : 'prod'}:${word}`;
	if (!dictionaryEntryCache.has(cacheKey)) {
		dictionaryEntryCache.set(cacheKey, loadDictionaryEntry(word, fetchFn));
	}
	return dictionaryEntryCache.get(cacheKey) ?? null;
}

async function loadDictionaryEntry(word: string, fetchFn: typeof fetch, redirectsLeft = 3): Promise<DictionaryEntry | null> {
	try {
		const { inflateSync } = await import('fflate');
		// Sentence annotation probes inflected and partial token forms that are
		// expected to miss. Ask the same-origin proxy for a quiet 204 so those
		// ordinary misses do not surface as browser console errors.
		const url = await getDictionaryUrl(word, dev, fetchFn, { optional: true });
		const response = await fetchDictionaryBytes(url, fetchFn);
		if (!response.ok || response.status === 204) return null;

		const data = JSON.parse(
			new TextDecoder().decode(inflateSync(new Uint8Array(await response.arrayBuffer())))
		) as DictionaryEntry;

		if (data.redirect && redirectsLeft > 0) {
			return loadDictionaryEntry(data.redirect, fetchFn, redirectsLeft - 1);
		}

		return data;
	} catch {
		return null;
	}
}

function fetchDictionaryBytes(url: string, fetchFn: typeof fetch): Promise<Response> {
	if (url.startsWith('http')) {
		return globalThis.fetch(url);
	}
	return fetchFn(url);
}

function extractJapaneseReading(entry: DictionaryEntry | null, surface: string, dictionaryForm: string): string | null {
	const reading = selectPreferredJapaneseReading(
		entry?.japanese_words,
		surface,
		dictionaryForm
	);
	return reading ? deriveJapaneseSurfaceReading(surface, dictionaryForm, reading) : null;
}

function deriveJapaneseSurfaceReading(surface: string, dictionaryForm: string, baseReading: string): string {
	const normalizedBaseReading = katakanaToHiragana(baseReading);
	if (surface === dictionaryForm) return normalizedBaseReading;

	const baseKanaSuffix = katakanaToHiragana(getTrailingKana(dictionaryForm));
	const surfaceKanaSuffix = katakanaToHiragana(getTrailingKana(surface));

	if (baseKanaSuffix && surfaceKanaSuffix && normalizedBaseReading.endsWith(baseKanaSuffix)) {
		return normalizedBaseReading.slice(0, -baseKanaSuffix.length) + surfaceKanaSuffix;
	}

	return normalizedBaseReading;
}

function getTrailingKana(text: string): string {
	return text.match(/[\u3040-\u30FF\u31F0-\u31FFー]+$/u)?.[0] ?? '';
}

function katakanaToHiragana(text: string): string {
	return text.replace(/[\u30A1-\u30F6]/g, (char) =>
		String.fromCharCode(char.charCodeAt(0) - 0x60)
	);
}
