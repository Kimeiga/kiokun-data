export interface IdsForwardEntry {
	character: string;
	components: string[];
	ids_operator?: string;
}

export interface IdsForwardLookup {
	[character: string]: IdsForwardEntry;
}

export interface CharacterWords {
	[character: string]: string[];
}

export interface WordIndex {
	chinese_words: string[];
	japanese_words: string[];
	all_words: string[];
}

export interface CharacterGlosses {
	[character: string]: string;
}

export type QuestionType =
	| 'char-to-component-glosses'        // 禎 → "to show + chaste" (ORDER MATTERS)
	| 'char-gloss-to-component-chars'    // "auspicious" → "示 + 貞" (ORDER MATTERS)
	| 'component-chars-to-char-gloss'    // "示 + 貞" → "auspicious" (SINGLE ANSWER)
	| 'component-glosses-to-char'        // "to show + chaste" → 禎 (SINGLE ANSWER)
	| 'character-to-real-word';          // 鲈 → which word is real? (SINGLE ANSWER)

export interface Question {
	type: QuestionType;
	character?: string;
	components?: string[];
	correctAnswer: number | number[]; // Single index or array of indices in order
	options: string[];
}

