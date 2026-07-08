use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticMnemonicArtifact {
    #[serde(default)]
    pub mnemonics: Vec<SemanticMnemonicCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticMnemonicCard {
    pub character: String,
    pub meaning: String,
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
