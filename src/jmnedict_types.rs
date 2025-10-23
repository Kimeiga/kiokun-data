use serde::{Deserialize, Serialize};

/// JMnedict (Japanese Names Dictionary) types
/// Contains Japanese personal names, place names, company names, etc.

#[derive(Debug, Serialize, Deserialize)]
pub struct JmnedictRoot {
    pub version: String,
    pub languages: Vec<String>,
    #[serde(rename = "commonOnly")]
    pub common_only: bool,
    #[serde(rename = "dictDate")]
    pub dict_date: String,
    #[serde(rename = "dictRevisions")]
    pub dict_revisions: Vec<String>,
    pub tags: std::collections::HashMap<String, String>,
    pub words: Vec<JmnedictEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JmnedictEntry {
    pub id: String,
    pub kanji: Vec<JmnedictKanji>,
    pub kana: Vec<JmnedictKana>,
    pub translation: Vec<JmnedictTranslation>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JmnedictKanji {
    pub text: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JmnedictKana {
    pub text: String,
    pub tags: Vec<String>,
    #[serde(rename = "appliesToKanji")]
    pub applies_to_kanji: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JmnedictTranslation {
    #[serde(rename = "type")]
    pub name_type: Vec<String>,
    pub related: Vec<String>,
    pub translation: Vec<JmnedictTranslationText>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JmnedictTranslationText {
    pub lang: String,
    pub text: String,
}

/// Optimized output type for JMnedict names (compressed field names)
/// NOTE: This is kept for backwards compatibility but is no longer used.
/// We now use full field names with Deflate compression instead.
#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OptimizedJmnedictName {
    /// id -> i
    #[serde(rename = "i")]
    pub id: String,
    
    /// kanji -> k
    #[serde(rename = "k", skip_serializing_if = "Vec::is_empty")]
    pub kanji: Vec<OptimizedJmnedictKanji>,
    
    /// kana -> n  
    #[serde(rename = "n")]
    pub kana: Vec<OptimizedJmnedictKana>,
    
    /// translation -> t
    #[serde(rename = "t")]
    pub translation: Vec<OptimizedJmnedictTranslation>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OptimizedJmnedictKanji {
    /// text -> t
    #[serde(rename = "t")]
    pub text: String,
    
    /// tags -> g (skip if empty)
    #[serde(rename = "g", skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OptimizedJmnedictKana {
    /// text -> t
    #[serde(rename = "t")]
    pub text: String,
    
    /// tags -> g (skip if empty)
    #[serde(rename = "g", skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    
    /// appliesToKanji -> a (skip if empty or all "*")
    #[serde(rename = "a", skip_serializing_if = "Vec::is_empty")]
    pub applies_to_kanji: Vec<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OptimizedJmnedictTranslation {
    /// type -> y
    #[serde(rename = "y")]
    pub name_type: Vec<String>,
    
    /// related -> r (skip if empty)
    #[serde(rename = "r", skip_serializing_if = "Vec::is_empty")]
    pub related: Vec<String>,
    
    /// translation -> t
    #[serde(rename = "t")]
    pub translation: Vec<OptimizedJmnedictTranslationText>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OptimizedJmnedictTranslationText {
    /// lang -> l (skip if "eng")
    #[serde(rename = "l", skip_serializing_if = "String::is_empty")]
    pub lang: String,
    
    /// text -> t
    #[serde(rename = "t")]
    pub text: String,
}

impl JmnedictEntry {
    /// Convert to optimized format for JSON output
    /// NOTE: This is kept for backwards compatibility but is no longer used.
    #[allow(dead_code)]
    pub fn to_optimized(&self) -> OptimizedJmnedictName {
        OptimizedJmnedictName {
            id: self.id.clone(),
            kanji: self.kanji.iter().map(|k| OptimizedJmnedictKanji {
                text: k.text.clone(),
                tags: k.tags.clone(),
            }).collect(),
            kana: self.kana.iter().map(|k| OptimizedJmnedictKana {
                text: k.text.clone(),
                tags: k.tags.clone(),
                applies_to_kanji: if k.applies_to_kanji.len() == 1 && k.applies_to_kanji[0] == "*" {
                    vec![] // Skip "*" as it's the default
                } else {
                    k.applies_to_kanji.clone()
                },
            }).collect(),
            translation: self.translation.iter().map(|t| OptimizedJmnedictTranslation {
                name_type: t.name_type.clone(),
                related: t.related.clone(),
                translation: t.translation.iter().map(|tt| OptimizedJmnedictTranslationText {
                    lang: if tt.lang == "eng" { String::new() } else { tt.lang.clone() }, // Skip "eng" as default
                    text: tt.text.clone(),
                }).collect(),
            }).collect(),
        }
    }
    
    /// Get all possible keys (kanji and kana) for this name entry
    pub fn get_keys(&self) -> Vec<String> {
        let mut keys = Vec::new();
        
        // Add kanji forms
        for kanji in &self.kanji {
            keys.push(kanji.text.clone());
        }
        
        // Add kana forms
        for kana in &self.kana {
            keys.push(kana.text.clone());
        }
        
        keys
    }
}