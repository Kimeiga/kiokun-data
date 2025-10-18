import type {
	IdsForwardLookup,
	IdsReverseLookup,
	WordIndex,
	ComponentCombinations,
	CharacterWords,
	Card
} from './types';

class DataLoader {
	private static instance: DataLoader;
	private idsForward: IdsForwardLookup = {};
	private idsReverse: IdsReverseLookup = {};
	private wordIndex: WordIndex = {};
	private componentCombinations: ComponentCombinations = {};
	private characterWords: CharacterWords = {};
	private strokeData: Map<string, number> = new Map();
	private glossData: Map<string, string> = new Map();
	private loaded = false;
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;

	private referenceGlyphData: Uint8ClampedArray | null = null;

	private constructor() {
		// Create canvas for glyph detection
		if (typeof document !== 'undefined') {
			this.canvas = document.createElement('canvas');
			this.canvas.width = 50;
			this.canvas.height = 50;
			this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
			if (this.ctx) {
				this.ctx.font = '40px sans-serif';
				this.ctx.textBaseline = 'top';
				// Render a reference character that we know has no glyph
				// U+FFFD is the replacement character, but we want something that renders as tofu
				// U+10FFFF is guaranteed to not have a glyph in any font
				this.referenceGlyphData = this.renderCharacterToPixels('\uDBFF\uDFFF'); // U+10FFFF
			}
		}
	}

	public static getInstance(): DataLoader {
		if (!DataLoader.instance) {
			DataLoader.instance = new DataLoader();
		}
		return DataLoader.instance;
	}

	public async load(): Promise<void> {
		if (this.loaded) return;

		try {
			// Load IDS data, word index, and game lookup files
			const [forwardRes, reverseRes, wordRes, combRes, charWordsRes, chineseCharRes] =
				await Promise.all([
					fetch('/data/ids_forward.json'),
					fetch('/data/ids_reverse.json'),
					fetch('/data/word_index.json'),
					fetch('/data/component_combinations.json'),
					fetch('/data/character_words.json'),
					fetch('/data/chinese_char.json').catch(() => null) // Optional
				]);

			this.idsForward = await forwardRes.json();
			this.idsReverse = await reverseRes.json();

			// Load and convert word index from arrays to lookup map
			const wordIndexData = await wordRes.json();
			this.wordIndex = {};

			// Add Chinese words
			if (wordIndexData.chinese_words) {
				for (const word of wordIndexData.chinese_words) {
					this.wordIndex[word] = { word, language: 'chinese' };
				}
			}

			// Add Japanese words
			if (wordIndexData.japanese_words) {
				for (const word of wordIndexData.japanese_words) {
					this.wordIndex[word] = { word, language: 'japanese' };
				}
			}

			this.componentCombinations = await combRes.json();
			this.characterWords = await charWordsRes.json();

			// Load Chinese character glosses if available
			if (chineseCharRes) {
				const chineseChar = await chineseCharRes.json();
				for (const [char, data] of Object.entries(chineseChar)) {
					if (data && typeof data === 'object' && 'definitions' in data) {
						const definitions = (data as any).definitions;
						if (Array.isArray(definitions) && definitions.length > 0) {
							// Get first definition from first pronunciation
							const firstPronunciation = Object.values(definitions[0])[0];
							if (Array.isArray(firstPronunciation) && firstPronunciation.length > 0) {
								this.glossData.set(char, firstPronunciation[0]);
							}
						}
					}
				}
				console.log(`  ✅ Loaded ${this.glossData.size} character glosses`);
			}

			// Build stroke data from IDS forward
			for (const [char, entry] of Object.entries(this.idsForward)) {
				if (!this.strokeData.has(char)) {
					// Calculate stroke count from components if not already set
					const componentStrokes = entry.components.reduce((sum, comp) => {
						return sum + (this.strokeData.get(comp) || this.estimateStrokes(comp));
					}, 0);
					this.strokeData.set(char, componentStrokes);
				}
			}

			// Add basic component stroke counts (common radicals)
			const basicStrokes: Record<string, number> = {
				一: 1,
				二: 2,
				三: 3,
				人: 2,
				口: 3,
				土: 3,
				女: 3,
				子: 3,
				小: 3,
				山: 3,
				工: 3,
				大: 3,
				中: 4,
				心: 4,
				手: 4,
				日: 4,
				月: 4,
				木: 4,
				水: 4,
				火: 4,
				田: 5,
				目: 5,
				石: 5,
				示: 5,
				禾: 5,
				白: 5,
				皮: 5,
				立: 5
			};

			for (const [char, strokes] of Object.entries(basicStrokes)) {
				if (!this.strokeData.has(char)) {
					this.strokeData.set(char, strokes);
				}
			}

			this.loaded = true;
			console.log('✅ Data loaded successfully');
			console.log(`  - IDS Forward: ${Object.keys(this.idsForward).length} entries`);
			console.log(`  - IDS Reverse: ${Object.keys(this.idsReverse).length} entries`);
			console.log(`  - Word Index: ${Object.keys(this.wordIndex).length} words`);
			console.log(
				`  - Component Combinations: ${Object.keys(this.componentCombinations).length} components`
			);
			console.log(
				`  - Character Words: ${Object.keys(this.characterWords).length} characters`
			);

			// Test a few words to verify they're loaded correctly
			const testWords = ['人生', '大人', '日本', '中国', '学生'];
			console.log('\n🧪 Testing word validation:');
			for (const word of testWords) {
				const result = this.isValidWord(word.split(''));
				console.log(
					`  ${result.valid ? '✅' : '❌'} ${word} - ${result.valid ? result.language : 'not found'}`
				);
			}
		} catch (error) {
			console.error('Failed to load data:', error);
			throw error;
		}
	}

	private estimateStrokes(char: string): number {
		// Simple estimation based on Unicode block
		const code = char.charCodeAt(0);
		if (code >= 0x4e00 && code <= 0x9fff) {
			// CJK Unified Ideographs - estimate 8 strokes average
			return 8;
		}
		return 5; // Default
	}

	// Helper method to render a character and get its pixel data
	private renderCharacterToPixels(char: string): Uint8ClampedArray {
		if (!this.ctx || !this.canvas) {
			return new Uint8ClampedArray();
		}

		// Clear canvas
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// Draw the character
		this.ctx.fillStyle = 'black';
		this.ctx.fillText(char, 5, 5);

		// Get pixel data
		const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
		return imageData.data;
	}

	// Compare two pixel arrays to see if they're similar (within a threshold)
	private pixelDataMatches(data1: Uint8ClampedArray, data2: Uint8ClampedArray): boolean {
		if (data1.length !== data2.length) return false;

		let differences = 0;
		const threshold = 100; // Allow some small differences due to anti-aliasing

		// Sample every 4th pixel for performance
		for (let i = 0; i < data1.length; i += 16) {
			const diff = Math.abs(data1[i] - data2[i]) +
				Math.abs(data1[i + 1] - data2[i + 1]) +
				Math.abs(data1[i + 2] - data2[i + 2]) +
				Math.abs(data1[i + 3] - data2[i + 3]);

			if (diff > 10) {
				differences++;
			}
		}

		// If more than threshold pixels are different, they don't match
		return differences < threshold;
	}

	// Detect if a character can be rendered (has a glyph in the font)
	public canRenderCharacter(char: string): boolean {
		if (!this.ctx || !this.canvas || !this.referenceGlyphData) {
			return true; // Assume yes if no canvas or reference
		}

		try {
			// Render the test character
			const testPixels = this.renderCharacterToPixels(char);

			// Compare with the reference missing glyph
			// If they match, this character is also missing a glyph
			const matchesTofu = this.pixelDataMatches(testPixels, this.referenceGlyphData);

			// Return true if it DOESN'T match the tofu (i.e., it has a real glyph)
			return !matchesTofu;
		} catch (e) {
			// If there's any error, assume the character is renderable
			console.warn('Error checking glyph for', char, e);
			return true;
		}
	}

	public getStrokeCount(char: string): number {
		return this.strokeData.get(char) || this.estimateStrokes(char);
	}

	public canCombine(char1: string, char2: string): string[] {
		const key1 = `${char1}+${char2}`;
		const key2 = `${char2}+${char1}`;

		const results: string[] = [];

		const addResults = (value: string | string[] | undefined) => {
			if (!value) return;
			if (typeof value === 'string') {
				results.push(value);
			} else {
				results.push(...value);
			}
		};

		addResults(this.idsReverse[key1]);
		addResults(this.idsReverse[key2]);

		return [...new Set(results)]; // Remove duplicates
	}

	public canDecompose(char: string): string[] | null {
		const entry = this.idsForward[char];
		return entry ? entry.components : null;
	}

	public isValidWord(chars: string[]): { valid: boolean; language?: 'chinese' | 'japanese' } {
		const word = chars.join('');
		const entry = this.wordIndex[word];
		if (entry) {
			return { valid: true, language: entry.language };
		}
		return { valid: false };
	}

	public createCard(character: string): Card {
		const strokeCount = this.getStrokeCount(character);
		const isComponent = !this.idsForward[character]; // If not in forward lookup, it's a component
		const gloss = this.glossData.get(character);

		return {
			id: `${character}-${Date.now()}-${Math.random()}`,
			character,
			strokeCount,
			isComponent,
			gloss
		};
	}

	// Check if a character is a valid CJK character
	private isValidCJKCharacter(char: string): boolean {
		if (!char || char.length === 0) return false;

		const codePoint = char.codePointAt(0);
		if (!codePoint) return false;

		// Check if it's ASCII (0x00-0x7F)
		if (codePoint >= 0x00 && codePoint <= 0x7f) {
			console.warn(`⚠️  Found ASCII character: "${char}" (U+${codePoint.toString(16).toUpperCase().padStart(4, '0')})`);
			console.warn(`   Character info:`, {
				char,
				codePoint: `U+${codePoint.toString(16).toUpperCase()}`,
				charCode: codePoint,
				isInForwardLookup: !!this.idsForward[char],
				forwardLookupEntry: this.idsForward[char]
			});
			return false;
		}

		// Check if it's in valid CJK ranges
		const validRanges = [
			[0x2e80, 0x2eff], // CJK Radicals Supplement
			[0x2f00, 0x2fdf], // Kangxi Radicals
			[0x3000, 0x303f], // CJK Symbols and Punctuation
			[0x3040, 0x309f], // Hiragana
			[0x30a0, 0x30ff], // Katakana
			[0x3100, 0x312f], // Bopomofo
			[0x3130, 0x318f], // Hangul Compatibility Jamo
			[0x3190, 0x319f], // Kanbun
			[0x31a0, 0x31bf], // Bopomofo Extended
			[0x31c0, 0x31ef], // CJK Strokes
			[0x31f0, 0x31ff], // Katakana Phonetic Extensions
			[0x3200, 0x32ff], // Enclosed CJK Letters and Months
			[0x3300, 0x33ff], // CJK Compatibility
			[0x3400, 0x4dbf], // CJK Unified Ideographs Extension A
			[0x4dc0, 0x4dff], // Yijing Hexagram Symbols
			[0x4e00, 0x9fff], // CJK Unified Ideographs
			[0xa000, 0xa48f], // Yi Syllables
			[0xa490, 0xa4cf], // Yi Radicals
			[0xf900, 0xfaff], // CJK Compatibility Ideographs
			[0x20000, 0x2a6df], // CJK Unified Ideographs Extension B
			[0x2a700, 0x2b73f], // CJK Unified Ideographs Extension C
			[0x2b740, 0x2b81f], // CJK Unified Ideographs Extension D
			[0x2b820, 0x2ceaf], // CJK Unified Ideographs Extension E
			[0x2ceb0, 0x2ebef], // CJK Unified Ideographs Extension F
			[0x2ebf0, 0x2ee5f], // CJK Unified Ideographs Extension I
			[0x2f800, 0x2fa1f], // CJK Compatibility Ideographs Supplement
			[0x30000, 0x3134f], // CJK Unified Ideographs Extension G
			[0x31350, 0x323af], // CJK Unified Ideographs Extension H
			[0x323b0, 0x3347b] // CJK Unified Ideographs Extension J
		];

		const isInValidRange = validRanges.some(([start, end]) => codePoint >= start && codePoint <= end);

		if (!isInValidRange) {
			console.warn(`⚠️  Found non-CJK character: "${char}" (U+${codePoint.toString(16).toUpperCase().padStart(4, '0')})`);
			console.warn(`   Character info:`, {
				char,
				codePoint: `U+${codePoint.toString(16).toUpperCase()}`,
				charCode: codePoint,
				isInForwardLookup: !!this.idsForward[char],
				forwardLookupEntry: this.idsForward[char]
			});
			return false;
		}

		return true;
	}

	public getRandomComponents(count: number): Card[] {
		// Get all components (characters not in forward lookup)
		const allChars = new Set([
			...Object.keys(this.idsForward),
			...Object.values(this.idsForward).flatMap((entry) => entry.components)
		]);

		let components = Array.from(allChars).filter((char) => !this.idsForward[char]);

		console.log(`📊 Total components before filtering: ${components.length}`);

		// Filter out non-CJK characters
		const cjkComponents = components.filter((char) => this.isValidCJKCharacter(char));
		const nonCJKCount = components.length - cjkComponents.length;

		if (nonCJKCount > 0) {
			console.log(`  ℹ️  Filtered out ${nonCJKCount} non-CJK characters`);
		}

		// Filter out characters that can't be rendered
		const renderableComponents = cjkComponents.filter((char) => this.canRenderCharacter(char));
		const unrenderableCount = cjkComponents.length - renderableComponents.length;

		if (unrenderableCount > 0) {
			console.log(`  ℹ️  Filtered out ${unrenderableCount} unrenderable characters`);
		}

		console.log(`✅ Final renderable components: ${renderableComponents.length}`);

		// Shuffle and take count
		const shuffled = renderableComponents.sort(() => Math.random() - 0.5);
		return shuffled.slice(0, count).map((char) => this.createCard(char));
	}

	// Find a valid word that can be made from the given cards
	public findValidWord(cards: Card[]): string[] | null {
		const chars = cards.map((c) => c.character);

		// Try all permutations of different lengths
		for (let len = chars.length; len >= 1; len--) {
			for (let i = 0; i <= chars.length - len; i++) {
				const subset = chars.slice(i, i + len);
				const word = subset.join('');
				if (this.wordIndex[word]) {
					return subset;
				}
			}
		}

		return null;
	}

	// Find a random valid combination from the hand
	public findRandomCombination(hand: Card[]): { indices: number[]; type: 'word' | 'combine' } | null {
		// Try to find a word first
		for (let len = hand.length; len >= 2; len--) {
			const combinations: number[][] = [];
			this.generateCombinations(hand.length, len, combinations);

			for (const indices of combinations) {
				const chars = indices.map((i) => hand[i].character);
				if (this.isValidWord(chars).valid) {
					return { indices, type: 'word' };
				}
			}
		}

		// Try to find a combination
		for (let i = 0; i < hand.length; i++) {
			for (let j = i + 1; j < hand.length; j++) {
				const results = this.canCombine(hand[i].character, hand[j].character);
				if (results.length > 0) {
					return { indices: [i, j], type: 'combine' };
				}
			}
		}

		return null;
	}

	private generateCombinations(
		n: number,
		k: number,
		result: number[][],
		current: number[] = [],
		start: number = 0
	) {
		if (current.length === k) {
			result.push([...current]);
			return;
		}

		for (let i = start; i < n; i++) {
			current.push(i);
			this.generateCombinations(n, k, result, current, i + 1);
			current.pop();
		}
	}

	// Getter methods for game lookup data
	public getComponentCombinations(): ComponentCombinations {
		return this.componentCombinations;
	}

	public getCharacterWords(): CharacterWords {
		return this.characterWords;
	}

	// Generate a hand with guaranteed solutions
	public generateHandWithSolutions(
		handSize: number = 8
	): {
		cards: Card[];
		solutions: Array<{ type: 'word' | 'combine'; steps: string[]; result: string }>;
	} {
		const cards: Card[] = [];
		const solutions: Array<{ type: 'word' | 'combine'; steps: string[]; result: string }> = [];

		// Generate 2-3 solution paths
		const numSolutions = 2 + Math.floor(Math.random() * 2); // 2 or 3 solutions

		for (let i = 0; i < numSolutions; i++) {
			// Randomly decide: word or combination chain
			const isWord = Math.random() < 0.5;

			if (isWord) {
				// Generate a word solution
				const wordSolution = this.generateWordSolution();
				if (wordSolution) {
					solutions.push(wordSolution);
					// Add the characters to the hand
					for (const char of wordSolution.result) {
						cards.push(this.createCard(char));
					}
				}
			} else {
				// Generate a combination chain solution
				const combSolution = this.generateCombinationChainSolution();
				if (combSolution) {
					solutions.push(combSolution);
					// Add the initial components to the hand
					for (const step of combSolution.steps) {
						cards.push(this.createCard(step));
					}
				}
			}
		}

		// Fill remaining slots with random components
		const componentsNeeded = handSize - cards.length;
		if (componentsNeeded > 0) {
			const randomComponents = this.getRandomComponents(componentsNeeded);
			cards.push(...randomComponents);
		}

		// Shuffle the cards so solutions aren't obvious
		for (let i = cards.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[cards[i], cards[j]] = [cards[j], cards[i]];
		}

		return { cards, solutions };
	}

	// Generate a word solution (pick a random word from character_words)
	private generateWordSolution(): {
		type: 'word';
		steps: string[];
		result: string;
	} | null {
		// Get all characters that have words
		const charsWithWords = Object.keys(this.characterWords);
		if (charsWithWords.length === 0) return null;

		// Pick a random character
		const randomChar = charsWithWords[Math.floor(Math.random() * charsWithWords.length)];
		const words = this.characterWords[randomChar];

		if (!words || words.length === 0) return null;

		// Pick a random word (prefer 2-3 character words)
		const shortWords = words.filter((w) => w.length >= 2 && w.length <= 3);
		const wordList = shortWords.length > 0 ? shortWords : words;
		const word = wordList[Math.floor(Math.random() * wordList.length)];

		return {
			type: 'word',
			steps: word.split(''),
			result: word
		};
	}

	// Generate a combination chain solution (component -> component -> character -> word)
	private generateCombinationChainSolution(): {
		type: 'combine';
		steps: string[];
		result: string;
	} | null {
		// Get all components that can combine
		const components = Object.keys(this.componentCombinations);
		if (components.length === 0) return null;

		// Try to build a chain: comp1 + comp2 -> char1, char1 + comp3 -> char2, etc.
		const maxAttempts = 50;
		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			// Start with a random component
			const comp1 = components[Math.floor(Math.random() * components.length)];
			const combinations1 = this.componentCombinations[comp1];

			if (!combinations1 || combinations1.length === 0) continue;

			// Pick a random combination
			const combo1 = combinations1[Math.floor(Math.random() * combinations1.length)];
			const [comp2, result1] = combo1.split(':');

			// Now try to find if result1 can combine with another component
			const combinations2 = this.componentCombinations[result1];
			if (combinations2 && combinations2.length > 0) {
				const combo2 = combinations2[Math.floor(Math.random() * combinations2.length)];
				const [comp3, result2] = combo2.split(':');

				// Check if result2 is in a word
				const words = this.characterWords[result2];
				if (words && words.length > 0) {
					// Success! We have a chain: comp1 + comp2 -> result1, result1 + comp3 -> result2, result2 is in a word
					return {
						type: 'combine',
						steps: [comp1, comp2, comp3],
						result: result2
					};
				}
			}

			// Simpler case: just comp1 + comp2 -> result1, and result1 is in a word
			const words = this.characterWords[result1];
			if (words && words.length > 0) {
				return {
					type: 'combine',
					steps: [comp1, comp2],
					result: result1
				};
			}
		}

		return null;
	}
}

export const dataLoader = DataLoader.getInstance();

