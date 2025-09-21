use serde::{Serialize, Deserialize};

/// Improved unified dictionary entry that preserves entry distinctions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImprovedUnifiedEntry {
    pub word: String,
    
    /// Primary unified data (from first Chinese + first Japanese entries)
    pub unified: UnifiedData,
    
    /// Additional Chinese entries beyond the first one
    pub chinese_specific_entries: Vec<ChineseSpecificEntry>,
    
    /// Additional Japanese entries beyond the first one  
    pub japanese_specific_entries: Vec<JapaneseSpecificEntry>,
    
    /// Metadata about the unification process
    pub metadata: UnifiedMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedData {
    /// Character representations from primary entries (includes pinyin)
    pub representations: CharacterRepresentations,

    /// Chinese metadata from primary entry
    pub chinese_metadata: Option<ChineseMetadata>,

    /// Unified definitions from primary entries only
    pub definitions: Vec<UnifiedDefinition>,

    /// Combined linguistic information
    pub linguistic_info: LinguisticInfo,

    /// Combined statistical data
    pub statistics: UnifiedStatistics,

    /// Examples from primary entries
    pub examples: Vec<Example>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChineseSpecificEntry {
    pub source_id: String,
    pub traditional: String,
    pub simplified: String,
    pub definitions: Vec<UnifiedDefinition>,  // Use unified definitions for consistency
    pub metadata: Option<ChineseMetadata>,
    pub statistics: Option<ChineseStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JapaneseSpecificEntry {
    pub source_id: String,
    pub kanji: Vec<KanjiVariant>,
    pub kana: Vec<KanaVariant>,
    pub definitions: Vec<UnifiedDefinition>,  // Use unified definitions for consistency
    pub examples: Vec<Example>,
    pub linguistic_info: LinguisticInfo,
}

/// Unified definition that can represent both Chinese and Japanese definitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedDefinition {
    /// The definition text
    pub text: String,

    /// Source language ("chinese", "japanese", "unified")
    pub source_language: String,

    /// Confidence score for unified definitions (0.0-1.0)
    pub confidence: Option<f32>,

    /// Original source entry IDs that contributed to this definition
    pub source_entry_ids: Vec<String>,

    /// Chinese-specific fields (optional)
    pub chinese_fields: Option<ChineseDefinitionFields>,

    /// Japanese-specific fields (optional)
    pub japanese_fields: Option<JapaneseDefinitionFields>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChineseDefinitionFields {
    pub source: String,
    pub context: Option<String>,
    pub pinyin: Option<String>,
    pub simp_trad: Option<String>,
    pub tang: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JapaneseDefinitionFields {
    pub part_of_speech: Vec<String>,
    pub field: Vec<String>,
    pub misc: Vec<String>,
    pub info: Vec<String>,
    pub applies_to_kanji: Vec<String>,
    pub applies_to_kana: Vec<String>,
    pub dialect: Vec<String>,
    pub language_source: Vec<LanguageSource>,
    pub gender: Option<String>,
    pub gloss_type: Option<String>,
    pub sense_group_index: Option<usize>,
}

/// Updated Definitions structure with unified definitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImprovedDefinitions {
    /// Chinese definitions (from CC-CEDICT)
    pub chinese: Vec<ChineseDefinition>,
    /// Japanese definitions (from JMDict)
    pub japanese: Vec<JapaneseDefinition>,
    /// Unified/deduplicated definitions
    pub unified: Vec<UnifiedDefinition>,
}

// Types moved from the old unified_types.rs
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterRepresentations {
    pub traditional: String,
    pub simplified: String,
    pub chinese_pinyin: Vec<PinyinReading>,
    pub japanese_kanji: Vec<KanjiVariant>,
    pub japanese_kana: Vec<KanaVariant>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanjiVariant {
    pub text: String,
    pub common: bool,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanaVariant {
    pub text: String,
    pub common: bool,
    pub tags: Vec<String>,
    pub applies_to_kanji: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pronunciations {
    pub pinyin: Vec<PinyinReading>,
    pub japanese: Vec<JapaneseReading>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinyinReading {
    pub reading: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JapaneseReading {
    pub reading: String,
    pub reading_type: ReadingType,
    pub common: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReadingType {
    #[serde(rename = "hiragana")]
    Hiragana,
    #[serde(rename = "katakana")]
    Katakana,
    #[serde(rename = "mixed")]
    Mixed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChineseMetadata {
    pub gloss: String,
    pub pinyin_search_string: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChineseDefinition {
    pub text: String,
    pub source: String,
    pub context: Option<String>,
    pub pinyin: Option<String>,
    pub simp_trad: Option<String>,
    pub tang: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JapaneseDefinition {
    pub text: String,
    pub part_of_speech: Vec<String>,
    pub field: Vec<String>,
    pub misc: Vec<String>,
    pub info: Vec<String>,
    pub applies_to_kanji: Vec<String>,
    pub applies_to_kana: Vec<String>,
    pub dialect: Vec<String>,
    pub language_source: Vec<LanguageSource>,
    pub gender: Option<String>,
    pub gloss_type: Option<String>,
    pub source_entry_id: Option<String>,
    pub sense_group_index: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageSource {
    pub lang: String,
    pub full: Option<bool>,
    pub wasei: Option<bool>,
    pub text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinguisticInfo {
    pub parts_of_speech: Vec<String>,
    pub fields: Vec<String>,
    pub usage_notes: Vec<String>,
    pub related_words: Vec<String>,
    pub antonyms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedStatistics {
    pub chinese: Option<ChineseStats>,
    pub japanese: Option<JapaneseStats>,
    pub combined_frequency_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChineseStats {
    pub hsk_level: Option<u8>,
    pub movie_word_count: Option<u32>,
    pub movie_word_count_percent: Option<f64>,
    pub movie_word_rank: Option<u32>,
    pub movie_word_contexts: Option<u32>,
    pub movie_word_contexts_percent: Option<f64>,
    pub book_word_count: Option<u32>,
    pub book_word_count_percent: Option<f64>,
    pub book_word_rank: Option<u32>,
    pub movie_char_count: Option<u32>,
    pub movie_char_count_percent: Option<f64>,
    pub movie_char_rank: Option<u32>,
    pub movie_char_contexts: Option<u32>,
    pub movie_char_contexts_percent: Option<f64>,
    pub book_char_count: Option<u32>,
    pub book_char_count_percent: Option<f64>,
    pub book_char_rank: Option<u32>,
    pub pinyin_frequency: Option<HashMap<String, u32>>,
    pub top_words: Option<Vec<TopWord>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JapaneseStats {
    pub common: bool,
    pub jlpt_level: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopWord {
    pub word: String,
    pub share: f64,
    pub trad: String,
    pub gloss: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Example {
    pub source_language: String,
    pub text: String,
    pub translation: String,
    pub source: ExampleSource,
    pub source_entry_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExampleSource {
    pub source_type: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedMetadata {
    pub created_at: String,
    pub merger_version: String,
    pub chinese_source_id: Option<String>,
    pub japanese_source_ids: Vec<String>,
    pub unification_confidence: f32,
    pub has_multiple_japanese_entries: bool,
}
