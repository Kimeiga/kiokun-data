import * as fs from 'fs';
import chalk from 'chalk';
import { GameState } from './types';
import { DataLoader } from './dataLoader';
import { CardManager } from './cardManager';
import { ScoringSystem } from './scoring';
import { GameStateManager } from './gameState';
import { Shop } from './shop';

export class ScriptedGame {
  private dataLoader: DataLoader;
  private cardManager: CardManager;
  private scoringSystem: ScoringSystem;
  private gameStateManager: GameStateManager;
  private shop: Shop;
  private gameState!: GameState;
  private verbose: boolean;
  
  constructor(verbose: boolean = true) {
    this.dataLoader = DataLoader.getInstance();
    this.cardManager = new CardManager();
    this.scoringSystem = new ScoringSystem();
    this.gameStateManager = new GameStateManager();
    this.shop = new Shop();
    this.verbose = verbose;
  }
  
  public async initialize(): Promise<void> {
    await this.dataLoader.load();
  }
  
  public async runScript(scriptPath: string): Promise<void> {
    const script = fs.readFileSync(scriptPath, 'utf-8');
    const lines = script.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    
    this.log(chalk.bold.cyan('\n╔═══════════════════════════════════════╗'));
    this.log(chalk.bold.cyan('║   Scripted Game Playthrough           ║'));
    this.log(chalk.bold.cyan('╚═══════════════════════════════════════╝\n'));
    
    this.gameState = this.gameStateManager.createNewGame();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      this.log(chalk.gray(`\n[Command ${i + 1}/${lines.length}] ${line}`));
      
      await this.executeCommand(line);
      
      // Check game over
      if (this.gameState.gameOver) {
        this.log(chalk.yellow('\nGame ended.'));
        break;
      }
      
      // Check if blind complete
      if (this.gameStateManager.checkBlindComplete(this.gameState)) {
        this.log(chalk.green('\n✅ Blind Complete!'));
        const reward = this.scoringSystem.calculateReward(this.gameState.currentBlind.type, this.gameState.ante);
        const interest = this.scoringSystem.calculateInterest(this.gameState.currency);
        this.log(chalk.yellow(`💰 Reward: ¥${reward}, Interest: ¥${interest}`));
        
        const canContinue = this.gameStateManager.advanceBlind(this.gameState);
        if (!canContinue) {
          this.log(chalk.green('\n🎊 VICTORY! You beat all 8 antes!'));
          break;
        }
        
        // Auto-skip shop for now
        this.shop.skipShop(this.gameState);
        this.gameStateManager.startNewRound(this.gameState);
        this.log(chalk.cyan(`\n→ Advanced to Ante ${this.gameState.ante}, ${this.getBlindName()}`));
      }
      
      // Check if blind failed
      if (this.gameStateManager.checkBlindFailed(this.gameState)) {
        this.log(chalk.red('\n💀 Blind Failed! Game Over.'));
        this.gameState.gameOver = true;
        break;
      }
    }
    
    this.displayFinalStats();
  }
  
  private async executeCommand(command: string): Promise<void> {
    const parts = command.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    switch (cmd) {
      case 'status':
      case 's':
        this.displayStatus();
        break;
      case 'play':
      case 'p':
        this.handlePlay(args);
        break;
      case 'combine':
      case 'c':
        this.handleCombine(args);
        break;
      case 'dissolve':
      case 'd':
        this.handleDissolve(args);
        break;
      case 'discard':
      case 'x':
        this.handleDiscard(args);
        break;
      case 'suggest':
        this.handleSuggest();
        break;
      case 'auto':
      case 'a':
        this.handleAutoPlay();
        break;
      case 'shop':
        await this.handleShop(args);
        break;
      default:
        this.log(chalk.red(`Unknown command: ${cmd}`));
    }
  }
  
  private displayStatus(): void {
    this.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    this.log(chalk.bold.yellow(`💴 Currency: ¥${this.gameState.currency}  `) +
              chalk.bold.cyan(`🎯 Ante ${this.gameState.ante} - ${this.getBlindName()}`));
    this.log(chalk.bold.green(`📊 Score: ${this.gameState.currentScore} / ${this.gameState.currentBlind.targetScore}  `) +
              chalk.bold.magenta(`🎴 Hands: ${this.gameState.handsRemaining}  `) +
              chalk.bold.blue(`🗑️  Discards: ${this.gameState.discardsRemaining}`));
    
    if (this.gameState.jokers.length > 0) {
      this.log(chalk.yellow('\n🃏 Jokers: ') + this.gameState.jokers.map(j => j.name).join(', '));
    }
    
    this.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    this.log(chalk.cyan('\n🎴 Hand:'));
    this.gameState.hand.cards.forEach((card, i) => {
      this.log(`  [${i + 1}] ${card.character} (${card.strokes} strokes${card.isComponent ? ', component' : ''})`);
    });
  }
  
  private handlePlay(args: string[]): void {
    if (this.gameState.handsRemaining === 0) {
      this.log(chalk.red('  ❌ No hands remaining!'));
      return;
    }
    
    const indices = args.map(n => parseInt(n) - 1).filter(n => !isNaN(n) && n >= 0 && n < this.gameState.hand.cards.length);
    
    if (indices.length === 0) {
      this.log(chalk.red('  ❌ Invalid card numbers'));
      return;
    }
    
    const selectedCards = indices.map(i => this.gameState.hand.cards[i]);
    const word = selectedCards.map(c => c.character).join('');
    const result = this.scoringSystem.validateAndScoreWord(selectedCards, this.gameState);
    
    if (result.isValid) {
      this.log(chalk.green(`  ✅ Valid word: ${word} (${result.language})`));
      this.log(chalk.yellow(`     Score: ${result.finalScore} points`));
      this.log(chalk.gray(`     Calculation: ${selectedCards.map(c => c.strokes).join('+')} strokes × ${selectedCards.length} chars = ${result.baseScore} × ${result.multipliers} = ${result.finalScore}`));
      
      this.gameState.currentScore += result.finalScore;
      this.gameState.handsRemaining--;
      
      // Remove played cards
      indices.sort((a, b) => b - a);
      for (const index of indices) {
        const card = this.gameState.hand.cards[index];
        this.gameState.deck.discardPile.push(card);
      }
      this.gameState.hand.cards = this.gameState.hand.cards.filter((_, i) => !indices.includes(i));
      
      // Draw new cards
      const newCards = this.cardManager.drawCards(this.gameState.deck, indices.length);
      newCards.forEach(card => this.cardManager.addCardToHand(this.gameState.hand, card));
      
      this.log(chalk.gray(`     Drew: ${newCards.map(c => c.character).join(', ')}`));
      this.log(chalk.cyan(`     New score: ${this.gameState.currentScore}/${this.gameState.currentBlind.targetScore}, Hands left: ${this.gameState.handsRemaining}`));
    } else {
      this.log(chalk.red(`  ❌ Invalid word: ${word} (not in dictionary)`));
    }
  }
  
  private handleCombine(args: string[]): void {
    if (args.length < 2) {
      this.log(chalk.red('  ❌ Need two card numbers'));
      return;
    }
    
    const index1 = parseInt(args[0]) - 1;
    const index2 = parseInt(args[1]) - 1;
    
    if (isNaN(index1) || isNaN(index2) || index1 < 0 || index2 < 0 || 
        index1 >= this.gameState.hand.cards.length || index2 >= this.gameState.hand.cards.length || index1 === index2) {
      this.log(chalk.red('  ❌ Invalid card numbers'));
      return;
    }
    
    const card1 = this.gameState.hand.cards[index1];
    const card2 = this.gameState.hand.cards[index2];
    
    const result = this.cardManager.combineCards(this.gameState.hand, card1.id, card2.id);
    
    if (result) {
      this.log(chalk.green(`  ✅ Combined ${card1.character} + ${card2.character} = ${result.character} (${result.strokes} strokes)`));
    } else {
      this.log(chalk.red(`  ❌ Cannot combine ${card1.character} and ${card2.character}`));
    }
  }
  
  private handleDissolve(args: string[]): void {
    if (args.length === 0) {
      this.log(chalk.red('  ❌ Need a card number'));
      return;
    }
    
    const index = parseInt(args[0]) - 1;
    
    if (isNaN(index) || index < 0 || index >= this.gameState.hand.cards.length) {
      this.log(chalk.red('  ❌ Invalid card number'));
      return;
    }
    
    const card = this.gameState.hand.cards[index];
    const result = this.cardManager.dissolveCard(this.gameState.hand, card.id);
    
    if (result && result.length > 0) {
      this.log(chalk.green(`  ✅ Dissolved ${card.character} into: ${result.map(c => c.character).join(', ')}`));
    } else {
      this.log(chalk.red(`  ❌ Cannot dissolve ${card.character} (basic component)`));
    }
  }
  
  private handleDiscard(args: string[]): void {
    if (this.gameState.discardsRemaining === 0) {
      this.log(chalk.red('  ❌ No discards remaining!'));
      return;
    }
    
    const indices = args.map(n => parseInt(n) - 1).filter(n => !isNaN(n) && n >= 0 && n < this.gameState.hand.cards.length);
    
    if (indices.length === 0) {
      this.log(chalk.red('  ❌ Invalid card numbers'));
      return;
    }
    
    const discarded = indices.map(i => this.gameState.hand.cards[i].character);
    
    // Remove cards
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
    
    this.log(chalk.green(`  ✅ Discarded: ${discarded.join(', ')}`));
    this.log(chalk.gray(`     Drew: ${newCards.map(c => c.character).join(', ')}`));
    this.log(chalk.cyan(`     Discards left: ${this.gameState.discardsRemaining}`));
  }
  
  private handleSuggest(): void {
    this.log(chalk.cyan('  💡 Suggestions:'));

    // Find valid 2-character words
    const hand = this.gameState.hand.cards;
    let foundWords = 0;

    for (let i = 0; i < hand.length && foundWords < 5; i++) {
      for (let j = i + 1; j < hand.length && foundWords < 5; j++) {
        const word = hand[i].character + hand[j].character;
        const validation = this.dataLoader.isValidWord(word);
        if (validation.valid) {
          this.log(chalk.green(`     ${word} (cards ${i + 1} ${j + 1}) - ${validation.language}`));
          foundWords++;
        }
      }
    }

    if (foundWords === 0) {
      this.log(chalk.gray('     No 2-character words found. Try combining cards first!'));
    }
  }

  private handleAutoPlay(): void {
    this.log(chalk.cyan('  🤖 Auto-play:'));

    // Strategy 1: Try to find and play a valid word
    const hand = this.gameState.hand.cards;

    // Try 2-character words first
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        const word = hand[i].character + hand[j].character;
        const validation = this.dataLoader.isValidWord(word);
        if (validation.valid) {
          this.log(chalk.green(`     Found valid word: ${word}`));
          this.handlePlay([(i + 1).toString(), (j + 1).toString()]);
          return;
        }
      }
    }

    // Try 3-character words
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        for (let k = j + 1; k < hand.length; k++) {
          const word = hand[i].character + hand[j].character + hand[k].character;
          const validation = this.dataLoader.isValidWord(word);
          if (validation.valid) {
            this.log(chalk.green(`     Found valid word: ${word}`));
            this.handlePlay([(i + 1).toString(), (j + 1).toString(), (k + 1).toString()]);
            return;
          }
        }
      }
    }

    // Strategy 2: Try to combine cards
    this.log(chalk.yellow('     No valid words found, trying to combine...'));
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        const card1 = hand[i];
        const card2 = hand[j];

        // Check if these can combine
        const canCombine = this.dataLoader.canCombine(card1.character, card2.character);
        if (canCombine) {
          this.log(chalk.green(`     Combining ${card1.character} + ${card2.character}`));
          this.handleCombine([(i + 1).toString(), (j + 1).toString()]);
          return;
        }
      }
    }

    // Strategy 3: Discard low-value cards
    if (this.gameState.discardsRemaining > 0) {
      this.log(chalk.yellow('     No combinations found, discarding low-value cards...'));
      // Find cards with fewest strokes
      const sortedIndices = hand
        .map((card, index) => ({ card, index }))
        .sort((a, b) => a.card.strokes - b.card.strokes)
        .slice(0, 2)
        .map(item => (item.index + 1).toString());

      this.handleDiscard(sortedIndices);
      return;
    }

    // Strategy 4: We're stuck
    this.log(chalk.red('     ❌ No valid moves available! Stuck.'));
  }
  
  private async handleShop(args: string[]): Promise<void> {
    if (args.length === 0 || args[0] === 'skip') {
      this.shop.skipShop(this.gameState);
      this.log(chalk.green('  ✅ Skipped shop (+¥1)'));
    }
  }
  
  private getBlindName(): string {
    const names = {
      small: 'Small Blind',
      big: 'Big Blind',
      boss: 'Boss Blind',
    };
    return names[this.gameState.currentBlind.type];
  }
  
  private displayFinalStats(): void {
    this.log(chalk.bold.cyan('\n╔═══════════════════════════════════════╗'));
    this.log(chalk.bold.cyan('║           Final Statistics            ║'));
    this.log(chalk.bold.cyan('╚═══════════════════════════════════════╝\n'));
    
    if (this.gameState.won) {
      this.log(chalk.bold.green('🎊 VICTORY! 🎊'));
    } else {
      this.log(chalk.bold.red('💀 GAME OVER 💀'));
    }
    
    this.log(chalk.yellow(`\nReached: Ante ${this.gameState.ante}, ${this.getBlindName()}`));
    this.log(chalk.cyan(`Final Score: ${this.gameState.currentScore}/${this.gameState.currentBlind.targetScore}`));
    this.log(chalk.yellow(`Currency: ¥${this.gameState.currency}`));
    this.log(chalk.magenta(`Jokers: ${this.gameState.jokers.length}`));
    
    if (this.gameState.jokers.length > 0) {
      this.log(chalk.gray('\nJokers collected:'));
      this.gameState.jokers.forEach(j => {
        this.log(chalk.gray(`  - ${j.name}: ${j.description}`));
      });
    }
  }
  
  private log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }
}

