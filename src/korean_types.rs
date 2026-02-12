// Korean dictionary types for KRDICT and other sources
use serde::{Deserialize, Serialize};

/// Main Korean word entry (from KRDICT or similar sources)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KoreanWord {
    /// Unique identifier for the word
    pub id: String,
    
    /// The word in Hangul (Korean script)
    pub hangul: String,
    
    /// Hanja (Chinese characters) representation, if available
    /// Many Sino-Korean words have hanja equivalents
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hanja: Option<String>,
    
    /// Romanization of the word (e.g., Revised Romanization)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub romanization: Option<String>,
    
    /// IPA pronunciation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pronunciation: Option<String>,
    
    /// Part of speech
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pos: Option<String>,
    
    /// English definitions
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub definitions: Vec<KoreanDefinition>,
    
    /// Example sentences
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub examples: Vec<KoreanExample>,
    
    /// Word origin (native Korean, Sino-Korean, loanword)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<WordOrigin>,
    
    /// Frequency rank (if available)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency_rank: Option<u32>,
}

/// Definition for a Korean word
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct KoreanDefinition {
    /// The definition text
    pub text: String,
    
    /// Language of the definition (e.g., "en" for English, "ko" for Korean monolingual)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
    
    /// Sense number or identifier
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sense_number: Option<u32>,
}

/// Example sentence for a Korean word
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct KoreanExample {
    /// Korean text
    pub korean: String,
    
    /// Translation (typically English)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub translation: Option<String>,
}

/// Word origin classification
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WordOrigin {
    /// Native Korean (순우리말)
    Native,
    /// Sino-Korean (한자어) - words derived from Chinese characters
    SinoKorean,
    /// Loanword (외래어) - from English, Japanese, etc.
    Loanword,
    /// Mixed origin
    Mixed,
    /// Unknown origin
    Unknown,
}

/// Korean character entry (Hanja information with Korean readings)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KoreanCharacter {
    /// The Hanja character (Chinese character)
    pub character: String,
    
    /// Korean reading(s) in Hangul
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub readings: Vec<KoreanReading>,
    
    /// Meaning(s) in Korean
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub meanings: Vec<String>,
    
    /// English meaning(s)
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub meanings_en: Vec<String>,
    
    /// Stroke count
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strokes: Option<u32>,
    
    /// Radical information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub radical: Option<String>,
}

/// Korean reading for a Hanja character
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct KoreanReading {
    /// Hangul reading (e.g., "학" for 學)
    pub hangul: String,
    
    /// Romanization
    #[serde(skip_serializing_if = "Option::is_none")]
    pub romanization: Option<String>,
    
    /// Type of reading (音 sound reading, 訓 meaning reading)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reading_type: Option<String>,
}

/// Container for Korean dictionary data
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KoreanDictionary {
    pub words: Vec<KoreanWord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
}

