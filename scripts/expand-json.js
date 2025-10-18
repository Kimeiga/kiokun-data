#!/usr/bin/env node
/**
 * CLI tool to expand optimized JSON to readable format
 * 
 * Usage:
 *   cat output_dictionary_optimized/好.json | ./scripts/expand-json.js | jq '.'
 *   cat output_dictionary_optimized/好.json | ./scripts/expand-json.js | jq '.chineseChar.strokeCount'
 * 
 * This tool reads optimized JSON from stdin and outputs expanded JSON to stdout.
 * Field names are expanded from short (e.g., "cc") to long (e.g., "chineseChar").
 */

const fs = require('fs');
const path = require('path');

// Load the field mappings module
// We need to use a TypeScript loader or convert to JS
// For now, we'll inline the expansion logic

// Field mappings (copied from field-mappings.ts)
const TOP_LEVEL_MAP = {
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
};

const CHINESE_CHAR_MAP = {
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
};

const PINYIN_FREQ_MAP = {
  py: 'pinyin',
  cnt: 'count',
};

const COMPONENT_MAP = {
  ch: 'character',
  ct: 'componentType',
  h: 'hint',
};

const IMAGE_MAP = {
  p: 'path',
  src: 'source',
  d: 'description',
  ty: 'type',
  e: 'era',
  data: 'data',
};

const STATISTICS_MAP = {
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
};

const TOP_WORD_MAP = {
  w: 'word',
  sh: 'share',
  tr: 'trad',
  g: 'gloss',
};

const VARIANT_MAP = {
  ch: 'char',
  pts: 'parts',
  src: 'source',
};

const COMMENT_MAP = {
  src: 'source',
  txt: 'text',
};

const JAPANESE_CHAR_MAP = {
  lit: 'literal',
  rm: 'readingMeaning',
  misc: 'misc',
};

const READING_MEANING_MAP = {
  r: 'readings',
  m: 'meanings',
  nan: 'nanori',
};

const READING_MAP = {
  ty: 'type',
  ot: 'onType',
  st: 'status',
  v: 'value',
};

const MEANING_MAP = {
  l: 'lang',
  v: 'value',
};

const MISC_MAP = {
  gr: 'grade',
  sc: 'strokeCounts',
  var: 'variants',
  freq: 'frequency',
  rn: 'radicalNames',
  jlpt: 'jlptLevel',
};

const CHINESE_WORD_MAP = {
  i: 'items',
};

const CHINESE_ITEM_MAP = {
  py: 'pinyin',
  def: 'definitions',
};

const JAPANESE_WORD_MAP = {
  k: 'kanji',
  ka: 'kana',
  s: 'sense',
};

const KANJI_MAP = {
  c: 'common',
  t: 'text',
  tag: 'tags',
};

const KANA_MAP = {
  c: 'common',
  t: 'text',
  tag: 'tags',
  ak: 'appliesToKanji',
  pa: 'pitchAccents',
};

const SENSE_MAP = {
  pos: 'partOfSpeech',
  misc: 'misc',
  g: 'gloss',
  rel: 'related',
  ex: 'examples',
};

const EXAMPLE_MAP = {
  src: 'source',
  t: 'text',
  sent: 'sentences',
};

const EXAMPLE_SOURCE_MAP = {
  ty: 'type',
  v: 'value',
};

const EXAMPLE_SENTENCE_MAP = {
  l: 'land',
  t: 'text',
};

// Expansion functions
function expandObject(obj, mapping) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = {};
  for (const [shortKey, value] of Object.entries(obj)) {
    const longKey = mapping[shortKey] || shortKey;
    result[longKey] = value;
  }
  return result;
}

function expandArray(arr, mapping) {
  return arr.map(item => expandObject(item, mapping));
}

function expandFields(data) {
  if (!data || typeof data !== 'object') return data;
  
  // Expand top level
  const expanded = expandObject(data, TOP_LEVEL_MAP);
  
  // Expand chinese_char
  if (expanded.chinese_char) {
    expanded.chinese_char = expandObject(expanded.chinese_char, CHINESE_CHAR_MAP);
    
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
    expanded.chinese_words = expanded.chinese_words.map(word => {
      const expandedWord = expandObject(word, CHINESE_WORD_MAP);
      if (expandedWord.items) {
        expandedWord.items = expandArray(expandedWord.items, CHINESE_ITEM_MAP);
      }
      return expandedWord;
    });
  }
  
  // Expand japanese_words
  if (expanded.japanese_words) {
    expanded.japanese_words = expanded.japanese_words.map(word => {
      const expandedWord = expandObject(word, JAPANESE_WORD_MAP);
      
      if (expandedWord.kanji) {
        expandedWord.kanji = expandArray(expandedWord.kanji, KANJI_MAP);
      }
      
      if (expandedWord.kana) {
        expandedWord.kana = expandArray(expandedWord.kana, KANA_MAP);
      }
      
      if (expandedWord.sense) {
        expandedWord.sense = expandedWord.sense.map(s => {
          const expandedSense = expandObject(s, SENSE_MAP);
          
          if (expandedSense.examples) {
            expandedSense.examples = expandedSense.examples.map(ex => {
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

// Main execution
let input = '';

process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const expanded = expandFields(data);
    console.log(JSON.stringify(expanded, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
});

