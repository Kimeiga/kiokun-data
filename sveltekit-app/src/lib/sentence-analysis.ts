export type SentenceLanguage = 'ja' | 'zh' | 'ko';

export interface SentenceWordAnalysis {
	surfaceForm: string;
	wordSlug: string;
	position: number;
	dictionaryForm: string | null;
	reading: string | null;
	gloss: string | null;
	conjugation: string | null;
}
export interface AnnotatedSentenceSegment {
	text: string;
	position: number;
	isWord: boolean;
	target: string | null;
	reading: string | null;
	definition: string | null;
	conjugation: string | null;
}

const LEADING_GLOSS_WORDS = /^(?:to|a|an|the)\s+/i;
const CLAUSE_BREAK = /\s*(?:;|\/|\||,\s+(?:to|a|an|the|indicates?|used|expresses?)\b|\s[-–—]\s)\s*/i;

/**
 * Turn a dictionary's first full gloss into the short hint shown below a word.
 * A compact phrase is preferable to a misleading single word when a particle
 * or grammar item cannot be explained accurately in one word.
 */
export function compactSentenceGloss(gloss: string | null | undefined, maxLength = 28): string | null {
	if (!gloss) return null;

	let compact = gloss
		.replace(/\([^)]*\)/g, ' ')
		.split(CLAUSE_BREAK)[0]
		.replace(LEADING_GLOSS_WORDS, '')
		.replace(/\s+/g, ' ')
		.trim();

	if (!compact) return null;
	if (compact.length <= maxLength) return compact;

	const words = compact.split(' ');
	let result = '';
	for (const word of words) {
		const next = result ? `${result} ${word}` : word;
		if (next.length > maxLength - 1) break;
		result = next;
	}

	return `${result || compact.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Reinsert punctuation and whitespace around analyzed word positions so the
 * annotated header always reproduces the source sentence exactly.
 */
export function buildAnnotatedSentenceSegments(
	text: string,
	words: SentenceWordAnalysis[]
): AnnotatedSentenceSegment[] {
	const sorted = [...words]
		.filter((word) => word.surfaceForm && word.position >= 0)
		.sort((a, b) => a.position - b.position);
	const segments: AnnotatedSentenceSegment[] = [];
	let cursor = 0;

	for (const word of sorted) {
		let position = word.position;
		if (position < cursor || text.slice(position, position + word.surfaceForm.length) !== word.surfaceForm) {
			position = text.indexOf(word.surfaceForm, cursor);
		}
		if (position < cursor) continue;

		if (position > cursor) {
			segments.push({
				text: text.slice(cursor, position),
				position: cursor,
				isWord: false,
				target: null,
				reading: null,
				definition: null,
				conjugation: null,
			});
		}

		segments.push({
			text: word.surfaceForm,
			position,
			isWord: true,
			target: word.dictionaryForm || word.wordSlug || word.surfaceForm,
			reading: word.reading,
			definition: compactSentenceGloss(word.gloss),
			conjugation: word.conjugation,
		});
		cursor = position + word.surfaceForm.length;
	}

	if (cursor < text.length) {
		segments.push({
			text: text.slice(cursor),
			position: cursor,
			isWord: false,
			target: null,
			reading: null,
			definition: null,
			conjugation: null,
		});
	}

	return segments;
}

export function isStudyableSentenceWord(word: SentenceWordAnalysis): boolean {
	if (!word.surfaceForm.trim() || /^\p{N}+$/u.test(word.surfaceForm)) return false;
	return Boolean(
		word.gloss ||
		/[\p{Script=Han}\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/u.test(word.surfaceForm)
	);
}
