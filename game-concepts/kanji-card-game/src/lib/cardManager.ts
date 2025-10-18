import type { Card, GameState } from './types';
import { dataLoader } from './dataLoader';

export class CardManager {
	// Create initial deck with guaranteed playable combinations
	public createDeck(size: number = 52): Card[] {
		const deck: Card[] = [];

		// Fill deck with random components
		// We'll ensure the initial hand has solutions, not the whole deck
		const components = dataLoader.getRandomComponents(size);
		deck.push(...components);

		return this.shuffleDeck(deck);
	}



	// Shuffle deck
	private shuffleDeck(deck: Card[]): Card[] {
		const shuffled = [...deck];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		return shuffled;
	}

	// Draw cards from deck
	public drawCards(deck: Card[], count: number): { drawn: Card[]; remaining: Card[] } {
		const drawn = deck.slice(0, count);
		const remaining = deck.slice(count);
		return { drawn, remaining };
	}

	// Deal initial hand with guaranteed playable combination
	public dealInitialHand(deck: Card[], handSize: number = 8): { hand: Card[]; deck: Card[] } {
		// Generate a hand with guaranteed solutions
		const { cards: hand, solutions } = dataLoader.generateHandWithSolutions(handSize);

		console.log(`🌱 Generated initial hand with ${solutions.length} guaranteed solutions`);
		console.log(
			`  - Word solutions: ${solutions.filter((s) => s.type === 'word').length}`
		);
		console.log(
			`  - Combination solutions: ${solutions.filter((s) => s.type === 'combine').length}`
		);

		// Log the solutions for debugging
		solutions.forEach((sol, i) => {
			if (sol.type === 'word') {
				console.log(`  ${i + 1}. Word: ${sol.result} (${sol.steps.join(' + ')})`);
			} else {
				console.log(
					`  ${i + 1}. Combination: ${sol.steps.join(' + ')} → ${sol.result}`
				);
			}
		});

		return { hand, deck };
	}

	// Check if hand has any valid combination
	private hasValidCombination(hand: Card[]): boolean {
		// Check for valid 2-character words (all pairs, not just consecutive)
		for (let i = 0; i < hand.length; i++) {
			for (let j = i + 1; j < hand.length; j++) {
				const chars = [hand[i].character, hand[j].character];
				if (dataLoader.isValidWord(chars).valid) {
					return true;
				}
			}
		}

		// Check for valid 3-character words
		for (let i = 0; i < hand.length; i++) {
			for (let j = i + 1; j < hand.length; j++) {
				for (let k = j + 1; k < hand.length; k++) {
					const chars = [hand[i].character, hand[j].character, hand[k].character];
					if (dataLoader.isValidWord(chars).valid) {
						return true;
					}
				}
			}
		}

		// Also check for valid component combinations (can combine into larger kanji)
		for (let i = 0; i < hand.length; i++) {
			for (let j = i + 1; j < hand.length; j++) {
				const results = dataLoader.canCombine(hand[i].character, hand[j].character);
				if (results.length > 0) {
					return true;
				}
			}
		}

		return false;
	}

	// Combine two cards into one
	public combineCards(card1: Card, card2: Card, chosenChar: string): Card {
		return dataLoader.createCard(chosenChar);
	}

	// Decompose a card into its components
	public decomposeCard(card: Card): Card[] | null {
		const components = dataLoader.canDecompose(card.character);
		if (!components) return null;
		return components.map((char) => dataLoader.createCard(char));
	}

	// Calculate score for a word
	public calculateScore(cards: Card[]): number {
		const totalStrokes = cards.reduce((sum, card) => sum + card.strokeCount, 0);
		const wordLength = cards.length;
		return totalStrokes * wordLength;
	}

	// Find valid combinations that can be made from the hand
	public findValidCombinations(hand: Card[]): { cards: Card[]; word: string; language: 'chinese' | 'japanese' | 'both' }[] {
		const combinations: { cards: Card[]; word: string; language: 'chinese' | 'japanese' | 'both' }[] = [];

		// Try 2-character words
		for (let i = 0; i < hand.length; i++) {
			for (let j = i + 1; j < hand.length; j++) {
				const word = hand[i].character + hand[j].character;
				const validation = dataLoader.isValidWord([hand[i].character, hand[j].character]);
				if (validation.valid && validation.language) {
					combinations.push({
						cards: [hand[i], hand[j]],
						word,
						language: validation.language
					});
				}
			}
		}

		// Try 3-character words
		for (let i = 0; i < hand.length; i++) {
			for (let j = i + 1; j < hand.length; j++) {
				for (let k = j + 1; k < hand.length; k++) {
					const word = hand[i].character + hand[j].character + hand[k].character;
					const validation = dataLoader.isValidWord([hand[i].character, hand[j].character, hand[k].character]);
					if (validation.valid && validation.language) {
						combinations.push({
							cards: [hand[i], hand[j], hand[k]],
							word,
							language: validation.language
						});
					}
				}
			}
		}

		return combinations;
	}

	// Validate if cards form a valid word
	public validateWord(cards: Card[]): { valid: boolean; language?: 'chinese' | 'japanese'; score?: number } {
		const result = dataLoader.isValidWord(cards.map((c) => c.character));
		if (result.valid) {
			return {
				valid: true,
				language: result.language,
				score: this.calculateScore(cards)
			};
		}
		return { valid: false };
	}

	// Get possible combinations from two cards
	public getPossibleCombinations(card1: Card, card2: Card): string[] {
		return dataLoader.canCombine(card1.character, card2.character);
	}

	// Initialize game state
	public initializeGame(): GameState {
		const deck = this.createDeck(52);
		const { hand, deck: remainingDeck } = this.dealInitialHand(deck, 8);

		return {
			deck: remainingDeck,
			hand,
			stagingArea: [],
			score: 0,
			targetScore: 300,
			currency: 4,
			handsRemaining: 4,
			discardsRemaining: 3,
			ante: 1
		};
	}

	// Play cards from staging area
	public playCards(gameState: GameState, cards: Card[]): GameState {
		const validation = this.validateWord(cards);
		if (!validation.valid || !validation.score) {
			return gameState;
		}

		// Remove cards from staging area
		const newStagingArea = gameState.stagingArea.filter(
			(card) => !cards.some((c) => c.id === card.id)
		);

		// Draw new cards
		const { drawn, remaining } = this.drawCards(gameState.deck, cards.length);

		return {
			...gameState,
			stagingArea: newStagingArea,
			hand: [...gameState.hand, ...drawn],
			deck: remaining,
			score: gameState.score + validation.score,
			handsRemaining: gameState.handsRemaining - 1
		};
	}

	// Discard cards from staging area
	public discardCards(gameState: GameState, cards: Card[]): GameState {
		if (gameState.discardsRemaining <= 0) {
			return gameState;
		}

		// Remove cards from staging area
		const newStagingArea = gameState.stagingArea.filter(
			(card) => !cards.some((c) => c.id === card.id)
		);

		// Draw new cards
		const { drawn, remaining } = this.drawCards(gameState.deck, cards.length);

		return {
			...gameState,
			stagingArea: newStagingArea,
			hand: [...gameState.hand, ...drawn],
			deck: remaining,
			discardsRemaining: gameState.discardsRemaining - 1
		};
	}

	// Move cards to staging area
	public moveToStaging(gameState: GameState, cards: Card[]): GameState {
		// Remove from hand
		const newHand = gameState.hand.filter((card) => !cards.some((c) => c.id === card.id));

		return {
			...gameState,
			hand: newHand,
			stagingArea: [...gameState.stagingArea, ...cards]
		};
	}

	// Move cards back to hand
	public moveToHand(gameState: GameState, cards: Card[]): GameState {
		// Remove from staging area
		const newStagingArea = gameState.stagingArea.filter(
			(card) => !cards.some((c) => c.id === card.id)
		);

		return {
			...gameState,
			stagingArea: newStagingArea,
			hand: [...gameState.hand, ...cards]
		};
	}

	// Get hint (random valid combination)
	public getHint(hand: Card[]): { indices: number[]; type: 'word' | 'combine' } | null {
		return dataLoader.findRandomCombination(hand);
	}
}

export const cardManager = new CardManager();

