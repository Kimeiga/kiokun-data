export interface JapaneseRubyPart {
	text: string;
	reading?: string;
}

interface SurfaceRun {
	text: string;
	isKana: boolean;
}

const KANA_CHAR_RE = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]$/u;

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
