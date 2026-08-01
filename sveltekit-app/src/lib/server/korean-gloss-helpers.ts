const KOREAN_DISPLAY_BOUNDARY_RE = /(\s+|[.,;:!?。、，！？“”"「」『』（）()[\]{}…]+)/u;
const DISPLAY_WORD_CONTENT_RE = /[\p{Script=Han}\p{Script=Latin}\p{N}\uAC00-\uD7A3]/u;

const SINO_DIGITS: Record<string, number> = {
	영: 0,
	공: 0,
	일: 1,
	이: 2,
	삼: 3,
	사: 4,
	오: 5,
	육: 6,
	칠: 7,
	팔: 8,
	구: 9,
};

const SMALL_SINO_UNITS: Record<string, number> = {
	십: 10,
	백: 100,
	천: 1_000,
};

const LARGE_SINO_UNITS: Record<string, number> = {
	만: 10_000,
	억: 100_000_000,
};

const MONTHS = [
	'',
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

/**
 * Return the same visible Korean word units used by AnnotatedSentence.
 * Intl.Segmenter intentionally splits number+counter forms (1970 + 년), while
 * the UI renders them together (1970년). Gloss keys must match the latter.
 */
export function getKoreanDisplayTokens(text: string): string[] {
	return text
		.split(KOREAN_DISPLAY_BOUNDARY_RE)
		.filter((token) => token.trim().length > 0 && DISPLAY_WORD_CONTENT_RE.test(token));
}

/**
 * Supply concise English glosses for productive Korean number/counter forms
 * that are normally absent as whole dictionary headwords.
 */
export function getKoreanMorphologyGloss(token: string): string | null {
	const numericUnit = token.match(/^(\d+|[영공일이삼사오육칠팔구십백천만억]+)(년생|일생|년|월|일)$/u);
	if (numericUnit) {
		const [, surfaceNumber, unit] = numericUnit;
		const value = /^\d+$/u.test(surfaceNumber)
			? Number(surfaceNumber)
			: parseSinoKoreanNumber(surfaceNumber);
		if (value === null || !Number.isFinite(value)) return null;

		if (unit === '월' && value >= 1 && value <= 12) return MONTHS[value];
		if (unit === '일생') return `born on the ${toEnglishOrdinal(value)}`;
		if (unit === '년생') {
			if (value >= 1_000) return `born in ${value}`;
			return `${toEnglishNumber(value)}-year-old; ${toEnglishOrdinal(value)}-year`;
		}
		if (unit === '년') return `${formatNumber(value, surfaceNumber)} year`;
		if (unit === '월') return `month ${formatNumber(value, surfaceNumber)}`;
		return `${toEnglishOrdinal(value)} day`;
	}

	const sinoNumber = parseSinoKoreanNumber(token);
	if (sinoNumber !== null) return toEnglishNumber(sinoNumber);

	if (token === '년') return 'year';
	if (token === '월') return 'month';
	if (token === '년생') return 'year-old; student in that year';

	return null;
}

/** A last-resort meaning for productive suffixes on an otherwise unlisted compound. */
export function getKoreanSuffixGloss(token: string): string | null {
	if (token.length > 1 && token.endsWith('년생')) return 'year-old; student in that year';
	if (token.length > 1 && token.endsWith('생')) return 'born; student';
	return null;
}

/**
 * Korean definitions sometimes begin with a romanized label rather than an
 * English meaning (for example "-nyeon — A suffix used to mean the year").
 * Prefer the explanatory meaning in that shape, then compact ordinary senses.
 */
export function compactKoreanGloss(gloss: string): string {
	const parts = gloss.split(/\s+[—–]\s+/u).map((part) => part.trim()).filter(Boolean);
	const first = parts[0] ?? gloss;
	const explanation = parts[1] ?? '';

	if (looksLikeRomanizedLabel(first, explanation)) {
		const semantic = compactExplanation(explanation);
		if (semantic) return semantic;
	}

	return cleanGlossFragment(first);
}

function looksLikeRomanizedLabel(label: string, explanation: string): boolean {
	if (!/^-?[a-z][a-z '-]*-?$/i.test(label)) return false;
	return /^an?\s+(?:suffix|prefix|bound noun)\b/i.test(explanation)
		|| label.startsWith('-')
		|| label.endsWith('-');
}

function compactExplanation(explanation: string): string {
	let value = explanation
		.replace(/^an?\s+(?:suffix|prefix)\s+used\s+to\s+mean\s+/i, '')
		.replace(/^an?\s+bound noun\s+(?:used\s+to\s+refer\s+to|that\s+serves\s+as)\s+/i, '')
		.replace(/^an?\s+unit\s+used\s+for\s+/i, '')
		.replace(/^the\s+/i, '')
		.replace(/^being\s+/i, '')
		.replace(/^having\s+/i, '')
		.replace(/^['"]|['"]$/g, '');

	value = value
		.replace(/^a\s+student\s+in\s+/i, 'student in ')
		.replace(/[.!?]+$/u, '')
		.trim();
	return cleanGlossFragment(value);
}

function cleanGlossFragment(value: string): string {
	return value
		.split(/;|\/(?!\/)|,(?=\s)/u, 1)[0]
		.replace(/\s*\([^)]*\)\s*/g, ' ')
		.replace(/^(?:to|a|an|the)\s+/i, '')
		.replace(/^['"]|['"]$/g, '')
		.replace(/\s+/g, ' ')
		.replace(/[.!?]+$/u, '')
		.trim();
}

function parseSinoKoreanNumber(text: string): number | null {
	if (!text || !/^[영공일이삼사오육칠팔구십백천만억]+$/u.test(text)) return null;

	let total = 0;
	let section = 0;
	let digit: number | null = null;
	for (const character of text) {
		if (character in SINO_DIGITS) {
			digit = SINO_DIGITS[character];
			continue;
		}

		if (character in SMALL_SINO_UNITS) {
			section += (digit ?? 1) * SMALL_SINO_UNITS[character];
			digit = null;
			continue;
		}

		const largeUnit = LARGE_SINO_UNITS[character];
		if (!largeUnit) return null;
		section += digit ?? 0;
		total += (section || 1) * largeUnit;
		section = 0;
		digit = null;
	}

	return total + section + (digit ?? 0);
}

function formatNumber(value: number, surface: string): string {
	return /^\d+$/u.test(surface) ? surface : toEnglishNumber(value);
}

function toEnglishNumber(value: number): string {
	if (!Number.isInteger(value) || value < 0 || value >= 1_000_000_000) return String(value);
	const underTwenty = [
		'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
		'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
		'seventeen', 'eighteen', 'nineteen',
	];
	const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
	if (value < 20) return underTwenty[value];
	if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? `-${underTwenty[value % 10]}` : ''}`;
	if (value < 1_000) return `${underTwenty[Math.floor(value / 100)]} hundred${value % 100 ? ` ${toEnglishNumber(value % 100)}` : ''}`;
	if (value < 1_000_000) return `${toEnglishNumber(Math.floor(value / 1_000))} thousand${value % 1_000 ? ` ${toEnglishNumber(value % 1_000)}` : ''}`;
	return `${toEnglishNumber(Math.floor(value / 1_000_000))} million${value % 1_000_000 ? ` ${toEnglishNumber(value % 1_000_000)}` : ''}`;
}

function toEnglishOrdinal(value: number): string {
	const irregular: Record<number, string> = {
		1: 'first', 2: 'second', 3: 'third', 5: 'fifth', 8: 'eighth', 9: 'ninth', 12: 'twelfth',
	};
	if (irregular[value]) return irregular[value];
	if (value < 20) return `${toEnglishNumber(value)}th`;
	if (value < 100 && value % 10 !== 0) {
		return `${toEnglishNumber(value - (value % 10))}-${toEnglishOrdinal(value % 10)}`;
	}
	if (value < 100) return `${toEnglishNumber(value).replace(/y$/u, 'ie')}th`;
	return `${toEnglishNumber(value)}th`;
}
