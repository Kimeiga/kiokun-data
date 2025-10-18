import { GameState } from './types';
import { DataLoader } from './dataLoader';
import { CardManager } from './cardManager';
import { ScoringSystem } from './scoring';
import { GameStateManager } from './gameState';
import { Shop } from './shop';
import { TerminalUI } from './ui';

export class Game {
  private dataLoader: DataLoader;
  private cardManager: CardManager;
  private scoringSystem: ScoringSystem;
  private gameStateManager: GameStateManager;
  private shop: Shop;
  private ui: TerminalUI;
  private gameState!: GameState;
  
  constructor() {
    this.dataLoader = DataLoader.getInstance();
    this.cardManager = new CardManager();
    this.scoringSystem = new ScoringSystem();
    this.gameStateManager = new GameStateManager();
    this.shop = new Shop();
    this.ui = new TerminalUI();
  }
  
  public async initialize(): Promise<void> {
    await this.dataLoader.load();
  }
  
  public async start(): Promise<void> {
    this.ui.displayWelcome();
    await this.ui.promptContinue('Press Enter to start...');
    
    this.gameState = this.gameStateManager.createNewGame();
    
    while (!this.gameState.gameOver) {
      await this.playBlind();
      
      if (this.gameState.gameOver) {
        break;
      }
      
      // Shop phase
      await this.shopPhase();
      
      // Start next blind
      this.gameStateManager.startNewRound(this.gameState);
    }
    
    this.ui.displayGameOver(this.gameState.won, this.gameState.ante, this.gameState.currentScore);
  }
  
  private async playBlind(): Promise<void> {
    while (true) {
      console.clear();
      this.ui.displayGameState(this.gameState);
      this.ui.displayHand(this.gameState.hand.cards);
      
      // Check if blind is complete
      if (this.gameStateManager.checkBlindComplete(this.gameState)) {
        const reward = this.scoringSystem.calculateReward(this.gameState.currentBlind.type, this.gameState.ante);
        const interest = this.scoringSystem.calculateInterest(this.gameState.currency);
        
        this.ui.displayBlindComplete(reward, interest);
        await this.ui.promptContinue();
        
        const canContinue = this.gameStateManager.advanceBlind(this.gameState);
        if (!canContinue) {
          return; // Game won
        }
        return; // Go to shop
      }
      
      // Check if blind failed
      if (this.gameStateManager.checkBlindFailed(this.gameState)) {
        this.ui.displayBlindFailed();
        await this.ui.promptContinue();
        this.gameState.gameOver = true;
        this.gameState.won = false;
        return;
      }
      
      const action = await this.ui.promptAction();
      
      switch (action) {
        case 'play':
          await this.handlePlayWord();
          break;
        case 'combine':
          await this.handleCombine();
          break;
        case 'dissolve':
          await this.handleDissolve();
          break;
        case 'discard':
          await this.handleDiscard();
          break;
        case 'quit':
          this.gameState.gameOver = true;
          this.gameState.won = false;
          return;
      }
    }
  }
  
  private async handlePlayWord(): Promise<void> {
    if (this.gameState.handsRemaining === 0) {
      console.log('No hands remaining!');
      await this.ui.promptContinue();
      return;
    }
    
    const indices = await this.ui.promptCardSelection(
      this.gameState.hand.cards,
      'Select cards to play as a word (use space to select, enter to confirm):',
      true
    );
    
    if (indices.length === 0) {
      return;
    }
    
    const selectedCards = indices.map(i => this.gameState.hand.cards[i]);
    const result = this.scoringSystem.validateAndScoreWord(selectedCards, this.gameState);
    
    this.ui.displayWordResult(result.word, result.finalScore, result.isValid, result.language);
    
    if (result.isValid) {
      this.gameState.currentScore += result.finalScore;
      this.gameState.handsRemaining--;
      
      // Remove played cards and put them in discard
      indices.sort((a, b) => b - a); // Sort descending to remove from end first
      for (const index of indices) {
        const card = this.gameState.hand.cards[index];
        this.gameState.deck.discardPile.push(card);
      }
      this.gameState.hand.cards = this.gameState.hand.cards.filter((_, i) => !indices.includes(i));
      
      // Draw new cards
      const newCards = this.cardManager.drawCards(this.gameState.deck, indices.length);
      newCards.forEach(card => this.cardManager.addCardToHand(this.gameState.hand, card));
    }
    
    await this.ui.promptContinue();
  }
  
  private async handleCombine(): Promise<void> {
    if (this.gameState.hand.cards.length < 2) {
      console.log('Need at least 2 cards to combine!');
      await this.ui.promptContinue();
      return;
    }
    
    const [index1] = await this.ui.promptCardSelection(
      this.gameState.hand.cards,
      'Select first card to combine:',
      false
    );
    
    const [index2] = await this.ui.promptCardSelection(
      this.gameState.hand.cards.filter((_, i) => i !== index1),
      'Select second card to combine:',
      false
    );
    
    const actualIndex2 = index2 >= index1 ? index2 + 1 : index2;
    
    const card1 = this.gameState.hand.cards[index1];
    const card2 = this.gameState.hand.cards[actualIndex2];
    
    const result = this.cardManager.combineCards(
      this.gameState.hand,
      card1.id,
      card2.id
    );
    
    this.ui.displayCombineResult(card1.character, card2.character, result?.character || null);
    await this.ui.promptContinue();
  }
  
  private async handleDissolve(): Promise<void> {
    const [index] = await this.ui.promptCardSelection(
      this.gameState.hand.cards,
      'Select card to dissolve:',
      false
    );
    
    const card = this.gameState.hand.cards[index];
    const result = this.cardManager.dissolveCard(this.gameState.hand, card.id);
    
    this.ui.displayDissolveResult(
      card.character,
      result ? result.map(c => c.character) : null
    );
    await this.ui.promptContinue();
  }
  
  private async handleDiscard(): Promise<void> {
    if (this.gameState.discardsRemaining === 0) {
      console.log('No discards remaining!');
      await this.ui.promptContinue();
      return;
    }
    
    const indices = await this.ui.promptCardSelection(
      this.gameState.hand.cards,
      'Select cards to discard:',
      true
    );
    
    if (indices.length === 0) {
      return;
    }
    
    // Remove cards and put in discard pile
    indices.sort((a, b) => b - a);
    for (const index of indices) {
      const card = this.gameState.hand.cards[index];
      this.gameState.deck.discardPile.push(card);
    }
    this.gameState.hand.cards = this.gameState.hand.cards.filter((_, i) => !indices.includes(i));
    
    // Draw new cards
    const newCards = this.cardManager.drawCards(this.gameState.deck, indices.length);
    newCards.forEach(card => this.cardManager.addCardToHand(this.gameState.hand, card));
    
    this.gameState.discardsRemaining--;
    
    console.log(`Discarded ${indices.length} cards and drew ${newCards.length} new cards.`);
    await this.ui.promptContinue();
  }
  
  private async shopPhase(): Promise<void> {
    const items = this.shop.generateShopItems(this.gameState.ante);
    
    while (true) {
      console.clear();
      this.ui.displayShop(items, this.gameState.currency);
      
      const action = await this.ui.promptShopAction(items.length);
      
      if (action === 'skip') {
        this.shop.skipShop(this.gameState);
        break;
      }
      
      if (action.startsWith('buy_')) {
        const index = parseInt(action.split('_')[1]);
        const item = items[index];
        
        if (this.shop.buyItem(this.gameState, item)) {
          console.log('Purchase successful!');
          items.splice(index, 1); // Remove bought item
        } else {
          console.log('Cannot afford this item or no room for more jokers!');
        }
        
        await this.ui.promptContinue();
      }
    }
  }
}

