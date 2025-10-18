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
  private lastMessage: string = ''; // Store last action message

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
    // Show last message if any
    if (this.lastMessage) {
      console.log(this.lastMessage);
      this.lastMessage = ''; // Clear after displaying
    }

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
        
        this.lastMessage = chalk.bold.green('🎉 Blind Complete!') +
                           chalk.yellow(` Reward: ¥${reward}, Interest: ¥${interest}`);

        const canContinue = this.gameStateManager.advanceBlind(this.gameState);
        if (!canContinue) {
          return; // Game won
        }
        return; // Go to shop
      }
      
      // Check if blind failed
      if (this.gameStateManager.checkBlindFailed(this.gameState)) {
        this.lastMessage = chalk.bold.red('💀 Blind Failed!') +
                           chalk.gray(' You ran out of hands before reaching the target score.');
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
        // Commands already displayed, no action needed
        break;
      case 'quit':
      case 'q':
        this.gameState.gameOver = true;
        this.gameState.won = false;
        break;
      default:
        this.lastMessage = chalk.red('❌ Unknown command. Type "help" for available commands.');
    }
  }
  
  private async handlePlay(args: string[]): Promise<void> {
    if (this.gameState.handsRemaining === 0) {
      this.lastMessage = chalk.red('❌ No hands remaining!');
      return;
    }

    if (args.length === 0) {
      this.lastMessage = chalk.red('❌ Please specify card numbers (e.g., "play 1 3 5")');
      return;
    }

    const indices = args.map(n => parseInt(n) - 1).filter(n => !isNaN(n) && n >= 0 && n < this.gameState.hand.cards.length);

    if (indices.length === 0) {
      this.lastMessage = chalk.red('❌ Invalid card numbers');
      return;
    }

    const selectedCards = indices.map(i => this.gameState.hand.cards[i]);

    // Check if playing a single component card
    if (selectedCards.length === 1 && selectedCards[0].isComponent) {
      this.lastMessage = chalk.red('❌ Cannot play a single component card. Combine it first or play multiple cards to form a word.');
      return;
    }

    const result = this.scoringSystem.validateAndScoreWord(selectedCards, this.gameState);

    const word = result.word;

    if (result.isValid) {
      let message = chalk.bold.green(`✅ Valid word: ${word}`);
      if (result.language) {
        message += chalk.gray(` (${result.language})`);
      }
      message += chalk.bold.yellow(` → ${result.finalScore} points`);
      this.lastMessage = message;

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
      this.lastMessage = chalk.bold.red(`❌ Invalid word: ${word}`) + chalk.gray(' (not in dictionary)');
    }
  }
  
  private async handleCombine(args: string[]): Promise<void> {
    if (args.length < 2) {
      this.lastMessage = chalk.red('❌ Please specify two card numbers (e.g., "combine 2 4")');
      return;
    }

    const index1 = parseInt(args[0]) - 1;
    const index2 = parseInt(args[1]) - 1;

    if (isNaN(index1) || isNaN(index2) || index1 < 0 || index2 < 0 ||
        index1 >= this.gameState.hand.cards.length || index2 >= this.gameState.hand.cards.length) {
      this.lastMessage = chalk.red('❌ Invalid card numbers');
      return;
    }

    if (index1 === index2) {
      this.lastMessage = chalk.red('❌ Cannot combine a card with itself');
      return;
    }

    const card1 = this.gameState.hand.cards[index1];
    const card2 = this.gameState.hand.cards[index2];

    // Check possible combinations
    const possibleResults = this.cardManager.getPossibleCombinations(card1.character, card2.character);

    if (possibleResults.length === 0) {
      this.lastMessage = chalk.bold.red(`❌ Cannot combine ${card1.character} and ${card2.character}`);
      return;
    }

    // If multiple results, let player choose
    let chosenChar: string;
    if (possibleResults.length > 1) {
      console.log(chalk.yellow(`\n🔀 Multiple results possible for ${card1.character} + ${card2.character}:`));
      possibleResults.forEach((char, i) => {
        console.log(chalk.cyan(`  [${i + 1}] ${char}`));
      });

      const choice = await this.prompt(chalk.white('Choose result (1-' + possibleResults.length + '): '));
      const choiceIndex = parseInt(choice) - 1;

      if (isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex >= possibleResults.length) {
        this.lastMessage = chalk.red('❌ Invalid choice, combination cancelled');
        return;
      }

      chosenChar = possibleResults[choiceIndex];
    } else {
      chosenChar = possibleResults[0];
    }

    const result = this.cardManager.combineCards(this.gameState.hand, card1.id, card2.id, chosenChar);

    if (result) {
      this.lastMessage = chalk.bold.green(`✅ Combined ${card1.character} + ${card2.character} = ${result.character}`);
    } else {
      this.lastMessage = chalk.bold.red(`❌ Cannot combine ${card1.character} and ${card2.character}`);
    }
  }

  private async handleDissolve(args: string[]): Promise<void> {
    if (args.length === 0) {
      this.lastMessage = chalk.red('❌ Please specify a card number (e.g., "dissolve 3")');
      return;
    }

    const index = parseInt(args[0]) - 1;

    if (isNaN(index) || index < 0 || index >= this.gameState.hand.cards.length) {
      this.lastMessage = chalk.red('❌ Invalid card number');
      return;
    }

    const card = this.gameState.hand.cards[index];
    const result = this.cardManager.dissolveCard(this.gameState.hand, card.id);

    if (result && result.length > 0) {
      this.lastMessage = chalk.bold.green(`✅ Dissolved ${card.character} into: ${result.map(c => c.character).join(', ')}`);
    } else {
      this.lastMessage = chalk.bold.red(`❌ Cannot dissolve ${card.character} (it's already a basic component)`);
    }
  }
  
  private async handleDiscard(args: string[]): Promise<void> {
    if (this.gameState.discardsRemaining === 0) {
      this.lastMessage = chalk.red('❌ No discards remaining!');
      return;
    }

    if (args.length === 0) {
      this.lastMessage = chalk.red('❌ Please specify card numbers (e.g., "discard 1 2")');
      return;
    }

    const indices = args.map(n => parseInt(n) - 1).filter(n => !isNaN(n) && n >= 0 && n < this.gameState.hand.cards.length);

    if (indices.length === 0) {
      this.lastMessage = chalk.red('❌ Invalid card numbers');
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

    this.lastMessage = chalk.green(`✅ Discarded ${indices.length} cards and drew ${newCards.length} new cards`);
  }
  
  private async shopPhase(): Promise<void> {
    const items = this.shop.generateShopItems(this.gameState.ante);
    let shopMessage = '';

    while (true) {
      console.clear();

      // Show shop message if any
      if (shopMessage) {
        console.log(shopMessage);
        shopMessage = '';
      }

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
        this.lastMessage = chalk.green('✅ Skipped shop, earned ¥1');
        break;
      } else if (cmd === 'buy' || cmd === 'b') {
        const index = parseInt(parts[1]) - 1;
        if (isNaN(index) || index < 0 || index >= items.length) {
          shopMessage = chalk.red('❌ Invalid item number');
          continue;
        }

        const item = items[index];
        if (this.shop.buyItem(this.gameState, item)) {
          shopMessage = chalk.green('✅ Purchase successful!');
          items.splice(index, 1);
        } else {
          shopMessage = chalk.red('❌ Cannot afford this item or no room for more jokers!');
        }
      } else if (cmd === 'quit' || cmd === 'q') {
        this.gameState.gameOver = true;
        this.gameState.won = false;
        break;
      } else {
        shopMessage = chalk.red('❌ Unknown command');
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

