use serde::{Serialize, Deserialize};
use crate::chinese_types::ChineseDictionaryElement;
use crate::japanese_types::Word;

/// Combined dictionary entry that merges Chinese and Japanese data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinedEntry {
    /// The word key (traditional Chinese form)
    pub word: String,
    
    /// Primary Chinese entry (first one encountered)
    pub chinese_entry: Option<ChineseDictionaryElement>,
    
    /// Additional Chinese entries for the same word
    pub chinese_specific_entries: Vec<ChineseDictionaryElement>,
    
    /// Primary Japanese entry (first one encountered)
    pub japanese_entry: Option<Word>,
    
    /// Additional Japanese entries for the same word
    pub japanese_specific_entries: Vec<Word>,
    
    /// Metadata about the combination
    pub metadata: CombinedMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinedMetadata {
    /// Total number of Chinese entries for this word
    pub chinese_count: usize,
    
    /// Total number of Japanese entries for this word
    pub japanese_count: usize,
    
    /// Whether this entry has both Chinese and Japanese data
    pub is_unified: bool,
    
    /// Source of the word key (which dictionary provided the key)
    pub key_source: KeySource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KeySource {
    Chinese,
    Japanese,
}

/// Statistics about the dictionary merging process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeStatistics {
    /// Total Chinese entries processed
    pub total_chinese_entries: usize,
    
    /// Total Japanese words processed
    pub total_japanese_words: usize,
    
    /// Number of unified entries (have both Chinese and Japanese data)
    pub unified_entries: usize,
    
    /// Number of Chinese-only entries
    pub chinese_only_entries: usize,
    
    /// Number of Japanese-only entries
    pub japanese_only_entries: usize,
    
    /// Total entries in combined dictionary
    pub total_combined_entries: usize,
    
    /// Examples of unified entries for manual inspection
    pub sample_unified_entries: Vec<String>,
}

/// The final combined dictionary output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinedDictionary {
    /// All combined entries
    pub entries: Vec<CombinedEntry>,
    
    /// Statistics about the merge process
    pub statistics: MergeStatistics,
    
    /// Metadata about the dictionaries used
    pub metadata: DictionaryMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictionaryMetadata {
    /// Chinese dictionary info
    pub chinese_source: String,
    
    /// Japanese dictionary info
    pub japanese_source: String,
    
    /// When this combined dictionary was created
    pub created_at: String,
    
    /// Version of the merger tool
    pub merger_version: String,
}
