// Core game types

export interface Card {
  id: string;
  character: string;
  strokes: number;
  isComponent: boolean; // True if it's a basic component, false if it's a compound character
}

export interface Hand {
  cards: Card[];
  maxSize: number;
}

export interface Deck {
  cards: Card[];
  discardPile: Card[];
}

export interface Joker {
  id: string;
  name: string;
  description: string;
  effect: JokerEffect;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  cost: number;
}

export type JokerEffect = 
  | { type: 'stroke_multiplier'; value: number }
  | { type: 'word_length_bonus'; value: number }
  | { type: 'component_bonus'; value: number }
  | { type: 'rhyme_swap'; language: 'chinese' | 'japanese' }
  | { type: 'extra_hand' }
  | { type: 'extra_discard' };

export interface ShopItem {
  type: 'joker' | 'tarot' | 'voucher';
  item: Joker | TarotCard | Voucher;
  cost: number;
}

export interface TarotCard {
  id: string;
  name: string;
  description: string;
  effect: TarotEffect;
}

export type TarotEffect =
  | { type: 'add_strokes'; target: 'hand' | 'selected'; amount: number }
  | { type: 'duplicate_card' }
  | { type: 'transform_random' }
  | { type: 'enhance_card'; enhancement: 'gold' | 'steel' | 'glass' };

export interface Voucher {
  id: string;
  name: string;
  description: string;
  effect: VoucherEffect;
  permanent: boolean;
}

export type VoucherEffect =
  | { type: 'increase_hand_size'; amount: number }
  | { type: 'increase_hands'; amount: number }
  | { type: 'increase_discards'; amount: number }
  | { type: 'shop_discount'; percent: number };

export interface Blind {
  type: 'small' | 'big' | 'boss';
  targetScore: number;
  name?: string;
  effect?: BlindEffect;
}

export type BlindEffect =
  | { type: 'none' }
  | { type: 'reduce_hands'; amount: number }
  | { type: 'min_word_length'; length: number }
  | { type: 'only_language'; language: 'chinese' | 'japanese' };

export interface GameState {
  // Player resources
  currency: number;
  
  // Current run state
  ante: number;
  blindIndex: number; // 0 = small, 1 = big, 2 = boss
  
  // Deck and hand
  deck: Deck;
  hand: Hand;
  
  // Active items
  jokers: Joker[];
  vouchers: Voucher[];
  
  // Current round state
  currentBlind: Blind;
  handsRemaining: number;
  discardsRemaining: number;
  currentScore: number;
  
  // Game over
  gameOver: boolean;
  won: boolean;
}

export interface IdsForwardLookup {
  [character: string]: {
    character: string;
    components: string[];
    ids_operator: string | null;
  };
}

export interface IdsReverseLookup {
  [key: string]: string[]; // key is "component1+component2", value is array of resulting characters
}

export interface WordIndex {
  chinese_words: string[];
  japanese_words: string[];
  all_words: string[];
}

// Stroke count data (we'll need to load this or calculate it)
export interface StrokeData {
  [character: string]: number;
}

export interface PlayedWord {
  characters: string[];
  word: string;
  isValid: boolean;
  language?: 'chinese' | 'japanese';
  baseScore: number;
  multipliers: number;
  finalScore: number;
}

