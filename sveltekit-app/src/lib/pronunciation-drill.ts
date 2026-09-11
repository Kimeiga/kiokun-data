import { normalizeToHiragana } from '$lib/utils/deinflect';

export type DrillLanguage = 'ja' | 'zh';

export interface PronunciationCard {
	language: DrillLanguage;
	rank: number;
	word: string;
	readings: string[];
	definition: string;
}

export interface DrillData {
	version: 1;
	languages: Record<DrillLanguage, PronunciationCard[]>;
}

export interface LanguageProgress {
	level: number;
	correctRun: number;
}

export type DrillProgress = Record<DrillLanguage, LanguageProgress>;

export const DRILL_BAND_SIZE = 100;
export const DRILL_START_LEVEL = 4;
export const DRILL_MAX_LEVEL = 9;

const JAPANESE_SCRIPT_RE = /[\u3040-\u30ff\u31f0-\u31ff]/u;
const HAN_SCRIPT_RE = /\p{Script=Han}/u;
const PINYIN_SEPARATOR_RE = /[\s\u200b-\u200d\ufeff·・'’._-]+/gu;
const JAPANESE_SEPARATOR_RE = /[\s\u200b-\u200d\ufeff·・._-]+/gu;

const KANA_ROMAJI: Record<string, string> = {
	きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
	しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
	ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
	にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
	ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
	みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
	りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
	ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
	じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
	びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
	ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
	いぇ: 'ye', うぃ: 'wi', うぇ: 'we', うぉ: 'wo',
	ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo',
	ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo',
	しぇ: 'she', じぇ: 'je', ちぇ: 'che',
	てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du',
	つぁ: 'tsa', つぃ: 'tsi', つぇ: 'tse', つぉ: 'tso',
	くぁ: 'kwa', くぃ: 'kwi', くぇ: 'kwe', くぉ: 'kwo',
	ぐぁ: 'gwa', ぐぃ: 'gwi', ぐぇ: 'gwe', ぐぉ: 'gwo',
	あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
	か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
	さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
	た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
	な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
	は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
	ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
	や: 'ya', ゆ: 'yu', よ: 'yo',
	ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
	わ: 'wa', ゐ: 'wi', ゑ: 'we', を: 'wo',
	が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
	ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
	だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
	ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
	ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
	ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
	ゔ: 'vu', ゎ: 'wa'
};

function katakanaToHiragana(value: string): string {
	return value.replace(/[\u30a1-\u30f6]/g, (character) =>
		String.fromCharCode(character.charCodeAt(0) - 0x60)
	);
}

function normalizeLatin(value: string): string {
	return value
		.normalize('NFKC')
		.toLocaleLowerCase('en')
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/[^a-z]/g, '');
}

export function normalizePinyin(value: string): string {
	return value
		.normalize('NFKC')
		.toLocaleLowerCase('en')
		.replace(/u:|[üǖǘǚǜ]/g, 'v')
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(PINYIN_SEPARATOR_RE, '')
		.replace(/[0-5]/g, '');
}

function normalizeJapaneseKana(value: string): string {
	return katakanaToHiragana(value.normalize('NFKC'))
		.replace(JAPANESE_SEPARATOR_RE, '')
		.replace(/[’']/g, '');
}

function lastVowel(value: string): string {
	for (let index = value.length - 1; index >= 0; index -= 1) {
		if ('aeiou'.includes(value[index])) return value[index];
	}
	return '';
}

export function romanizeJapaneseReading(value: string): string {
	const kana = normalizeJapaneseKana(value);
	let output = '';

	for (let index = 0; index < kana.length; index += 1) {
		const character = kana[index];
		if (character === 'ー') {
			output += lastVowel(output);
			continue;
		}

		if (character === 'っ') {
			const nextPair = kana.slice(index + 1, index + 3);
			const nextSingle = kana[index + 1] ?? '';
			const nextRomaji = KANA_ROMAJI[nextPair] || KANA_ROMAJI[nextSingle] || '';
			if (nextRomaji[0] && !'aeioun'.includes(nextRomaji[0])) output += nextRomaji[0];
			continue;
		}

		if (character === 'ん') {
			const nextPair = kana.slice(index + 1, index + 3);
			const nextSingle = kana[index + 1] ?? '';
			const nextRomaji = KANA_ROMAJI[nextPair] || KANA_ROMAJI[nextSingle] || '';
			output += /^[aeiouyn]/.test(nextRomaji) ? "n'" : 'n';
			continue;
		}

		const pair = kana.slice(index, index + 2);
		if (KANA_ROMAJI[pair]) {
			output += KANA_ROMAJI[pair];
			index += 1;
			continue;
		}

		output += KANA_ROMAJI[character] || character;
	}

	return output;
}

function japaneseReadingAliases(card: PronunciationCard): string[] {
	if (card.word === 'は') return ['wa'];
	if (card.word === 'へ') return ['e'];
	if (card.word === 'を') return ['o'];
	return [];
}

export function gradePronunciation(card: PronunciationCard, answer: string): boolean {
	if (!answer.trim()) return false;

	if (card.language === 'zh') {
		const normalizedAnswer = normalizePinyin(answer);
		return card.readings.some((reading) => normalizePinyin(reading) === normalizedAnswer);
	}

	if (JAPANESE_SCRIPT_RE.test(answer)) {
		const normalizedAnswer = normalizeJapaneseKana(answer);
		return card.readings.some(
			(reading) => normalizeJapaneseKana(reading) === normalizedAnswer
		);
	}

	const normalizedAnswer = normalizeLatin(answer);
	for (const reading of card.readings) {
		const romanized = normalizeLatin(romanizeJapaneseReading(reading));
		if (romanized === normalizedAnswer) return true;

		const converted = normalizeJapaneseKana(normalizeToHiragana(answer.replace(/\s+/g, '')));
		if (converted === normalizeJapaneseKana(reading)) return true;
	}

	return japaneseReadingAliases(card).some(
		(alias) => normalizeLatin(alias) === normalizedAnswer
	);
}

export function cardKey(card: Pick<PronunciationCard, 'language' | 'word'>): string {
	return `${card.language}:${card.word}`;
}

export function isPronunciationCardEligible(card: PronunciationCard): boolean {
	return card.language === 'zh' || HAN_SCRIPT_RE.test(card.word);
}

export function createDrillProgress(): DrillProgress {
	return {
		ja: { level: DRILL_START_LEVEL, correctRun: 0 },
		zh: { level: DRILL_START_LEVEL, correctRun: 0 }
	};
}

export function updateDrillProgress(
	progress: DrillProgress,
	language: DrillLanguage,
	correct: boolean
): DrillProgress {
	const current = progress[language];
	let level = current.level;
	let correctRun = correct ? current.correctRun + 1 : 0;

	if (!correct) {
		level = Math.max(0, level - 1);
	} else if (correctRun >= 3) {
		level = Math.min(DRILL_MAX_LEVEL, level + 1);
		correctRun = 0;
	}

	return {
		...progress,
		[language]: { level, correctRun }
	};
}

function unseenCards(
	cards: PronunciationCard[],
	seen: ReadonlySet<string>
): PronunciationCard[] {
	return cards.filter((card) => isPronunciationCardEligible(card) && !seen.has(cardKey(card)));
}

function cardsNearLevel(
	cards: PronunciationCard[],
	level: number
): PronunciationCard[] {
	const lowerRank = level * DRILL_BAND_SIZE + 1;
	const upperRank = (level + 1) * DRILL_BAND_SIZE;
	const inBand = cards.filter(
		(card) => card.rank >= lowerRank && card.rank <= upperRank
	);
	if (inBand.length > 0) return inBand;

	const center = (lowerRank + upperRank) / 2;
	return [...cards]
		.sort((left, right) =>
			Math.abs(left.rank - center) - Math.abs(right.rank - center)
		)
		.slice(0, DRILL_BAND_SIZE);
}

export function pickNextCard(
	data: DrillData,
	seen: ReadonlySet<string>,
	progress: DrillProgress,
	previousLanguage: DrillLanguage | null,
	random: () => number = Math.random
): PronunciationCard | null {
	const available = (['ja', 'zh'] as const).filter(
		(language) => unseenCards(data.languages[language], seen).length > 0
	);
	if (available.length === 0) return null;

	let language: DrillLanguage;
	if (available.length === 1) {
		language = available[0];
	} else if (previousLanguage) {
		language = previousLanguage === 'ja' ? 'zh' : 'ja';
	} else {
		language = random() < 0.5 ? 'ja' : 'zh';
	}

	const candidates = cardsNearLevel(
		unseenCards(data.languages[language], seen),
		progress[language].level
	);
	if (candidates.length === 0) return null;

	return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}
