use serde::{Deserialize, Serialize};
use crate::chinese_types::ChineseDictionaryElement;
use crate::chinese_char_types::ChineseCharacter;
use crate::japanese_types::Word;
use crate::japanese_char_types::KanjiCharacter;

/// Simple output structure with no unification - just raw data from each source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleOutput {
    /// The key (character or word) for this entry
    pub key: String,
    
    /// Chinese word entries (from CEDICT)
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub chinese_words: Vec<ChineseDictionaryElement>,

    /// Chinese character entry (from Chinese character dictionary)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chinese_char: Option<ChineseCharacter>,

    /// Japanese word entries (from JMdict)
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub japanese_words: Vec<Word>,

    /// Japanese character entry (from KANJIDIC)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub japanese_char: Option<KanjiCharacter>,
}

