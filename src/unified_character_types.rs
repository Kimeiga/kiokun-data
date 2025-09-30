use serde::{Serialize, Deserialize};

/// Unified character entry combining KANJIDIC2 and Chinese character dictionary data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedCharacterEntry {
    /// The character itself
    pub character: String,
    
    /// Unicode codepoint (e.g., "U+4E00")
    pub codepoint: String,
    
    /// Character representations and readings
    pub representations: CharacterRepresentations,
    
    /// IDS decomposition data (from CHISE IDS)
    pub decomposition: Option<CharacterDecomposition>,
    
    /// Meanings/definitions
    pub meanings: CharacterMeanings,
    
    /// Linguistic information
    pub linguistic_info: CharacterLinguisticInfo,
    
    /// Visual/structural information
    pub visual_info: CharacterVisualInfo,
    
    /// Statistical data
    pub statistics: Option<CharacterStatistics>,
    
    /// Source information
    pub sources: CharacterSources,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterRepresentations {
    /// Chinese readings
    pub chinese: Option<ChineseReadings>,
    
    /// Japanese readings
    pub japanese: Option<JapaneseReadings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChineseReadings {
    /// Pinyin readings (from Chinese dictionary)
    pub pinyin: Vec<String>,
    
    /// Traditional form (if different from main character)
    pub traditional: Option<String>,
    
    /// Simplified form (if different from main character)
    pub simplified: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JapaneseReadings {
    /// On'yomi readings (Chinese-derived readings)
    pub onyomi: Vec<String>,
    
    /// Kun'yomi readings (native Japanese readings)
    pub kunyomi: Vec<String>,
    
    /// Nanori readings (name readings)
    pub nanori: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterDecomposition {
    /// IDS (Ideographic Description Sequence)
    pub ids: String,
    
    /// Alternative apparent structure
    pub ids_apparent: Option<String>,
    
    /// Parsed components (if available)
    pub components: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterMeanings {
    /// English meanings from KANJIDIC2
    pub english: Vec<String>,
    
    /// Chinese gloss/meaning
    pub chinese_gloss: Option<String>,
    
    /// Shuowen Jiezi explanation (classical Chinese etymology)
    pub shuowen: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterLinguisticInfo {
    /// Radical information
    pub radicals: Vec<RadicalInfo>,
    
    /// Grade level (Japanese school grade)
    pub grade: Option<i64>,
    
    /// JLPT level (Japanese Language Proficiency Test)
    pub jlpt: Option<i64>,
    
    /// Frequency ranking
    pub frequency: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadicalInfo {
    /// Radical type (e.g., "classical", "nelson_c")
    pub radical_type: String,
    
    /// Radical value/number
    pub value: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterVisualInfo {
    /// Stroke count
    pub stroke_count: i64,
    
    /// Historical images (oracle bone, bronze, seal script, etc.)
    pub images: Vec<HistoricalImage>,
    
    /// Character variants
    pub variants: Vec<CharacterVariant>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricalImage {
    pub source: String,
    pub url: Option<String>,
    pub description: Option<String>,
    pub image_type: Option<String>,
    pub era: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterVariant {
    pub variant_type: String,  // e.g., "traditional", "simplified", "semantic"
    pub character: Option<String>,
    pub parts: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterStatistics {
    /// Chinese character statistics
    pub chinese: Option<ChineseCharStats>,
    
    /// Japanese character statistics  
    pub japanese: Option<JapaneseCharStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChineseCharStats {
    pub hsk_level: Option<i64>,
    pub frequency_rank: Option<i64>,
    pub general_standard_num: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JapaneseCharStats {
    pub frequency: Option<i64>,
    pub grade: Option<i64>,
    pub jlpt: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterSources {
    /// Present in KANJIDIC2
    pub in_kanjidic: bool,
    
    /// Present in Chinese character dictionary
    pub in_chinese_dict: bool,
    
    /// Source IDs
    pub kanjidic_id: Option<String>,
    pub chinese_dict_id: Option<String>,
    
    /// Dictionary reference codes
    pub dictionary_references: Vec<DictionaryReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DictionaryReference {
    pub reference_type: String,
    pub value: String,
    pub morohashi: Option<MorohashiReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MorohashiReference {
    pub volume: i64,
    pub page: i64,
}

/// Metadata about the character unification process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterUnificationMetadata {
    pub unified_at: String,
    pub mapping_used: bool,
    pub mapping_source: Option<String>,
    pub confidence: f32,
}

