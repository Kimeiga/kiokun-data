// Card types
export interface Card {
	id: string;
	character: string;
	strokeCount: number;
	isComponent: boolean;
	gloss?: string; // Chinese character definition
}

// IDS (Ideographic Description Sequence) types
export interface IdsForwardEntry {
	character: string;
	components: string[];
	ids_operator: string;
}

export interface IdsForwardLookup {
	[character: string]: IdsForwardEntry;
}

export interface IdsReverseLookup {
	[key: string]: string | string[]; // key is "component1+component2", value is string (single) or array (multiple choices)
}

// Word validation types
export interface WordEntry {
	word: string;
	language: 'chinese' | 'japanese';
}

export interface WordIndex {
	[word: string]: WordEntry;
}

// Game lookup types for efficient combination finding
export interface ComponentCombinations {
	[component: string]: string[]; // component -> ["otherComponent:resultChar", ...]
}

export interface CharacterWords {
	[character: string]: string[]; // character -> [words containing it]
}

// Game state types
export interface GameState {
	deck: Card[];
	hand: Card[];
	stagingArea: Card[];
	score: number;
	targetScore: number;
	currency: number;
	handsRemaining: number;
	discardsRemaining: number;
	ante: number;
}

// Animation types
export interface Position {
	x: number;
	y: number;
}

export interface CardAnimation {
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	rotation?: number;
}

