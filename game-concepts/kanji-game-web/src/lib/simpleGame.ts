import * as readline from 'readline';
import chalk from 'chalk';
import { GameState } from './types';
import { DataLoader } from './dataLoader';
import { CardManager } from './cardManager';
import { ScoringSystem } from './scoring';
import { GameStateManager } from './gameState';
import { Shop } from './shop';

export class SimpleGame {
  private dataLoader: DataLoader;
  private cardManager: CardManager;
  private scoringSystem: ScoringSystem;
  private gameStateManager: GameStateManager;
  private shop: Shop;
  private gameState!: GameState;
  private rl: readline.Interface;
  
  constructor() {
    this.dataLoader = DataLoader.getInstance();
    this.cardManager = new CardManager();
    this.scoringSystem = new ScoringSystem();
    this.gameStateManager = new GameStateManager();
    this.shop = new Shop();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  
  public async initialize(): Promise<void> {
    await this.dataLoader.load();
  }
  
  public async start(): Promise<void> {
    this.displayWelcome();
    await this.prompt('Press Enter to start...');
    
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
    
    this.displayGameOver();
    this.rl.close();
  }
  
  private displayWelcome(): void {
    console.clear();
    console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║   漢字ポーカー - Kanji Component Poker   ║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════╝\n'));
    console.log(chalk.gray('Simple Text Interface - Easy for AI testing\n'));
  }
  
  private displayGameState(): void {
    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.yellow(`💴 Currency: ¥${this.gameState.currency}  `) +
                chalk.bold.cyan(`🎯 Ante ${this.gameState.ante} - ${this.getBlindName()}`));
    console.log(chalk.bold.green(`📊 Score: ${this.gameState.currentScore} / ${this.gameState.currentBlind.targetScore}  `) +
                chalk.bold.magenta(`🎴 Hands: ${this.gameState.handsRemaining}  `) +
                chalk.bold.blue(`🗑️  Discards: ${this.gameState.discardsRemaining}`));
    
    if (this.gameState.currentBlind.name) {
      console.log(chalk.bold.red(`👹 Boss: ${this.gameState.currentBlind.name}`));
    }
    
    if (this.gameState.jokers.length > 0) {
      console.log(chalk.bold.yellow('\n🃏 Active Jokers:'));
      this.gameState.jokers.forEach((joker, i) => {
        console.log(chalk.yellow(`  ${i + 1}. ${joker.name} - ${joker.description}`));
      });
    }
    
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }
  
  private displayHand(): void {
    console.log(chalk.bold.cyan('🎴 Your Hand:\n'));
    
    this.gameState.hand.cards.forEach((card, index) => {
      const cardDisplay = chalk.bold.white(`[${index + 1}]`) + ' ' +
                         chalk.bold.green(card.character) + ' ' +
                         chalk.gray(`(${card.strokes} strokes${card.isComponent ? ', component' : ''})`);
      console.log(cardDisplay);
    });
    
    console.log('');
  }
  
  private displayCommands(): void {
    console.log(chalk.cyan('Commands:'));
    console.log('  ' + chalk.white('play <numbers>') + ' or ' + chalk.white('p <numbers>') + ' - Play cards as word (e.g., "play 1 3 5" or "p 1 3 5")');
    console.log('  ' + chalk.white('combine <n1> <n2>') + ' or ' + chalk.white('c <n1> <n2>') + ' - Combine two cards (e.g., "combine 2 4" or "c 2 4")');
    console.log('  ' + chalk.white('dissolve <n>') + ' or ' + chalk.white('d <n>') + ' - Dissolve a card (e.g., "dissolve 3" or "d 3")');
    console.log('  ' + chalk.white('discard <numbers>') + ' or ' + chalk.white('x <numbers>') + ' - Discard cards (e.g., "discard 1 2" or "x 1 2")');
    console.log('  ' + chalk.white('help') + ' or ' + chalk.white('h') + ' - Show this help');
    console.log('  ' + chalk.white('quit') + ' or ' + chalk.white('q') + ' - Quit game\n');
  }
  
  private getBlindName(): string {
    const names = {
      small: 'Small Blind',
      big: 'Big Blind',
      boss: 'Boss Blind',
    };
    return names[this.gameState.currentBlind.type];
  }
  
  private async playBlind(): Promise<void> {
    while (true) {
      console.clear();
      this.displayGameState();
      this.displayHand();
      
      // Check if blind is complete
      if (this.gameStateManager.checkBlindComplete(this.gameState)) {
        const reward = this.scoringSystem.calculateReward(this.gameState.currentBlind.type, this.gameState.ante);
        const interest = this.scoringSystem.calculateInterest(this.gameState.currency);
        
        console.log(chalk.bold.green('\n🎉 Blind Complete!\n'));
        console.log(chalk.yellow(`💰 Reward: ¥${reward}`));
        console.log(chalk.yellow(`💵 Interest: ¥${interest}\n`));
        
        await this.prompt('Press Enter to continue...');
        
        const canContinue = this.gameStateManager.advanceBlind(this.gameState);
        if (!canContinue) {
          return; // Game won
        }
        return; // Go to shop
      }
      
      // Check if blind failed
      if (this.gameStateManager.checkBlindFailed(this.gameState)) {
        console.log(chalk.bold.red('\n💀 Blind Failed!\n'));
        console.log(chalk.gray('You ran out of hands before reaching the target score.\n'));
        await this.prompt('Press Enter to continue...');
        this.gameState.gameOver = true;
        this.gameState.won = false;
        return;
      }
      
      this.displayCommands();
      const command = await this.prompt('Enter command: ');
      
      await this.handleCommand(command.trim());
    }
  }
  
  private async handleCommand(command: string): Promise<void> {
    const parts = command.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    switch (cmd) {
      case 'play':
      case 'p':
        await this.handlePlay(args);
        break;
      case 'combine':
      case 'c':
        await this.handleCombine(args);
        break;
      case 'dissolve':
      case 'd':
        await this.handleDissolve(args);
        break;
      case 'discard':
      case 'x':
        await this.handleDiscard(args);
        break;
      case 'help':
      case 'h':
        // Commands already displayed, just pause
        await this.prompt('Press Enter to continue...');
        break;
      case 'quit':
      case 'q':
        this.gameState.gameOver = true;
        this.gameState.won = false;
        break;
      default:
        console.log(chalk.red('Unknown command. Type "help" for available commands.'));
        await this.prompt('Press Enter to continue...');
    }
  }
  
  private async handlePlay(args: string[]): Promise<void> {
    if (this.gameState.handsRemaining === 0) {
      console.log(chalk.red('No hands remaining!'));
      await this.prompt('Press Enter to continue...');
      return;
    }
    
    if (args.length === 0) {
      console.log(chalk.red('Please specify card numbers (e.g., "play 1 3 5")'));
      await this.prompt('Press Enter to continue...');
      return;
    }
    
    const indices = args.map(n => parseInt(n) - 1).filter(n => !isNaN(n) && n >= 0 && n < this.gameState.hand.cards.length);
    
    if (indices.length === 0) {
      console.log(chalk.red('Invalid card numbers'));
      await this.prompt('Press Enter to continue...');
      return;
    }
    
    const selectedCards = indices.map(i => this.gameState.hand.cards[i]);
    const result = this.scoringSystem.validateAndScoreWord(selectedCards, this.gameState);
    
    const word = result.word;
    
    if (result.isValid) {
      console.log(chalk.bold.green(`\n✅ Valid word: ${word}`));
      if (result.language) {
        console.log(chalk.gray(`   Language: ${result.language}`));
      }
      console.log(chalk.bold.yellow(`   Score: ${result.finalScore} points\n`));
      
      this.gameState.currentScore += result.finalScore;
      this.gameState.handsRemaining--;
      
      // Remove played cards and put them in discard
      indices.sort((a, b) => b - a);
      for (const index of indices) {
        const card = this.gameState.hand.cards[index];
        this.gameState.deck.discardPile.push(card);
      }
      this.gameState.hand.cards = this.gameState.hand.cards.filter((_, i) => !indices.includes(i));
      
      // Draw new cards
      const newCards = this.cardManager.drawCards(this.gameState.deck, indices.length);
      newCards.forEach(card => this.cardManager.addCardToHand(this.gameState.hand, card));
    } else {
      console.log(chalk.bold.red(`\n❌ Invalid word: ${word}`));
      console.log(chalk.gray('   Not found in dictionary\n'));
    }
    
    await this.prompt('Press Enter to continue...');
  }
  
  private async handleCombine(args: string[]): Promise<void> {
    if (args.length < 2) {
      console.log(chalk.red('Please specify two card numbers (e.g., "combine 2 4")'));
      await this.prompt('Press Enter to continue...');
      return;
    }
    
    const index1 = parseInt(args[0]) - 1;
    const index2 = parseInt(args[1]) - 1;
    
    if (isNaN(index1) || isNaN(index2) || index1 < 0 || index2 < 0 || 
        index1 >= this.gameState.hand.cards.length || index2 >= this.gameState.hand.cards.length) {
      console.log(chalk.red('Invalid card numbers'));
      await this.prompt('Press Enter to continue...');
      return;
    }
    
    if (index1 === index2) {
      console.log(chalk.red('Cannot combine a card with itself'));
      await this.prompt('Press Enter to continue...');
      return;
    }
    
    const card1 = this.gameState.hand.cards[index1];
    const card2 = this.gameState.hand.cards[index2];
    
    const result = this.cardManager.combineCards(this.gameState.hand, card1.id, card2.id);
    
    if (result) {
      console.log(chalk.bold.green(`\n✅ Combined ${card1.character} + ${card2.character} = ${result.character}\n`));
    } else {
      console.log(chalk.bold.red(`\n❌ Cannot combine ${card1.character} and ${card2.character}\n`));
    }
    
    await this.prompt('Press Enter to continue...');
  }
  
  private async handleDissolve(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.red('Please specify a card number (e.g., "dissolve 3")'));
      await this.prompt('Press Enter to continue...');
      return;
    }
    
    const index = parseInt(args[0]) - 1;
    
    if (isNaN(index) || index < 0 || index >= this.gameState.hand.cards.length) {
      console.log(chalk.red('Invalid card number'));
      await this.prompt('Press Enter to continue...');
      return;
    }
    
    const card = this.gameState.hand.cards[index];
    const result = this.cardManager.dissolveCard(this.gameState.hand, card.id);
    
    if (result && result.length > 0) {
      console.log(chalk.bold.green(`\n✅ Dissolved ${card.character} into: ${result.map(c => c.character).join(', ')}\n`));
    } else {
      console.log(chalk.bold.red(`\n❌ Cannot dissolve ${card.character} (it's already a basic component)\n`));
    }
    
    await this.prompt('Press Enter to continue...');
  }
  
  private async handleDiscard(args: string[]): Promise<void> {
    if (this.gameState.discardsRemaining === 0) {
      console.log(chalk.red('No discards remaining!'));
      await this.prompt('Press Enter to continue...');
      return;
    }
    
    if (args.length === 0) {
      console.log(chalk.red('Please specify card numbers (e.g., "discard 1 2")'));
      await this.prompt('Press Enter to continue...');
      return;
    }
    
    const indices = args.map(n => parseInt(n) - 1).filter(n => !isNaN(n) && n >= 0 && n < this.gameState.hand.cards.length);
    
    if (indices.length === 0) {
      console.log(chalk.red('Invalid card numbers'));
      await this.prompt('Press Enter to continue...');
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
    
    console.log(chalk.green(`\nDiscarded ${indices.length} cards and drew ${newCards.length} new cards.\n`));
    await this.prompt('Press Enter to continue...');
  }
  
  private async shopPhase(): Promise<void> {
    const items = this.shop.generateShopItems(this.gameState.ante);
    
    while (true) {
      console.clear();
      console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════╗'));
      console.log(chalk.bold.cyan('║              🏪 SHOP                  ║'));
      console.log(chalk.bold.cyan('╚═══════════════════════════════════════╝\n'));
      console.log(chalk.bold.yellow(`💴 Your Currency: ¥${this.gameState.currency}\n`));
      
      items.forEach((item, index) => {
        if (item.type === 'joker') {
          const joker = item.item as any;
          const canAfford = this.gameState.currency >= item.cost;
          const color = canAfford ? chalk.green : chalk.gray;
          
          console.log(color(`[${index + 1}] ${joker.name} - ¥${item.cost}`));
          console.log(color(`    ${joker.description}`));
          console.log('');
        }
      });
      
      console.log(chalk.cyan('\nCommands:'));
      console.log('  ' + chalk.white('buy <n>') + ' or ' + chalk.white('b <n>') + ' - Buy item (e.g., "buy 1" or "b 1")');
      console.log('  ' + chalk.white('skip') + ' or ' + chalk.white('s') + ' - Skip shop (+¥1)');
      console.log('  ' + chalk.white('quit') + ' or ' + chalk.white('q') + ' - Quit game\n');
      
      const command = await this.prompt('Enter command: ');
      const parts = command.trim().split(/\s+/);
      const cmd = parts[0].toLowerCase();
      
      if (cmd === 'skip' || cmd === 's') {
        this.shop.skipShop(this.gameState);
        console.log(chalk.green('\nSkipped shop, earned ¥1\n'));
        await this.prompt('Press Enter to continue...');
        break;
      } else if (cmd === 'buy' || cmd === 'b') {
        const index = parseInt(parts[1]) - 1;
        if (isNaN(index) || index < 0 || index >= items.length) {
          console.log(chalk.red('Invalid item number'));
          await this.prompt('Press Enter to continue...');
          continue;
        }
        
        const item = items[index];
        if (this.shop.buyItem(this.gameState, item)) {
          console.log(chalk.green('Purchase successful!'));
          items.splice(index, 1);
        } else {
          console.log(chalk.red('Cannot afford this item or no room for more jokers!'));
        }
        await this.prompt('Press Enter to continue...');
      } else if (cmd === 'quit' || cmd === 'q') {
        this.gameState.gameOver = true;
        this.gameState.won = false;
        break;
      } else {
        console.log(chalk.red('Unknown command'));
        await this.prompt('Press Enter to continue...');
      }
    }
  }
  
  private displayGameOver(): void {
    console.clear();
    if (this.gameState.won) {
      console.log(chalk.bold.green('\n🎊 VICTORY! 🎊\n'));
      console.log(chalk.yellow(`You conquered all 8 antes!\n`));
    } else {
      console.log(chalk.bold.red('\n💀 GAME OVER 💀\n'));
      console.log(chalk.gray(`You reached Ante ${this.gameState.ante}\n`));
    }
    console.log(chalk.cyan(`Final Score: ${this.gameState.currentScore}\n`));
  }
  
  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }
}

