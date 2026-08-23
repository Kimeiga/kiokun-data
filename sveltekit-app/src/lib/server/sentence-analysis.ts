import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { buildWordTokens } from '$lib/utils/segment';
import { lookupWord } from '$lib/server/dictionary-lookup';
import { getTokenizer, tokenizeJapanese } from '$lib/server/kuromoji-loader';
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
	if (token.surfaceForm === 'ください') {
		return { gloss: 'please (do or give this for me)', dictionaryForm: '下さい' };
	}

	const auxiliaryGlosses: Record<string, string> = {
		'ます': 'polite verb ending',
		'ました': 'polite past-tense ending',
		'ません': 'polite negative verb ending',
		'ませんでした': 'polite negative past-tense ending',
		'です': 'polite copula (is; be)',
		'でした': 'polite past copula (was)',
		'た': 'past-tense ending',
	};
	const gloss = auxiliaryGlosses[token.surfaceForm];
	if (gloss && (token.pos === '助動詞' || token.pos === '表現')) {
		return { gloss, dictionaryForm: null };
	}
	return null;
}

export async function analyzeSentence(
	text: string,
	language: SentenceLanguage,
	bucket?: R2Bucket,
	db?: D1Database
): Promise<SentenceWordAnalysis[]> {
	if (language === 'ja' && bucket) {
		try {
			const tokenizer = await getTokenizer(bucket);
			const tokens = tokenizeJapanese(tokenizer, text);

			const enriched = await Promise.all(tokens.map(async (token) => {
				const lookupKey = token.basicForm || token.surfaceForm;
				const dictionary = await lookupWord(lookupKey, language, {
					db,
					reading: isAllKana(lookupKey) ? lookupKey : token.reading,
				});
				const reading = isAllKana(token.surfaceForm)
					? null
					: token.reading || dictionary.reading;
				const contextual = japaneseContextualMeaning(token);

				return {
					surfaceForm: token.surfaceForm,
					wordSlug: token.surfaceForm,
					// Kuromoji word_position is one-based.
					position: Math.max(0, token.position - 1),
					dictionaryForm: contextual
						? contextual.dictionaryForm
						: dictionary.dictionaryForm || (
						token.basicForm && token.basicForm !== token.surfaceForm
							? token.basicForm
							: null
						),
					reading: reading || null,
					gloss: contextual?.gloss || dictionary.gloss,
					conjugation: token.conjugation,
				} satisfies SentenceWordAnalysis;
			}));

			return enriched.filter((word) =>
				word.surfaceForm.trim().length > 0 &&
				isLexicalWord(word.surfaceForm)
			);
		} catch (error) {
			console.error('Kuromoji sentence analysis failed, using lightweight segmentation:', error);
		}
	}

	const tokens = buildWordTokens(text, language);
	const enriched = await Promise.all(tokens.map(async (token, index) => {
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
