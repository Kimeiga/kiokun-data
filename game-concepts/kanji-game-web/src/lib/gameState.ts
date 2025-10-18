import { GameState, Blind, Joker, Voucher } from './types';
import { CardManager } from './cardManager';
import { ScoringSystem } from './scoring';

export class GameStateManager {
  private cardManager: CardManager;
  private scoringSystem: ScoringSystem;
  
  constructor() {
    this.cardManager = new CardManager();
    this.scoringSystem = new ScoringSystem();
  }
  
  public createNewGame(): GameState {
    const deck = this.cardManager.createStartingDeck();
    const hand = this.cardManager.createHand(8);
    
    // Draw initial hand
    const initialCards = this.cardManager.drawCards(deck, 8);
    initialCards.forEach(card => this.cardManager.addCardToHand(hand, card));
    
    const currentBlind = this.createBlind(1, 'small');
    
    return {
      currency: 4, // Starting currency
      ante: 1,
      blindIndex: 0,
      deck,
      hand,
      jokers: [],
      vouchers: [],
      currentBlind,
      handsRemaining: 4,
      discardsRemaining: 3,
      currentScore: 0,
      gameOver: false,
      won: false,
    };
  }
  
  public createBlind(ante: number, type: 'small' | 'big' | 'boss'): Blind {
    const targetScore = this.scoringSystem.calculateBlindTarget(ante, type);
    
    // Boss blinds can have special effects
    if (type === 'boss') {
      const bossEffects = [
        { type: 'none' as const },
        { type: 'reduce_hands' as const, amount: 1 },
        { type: 'min_word_length' as const, length: 3 },
      ];
      
      const effect = bossEffects[Math.floor(Math.random() * bossEffects.length)];
      
      return {
        type,
        targetScore,
        name: this.getBossName(ante),
        effect,
      };
    }
    
    return {
      type,
      targetScore,
    };
  }
  
  private getBossName(ante: number): string {
    const names = [
      '漢字の王', // Kanji King
      '文字の魔王', // Character Demon Lord
      '筆画の覇者', // Stroke Overlord
      '部首の帝王', // Radical Emperor
      '言葉の支配者', // Word Ruler
    ];
    return names[ante % names.length];
  }
  
  public startNewRound(gameState: GameState): void {
    // Discard current hand
    gameState.hand.cards.forEach(card => {
      gameState.deck.discardPile.push(card);
    });
    gameState.hand.cards = [];
    
    // Draw new hand
    const newCards = this.cardManager.drawCards(gameState.deck, gameState.hand.maxSize);
    newCards.forEach(card => this.cardManager.addCardToHand(gameState.hand, card));
    
    // Reset round state
    gameState.handsRemaining = 4;
    gameState.discardsRemaining = 3;
    gameState.currentScore = 0;
    
    // Apply blind effects
    if (gameState.currentBlind.effect) {
      switch (gameState.currentBlind.effect.type) {
        case 'reduce_hands':
          gameState.handsRemaining -= gameState.currentBlind.effect.amount;
          break;
      }
    }
    
    // Apply voucher effects
    for (const voucher of gameState.vouchers) {
      switch (voucher.effect.type) {
        case 'increase_hands':
          gameState.handsRemaining += voucher.effect.amount;
          break;
        case 'increase_discards':
          gameState.discardsRemaining += voucher.effect.amount;
          break;
      }
    }
  }
  
  public advanceBlind(gameState: GameState): boolean {
    // Award currency
    const reward = this.scoringSystem.calculateReward(gameState.currentBlind.type, gameState.ante);
    gameState.currency += reward;
    
    // Add interest
    const interest = this.scoringSystem.calculateInterest(gameState.currency);
    gameState.currency += interest;
    
    gameState.blindIndex++;
    
    if (gameState.blindIndex > 2) {
      // Move to next ante
      gameState.ante++;
      gameState.blindIndex = 0;
      
      // Check win condition (beat ante 8)
      if (gameState.ante > 8) {
        gameState.gameOver = true;
        gameState.won = true;
        return false;
      }
    }
    
    // Create next blind
    const blindTypes: ('small' | 'big' | 'boss')[] = ['small', 'big', 'boss'];
    gameState.currentBlind = this.createBlind(gameState.ante, blindTypes[gameState.blindIndex]);
    
    return true; // Continue to shop
  }
  
  public checkBlindComplete(gameState: GameState): boolean {
    return gameState.currentScore >= gameState.currentBlind.targetScore;
  }
  
  public checkBlindFailed(gameState: GameState): boolean {
    return gameState.handsRemaining === 0 && gameState.currentScore < gameState.currentBlind.targetScore;
  }
}

