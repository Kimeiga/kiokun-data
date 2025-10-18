use serde::{Deserialize, Serialize};

/// Compact word preview for "Appears In" and "Contains" sections
/// Contains just enough data to display a word card without fetching the full entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordPreview {
    /// The word text (simplified Chinese or Japanese kanji/kana)
    #[serde(rename = "w")]
    pub word: String,
    
    /// Pronunciation (pinyin for Chinese, kana for Japanese)
    #[serde(rename = "p", skip_serializing_if = "Option::is_none")]
    pub pronunciation: Option<String>,
    
    /// First definition (short English gloss)
    #[serde(rename = "d", skip_serializing_if = "Option::is_none")]
    pub definition: Option<String>,
}

impl WordPreview {
    /// Create a preview from a Chinese dictionary element
    pub fn from_chinese(word: &crate::chinese_types::ChineseDictionaryElement) -> Self {
        let pronunciation = word.items.first()
            .and_then(|item| item.pinyin.clone());
        
        let definition = word.items.first()
            .and_then(|item| item.definitions.as_ref())
            .and_then(|defs| defs.first())
            .cloned();
        
        WordPreview {
            word: word.simp.clone(),
            pronunciation,
            definition,
        }
    }
    
    /// Create a preview from a Japanese word
    pub fn from_japanese(word: &crate::japanese_types::Word) -> Self {
        // Get the first kanji or kana as the word text
        let word_text = word.kanji.first()
            .map(|k| k.text.clone())
            .or_else(|| word.kana.first().map(|k| k.text.clone()))
            .unwrap_or_default();
        
        // Get the first kana as pronunciation
        let pronunciation = word.kana.first()
            .map(|k| k.text.clone());
        
        // Get the first gloss as definition
        let definition = word.sense.first()
            .and_then(|s| s.gloss.first())
            .map(|g| g.text.clone());
        
        WordPreview {
            word: word_text,
            pronunciation,
            definition,
        }
    }
}

