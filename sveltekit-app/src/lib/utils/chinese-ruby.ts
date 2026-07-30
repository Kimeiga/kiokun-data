const HAN_RE = /\p{Script=Han}/u;
const LATIN_RE = /\p{Script=Latin}/u;
const PINYIN_TOKEN_RE = /[\p{Script=Latin}\p{Mark}\d:'’-]+/gu;
const PINYIN_VOWEL_RE = /[aeiouv]+/g;
const PINYIN_INITIALS = [
	'',
	'b', 'p', 'm', 'f',
	'd', 't', 'n', 'l',
	'g', 'k', 'h',
	'j', 'q', 'x',
	'zh', 'ch', 'sh', 'r',
	'z', 'c', 's',
	'y', 'w'
];
const PINYIN_FINALS = [
	'a', 'o', 'e', 'ai', 'ei', 'ao', 'ou',
	'an', 'en', 'ang', 'eng', 'ong', 'er',
	'i', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong',
	'u', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang', 'ueng',
	'v', 've', 'van', 'vn'
];
const VALID_PINYIN_SYLLABLES = new Set([
	...PINYIN_INITIALS.flatMap((initial) =>
		PINYIN_FINALS.map((final) => `${initial}${final}`)
	),
	'zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si',
	'm', 'n', 'ng', 'hm', 'hng'
]);

interface PinyinUnit {
	surface: string;
	sourceToken: number;
}

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
			tokenSyllablePrefix[tokenSyllablePrefix.length - 1] +
				countPinyinSyllables(token.surface)
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
		aligned[textSegmentIndex] = joinPinyinUnits(
			pinyinTokens.slice(tokenStart, tokenEnd)
		);
		tokenEnd = tokenStart;
	}

	return aligned;
}

function tokenizePinyin(pinyin: string, textSegments: string[]): PinyinUnit[] {
	const nonHanSurfaces = collectNonHanSurfaces(textSegments);
	return (pinyin.match(PINYIN_TOKEN_RE) ?? [])
		.filter((token) =>
			LATIN_RE.test(token) &&
			!nonHanSurfaces.has(normalizeSurface(token))
		)
		.flatMap((token, sourceToken) =>
			splitCompactPinyinToken(token).map((surface) => ({ surface, sourceToken }))
		);
}

function joinPinyinUnits(units: PinyinUnit[]): string {
	return units.reduce((reading, unit, index) => {
		if (index === 0) return unit.surface;
		const separator = units[index - 1].sourceToken === unit.sourceToken ? '' : ' ';
		return `${reading}${separator}${unit.surface}`;
	}, '');
}

function splitCompactPinyinToken(token: string): string[] {
	const expectedSyllables = countPinyinSyllables(token);
	if (expectedSyllables <= 1) return [token];

	const originalChars = [...token];
	const letters: Array<{ normalized: string; originalIndex: number }> = [];
	for (const [originalIndex, char] of originalChars.entries()) {
		const decomposed = char.normalize('NFD');
		const base = decomposed.replace(/\p{Mark}/gu, '').toLowerCase();
		if (!/^[a-z]$/u.test(base)) continue;
		letters.push({
			normalized: base === 'u' && decomposed.includes('\u0308') ? 'v' : base,
			originalIndex
		});
	}

	const normalized = letters.map((letter) => letter.normalized).join('');
	if (!normalized) return [token];

	const memo = new Map<string, { boundaries: number[]; score: number } | null>();
	const findBoundaries = (
		start: number,
		remaining: number
	): { boundaries: number[]; score: number } | null => {
		const key = `${start}:${remaining}`;
		if (memo.has(key)) return memo.get(key) ?? null;
		if (remaining === 0) {
			const result = start === normalized.length
				? { boundaries: [], score: 0 }
				: null;
			memo.set(key, result);
			return result;
		}

		let best: { boundaries: number[]; score: number } | null = null;
		const maxEnd = normalized.length - (remaining - 1);
		for (let end = start + 1; end <= maxEnd; end += 1) {
			const syllable = normalized.slice(start, end);
			if (!VALID_PINYIN_SYLLABLES.has(syllable)) continue;
			const rest = findBoundaries(end, remaining - 1);
			if (!rest) continue;

			const originalStart = letters[start]?.originalIndex ?? 0;
			const originalEnd = letters[end]?.originalIndex ?? originalChars.length;
			const surface = originalChars.slice(originalStart, originalEnd).join('');
			const hasTone = /\d|\p{Mark}/u.test(surface.normalize('NFD'));
			const isOverlyShort =
				syllable.length === 1 && !['a', 'e', 'o', 'm', 'n'].includes(syllable);
			const score = rest.score + (hasTone ? 4 : 0) - (isOverlyShort ? 3 : 0);
			if (!best || score > best.score) {
				best = { boundaries: [end, ...rest.boundaries], score };
			}
		}

		memo.set(key, best);
		return best;
	};

	const result = findBoundaries(0, expectedSyllables);
	if (!result) return [token];

	const syllables: string[] = [];
	let letterStart = 0;
	for (const letterEnd of result.boundaries) {
		const originalStart = letters[letterStart]?.originalIndex ?? 0;
		const originalEnd = letters[letterEnd]?.originalIndex ?? originalChars.length;
		syllables.push(originalChars.slice(originalStart, originalEnd).join(''));
		letterStart = letterEnd;
	}
	return syllables.length === expectedSyllables ? syllables : [token];
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
