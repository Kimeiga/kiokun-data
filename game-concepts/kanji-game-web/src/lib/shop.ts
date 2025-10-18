import { Joker, ShopItem, GameState } from './types';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export class Shop {
  public generateShopItems(ante: number): ShopItem[] {
    const items: ShopItem[] = [];
    
    // Generate 2-3 jokers
    const jokerCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < jokerCount; i++) {
      items.push({
        type: 'joker',
        item: this.generateRandomJoker(ante),
        cost: this.calculateJokerCost(ante),
      });
    }
    
    return items;
  }
  
  private generateRandomJoker(ante: number): Joker {
    const jokerTemplates = [
      {
        name: '筆画の力', // Stroke Power
        description: 'Multiply score by strokes',
        effect: { type: 'stroke_multiplier' as const, value: 1.5 },
        rarity: 'common' as const,
      },
      {
        name: '長文の達人', // Long Word Master
        description: '+10 score per character in word',
        effect: { type: 'word_length_bonus' as const, value: 10 },
        rarity: 'common' as const,
      },
      {
        name: '部首の祝福', // Radical Blessing
        description: '+20 score per component card',
        effect: { type: 'component_bonus' as const, value: 20 },
        rarity: 'uncommon' as const,
      },
      {
        name: '追加の手', // Extra Hand
        description: '+1 hand per round',
        effect: { type: 'extra_hand' as const },
        rarity: 'rare' as const,
      },
      {
        name: '追加の捨て', // Extra Discard
        description: '+1 discard per round',
        effect: { type: 'extra_discard' as const },
        rarity: 'uncommon' as const,
      },
    ];
    
    const template = jokerTemplates[Math.floor(Math.random() * jokerTemplates.length)];
    
    return {
      id: generateId(),
      name: template.name,
      description: template.description,
      effect: template.effect,
      rarity: template.rarity,
      cost: this.calculateJokerCost(ante, template.rarity),
    };
  }
  
  private calculateJokerCost(ante: number, rarity: 'common' | 'uncommon' | 'rare' | 'legendary' = 'common'): number {
    const baseCosts = {
      common: 3,
      uncommon: 5,
      rare: 8,
      legendary: 12,
    };
    
    return baseCosts[rarity] + Math.floor(ante / 2);
  }
  
  public buyItem(gameState: GameState, item: ShopItem): boolean {
    if (gameState.currency < item.cost) {
      return false;
    }
    
    gameState.currency -= item.cost;
    
    if (item.type === 'joker') {
      const joker = item.item as Joker;
      
      // Check if we have room for more jokers (max 5)
      if (gameState.jokers.length >= 5) {
        return false;
      }
      
      gameState.jokers.push(joker);
      
      // Apply immediate effects
      if (joker.effect.type === 'extra_hand') {
        // This will be applied at the start of next round
      } else if (joker.effect.type === 'extra_discard') {
        // This will be applied at the start of next round
      }
    }
    
    return true;
  }
  
  public skipShop(gameState: GameState): void {
    // Award skip bonus
    gameState.currency += 1;
  }
}

