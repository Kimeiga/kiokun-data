/**
 * Field name mappings for optimized dictionary output
 * 
 * Short names are used in JSON files to reduce size (~15% reduction).
 * This file provides bidirectional mapping between short and long names.
 * 
 * Usage:
 * - CLI: cat file.json | ./scripts/expand-json.js | jq '.'
 * - Webapp: import { expandFields } from './field-mappings'
 */

// ============================================================================
// FIELD MAPPINGS
// ============================================================================

/** Top-level field mappings */
export const TOP_LEVEL_MAP = {
  k: 'key',
  r: 'redirect',
  cw: 'chinese_words',
  cc: 'chinese_char',
  jw: 'japanese_words',
  jc: 'japanese_char',
  rjw: 'related_japanese_words',
  ct: 'contains',
  cic: 'contained_in_chinese',
  cij: 'contained_in_japanese',
} as const;

/** Chinese character field mappings */
export const CHINESE_CHAR_MAP = {
  sc: 'strokeCount',
  pf: 'pinyinFrequencies',
  g: 'gloss',
  h: 'hint',
  comp: 'components',
  img: 'images',
  stats: 'statistics',
  var: 'variants',
  com: 'comments',
  ids: 'ids',
  idsa: 'idsApparent',
} as const;

/** Pinyin frequency field mappings */
export const PINYIN_FREQ_MAP = {
  py: 'pinyin',
  cnt: 'count',
} as const;

/** Component field mappings */
export const COMPONENT_MAP = {
  ch: 'character',
  ct: 'componentType',
  h: 'hint',
} as const;

/** Image field mappings */
export const IMAGE_MAP = {
  p: 'path',
  src: 'source',
  d: 'description',
  ty: 'type',
  e: 'era',
  data: 'data',
} as const;

/** Statistics field mappings */
export const STATISTICS_MAP = {
  hsk: 'hskLevel',
  tw: 'topWords',
  mwc: 'movieWordCount',
  mwcp: 'movieWordCountPercent',
  mwr: 'movieWordRank',
  mwx: 'movieWordContexts',
  mwxp: 'movieWordContextsPercent',
  bwc: 'bookWordCount',
  bwcp: 'bookWordCountPercent',
  bwr: 'bookWordRank',
  mcc: 'movieCharCount',
  mccp: 'movieCharCountPercent',
  mcr: 'movieCharRank',
  mcx: 'movieCharContexts',
  mcxp: 'movieCharContextsPercent',
  bcc: 'bookCharCount',
  bccp: 'bookCharCountPercent',
  bcr: 'bookCharRank',
  pf: 'pinyinFrequency',
} as const;

/** Top word field mappings */
export const TOP_WORD_MAP = {
  w: 'word',
  sh: 'share',
  tr: 'trad',
  g: 'gloss',
} as const;

/** Variant field mappings */
export const VARIANT_MAP = {
  ch: 'char',
  pts: 'parts',
  src: 'source',
} as const;

/** Comment field mappings */
export const COMMENT_MAP = {
  src: 'source',
  txt: 'text',
} as const;

/** Japanese character field mappings */
export const JAPANESE_CHAR_MAP = {
  lit: 'literal',
  rm: 'readingMeaning',
  misc: 'misc',
} as const;

/** Reading meaning field mappings */
export const READING_MEANING_MAP = {
  r: 'readings',
  m: 'meanings',
  nan: 'nanori',
} as const;

/** Reading field mappings */
export const READING_MAP = {
  ty: 'type',
  ot: 'onType',
  st: 'status',
  v: 'value',
} as const;

/** Meaning field mappings */
export const MEANING_MAP = {
  l: 'lang',
  v: 'value',
} as const;

/** Misc (Japanese char) field mappings */
export const MISC_MAP = {
  gr: 'grade',
  sc: 'strokeCounts',
  var: 'variants',
  freq: 'frequency',
  rn: 'radicalNames',
  jlpt: 'jlptLevel',
} as const;

/** Chinese word field mappings */
export const CHINESE_WORD_MAP = {
  i: 'items',
} as const;

/** Chinese item field mappings */
export const CHINESE_ITEM_MAP = {
  py: 'pinyin',
  def: 'definitions',
} as const;

/** Japanese word field mappings */
export const JAPANESE_WORD_MAP = {
  k: 'kanji',
  ka: 'kana',
  s: 'sense',
} as const;

/** Kanji field mappings */
export const KANJI_MAP = {
  c: 'common',
  t: 'text',
  tag: 'tags',
} as const;

/** Kana field mappings */
export const KANA_MAP = {
  c: 'common',
  t: 'text',
  tag: 'tags',
  ak: 'appliesToKanji',
  pa: 'pitchAccents',
} as const;

/** Sense field mappings */
export const SENSE_MAP = {
  pos: 'partOfSpeech',
  misc: 'misc',
  g: 'gloss',
  rel: 'related',
  ex: 'examples',
} as const;

/** Example field mappings */
export const EXAMPLE_MAP = {
  src: 'source',
  t: 'text',
  sent: 'sentences',
} as const;

/** Example source field mappings */
export const EXAMPLE_SOURCE_MAP = {
  ty: 'type',
  v: 'value',
} as const;

/** Example sentence field mappings */
export const EXAMPLE_SENTENCE_MAP = {
  l: 'land',
  t: 'text',
} as const;

// ============================================================================
// EXPANSION FUNCTIONS
// ============================================================================

/** Expand a single object using a mapping */
function expandObject(obj: any, mapping: Record<string, string>): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result: any = {};
  for (const [shortKey, value] of Object.entries(obj)) {
    const longKey = mapping[shortKey] || shortKey;
    result[longKey] = value;
  }
  return result;
}

/** Expand an array of objects using a mapping */
function expandArray(arr: any[], mapping: Record<string, string>): any[] {
  return arr.map(item => expandObject(item, mapping));
}

/** Recursively expand all fields in the data structure */
export function expandFields(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  // Expand top level
  const expanded = expandObject(data, TOP_LEVEL_MAP);

  // Expand chinese_char
  if (expanded.chinese_char) {
    expanded.chinese_char = expandObject(expanded.chinese_char, CHINESE_CHAR_MAP);

    // Expand nested fields
    if (expanded.chinese_char.pinyinFrequencies) {
      expanded.chinese_char.pinyinFrequencies = expandArray(
        expanded.chinese_char.pinyinFrequencies,
        PINYIN_FREQ_MAP
      );
    }

    if (expanded.chinese_char.components) {
      expanded.chinese_char.components = expandArray(
        expanded.chinese_char.components,
        COMPONENT_MAP
      );
    }

    if (expanded.chinese_char.images) {
      expanded.chinese_char.images = expandArray(
        expanded.chinese_char.images,
        IMAGE_MAP
      );
    }

    if (expanded.chinese_char.statistics) {
      expanded.chinese_char.statistics = expandObject(
        expanded.chinese_char.statistics,
        STATISTICS_MAP
      );

      if (expanded.chinese_char.statistics.topWords) {
        expanded.chinese_char.statistics.topWords = expandArray(
          expanded.chinese_char.statistics.topWords,
          TOP_WORD_MAP
        );
      }
    }

    if (expanded.chinese_char.variants) {
      expanded.chinese_char.variants = expandArray(
        expanded.chinese_char.variants,
        VARIANT_MAP
      );
    }

    if (expanded.chinese_char.comments) {
      expanded.chinese_char.comments = expandArray(
        expanded.chinese_char.comments,
        COMMENT_MAP
      );
    }
  }
  
  // Expand japanese_char
  if (expanded.japanese_char) {
    expanded.japanese_char = expandObject(expanded.japanese_char, JAPANESE_CHAR_MAP);

    if (expanded.japanese_char.readingMeaning) {
      expanded.japanese_char.readingMeaning = expandObject(
        expanded.japanese_char.readingMeaning,
        READING_MEANING_MAP
      );

      if (expanded.japanese_char.readingMeaning.readings) {
        expanded.japanese_char.readingMeaning.readings = expandArray(
          expanded.japanese_char.readingMeaning.readings,
          READING_MAP
        );
      }

      if (expanded.japanese_char.readingMeaning.meanings) {
        expanded.japanese_char.readingMeaning.meanings = expandArray(
          expanded.japanese_char.readingMeaning.meanings,
          MEANING_MAP
        );
      }
    }

    if (expanded.japanese_char.misc) {
      expanded.japanese_char.misc = expandObject(
        expanded.japanese_char.misc,
        MISC_MAP
      );
    }
  }

  // Expand chinese_words
  if (expanded.chinese_words) {
    expanded.chinese_words = expanded.chinese_words.map((word: any) => {
      const expandedWord = expandObject(word, CHINESE_WORD_MAP);
      if (expandedWord.items) {
        expandedWord.items = expandArray(expandedWord.items, CHINESE_ITEM_MAP);
      }
      return expandedWord;
    });
  }

  // Expand japanese_words
  if (expanded.japanese_words) {
    expanded.japanese_words = expanded.japanese_words.map((word: any) => {
      const expandedWord = expandObject(word, JAPANESE_WORD_MAP);
      
      if (expandedWord.kanji) {
        expandedWord.kanji = expandArray(expandedWord.kanji, KANJI_MAP);
      }
      
      if (expandedWord.kana) {
        expandedWord.kana = expandArray(expandedWord.kana, KANA_MAP);
      }
      
      if (expandedWord.sense) {
        expandedWord.sense = expandedWord.sense.map((s: any) => {
          const expandedSense = expandObject(s, SENSE_MAP);
          
          if (expandedSense.examples) {
            expandedSense.examples = expandedSense.examples.map((ex: any) => {
              const expandedEx = expandObject(ex, EXAMPLE_MAP);
              
              if (expandedEx.source) {
                expandedEx.source = expandObject(expandedEx.source, EXAMPLE_SOURCE_MAP);
              }
              
              if (expandedEx.sentences) {
                expandedEx.sentences = expandArray(expandedEx.sentences, EXAMPLE_SENTENCE_MAP);
              }
              
              return expandedEx;
            });
          }
          
          return expandedSense;
        });
      }
      
      return expandedWord;
    });
  }
  
  return expanded;
}

// ============================================================================
// COMPRESSION FUNCTIONS (for generating optimized output)
// ============================================================================

/** Create reverse mapping */
function reverseMapping(mapping: Record<string, string>): Record<string, string> {
  const reversed: Record<string, string> = {};
  for (const [short, long] of Object.entries(mapping)) {
    reversed[long] = short;
  }
  return reversed;
}

// Create reverse mappings
const TOP_LEVEL_REVERSE = reverseMapping(TOP_LEVEL_MAP);
const CHINESE_CHAR_REVERSE = reverseMapping(CHINESE_CHAR_MAP);
const PINYIN_FREQ_REVERSE = reverseMapping(PINYIN_FREQ_MAP);
const COMPONENT_REVERSE = reverseMapping(COMPONENT_MAP);
const IMAGE_REVERSE = reverseMapping(IMAGE_MAP);
const STATISTICS_REVERSE = reverseMapping(STATISTICS_MAP);
const TOP_WORD_REVERSE = reverseMapping(TOP_WORD_MAP);
const VARIANT_REVERSE = reverseMapping(VARIANT_MAP);
const COMMENT_REVERSE = reverseMapping(COMMENT_MAP);
const JAPANESE_CHAR_REVERSE = reverseMapping(JAPANESE_CHAR_MAP);
const READING_MEANING_REVERSE = reverseMapping(READING_MEANING_MAP);
const READING_REVERSE = reverseMapping(READING_MAP);
const MEANING_REVERSE = reverseMapping(MEANING_MAP);
const MISC_REVERSE = reverseMapping(MISC_MAP);
const CHINESE_WORD_REVERSE = reverseMapping(CHINESE_WORD_MAP);
const CHINESE_ITEM_REVERSE = reverseMapping(CHINESE_ITEM_MAP);
const JAPANESE_WORD_REVERSE = reverseMapping(JAPANESE_WORD_MAP);
const KANJI_REVERSE = reverseMapping(KANJI_MAP);
const KANA_REVERSE = reverseMapping(KANA_MAP);
const SENSE_REVERSE = reverseMapping(SENSE_MAP);
const EXAMPLE_REVERSE = reverseMapping(EXAMPLE_MAP);
const EXAMPLE_SOURCE_REVERSE = reverseMapping(EXAMPLE_SOURCE_MAP);
const EXAMPLE_SENTENCE_REVERSE = reverseMapping(EXAMPLE_SENTENCE_MAP);

/** Compress a single object using a reverse mapping */
function compressObject(obj: any, reverseMapping: Record<string, string>): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result: any = {};
  for (const [longKey, value] of Object.entries(obj)) {
    const shortKey = reverseMapping[longKey] || longKey;
    result[shortKey] = value;
  }
  return result;
}

/** Export reverse mappings for Rust code generation */
export const REVERSE_MAPPINGS = {
  TOP_LEVEL: TOP_LEVEL_REVERSE,
  CHINESE_CHAR: CHINESE_CHAR_REVERSE,
  PINYIN_FREQ: PINYIN_FREQ_REVERSE,
  COMPONENT: COMPONENT_REVERSE,
  IMAGE: IMAGE_REVERSE,
  STATISTICS: STATISTICS_REVERSE,
  TOP_WORD: TOP_WORD_REVERSE,
  VARIANT: VARIANT_REVERSE,
  COMMENT: COMMENT_REVERSE,
  JAPANESE_CHAR: JAPANESE_CHAR_REVERSE,
  READING_MEANING: READING_MEANING_REVERSE,
  READING: READING_REVERSE,
  MEANING: MEANING_REVERSE,
  MISC: MISC_REVERSE,
  CHINESE_WORD: CHINESE_WORD_REVERSE,
  CHINESE_ITEM: CHINESE_ITEM_REVERSE,
  JAPANESE_WORD: JAPANESE_WORD_REVERSE,
  KANJI: KANJI_REVERSE,
  KANA: KANA_REVERSE,
  SENSE: SENSE_REVERSE,
  EXAMPLE: EXAMPLE_REVERSE,
  EXAMPLE_SOURCE: EXAMPLE_SOURCE_REVERSE,
  EXAMPLE_SENTENCE: EXAMPLE_SENTENCE_REVERSE,
};

