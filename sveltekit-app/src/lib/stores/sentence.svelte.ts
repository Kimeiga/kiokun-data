/**
 * Sentence context store using Svelte 5 runes
 * 
 * Persists the current sentence being analyzed across navigation,
 * so users can click on individual words while keeping the sentence bar visible.
 */
import { browser } from '$app/environment';
import { tokenizeSentence, type TokenizedSentence, type SupportedLanguage } from '$lib/utils/sentence-tokenizer';

export interface SentenceState {
	/** The tokenized sentence data */
	tokenized: TokenizedSentence | null;
	/** The index of the currently selected word (0-based, only counting word-like tokens) */
	currentWordIndex: number | null;
}

// Session storage key for persistence across page navigations
const STORAGE_KEY = 'kiokun_sentence_context';

// Get initial state from session storage
function getInitialState(): SentenceState {
	if (!browser) {
		return { tokenized: null, currentWordIndex: null };
	}
	
	try {
		const stored = sessionStorage.getItem(STORAGE_KEY);
		if (stored) {
			return JSON.parse(stored);
		}
	} catch {
		// Invalid JSON or storage error, use defaults
	}
	
	return { tokenized: null, currentWordIndex: null };
}

class SentenceStore {
	state = $state<SentenceState>(getInitialState());

	constructor() {
		if (browser) {
			// Re-check on mount in case SSR had wrong value
			const initial = getInitialState();
			this.state = initial;
		}
	}

	/**
	 * Set a new sentence to analyze
	 */
	setSentence(sentence: string, language?: SupportedLanguage) {
		if (!sentence.trim()) {
			this.clear();
			return;
		}

		const tokenized = tokenizeSentence(sentence.trim(), language);
		this.state = {
			tokenized,
			currentWordIndex: null
		};
		this.save();
	}

	/**
	 * Set a sentence with custom tokens (for character-by-character mode)
	 * Used when Intl.Segmenter treats a phrase as a single word but we want individual characters
	 */
	setSentenceWithTokens(sentence: string, tokens: Array<{ segment: string; index: number; isWordLike: boolean }>, language?: SupportedLanguage) {
		if (!sentence.trim()) {
			this.clear();
			return;
		}

		this.state = {
			tokenized: {
				original: sentence.trim(),
				language: language ?? 'zh',
				tokens
			},
			currentWordIndex: null
		};
		this.save();
	}

	/**
	 * Set the currently selected word by its index among word-like tokens
	 */
	setCurrentWordIndex(index: number | null) {
		this.state.currentWordIndex = index;
		this.save();
	}

	/**
	 * Set the current word by finding it in the tokens
	 */
	setCurrentWord(word: string) {
		if (!this.state.tokenized) return;
		
		const words = this.state.tokenized.tokens.filter(t => t.isWordLike);
		const index = words.findIndex(t => t.segment === word);
		this.state.currentWordIndex = index >= 0 ? index : null;
		this.save();
	}

	/**
	 * Clear the sentence context
	 */
	clear() {
		this.state = { tokenized: null, currentWordIndex: null };
		this.save();
	}

	/**
	 * Check if there's an active sentence
	 */
	get hasSentence(): boolean {
		return this.state.tokenized !== null;
	}

	/**
	 * Get the current sentence text
	 */
	get sentence(): string | null {
		return this.state.tokenized?.original ?? null;
	}

	/**
	 * Get the detected/specified language
	 */
	get language(): SupportedLanguage | null {
		return this.state.tokenized?.language ?? null;
	}

	/**
	 * Get all tokens
	 */
	get tokens() {
		return this.state.tokenized?.tokens ?? [];
	}

	/**
	 * Get only word-like tokens
	 */
	get words() {
		return this.tokens.filter(t => t.isWordLike);
	}

	/**
	 * Get the currently selected word token
	 */
	get currentWord() {
		if (this.state.currentWordIndex === null) return null;
		return this.words[this.state.currentWordIndex] ?? null;
	}

	private save() {
		if (!browser) return;
		try {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
		} catch {
			// Storage full or not available
		}
	}
}

export const sentenceStore = new SentenceStore();

