// ============================================================================
// DICTIONARY DATA TYPES
// ============================================================================
// These types match the Rust structures in src/simple_output_types.rs

/**
 * Main dictionary entry structure
 * Contains all data for a single character or word
 */
export interface DictionaryEntry {
  key: string;
  redirect?: string;
  chinese_words: ChineseWord[];
  chinese_char?: ChineseCharacter;
  japanese_words: JapaneseWord[];
  japanese_char?: JapaneseCharacter;
  related_japanese_words: string[];
  japanese_names: JapaneseNameEntry[];
  contains: WordPreview[];
  contained_in_chinese: WordPreview[];
  contained_in_japanese: WordPreview[];
}

// ============================================================================
// WORD PREVIEW TYPES (for Contains and Appears In sections)
// ============================================================================

export interface WordPreview {
  w: string;           // word
  p?: string;          // pronunciation
  d?: string;          // definition
  c?: boolean;         // common (Japanese words only)
}

// ============================================================================
// CHINESE TYPES
// ============================================================================

export interface ChineseWord {
  _id: string;
  simp: string;
  trad: string;
  items: ChineseWordItem[];
  gloss?: string;
  pinyinSearchString: string;
  statistics?: ChineseWordStatistics;
}

export interface ChineseWordItem {
  source?: string;
  pinyin?: string;
  simpTrad?: 'simp' | 'trad' | 'both';
  definitions?: string[];
  tang?: string[];
  variantRefs?: string[];
}

export interface ChineseWordStatistics {
  movieWordRank?: number;
  movieWordCount?: number;
  movieWordCountPercent?: number;
  bookWordRank?: number;
  bookWordCount?: number;
  bookWordCountPercent?: number;
}

export interface ChineseCharacter {
  _id: string;
  char: string;
  codepoint: string;
  strokeCount: number;
  sources: string[];
  images?: ChineseCharacterImage[];
  shuowen?: string;
  variants?: ChineseCharacterVariant[];
  gloss?: string;
  statistics?: ChineseCharacterStatistics;
  hint?: string;
  isVerified?: boolean;
  variantOf?: string;
  simpVariants?: string[];
  tradVariants?: string[];
  pinyinFrequencies?: PinyinFrequency[];
  components?: ChineseComponent[];
  oldPronunciations?: OldPronunciation[];
  comments?: ChineseComment[];
  ids?: string;
  idsApparent?: string;
}

export interface ChineseCharacterImage {
  url: string;
  type: string;
  era?: string;
}

export interface ChineseCharacterVariant {
  char?: string;
  parts?: string;
  source: string;
}

export interface ChineseCharacterStatistics {
  hskLevel?: number;
  movieCharRank?: number;
  movieCharCount?: number;
  movieCharCountPercent?: number;
  bookCharRank?: number;
  bookCharCount?: number;
  bookCharCountPercent?: number;
  topWords?: TopWord[];
  pinyinFrequency?: number;
}

export interface TopWord {
  word: string;
  share: number;
  trad: string;
  gloss: string;
}

export interface PinyinFrequency {
  pinyin: string;
  count: number;
}

export interface ChineseComponent {
  char: string;
  meaning?: string;
  phonetic?: boolean;
}

export interface OldPronunciation {
  dynasty: string;
  pinyin: string;
}

export interface ChineseComment {
  comment: string;
  source: string;
}

// ============================================================================
// JAPANESE TYPES
// ============================================================================

export interface JapaneseWord {
  id: string;
  kanji: JapaneseKanji[];
  kana: JapaneseKana[];
  sense: JapaneseSense[];
}

export interface JapaneseKanji {
  common: boolean;
  text: string;
  tags: string[];
  appliesToKanji?: string[];
  pitchAccents?: number[];
}

export interface JapaneseKana {
  common: boolean;
  text: string;
  tags: string[];
  appliesToKanji?: string[];
  pitchAccents?: number[];
}

export interface JapaneseSense {
  partOfSpeech: string[];
  appliesToKanji: string[];
  appliesToKana: string[];
  related: JapaneseRelated[];
  antonym: JapaneseAntonym[];
  field: string[];
  dialect: string[];
  misc: string[];
  info: string[];
  languageSource: JapaneseLanguageSource[];
  gloss: JapaneseGloss[];
  examples?: JapaneseExample[];
}

export interface JapaneseRelated {
  text: string;
  type?: string;
}

export interface JapaneseAntonym {
  text: string;
  type?: string;
}

export interface JapaneseLanguageSource {
  lang: string;
  full: boolean;
  wasei: boolean;
  text?: string;
}

export interface JapaneseGloss {
  lang: string;
  gender?: string;
  type?: string;
  text: string;
}

export interface JapaneseExample {
  text: string;
  sentences: JapaneseExampleSentence[];
}

export interface JapaneseExampleSentence {
  lang: string;
  text: string;
}

export interface JapaneseCharacter {
  literal: string;
  codepoints: JapaneseCodepoint[];
  radicals: JapaneseRadical[];
  misc: JapaneseMisc;
  dictionaryReferences: JapaneseDictionaryReference[];
  queryCodes: JapaneseQueryCode[];
  readingMeaning?: JapaneseReadingMeaning;
  ids?: string;
  idsApparent?: string;
}

export interface JapaneseCodepoint {
  type: string;
  value: string;
}

export interface JapaneseRadical {
  type: string;
  value: number;
}

export interface JapaneseMisc {
  grade?: number;
  strokeCounts: number[];
  variants: JapaneseCodepoint[];
  frequency?: number;
  radicalNames: string[];
  jlptLevel?: number;
}

export interface JapaneseDictionaryReference {
  type: string;
  morohashi?: JapaneseMorohashi;
  value: string;
}

export interface JapaneseMorohashi {
  volume: number;
  page: number;
}

export interface JapaneseQueryCode {
  type: string;
  skipMisclassification?: string;
  value: string;
}

export interface JapaneseReadingMeaning {
  readingGroups: JapaneseReadingGroup[];
  meanings: string[];
}

export interface JapaneseReadingGroup {
  onReadings: string[];
  kunReadings: string[];
}

// ============================================================================
// JAPANESE NAMES (JMnedict) TYPES
// ============================================================================

export interface JapaneseNameEntry {
  id: string;
  kanji: JapaneseNameKanji[];
  kana: JapaneseNameKana[];
  translation: JapaneseNameTranslation[];
}

export interface JapaneseNameKanji {
  text: string;
  tags: string[];
}

export interface JapaneseNameKana {
  text: string;
  tags: string[];
  appliesToKanji: string[];
}

export interface JapaneseNameTranslation {
  type: string[];
  related: string[];
  translation: JapaneseNameTranslationText[];
}

export interface JapaneseNameTranslationText {
  lang: string;
  text: string;
}

// ============================================================================
// LEGACY OPTIMIZED TYPES (deprecated, kept for backwards compatibility)
// ============================================================================

export interface OptimizedJmnedictName {
  i: string; // id
  k: OptimizedJmnedictKanji[]; // kanji
  n: OptimizedJmnedictKana[]; // kana
  t: OptimizedJmnedictTranslation[]; // translation
}

export interface OptimizedJmnedictKanji {
  t: string; // text
  g?: string[]; // tags
}

export interface OptimizedJmnedictKana {
  t: string; // text
  g?: string[]; // tags
  a?: string[]; // applies_to_kanji
}

export interface OptimizedJmnedictTranslation {
  y: string[]; // name_type
  r?: string[]; // related
  t: OptimizedJmnedictTranslationText[]; // translation
}

export interface OptimizedJmnedictTranslationText {
  l?: string; // lang (empty for "eng")
  t: string; // text
}
