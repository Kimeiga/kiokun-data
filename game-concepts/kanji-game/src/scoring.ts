import { Card, PlayedWord, Joker, GameState } from './types';
import { DataLoader } from './dataLoader';

export class ScoringSystem {
  private dataLoader: DataLoader;
  
  constructor() {
    this.dataLoader = DataLoader.getInstance();
  }
  
  public validateAndScoreWord(cards: Card[], gameState: GameState): PlayedWord {
    const word = cards.map(c => c.character).join('');
    const validation = this.dataLoader.isValidWord(word);
    
    if (!validation.valid) {
      return {
        characters: cards.map(c => c.character),
        word,
        isValid: false,
        baseScore: 0,
        multipliers: 0,
        finalScore: 0,
      };
    }
    
    // Calculate base score: sum of strokes in each character
    const totalStrokes = cards.reduce((sum, card) => sum + card.strokes, 0);
    
    // Word length multiplier
    const wordLength = cards.length;
    
    // Base calculation: strokes × word length
    let baseScore = totalStrokes * wordLength;
    
    // Apply joker multipliers
    let multiplier = 1;
    
    for (const joker of gameState.jokers) {
      switch (joker.effect.type) {
        case 'stroke_multiplier':
          multiplier *= joker.effect.value;
          break;
        case 'word_length_bonus':
          baseScore += wordLength * joker.effect.value;
          break;
        case 'component_bonus':
          const componentCount = cards.filter(c => c.isComponent).length;
          baseScore += componentCount * joker.effect.value;
          break;
      }
    }
    
    const finalScore = Math.floor(baseScore * multiplier);

    // Handle 'both' language case
    const language = validation.language === 'both' ? 'chinese' : validation.language;

    return {
      characters: cards.map(c => c.character),
      word,
      isValid: true,
      language,
      baseScore,
      multipliers: multiplier,
      finalScore,
    };
  }
  
  public calculateBlindTarget(ante: number, blindType: 'small' | 'big' | 'boss'): number {
    const baseTargets = {
      small: 300,
      big: 450,
      boss: 600,
    };
    
    const base = baseTargets[blindType];
    const scaling = Math.pow(1.5, ante - 1);
    
    return Math.floor(base * scaling);
  }
  
  public calculateReward(blind: 'small' | 'big' | 'boss', ante: number): number {
    const baseRewards = {
      small: 3,
      big: 4,
      boss: 5,
    };
    
    return baseRewards[blind] + ante;
  }
  
  public calculateInterest(currency: number): number {
    // Interest: ¥1 per ¥5 held, max ¥5
    const interest = Math.floor(currency / 5);
    return Math.min(interest, 5);
  }
}

