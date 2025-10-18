import * as fs from 'fs';
import * as path from 'path';
import { IdsForwardLookup, IdsReverseLookup, WordIndex, StrokeData } from './types';

export class DataLoader {
  private static instance: DataLoader;
  
  public idsForward: IdsForwardLookup = {};
  public idsReverse: IdsReverseLookup = {};
  public wordIndex: Set<string> = new Set();
  public chineseWords: Set<string> = new Set();
  public japaneseWords: Set<string> = new Set();
  public strokeData: StrokeData = {};
  
  private constructor() {}
  
  public static getInstance(): DataLoader {
    if (!DataLoader.instance) {
      DataLoader.instance = new DataLoader();
    }
    return DataLoader.instance;
  }
  
  public async load(): Promise<void> {
    console.log('📚 Loading game data...');
    
    try {
      // Load IDS forward lookup
      const idsForwardPath = path.join(__dirname, '../data/ids_forward.json');
      const idsForwardData = fs.readFileSync(idsForwardPath, 'utf-8');
      this.idsForward = JSON.parse(idsForwardData);
      console.log(`  ✅ Loaded ${Object.keys(this.idsForward).length} forward IDS mappings`);
      
      // Load IDS reverse lookup
      const idsReversePath = path.join(__dirname, '../data/ids_reverse.json');
      const idsReverseData = fs.readFileSync(idsReversePath, 'utf-8');
      this.idsReverse = JSON.parse(idsReverseData);
      console.log(`  ✅ Loaded ${Object.keys(this.idsReverse).length} reverse IDS mappings`);
      
      // Load word index
      const wordIndexPath = path.join(__dirname, '../data/word_index.json');
      const wordIndexData = fs.readFileSync(wordIndexPath, 'utf-8');
      const wordIndexObj: WordIndex = JSON.parse(wordIndexData);
      
      this.wordIndex = new Set(wordIndexObj.all_words);
      this.chineseWords = new Set(wordIndexObj.chinese_words);
      this.japaneseWords = new Set(wordIndexObj.japanese_words);
      console.log(`  ✅ Loaded ${this.wordIndex.size} valid words`);
      console.log(`     - Chinese: ${this.chineseWords.size}`);
      console.log(`     - Japanese: ${this.japaneseWords.size}`);
      
      // Build stroke data from IDS forward lookup
      this.buildStrokeData();
      console.log(`  ✅ Built stroke data for ${Object.keys(this.strokeData).length} characters`);
      
      console.log('✨ Data loading complete!\n');
    } catch (error) {
      console.error('❌ Error loading game data:', error);
      throw error;
    }
  }
  
  private buildStrokeData(): void {
    // For characters in IDS, we can estimate strokes by counting components recursively
    // For now, we'll use a simple heuristic: basic components have 1-5 strokes
    // and compound characters sum their components
    
    const basicStrokes: { [char: string]: number } = {
      '一': 1, '丨': 1, '丶': 1, '丿': 1, '乙': 1, '亅': 1,
      '二': 2, '亠': 2, '人': 2, '儿': 2, '入': 2, '八': 2, '冂': 2, '冖': 2, '冫': 2, '几': 2, '凵': 2, '刀': 2, '力': 2, '勹': 2, '匕': 2, '匚': 2, '匸': 2, '十': 2, '卜': 2, '卩': 2, '厂': 2, '厶': 2, '又': 2,
      '三': 3, '口': 3, '囗': 3, '土': 3, '士': 3, '夂': 3, '夊': 3, '夕': 3, '大': 3, '女': 3, '子': 3, '宀': 3, '寸': 3, '小': 3, '尢': 3, '尸': 3, '屮': 3, '山': 3, '巛': 3, '工': 3, '己': 3, '巾': 3, '干': 3, '幺': 3, '广': 3, '廴': 3, '廾': 3, '弋': 3, '弓': 3, '彐': 3, '彡': 3, '彳': 3,
      '四': 4, '心': 4, '戈': 4, '戶': 4, '手': 4, '支': 4, '攴': 4, '文': 4, '斗': 4, '斤': 4, '方': 4, '无': 4, '日': 4, '曰': 4, '月': 4, '木': 4, '欠': 4, '止': 4, '歹': 4, '殳': 4, '毋': 4, '比': 4, '毛': 4, '氏': 4, '气': 4, '水': 4, '火': 4, '爪': 4, '父': 4, '爻': 4, '爿': 4, '片': 4, '牙': 4, '牛': 4, '犬': 4,
      '五': 5, '玄': 5, '玉': 5, '瓜': 5, '瓦': 5, '甘': 5, '生': 5, '用': 5, '田': 5, '疋': 5, '疒': 5, '癶': 5, '白': 5, '皮': 5, '皿': 5, '目': 5, '矛': 5, '矢': 5, '石': 5, '示': 5, '禸': 5, '禾': 5, '穴': 5, '立': 5,
    };
    
    // Add basic strokes
    for (const [char, strokes] of Object.entries(basicStrokes)) {
      this.strokeData[char] = strokes;
    }
    
    // For characters in IDS forward lookup, calculate strokes recursively
    const calculateStrokes = (char: string, visited: Set<string> = new Set()): number => {
      if (visited.has(char)) return 1; // Prevent infinite recursion
      visited.add(char);
      
      if (this.strokeData[char]) {
        return this.strokeData[char];
      }
      
      const idsEntry = this.idsForward[char];
      if (!idsEntry || !idsEntry.components || idsEntry.components.length === 0) {
        // Unknown character, estimate based on Unicode block
        const code = char.charCodeAt(0);
        if (code >= 0x4E00 && code <= 0x9FFF) {
          // CJK Unified Ideographs - estimate 8 strokes average
          return 8;
        }
        return 1;
      }
      
      // Sum strokes of components
      let totalStrokes = 0;
      for (const component of idsEntry.components) {
        // Extract just the character if it's a complex IDS expression
        const componentChar = component.charAt(0);
        totalStrokes += calculateStrokes(componentChar, visited);
      }
      
      return totalStrokes;
    };
    
    // Calculate strokes for all characters in IDS forward lookup
    for (const char of Object.keys(this.idsForward)) {
      if (!this.strokeData[char]) {
        this.strokeData[char] = calculateStrokes(char);
      }
    }
    
    // Add some common characters with known stroke counts
    const commonStrokes: { [char: string]: number } = {
      '的': 8, '一': 1, '是': 9, '不': 4, '了': 2, '人': 2, '我': 7, '在': 6, '有': 6, '他': 5,
      '这': 7, '个': 3, '们': 5, '中': 4, '来': 7, '上': 3, '大': 3, '为': 4, '和': 8, '国': 8,
      '地': 6, '到': 8, '以': 4, '说': 9, '时': 7, '要': 9, '就': 12, '出': 5, '会': 6, '可': 5,
      '也': 3, '你': 7, '对': 5, '生': 5, '能': 10, '而': 6, '子': 3, '那': 6, '得': 11, '于': 3,
      '着': 11, '下': 3, '自': 6, '之': 3, '年': 6, '过': 6, '发': 5, '后': 6, '作': 7, '里': 7,
      '用': 5, '道': 12, '行': 6, '所': 8, '然': 12, '家': 10, '种': 9, '事': 8, '成': 6, '方': 4,
      '多': 6, '经': 8, '么': 3, '去': 5, '法': 8, '学': 8, '如': 6, '她': 6, '只': 5, '从': 4,
    };
    
    for (const [char, strokes] of Object.entries(commonStrokes)) {
      if (!this.strokeData[char]) {
        this.strokeData[char] = strokes;
      }
    }
  }
  
  public getStrokes(char: string): number {
    if (this.strokeData[char]) {
      return this.strokeData[char];
    }
    
    // Default estimate for unknown characters
    const code = char.charCodeAt(0);
    if (code >= 0x4E00 && code <= 0x9FFF) {
      return 8; // Average CJK character
    }
    return 1;
  }
  
  public canCombine(char1: string, char2: string): string[] {
    const key1 = `${char1}+${char2}`;
    const key2 = `${char2}+${char1}`;

    const results: string[] = [];

    // Helper to normalize value (string or array) to array
    const addResults = (value: string | string[] | undefined) => {
      if (!value) return;
      if (typeof value === 'string') {
        results.push(value);
      } else {
        results.push(...value);
      }
    };

    addResults(this.idsReverse[key1]);
    addResults(this.idsReverse[key2]);

    return [...new Set(results)]; // Remove duplicates
  }
  
  public canDissolve(char: string): string[] {
    const entry = this.idsForward[char];
    if (!entry || !entry.components || entry.components.length === 0) {
      return [];
    }
    return entry.components;
  }
  
  public isValidWord(word: string): { valid: boolean; language?: 'chinese' | 'japanese' | 'both' } {
    if (this.wordIndex.has(word)) {
      const isChinese = this.chineseWords.has(word);
      const isJapanese = this.japaneseWords.has(word);
      
      if (isChinese && isJapanese) {
        return { valid: true, language: 'both' };
      } else if (isChinese) {
        return { valid: true, language: 'chinese' };
      } else if (isJapanese) {
        return { valid: true, language: 'japanese' };
      }
    }
    return { valid: false };
  }
}

