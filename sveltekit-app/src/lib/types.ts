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
  simplified_form_of?: string;
  chinese_words: ChineseWord[];
  chinese_char?: ChineseCharacter;
  japanese_words: JapaneseWord[];
  japanese_char?: JapaneseCharacter;
  korean_words?: KoreanWord[];
  korean_char?: KoreanCharacter;
  semantic_mnemonic?: SemanticMnemonicCard;
  semantic_mnemonic_variants?: SemanticMnemonicCard[];
  related_japanese_words: string[];
  japanese_names: JapaneseNameEntry[];
  contains: WordPreview[];
  contained_in_chinese: WordPreview[];
  contained_in_japanese: WordPreview[];
  contained_in_korean?: WordPreview[];
}

export interface SemanticMnemonicComponent {
  character: string;
  gloss: string;
}

export interface SemanticMnemonicCard {
  character: string;
  meaning: string;
  lexical_gloss?: string;
  mnemonic_keyword?: string;
  keyword_kind?: 'visual_comparison' | 'historical_form' | 'component_image';
  equation: string;
  mnemonic: string;
  components?: SemanticMnemonicComponent[];
  visual_components?: SemanticMnemonicComponent[];
  component_source?: string;
  historical_components?: SemanticMnemonicComponent[];
  historical_component_source?: string;
  alias_of?: string;
  alias_kind?: string;
  alias_reason?: string;
  pronunciation_mnemonics?: PronunciationMnemonicCard[];
}

export type PronunciationLanguage = 'zh' | 'ja';
export type PronunciationReadingType = 'mandarin' | 'on' | 'kun';

export interface PronunciationMnemonicCard {
  character: string;
  variants: string[];
  language: PronunciationLanguage;
  review_status: 'reviewed' | 'needs_review';
  readings: PronunciationMnemonicReading[];
}

export interface PronunciationMnemonicReading {
  reading_type: PronunciationReadingType;
  display_reading: string;
  normalized_reading: string;
  source_reading?: string;
  status: 'core' | 'secondary';
  usage_gloss: string;
  editorial_reason: string;
  strategy: 'phonetic_component' | 'integrated_sound_cue' | 'word_anchor';
  overlay: string;
  tone?: number;
  sound_cue?: { syllable: string; tone_behavior: string };
  phonetic_component?: {
    character: string;
    reading: string;
    relationship: string;
    source: string;
  };
  anchors: PronunciationAnchorWord[];
}

export interface PronunciationAnchorWord {
  word: string;
  reading: string;
  character_reading: string;
  gloss: string;
  phonological_note?: string;
  frequency: {
    source: string;
    field: string;
    rank?: number;
    usefulness?: string;
  };
}

// ============================================================================
// WORD PREVIEW TYPES (for Contains and Appears In sections)
// ============================================================================

export interface WordPreview {
  w: string;           // word
  p?: string;          // pronunciation (Chinese pinyin)
  jp?: string;         // Japanese pronunciation (kana reading)
  kr?: string;         // Korean reading (Hangul)
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
  jyutpingSearchString?: string;  // Cantonese Jyutping search string
  statistics?: ChineseWordStatistics;
}

export interface ChineseWordItem {
  source?: string;
  pinyin?: string;
  jyutping?: string;  // Cantonese pronunciation (Jyutping romanization)
  simpTrad?: 'simp' | 'trad' | 'both';
  definitions?: string[];
  definitionExamples?: ChineseDefinitionExamples[];
  tang?: string[];
  variantRefs?: string[];
}

export interface ChineseDefinitionExamples {
  definition: string;
  examples: ChineseExample[];
}

export interface ChineseExample {
  simp: string;
  trad: string;
  en: string;
  pinyin?: string;
  source: string;
  sourceSenseId: string;
  sourceGloss: string;
  matchConfidence: number;
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
  cantonese?: string[];  // Cantonese Jyutping readings from Unihan
  hkChar?: string;  // Hong Kong character variant (when HK uses different form)
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
  char?: string;
  character?: string;
  meaning?: string;
  type?: string[];
  componentType?: string[];
  hint?: string;
  pinyin?: string;
  phonetic?: boolean;
  gloss?: string;
  visualGloss?: string;
  visualMnemonic?: boolean;
  originalCharacter?: string;
  originalGloss?: string;
  originalPinyin?: string;
  originalHint?: string;
  originalType?: string[];
}

export interface OldPronunciation {
  pinyin: string;
  source?: string;
  gloss?: string;
  MC?: string;  // Middle Chinese reconstruction
  OC?: string;  // Old Chinese reconstruction
  dynasty?: string;  // legacy field
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
  groups?: JapaneseReadingMeaningGroup[];
  nanori?: string[];
  // Legacy projection retained for older cached dictionary entries.
  readingGroups?: JapaneseReadingGroup[];
  readings?: JapaneseTypedReading[];
  meanings?: string[];
}

export interface JapaneseReadingMeaningGroup {
  readings: JapaneseTypedReading[];
  meanings: Array<{
    lang?: string;
    value: string;
  }>;
}

export interface JapaneseTypedReading {
  type: string;
  value: string;
}

export interface JapaneseReadingGroup {
  onReadings: string[];
  kunReadings: string[];
}

// ============================================================================
// KOREAN TYPES
// ============================================================================

export interface KoreanReading {
  hangul: string;
  romanization?: string;
}

export interface KoreanCharacter {
  character: string;
  hanjaForm?: string;
  readings: KoreanReading[];
  meanings: string[];
  meaningsEn: string[];
  strokes?: number;
  radical?: string;
}

export interface KoreanDefinition {
  text: string;
  lang?: string;
  sense_number?: number;
  examples?: KoreanExample[];
}

export interface KoreanExample {
  korean: string;
  translation?: string;
}

export interface KoreanWord {
  id: string;
  hangul: string;
  hanja?: string;
  romanization?: string;
  pronunciation?: string;
  pos?: string;
  definitions: KoreanDefinition[];
  examples?: KoreanExample[];
  origin?: 'native' | 'sino_korean' | 'loanword' | 'mixed' | 'unknown';
  frequency_rank?: number;
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
