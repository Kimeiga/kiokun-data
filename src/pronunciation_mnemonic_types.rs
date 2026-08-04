use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PronunciationMnemonicCorpusManifest {
    pub bucket_algorithm: String,
    pub bucket_count: usize,
    pub card_count: usize,
    pub packed_buckets: Vec<PronunciationMnemonicBucketReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PronunciationMnemonicBucketReference {
    pub path: String,
    pub bucket: String,
    pub count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PronunciationMnemonicCard {
    pub character: String,
    pub variants: Vec<String>,
    pub language: String,
    pub review_status: String,
    pub readings: Vec<PronunciationMnemonicReading>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PronunciationMnemonicReading {
    pub reading_type: String,
    pub display_reading: String,
    pub normalized_reading: String,
    pub status: String,
    pub usage_gloss: String,
    pub editorial_reason: String,
    pub strategy: String,
    pub overlay: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tone: Option<u8>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_reading: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sound_cue: Option<MandarinSoundCue>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phonetic_component: Option<PhoneticComponent>,
    pub anchors: Vec<PronunciationAnchorWord>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MandarinSoundCue {
    pub syllable: String,
    pub tone_behavior: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PhoneticComponent {
    pub character: String,
    pub reading: String,
    pub relationship: String,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PronunciationAnchorWord {
    pub word: String,
    pub reading: String,
    pub character_reading: String,
    pub gloss: String,
    pub frequency: PronunciationFrequencyEvidence,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phonological_note: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PronunciationFrequencyEvidence {
    pub source: String,
    pub field: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rank: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usefulness: Option<String>,
}
