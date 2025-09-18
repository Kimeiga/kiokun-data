use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Unified dictionary entry combining Chinese and Japanese data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedEntry {
    /// Primary word (Traditional Chinese as canonical form)
    pub word: String,
    
    /// All character representations
    pub representations: CharacterRepresentations,
    
    /// All pronunciation data
    pub pronunciations: Pronunciations,

    /// Additional Chinese metadata
    pub chinese_metadata: Option<ChineseMetadata>,
    
    /// Combined definitions and meanings
    pub definitions: Definitions,
    
    /// Grammatical and linguistic information
    pub linguistic_info: LinguisticInfo,
    
    /// Usage statistics and frequency data
    pub statistics: UnifiedStatistics,
    
    /// Examples and usage
    pub examples: Vec<Example>,
    
    /// Source metadata
    pub metadata: UnifiedMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterRepresentations {
    /// Traditional Chinese characters
    pub traditional: String,
    /// Simplified Chinese characters  
    pub simplified: String,
    /// Japanese kanji representations
    pub japanese_kanji: Vec<KanjiVariant>,
    /// Japanese kana representations
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
    /// Chinese pinyin readings
    pub pinyin: Vec<PinyinReading>,
    /// Japanese readings
    pub japanese: Vec<JapaneseReading>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinyinReading {
    pub reading: String,
    pub source: String, // "cedict", "unicode", etc.
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JapaneseReading {
    pub reading: String,
    pub reading_type: ReadingType, // on'yomi, kun'yomi, etc.
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
pub struct Definitions {
    /// Chinese definitions (from CC-CEDICT)
    pub chinese: Vec<ChineseDefinition>,
    /// Japanese definitions (from JMDict)
    pub japanese: Vec<JapaneseDefinition>,
    /// Unified/deduplicated definitions (future)
    pub unified: Option<Vec<UnifiedDefinition>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChineseDefinition {
    pub text: String,
    pub source: String,
    /// Additional context like measure words
    pub context: Option<String>,
    /// Pinyin for this specific definition
    pub pinyin: Option<String>,
    /// Whether this applies to simplified, traditional, or both
    pub simp_trad: Option<String>,
    /// Tang dynasty pronunciation if available
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
    /// Which Japanese entry this definition comes from
    pub source_entry_id: Option<String>,
    /// Which sense group within the entry this belongs to
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
pub struct UnifiedDefinition {
    pub text: String,
    pub confidence: f32, // How confident we are in the unification
    pub sources: Vec<String>, // Which original definitions this came from
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinguisticInfo {
    /// Parts of speech from Japanese
    pub parts_of_speech: Vec<String>,
    /// Grammatical fields
    pub fields: Vec<String>,
    /// Usage notes
    pub usage_notes: Vec<String>,
    /// Related words
    pub related_words: Vec<String>,
    /// Antonyms
    pub antonyms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedStatistics {
    /// Chinese frequency data
    pub chinese: Option<ChineseStats>,
    /// Japanese frequency data  
    pub japanese: Option<JapaneseStats>,
    /// Combined frequency score
    pub combined_frequency_score: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChineseStats {
    pub hsk_level: Option<i32>,
    pub movie_word_count: Option<i32>,
    pub movie_word_count_percent: Option<f64>,
    pub movie_word_rank: Option<i32>,
    pub movie_word_contexts: Option<i32>,
    pub movie_word_contexts_percent: Option<f64>,
    pub book_word_count: Option<i32>,
    pub book_word_count_percent: Option<f64>,
    pub book_word_rank: Option<i32>,
    pub movie_char_count: Option<i32>,
    pub movie_char_count_percent: Option<f64>,
    pub movie_char_rank: Option<i32>,
    pub movie_char_contexts: Option<i32>,
    pub movie_char_contexts_percent: Option<f64>,
    pub book_char_count: Option<i32>,
    pub book_char_count_percent: Option<f64>,
    pub book_char_rank: Option<i32>,
    pub pinyin_frequency: Option<i32>,
    pub top_words: Option<Vec<TopWord>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopWord {
    pub word: String,
    pub share: f64,
    pub trad: String,
    pub gloss: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JapaneseStats {
    pub common: bool,
    pub jlpt_level: Option<i32>, // If we had this data
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Example {
    pub source_language: String, // "chinese", "japanese"
    pub text: String,
    pub translation: Option<String>,
    pub source: ExampleSource,
    /// Which Japanese entry this example comes from
    pub source_entry_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExampleSource {
    pub source_type: String, // "tatoeba", "cedict", etc.
    pub id: Option<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChineseMetadata {
    /// Short gloss/summary
    pub gloss: Option<String>,
    /// Alternative pinyin search representations
    pub pinyin_search_string: String,
}
