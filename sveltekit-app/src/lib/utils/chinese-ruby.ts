const HAN_RE = /\p{Script=Han}/u;
const LATIN_RE = /\p{Script=Latin}/u;
const PINYIN_TOKEN_RE = /[\p{Script=Latin}\p{Mark}\d:'’-]+/gu;
const PINYIN_VOWEL_RE = /[aeiouv]+/g;

/**
 * Align pinyin groups with already-segmented Chinese text.
 *
 * Example corpora are not consistent about whitespace: some write one token
 * per syllable ("yín háng"), while others write one token per word
 * ("yínháng"). The number of vowel nuclei gives us a reliable syllable count
 * for both forms, so a small dynamic-programming pass can preserve the text
 * segmenter's word boundaries without putting every reading on the first word.
 */
export function alignChinesePinyinReadings(
	textSegments: string[],
	pinyin: string
): Array<string | undefined> {
	const aligned = new Array<string | undefined>(textSegments.length).fill(undefined);
	const hanSegments = textSegments
		.map((text, index) => ({ index, hanCount: countHan(text) }))
		.filter((segment) => segment.hanCount > 0);
	const pinyinTokens = tokenizePinyin(pinyin, textSegments);

	if (hanSegments.length === 0 || pinyinTokens.length < hanSegments.length) {
		return aligned;
	}

	const tokenSyllablePrefix = [0];
	for (const token of pinyinTokens) {
		tokenSyllablePrefix.push(
			tokenSyllablePrefix[tokenSyllablePrefix.length - 1] + countPinyinSyllables(token)
		);
	}

	const segmentCount = hanSegments.length;
	const tokenCount = pinyinTokens.length;
	const costs = Array.from(
		{ length: segmentCount + 1 },
		() => new Array<number>(tokenCount + 1).fill(Number.POSITIVE_INFINITY)
	);
	const previous = Array.from(
		{ length: segmentCount + 1 },
		() => new Array<number>(tokenCount + 1).fill(-1)
	);
	costs[0][0] = 0;

	for (let segmentIndex = 1; segmentIndex <= segmentCount; segmentIndex += 1) {
		const remainingSegments = segmentCount - segmentIndex;
		const earliestEnd = segmentIndex;
		const latestEnd = tokenCount - remainingSegments;

		for (let tokenEnd = earliestEnd; tokenEnd <= latestEnd; tokenEnd += 1) {
			const earliestStart = segmentIndex - 1;
			for (let tokenStart = earliestStart; tokenStart < tokenEnd; tokenStart += 1) {
				const priorCost = costs[segmentIndex - 1][tokenStart];
				if (!Number.isFinite(priorCost)) continue;

				const syllableCount =
					tokenSyllablePrefix[tokenEnd] - tokenSyllablePrefix[tokenStart];
				const hanCount = hanSegments[segmentIndex - 1].hanCount;
				const mismatchCost = Math.abs(syllableCount - hanCount) * 10;
				const groupingCost = Math.abs((tokenEnd - tokenStart) - hanCount);
				const candidateCost = priorCost + mismatchCost + groupingCost;

				if (candidateCost < costs[segmentIndex][tokenEnd]) {
					costs[segmentIndex][tokenEnd] = candidateCost;
					previous[segmentIndex][tokenEnd] = tokenStart;
				}
			}
		}
	}

	let tokenEnd = tokenCount;
	for (let segmentIndex = segmentCount; segmentIndex > 0; segmentIndex -= 1) {
		const tokenStart = previous[segmentIndex][tokenEnd];
		if (tokenStart < 0) {
			return new Array<string | undefined>(textSegments.length).fill(undefined);
		}

		const textSegmentIndex = hanSegments[segmentIndex - 1].index;
		aligned[textSegmentIndex] = pinyinTokens.slice(tokenStart, tokenEnd).join(' ');
		tokenEnd = tokenStart;
	}

	return aligned;
}

function tokenizePinyin(pinyin: string, textSegments: string[]): string[] {
	const nonHanSurfaces = collectNonHanSurfaces(textSegments);
	return (pinyin.match(PINYIN_TOKEN_RE) ?? []).filter((token) =>
		LATIN_RE.test(token) &&
		!nonHanSurfaces.has(normalizeSurface(token))
	);
}

function collectNonHanSurfaces(textSegments: string[]): Set<string> {
	const surfaces = new Set<string>();
	let run = '';

	const addSurface = (surface: string) => {
		const normalized = normalizeSurface(surface);
		if (normalized && LATIN_RE.test(surface)) surfaces.add(normalized);
	};

	for (const segment of textSegments) {
		if (countHan(segment) > 0) {
			addSurface(run);
			run = '';
			continue;
		}

		run += segment;
		addSurface(segment);
	}
	addSurface(run);

	return surfaces;
}

function normalizeSurface(value: string): string {
	return value
		.normalize('NFKC')
		.toLowerCase()
		.replace(/[^\p{Script=Latin}\p{N}]/gu, '');
}

function countHan(text: string): number {
	let count = 0;
	for (const char of text) {
		if (HAN_RE.test(char)) count += 1;
	}
	return count;
}

function countPinyinSyllables(token: string): number {
	const normalized = token
		.normalize('NFD')
		.replace(/\p{Mark}/gu, '')
		.replace(/ü/g, 'v')
		.toLowerCase();
	const vowelGroups = normalized.match(PINYIN_VOWEL_RE)?.length ?? 0;
	return Math.max(1, vowelGroups);
}
