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

export interface ChineseCharacter {
	definitions: Record<string, string[]>[];
}

export interface ChineseCharDict {
	[character: string]: ChineseCharacter;
}

export interface CharacterGlosses {
	[character: string]: string;
}

export interface QuestionState {
	type:
		| 'char-to-component-glosses'        // 禎 → "to show + chaste"
		| 'char-gloss-to-component-chars'    // "auspicious" → "示 + 貞"
		| 'component-chars-to-char-gloss'    // "示 + 貞" → "auspicious"
		| 'component-glosses-to-char'        // "to show + chaste" → 禎
		| 'character-to-real-word';          // 鲈 → which word is real?
	character?: string;
	components?: string[];
	correctAnswer: number; // Index of correct answer (0-5)
	options: string[];
	timestamp: number;
}

