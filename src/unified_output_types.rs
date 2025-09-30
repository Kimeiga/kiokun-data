// Unified output types that combine word and character data
use serde::{Serialize, Deserialize};
use crate::improved_unified_types::ImprovedUnifiedEntry;
use crate::unified_character_types::UnifiedCharacterEntry;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedOutput {
    /// The key (character or word) for this entry
    pub key: String,
    
    /// Word-level data (if this key exists as a word in dictionaries)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word: Option<ImprovedUnifiedEntry>,
    
    /// Character-level data (if this key is a single character)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub character: Option<UnifiedCharacterEntry>,
}

