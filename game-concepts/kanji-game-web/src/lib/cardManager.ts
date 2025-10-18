import { Card, Deck, Hand } from './types';
import { DataLoader } from './dataLoader';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export class CardManager {
  private dataLoader: DataLoader;

  constructor() {
    this.dataLoader = DataLoader.getInstance();
  }

  public createCard(character: string): Card {
    const strokes = this.dataLoader.getStrokes(character);
    const isComponent = this.dataLoader.canDissolve(character).length === 0;

    return {
      id: generateId(),
      character,
      strokes,
      isComponent,
    };
  }
  
  public createStartingDeck(): Deck {
    // Starting deck: 20 common kanji components and simple characters
    const startingCharacters = [
      '一', '二', '三', '人', '口', '日', '月', '木', '水', '火',
      '土', '大', '小', '中', '山', '田', '目', '手', '心', '女',
    ];
    
    const cards = startingCharacters.map(char => this.createCard(char));
    
    return {
      cards: this.shuffleDeck(cards),
      discardPile: [],
    };
  }
  
  public shuffleDeck(cards: Card[]): Card[] {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  public drawCards(deck: Deck, count: number): Card[] {
    const drawn: Card[] = [];
    
    for (let i = 0; i < count; i++) {
      if (deck.cards.length === 0) {
        // Reshuffle discard pile into deck
        if (deck.discardPile.length > 0) {
          deck.cards = this.shuffleDeck(deck.discardPile);
          deck.discardPile = [];
        } else {
          // No more cards to draw
          break;
        }
      }
      
      const card = deck.cards.pop();
      if (card) {
        drawn.push(card);
      }
    }
    
    return drawn;
  }
  
  public discardCard(hand: Hand, cardId: string, deck: Deck): boolean {
    const cardIndex = hand.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      return false;
    }
    
    const [card] = hand.cards.splice(cardIndex, 1);
    deck.discardPile.push(card);
    return true;
  }
  
  public combineCards(hand: Hand, cardId1: string, cardId2: string): Card | null {
    const card1 = hand.cards.find(c => c.id === cardId1);
    const card2 = hand.cards.find(c => c.id === cardId2);
    
    if (!card1 || !card2) {
      return null;
    }
    
    const possibleResults = this.dataLoader.canCombine(card1.character, card2.character);
    
    if (possibleResults.length === 0) {
      return null;
    }
    
    // For now, just take the first result
    // In a more advanced version, we could let the player choose
    const resultChar = possibleResults[0];
    const newCard = this.createCard(resultChar);
    
    // Remove the two cards from hand
    hand.cards = hand.cards.filter(c => c.id !== cardId1 && c.id !== cardId2);
    
    // Add the new card
    hand.cards.push(newCard);
    
    return newCard;
  }
  
  public dissolveCard(hand: Hand, cardId: string): Card[] | null {
    const card = hand.cards.find(c => c.id === cardId);
    
    if (!card) {
      return null;
    }
    
    const components = this.dataLoader.canDissolve(card.character);
    
    if (components.length === 0) {
      return null;
    }
    
    // Remove the card from hand
    hand.cards = hand.cards.filter(c => c.id !== cardId);
    
    // Add component cards
    const newCards = components.map(char => this.createCard(char));
    hand.cards.push(...newCards);
    
    return newCards;
  }
  
  public createHand(maxSize: number = 8): Hand {
    return {
      cards: [],
      maxSize,
    };
  }
  
  public addCardToHand(hand: Hand, card: Card): boolean {
    if (hand.cards.length >= hand.maxSize) {
      return false;
    }
    hand.cards.push(card);
    return true;
  }
  
  public removeCardFromHand(hand: Hand, cardId: string): Card | null {
    const index = hand.cards.findIndex(c => c.id === cardId);
    if (index === -1) {
      return null;
    }
    const [card] = hand.cards.splice(index, 1);
    return card;
  }
}

