use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticMnemonicCorpusManifest {
    pub count: usize,
    pub bucket_algorithm: String,
    pub bucket_count: usize,
    #[serde(default)]
    pub card_buckets: Vec<SemanticMnemonicBucketReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticMnemonicBucketReference {
    pub path: String,
    pub bucket: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticMnemonicCard {
    pub character: String,
    pub meaning: String,

    /// Attested standalone sense(s), when the learning keyword is deliberately
    /// a visual or historical image rather than a dictionary definition.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lexical_gloss: Option<String>,

    /// Explicit learning keyword used by the equation and dependent cards.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mnemonic_keyword: Option<String>,

    /// Why the mnemonic keyword differs from the lexical gloss.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub keyword_kind: Option<String>,

    pub equation: String,
    pub mnemonic: String,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub components: Vec<SemanticMnemonicComponent>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub visual_components: Vec<SemanticMnemonicComponent>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub component_source: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub historical_components: Vec<SemanticMnemonicComponent>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub historical_component_source: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alias_of: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alias_kind: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alias_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticMnemonicComponent {
    pub character: String,
    pub gloss: String,
}
