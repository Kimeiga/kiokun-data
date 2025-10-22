use serde::{Deserialize, Serialize};
use crate::jmnedict_types::JmnedictEntry;
use crate::chinese_types::ChineseDictionaryElement;
use crate::chinese_char_types::ChineseCharacter;
use crate::japanese_types::Word;
use crate::japanese_char_types::KanjiCharacter;
use crate::word_preview_types::WordPreview;

/// Simple output structure with no unification - just raw data from each source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimpleOutput {
    /// The key (character or word) for this entry
    pub key: String,

    /// If this is a redirect entry, this field contains the primary key to redirect to
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redirect: Option<String>,

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

    /// Cross-references to other entries where this character appears in Japanese words
    /// (e.g., 好 would reference 誼 because 好 appears as an alternative kanji form)
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub related_japanese_words: Vec<String>,

    /// Japanese name entries (from JMnedict)
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub japanese_names: Vec<JmnedictEntry>,

    /// Words/characters contained within this word (for multi-character words only)
    /// e.g., for "一把好手", this would include ["一", "把", "好", "手", "一把", "好手", etc.]
    /// Now includes word preview data (word, pronunciation, definition)
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub contains: Vec<WordPreview>,

    /// Chinese words that contain this word/character
    /// Limited to 100 entries, includes preview data
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub contained_in_chinese: Vec<WordPreview>,

    /// Japanese words that contain this word/character
    /// Limited to 100 entries, includes preview data
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub contained_in_japanese: Vec<WordPreview>,
}

