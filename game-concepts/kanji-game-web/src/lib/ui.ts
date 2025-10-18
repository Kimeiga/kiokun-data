import chalk from 'chalk';
import inquirer from 'inquirer';
import { GameState, Card, ShopItem } from './types';

export class TerminalUI {
  public displayWelcome(): void {
    console.clear();
    console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║   漢字ポーカー - Kanji Component Poker   ║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════╝\n'));
    console.log(chalk.gray('A Balatro-inspired roguelike deck builder\n'));
    console.log(chalk.yellow('Combine kanji components to form words and score points!\n'));
  }
  
  public displayGameState(gameState: GameState): void {
    console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.bold.yellow(`💴 Currency: ¥${gameState.currency}  `) +
                chalk.bold.cyan(`🎯 Ante ${gameState.ante} - ${this.getBlindName(gameState.currentBlind.type)}`));
    console.log(chalk.bold.green(`📊 Score: ${gameState.currentScore} / ${gameState.currentBlind.targetScore}  `) +
                chalk.bold.magenta(`🎴 Hands: ${gameState.handsRemaining}  `) +
                chalk.bold.blue(`🗑️  Discards: ${gameState.discardsRemaining}`));
    
    if (gameState.currentBlind.name) {
      console.log(chalk.bold.red(`👹 Boss: ${gameState.currentBlind.name}`));
    }
    
    if (gameState.jokers.length > 0) {
      console.log(chalk.bold.yellow('\n🃏 Active Jokers:'));
      gameState.jokers.forEach((joker, i) => {
        console.log(chalk.yellow(`  ${i + 1}. ${joker.name} - ${joker.description}`));
      });
    }
    
    console.log(chalk.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
  }
  
  public displayHand(hand: Card[]): void {
    console.log(chalk.bold.cyan('🎴 Your Hand:\n'));
    
    hand.forEach((card, index) => {
      const cardDisplay = chalk.bold.white(`[${index + 1}]`) + ' ' +
                         chalk.bold.green(card.character) + ' ' +
                         chalk.gray(`(${card.strokes} strokes${card.isComponent ? ', component' : ''})`);
      console.log(cardDisplay);
    });
    
    console.log('');
  }
  
  private getBlindName(type: 'small' | 'big' | 'boss'): string {
    const names = {
      small: 'Small Blind',
      big: 'Big Blind',
      boss: 'Boss Blind',
    };
    return names[type];
  }
  
  public async promptAction(): Promise<string> {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🎯 Play a word', value: 'play' },
          { name: '🔄 Combine two cards', value: 'combine' },
          { name: '💥 Dissolve a card', value: 'dissolve' },
          { name: '🗑️  Discard cards', value: 'discard' },
          { name: '❌ Quit', value: 'quit' },
        ],
      },
    ]);
    
    return action;
  }
  
  public async promptCardSelection(hand: Card[], message: string, multiple: boolean = false): Promise<number[]> {
    const choices = hand.map((card, index) => ({
      name: `${card.character} (${card.strokes} strokes)`,
      value: index,
    }));
    
    if (multiple) {
      const { selected } = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'selected',
          message,
          choices,
        },
      ]);
      return selected;
    } else {
      const { selected } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message,
          choices,
        },
      ]);
      return [selected];
    }
  }
  
  public displayWordResult(word: string, score: number, isValid: boolean, language?: string): void {
    if (isValid) {
      console.log(chalk.bold.green(`\n✅ Valid word: ${word}`));
      if (language) {
        console.log(chalk.gray(`   Language: ${language}`));
      }
      console.log(chalk.bold.yellow(`   Score: ${score} points\n`));
    } else {
      console.log(chalk.bold.red(`\n❌ Invalid word: ${word}`));
      console.log(chalk.gray('   Not found in dictionary\n'));
    }
  }
  
  public displayCombineResult(char1: string, char2: string, result: string | null): void {
    if (result) {
      console.log(chalk.bold.green(`\n✅ Combined ${char1} + ${char2} = ${result}\n`));
    } else {
      console.log(chalk.bold.red(`\n❌ Cannot combine ${char1} and ${char2}\n`));
    }
  }
  
  public displayDissolveResult(char: string, components: string[] | null): void {
    if (components && components.length > 0) {
      console.log(chalk.bold.green(`\n✅ Dissolved ${char} into: ${components.join(', ')}\n`));
    } else {
      console.log(chalk.bold.red(`\n❌ Cannot dissolve ${char} (it's already a basic component)\n`));
    }
  }
  
  public displayBlindComplete(reward: number, interest: number): void {
    console.log(chalk.bold.green('\n🎉 Blind Complete!\n'));
    console.log(chalk.yellow(`💰 Reward: ¥${reward}`));
    console.log(chalk.yellow(`💵 Interest: ¥${interest}\n`));
  }
  
  public displayBlindFailed(): void {
    console.log(chalk.bold.red('\n💀 Blind Failed!\n'));
    console.log(chalk.gray('You ran out of hands before reaching the target score.\n'));
  }
  
  public displayShop(items: ShopItem[], currency: number): void {
    console.clear();
    console.log(chalk.bold.cyan('\n╔═══════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║              🏪 SHOP                  ║'));
    console.log(chalk.bold.cyan('╚═══════════════════════════════════════╝\n'));
    console.log(chalk.bold.yellow(`💴 Your Currency: ¥${currency}\n`));
    
    items.forEach((item, index) => {
      if (item.type === 'joker') {
        const joker = item.item as any;
        const canAfford = currency >= item.cost;
        const color = canAfford ? chalk.green : chalk.gray;
        
        console.log(color(`[${index + 1}] ${joker.name} - ¥${item.cost}`));
        console.log(color(`    ${joker.description}`));
        console.log('');
      }
    });
  }
  
  public async promptShopAction(itemCount: number): Promise<string> {
    const choices = [];
    
    for (let i = 0; i < itemCount; i++) {
      choices.push({ name: `Buy item ${i + 1}`, value: `buy_${i}` });
    }
    
    choices.push({ name: '➡️  Continue (skip shop, +¥1)', value: 'skip' });
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices,
      },
    ]);
    
    return action;
  }
  
  public displayGameOver(won: boolean, ante: number, score: number): void {
    console.clear();
    if (won) {
      console.log(chalk.bold.green('\n🎊 VICTORY! 🎊\n'));
      console.log(chalk.yellow(`You conquered all 8 antes!\n`));
    } else {
      console.log(chalk.bold.red('\n💀 GAME OVER 💀\n'));
      console.log(chalk.gray(`You reached Ante ${ante}\n`));
    }
    console.log(chalk.cyan(`Final Score: ${score}\n`));
  }
  
  public async promptContinue(message: string = 'Press Enter to continue...'): Promise<void> {
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message,
      },
    ]);
  }
}

