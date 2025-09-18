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
    /// Character representations from primary entries
    pub representations: CharacterRepresentations,
    
    /// Pronunciations from primary entries
    pub pronunciations: Pronunciations,
    
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

// Re-export types from unified_types.rs
pub use crate::unified_types::{
    CharacterRepresentations, Pronunciations, ChineseMetadata,
    LinguisticInfo, UnifiedStatistics, Example, UnifiedMetadata,
    ChineseDefinition, JapaneseDefinition, ChineseStats,
    KanjiVariant, KanaVariant, JapaneseReading, PinyinReading,
    ExampleSource, LanguageSource, TopWord
};
