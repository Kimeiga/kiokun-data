import type { D1Database } from '@cloudflare/workers-types';
import { buildWordTokens } from '$lib/utils/segment';
import { lookupWord } from '$lib/server/dictionary-lookup';
import type { SentenceLanguage, SentenceWordAnalysis } from '$lib/sentence-analysis';

function isAllKana(text: string): boolean {
	return /^[\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FFー]+$/.test(text);
}

function isLexicalWord(text: string): boolean {
	return (
		!/^\p{N}+$/u.test(text) &&
		/[\p{Script=Han}\p{Script=Latin}\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/u.test(text)
	);
}

function japaneseSurfaceReading(
	surface: string,
	dictionaryForm: string | null,
	reading: string | null
): string | null {
	if (!reading || isAllKana(surface)) return null;
	if (!dictionaryForm || dictionaryForm === surface) return reading;

	const baseSuffix = dictionaryForm.match(/[\u3040-\u30ff\u31f0-\u31ffー]+$/u)?.[0] || '';
	const surfaceSuffix = surface.match(/[\u3040-\u30ff\u31f0-\u31ffー]+$/u)?.[0] || '';
	if (baseSuffix && surfaceSuffix && reading.endsWith(baseSuffix)) {
		return reading.slice(0, -baseSuffix.length) + surfaceSuffix;
	}
	return reading;
}

export function japaneseContextualMeaning(token: {
	surfaceForm: string;
	pos: string;
}): { gloss: string; dictionaryForm: string | null } | null {
	const meaning = japaneseLightweightMeaning(token.surfaceForm);
	if (token.surfaceForm === 'ください') return meaning;
	if (meaning && JAPANESE_AUXILIARY_FORMS.has(token.surfaceForm) &&
		(token.pos === '助動詞' || token.pos === '表現')) return meaning;
	return null;
}

const JAPANESE_AUXILIARY_FORMS = new Set([
	'ます', 'ました', 'ません', 'ませんでした', 'です', 'でした', 'た', 'たい',
]);

const JAPANESE_LIGHTWEIGHT_MEANINGS: Record<
	string,
	{ gloss: string; dictionaryForm: string | null }
> = {
	'すみません': { gloss: 'excuse me; sorry', dictionaryForm: '済みません' },
	'こんにちは': { gloss: 'hello; good afternoon', dictionaryForm: '今日は' },
	'こんばんは': { gloss: 'good evening', dictionaryForm: '今晩は' },
	'ありがとう': { gloss: 'thank you', dictionaryForm: '有難う' },
	'ありがとうございます': { gloss: 'thank you', dictionaryForm: '有難うございます' },
	'ありがとうございました': { gloss: 'thank you very much', dictionaryForm: '有難うございました' },
	'おはようございます': { gloss: 'good morning', dictionaryForm: 'お早うございます' },
	'お願いします': { gloss: 'please', dictionaryForm: null },
	'よろしくお願いします': { gloss: 'please; pleased to meet you', dictionaryForm: null },
	'いってきます': { gloss: "I'm leaving; see you later", dictionaryForm: '行ってきます' },
	'いってらっしゃい': { gloss: 'take care; see you later', dictionaryForm: '行ってらっしゃい' },
	'おかえりなさい': { gloss: 'welcome home', dictionaryForm: 'お帰りなさい' },
	'ごちそうさまでした': { gloss: 'thank you for the meal', dictionaryForm: 'ご馳走様でした' },
	'どうやって': { gloss: 'how; by what means', dictionaryForm: null },
	'ください': { gloss: 'please (do or give this for me)', dictionaryForm: '下さい' },
	'ます': { gloss: 'polite verb ending', dictionaryForm: null },
	'ました': { gloss: 'polite past-tense ending', dictionaryForm: null },
	'ません': { gloss: 'polite negative verb ending', dictionaryForm: null },
	'ませんでした': { gloss: 'polite negative past-tense ending', dictionaryForm: null },
	'です': { gloss: 'polite copula (is; be)', dictionaryForm: null },
	'でした': { gloss: 'polite past copula (was)', dictionaryForm: null },
	'た': { gloss: 'past-tense ending', dictionaryForm: null },
	'たい': { gloss: 'want to (verb ending)', dictionaryForm: null },
	'は': { gloss: 'indicates sentence topic', dictionaryForm: null },
	'が': { gloss: 'indicates the subject of a sentence', dictionaryForm: null },
	'を': { gloss: 'indicates direct object of action', dictionaryForm: null },
	'に': { gloss: 'to; at; on (target marker)', dictionaryForm: null },
	'で': { gloss: 'at; by; with (location or means)', dictionaryForm: null },
	'へ': { gloss: 'toward; to', dictionaryForm: null },
	'と': { gloss: 'with; and; quotation marker', dictionaryForm: null },
	'も': { gloss: 'also; too', dictionaryForm: null },
	'まで': { gloss: 'until; as far as', dictionaryForm: null },
	'から': { gloss: 'from; because', dictionaryForm: null },
	'か': { gloss: 'indicates a question', dictionaryForm: null },
	'これ': { gloss: 'this', dictionaryForm: '此れ' },
	'どこ': { gloss: 'where', dictionaryForm: '何処' },
	'いくら': { gloss: 'how much', dictionaryForm: '幾ら' },
	'おすすめ': { gloss: 'recommendation', dictionaryForm: 'お勧め' },
};

/**
 * Small, deterministic grammar and travel-expression layer used by the
 * production worker. It avoids loading Kuromoji's multi-megabyte dictionary
 * on a cold isolate while keeping the most learner-sensitive tokens accurate.
 */
export function japaneseLightweightMeaning(
	surfaceForm: string
): { gloss: string; dictionaryForm: string | null } | null {
	return JAPANESE_LIGHTWEIGHT_MEANINGS[surfaceForm] || null;
}

export async function analyzeSentence(
	text: string,
	language: SentenceLanguage,
	db?: D1Database
): Promise<SentenceWordAnalysis[]> {
	const tokens = buildWordTokens(text, language);
	const enriched = await Promise.all(tokens.map(async (token, index) => {
		const contextual = language === 'ja'
			? japaneseLightweightMeaning(token.surfaceForm)
			: null;
		if (contextual) {
			return {
				...token,
				dictionaryForm: contextual.dictionaryForm,
				reading: null,
				gloss: contextual.gloss,
				conjugation: null,
			} satisfies SentenceWordAnalysis;
		}

		const nextSurface = tokens[index + 1]?.surfaceForm || '';
		const preferDeconjugation = language === 'ja' && (
			/^(?:ます|ませ|たい|たく)$/u.test(nextSurface) ||
			(token.surfaceForm.endsWith('っ') && /^(?:て|た)$/u.test(nextSurface))
		);
		const dictionary = await lookupWord(token.surfaceForm, language, {
			db,
			preferDeconjugation,
		});
		const dictionaryReading = language === 'ja'
			? japaneseSurfaceReading(token.surfaceForm, dictionary.dictionaryForm, dictionary.reading)
			: dictionary.reading;
		const reading = dictionaryReading === token.surfaceForm ? null : dictionaryReading;
		return {
			...token,
			dictionaryForm: dictionary.dictionaryForm,
			reading,
			gloss: dictionary.gloss,
			conjugation: null,
		} satisfies SentenceWordAnalysis;
	}));
	return enriched.filter((word) => isLexicalWord(word.surfaceForm));
}
