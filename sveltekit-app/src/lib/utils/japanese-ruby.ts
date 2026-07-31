export interface JapaneseRubyPart {
	text: string;
	reading?: string;
}

export interface JapaneseRubyToken {
	text: string;
	reading?: string;
	isWord: boolean;
}

export interface JapaneseReadingWord {
	kanji?: Array<{
		text: string;
		common?: boolean;
		tags?: string[];
	}>;
	kana?: Array<{
		text: string;
		common?: boolean;
		tags?: string[];
		appliesToKanji?: string[];
	}>;
	sense?: Array<{
		misc?: string[];
	}>;
	frequencyRank?: number;
}

interface SurfaceRun {
	text: string;
	isKana: boolean;
}

const KANA_CHAR_RE = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]$/u;
const HAN_RE = /\p{Script=Han}/u;
const MARKED_RARE_READING_TAGS = new Set(['sk']);
const MARKED_RARE_SENSE_TAGS = new Set([
	'arch',
	'dated',
	'hist',
	'obs',
	'obsc',
	'rare'
]);

/**
 * Select the learner-useful reading for a surface form instead of trusting
 * dictionary insertion order. JMdict groups homographs together, so the first
 * entry for 私 can otherwise be the archaic わらわ rather than わたし.
 */
export function selectPreferredJapaneseReading(
	words: JapaneseReadingWord[] | null | undefined,
	surface: string,
	dictionaryForm = surface
): string | null {
	if (!words?.length) return null;

	const matching = words
		.map((word, index) => readingCandidate(word, surface, dictionaryForm, index))
		.filter((candidate): candidate is ReadingCandidate => Boolean(candidate))
		.sort((left, right) => left.score - right.score || left.index - right.index);

	if (matching.length > 0) return matching[0].reading;

	// Redirects and unusual kana-only records occasionally omit a matching
	// kanji restriction. Preserve a deterministic fallback without allowing an
	// archaic first record to win merely because it appeared first.
	return words
		.map((word, index) => readingCandidate(word, surface, dictionaryForm, index, false))
		.filter((candidate): candidate is ReadingCandidate => Boolean(candidate))
		.sort((left, right) => left.score - right.score || left.index - right.index)[0]?.reading ?? null;
}

interface ReadingCandidate {
	reading: string;
	score: number;
	index: number;
}

function readingCandidate(
	word: JapaneseReadingWord,
	surface: string,
	dictionaryForm: string,
	index: number,
	requireMatchingKanji = true
): ReadingCandidate | null {
	const kanji = word.kanji || [];
	const matchingKanji = kanji.find((form) =>
		form.text === surface || form.text === dictionaryForm
	);
	if (requireMatchingKanji && kanji.length > 0 && !matchingKanji) return null;

	const kana = (word.kana || [])
		.filter((reading) => !reading.tags?.some((tag) => MARKED_RARE_READING_TAGS.has(tag)))
		.filter((reading) => {
			const applies = reading.appliesToKanji;
			return !applies?.length ||
				applies.includes('*') ||
				applies.includes(surface) ||
				applies.includes(dictionaryForm);
		})
		.sort((left, right) => Number(Boolean(right.common)) - Number(Boolean(left.common)))[0]
		?? word.kana?.[0];
	if (!kana?.text) return null;

	const commonKanji = Boolean(matchingKanji?.common) ||
		kanji.some((form) => form.common && (form.text === surface || form.text === dictionaryForm));
	const commonKana = Boolean(kana.common);
	const allSensesMarkedRare = Boolean(word.sense?.length) && word.sense!.every((sense) =>
		Boolean(sense.misc?.some((tag) => MARKED_RARE_SENSE_TAGS.has(tag)))
	);
	const frequencyRank = Number.isFinite(word.frequencyRank)
		? Math.max(0, word.frequencyRank as number)
		: 999_999;

	return {
		reading: normalizeJapaneseReading(kana.text),
		score:
			(commonKanji ? 0 : 10_000_000) +
			(commonKana ? 0 : 1_000_000) +
			(allSensesMarkedRare ? 5_000_000 : 0) +
			Math.min(frequencyRank, 999_999),
		index
	};
}

/**
 * Align a word's full dictionary reading with the kana already visible in its
 * surface form. Visible kana become anchors, so only the kanji-bearing runs
 * receive ruby (for example, 伸ばす / のばす becomes 伸[の] + ばす).
 */
export function splitJapaneseRubyParts(surface: string, reading: string): JapaneseRubyPart[] {
	if (!surface || !reading) return [{ text: surface }];

	const normalizedReading = normalizeJapaneseReading(reading);
	const runs = splitSurfaceRuns(surface);
	if (!runs.some((run) => !run.isKana) || !runs.some((run) => run.isKana)) {
		return [{ text: surface, reading: normalizedReading }];
	}

	const aligned = alignRuns(runs, normalizedReading, 0, 0);
	return aligned ?? [{ text: surface, reading: normalizedReading }];
}

/**
 * Recover the reading for a token prefix when a lightweight segmenter has
 * split off conjugation kana (for example, 伸ば + し + た).
 */
export function trimJapaneseReadingSuffix(reading: string, visibleSuffix: string): string | null {
	const normalizedReading = normalizeJapaneseReading(reading);
	const normalizedSuffix = normalizeJapaneseReading(visibleSuffix);
	if (!normalizedSuffix || !normalizedReading.endsWith(normalizedSuffix)) return null;

	const prefix = normalizedReading.slice(0, -normalizedSuffix.length);
	return prefix || null;
}

/**
 * Recombine adjacent kanji-bearing fragments when their longest joined form
 * has a dictionary reading. Lightweight tokenizers can otherwise split words
 * such as 皮表紙 into 皮表 + 紙 and leave the first fragment unannotated.
 */
export async function mergeJapaneseCompoundTokens<T extends JapaneseRubyToken>(
	tokens: T[],
	lookupReading: (surface: string) => Promise<string | null>,
	maxParts = 6
): Promise<T[]> {
	const merged: T[] = [];
	let index = 0;

	while (index < tokens.length) {
		const availableParts = countCompoundParts(tokens, index, maxParts);
		let matched = false;

		for (let partCount = availableParts; partCount >= 2; partCount -= 1) {
			const text = tokens.slice(index, index + partCount).map((token) => token.text).join('');
			const reading = await lookupReading(text);
			if (!reading || reading === text) continue;

			merged.push({
				...tokens[index],
				text,
				reading,
				isWord: true
			});
			index += partCount;
			matched = true;
			break;
		}

		if (!matched) {
			merged.push(tokens[index]);
			index += 1;
		}
	}

	return merged;
}

function countCompoundParts(tokens: JapaneseRubyToken[], start: number, maxParts: number): number {
	let count = 0;
	while (count < maxParts) {
		const token = tokens[start + count];
		if (!token?.isWord || !HAN_RE.test(token.text)) break;
		count += 1;
	}
	return count;
}

function alignRuns(
	runs: SurfaceRun[],
	reading: string,
	runIndex: number,
	readingIndex: number
): JapaneseRubyPart[] | null {
	if (runIndex === runs.length) {
		return readingIndex === reading.length ? [] : null;
	}

	const run = runs[runIndex];
	if (run.isKana) {
		const anchor = normalizeJapaneseReading(run.text);
		if (!reading.startsWith(anchor, readingIndex)) return null;

		const remainder = alignRuns(runs, reading, runIndex + 1, readingIndex + anchor.length);
		return remainder ? [{ text: run.text }, ...remainder] : null;
	}

	if (runIndex === runs.length - 1) {
		const runReading = reading.slice(readingIndex);
		return runReading ? [{ text: run.text, reading: runReading }] : null;
	}

	const nextAnchor = normalizeJapaneseReading(runs[runIndex + 1].text);
	let anchorIndex = reading.indexOf(nextAnchor, readingIndex + 1);

	while (anchorIndex !== -1) {
		const runReading = reading.slice(readingIndex, anchorIndex);
		const remainder = alignRuns(runs, reading, runIndex + 1, anchorIndex);
		if (runReading && remainder) {
			return [{ text: run.text, reading: runReading }, ...remainder];
		}
		anchorIndex = reading.indexOf(nextAnchor, anchorIndex + 1);
	}

	return null;
}

function splitSurfaceRuns(surface: string): SurfaceRun[] {
	const runs: SurfaceRun[] = [];

	for (const char of surface) {
		const isKana = KANA_CHAR_RE.test(char);
		const previous = runs[runs.length - 1];
		if (previous?.isKana === isKana) {
			previous.text += char;
		} else {
			runs.push({ text: char, isKana });
		}
	}

	return runs;
}

function normalizeJapaneseReading(text: string): string {
	return text.normalize('NFKC').replace(/[\u30A1-\u30F6]/g, (char) =>
		String.fromCharCode(char.charCodeAt(0) - 0x60)
	);
}
