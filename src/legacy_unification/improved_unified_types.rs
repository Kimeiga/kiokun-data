#![allow(dead_code)]

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
    pub chinese_pinyin: Vec<String>,  // Simplified: just the pinyin strings, deduplicated
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

/// Cleaned pinyin-to-definitions mapping (no source, no duplicates)
#[allow(dead_code)]
pub type PinyinDefinitionsMap = std::collections::HashMap<String, Vec<String>>;

/// Enhanced unified data structure with semantic clustering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticUnifiedData {
    pub representations: CharacterRepresentations,
    pub unified_meanings: Vec<UnifiedMeaning>,
    pub chinese_only_meanings: Vec<LanguageSpecificMeaning>,
    pub japanese_only_meanings: Vec<LanguageSpecificMeaning>,
    pub statistics: UnifiedStatistics,
    pub examples: Vec<Example>,
    pub linguistic_info: LinguisticInfo,
}

/// A unified meaning that combines semantically related Chinese and Japanese definitions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedMeaning {
    pub semantic_id: String,
    pub unified_explanation: String,
    pub semantic_category: SemanticCategory,
    pub chinese_aspect: Option<LanguageAspect>,
    pub japanese_aspect: Option<LanguageAspect>,
    pub cross_linguistic_note: Option<String>,
    pub confidence: f64,
    pub is_primary: bool,
}

/// Language-specific aspect of a unified meaning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageAspect {
    pub readings: Vec<String>,
    pub specific_function: String,
    pub examples: Vec<String>,
    pub frequency_level: FrequencyLevel,
}

/// Meaning that exists only in one language
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageSpecificMeaning {
    pub reading: String,
    pub definition: String,
    pub examples: Vec<String>,
    pub frequency_level: FrequencyLevel,
    pub semantic_category: SemanticCategory,
}

/// Semantic categories for grouping related meanings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SemanticCategory {
    GrammaticalModifier,    // possessive, adjectival suffixes
    TargetGoal,            // target, mark, objective
    Transportation,        // taxi, vehicle-related
    Intensifier,          // really, truly, very
    EmptinessVoid,        // empty, hollow, vacant
    ConflictOpposition,   // enemy, rival, conflict
    Comparison,           // compare, ratio, proportion
    Harmony,              // peace, harmony, calm
    General,              // catch-all for unclear cases
}

/// Frequency levels for prioritization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FrequencyLevel {
    VeryHigh,  // HSK 1-2, JLPT N5-N4
    High,      // HSK 3-4, JLPT N3
    Medium,    // HSK 5-6, JLPT N2
    Low,       // Above HSK 6, JLPT N1
    Rare,      // Specialized or archaic
}

/// Learner-focused structure for characters with multiple readings in both languages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearnerFocusedEntry {
    pub character: String,
    pub is_multi_reading_overlap: bool,
    pub chinese_section: Option<LanguageSection>,
    pub japanese_section: Option<LanguageSection>,
    pub cross_linguistic_insights: Vec<CrossLinguisticInsight>,
    pub complexity_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageSection {
    pub primary_meaning: PrimaryMeaning,
    pub secondary_meanings: Vec<SecondaryMeaning>,
    pub total_readings: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrimaryMeaning {
    pub reading: String,
    pub definition: String,
    pub examples: Vec<String>,
    pub frequency_level: String,
    pub proficiency_level: Option<String>, // HSK 1, JLPT N4, etc.
    pub semantic_category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecondaryMeaning {
    pub reading: String,
    pub definition: String,
    pub frequency_level: String,
    pub semantic_category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossLinguisticInsight {
    pub insight_type: InsightType,
    pub description: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InsightType {
    ExactSemanticMatch,    // Chinese dì + Japanese まと (both "target")
    FunctionalSimilarity,  // Chinese de + Japanese てき (both modify nouns)
    LanguageSpecific,      // Chinese dī (taxi) - no Japanese equivalent
    EtymologicalConnection, // Shared historical meaning
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
