// Optimized output types with shortened field names for size reduction
// Field names are mapped back to readable names via field-mappings.ts

use serde::{Deserialize, Serialize};
use crate::word_preview_types::WordPreview;

/// Optimized output structure with shortened field names
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedOutput {
    /// key → k
    #[serde(rename = "k")]
    pub key: String,

    /// redirect → r
    #[serde(rename = "r", skip_serializing_if = "Option::is_none")]
    pub redirect: Option<String>,

    /// chineseWords → cw
    #[serde(rename = "cw", skip_serializing_if = "Vec::is_empty", default)]
    pub chinese_words: Vec<OptimizedChineseWord>,

    /// chineseChar → cc
    #[serde(rename = "cc", skip_serializing_if = "Option::is_none")]
    pub chinese_char: Option<OptimizedChineseChar>,

    /// japaneseWords → jw
    #[serde(rename = "jw", skip_serializing_if = "Vec::is_empty", default)]
    pub japanese_words: Vec<OptimizedJapaneseWord>,

    /// japaneseChar → jc
    #[serde(rename = "jc", skip_serializing_if = "Option::is_none")]
    pub japanese_char: Option<OptimizedJapaneseChar>,

    /// relatedJapaneseWords → rjw
    #[serde(rename = "rjw", skip_serializing_if = "Vec::is_empty", default)]
    pub related_japanese_words: Vec<String>,

    /// contains → ct
    #[serde(rename = "ct", skip_serializing_if = "Vec::is_empty", default)]
    pub contains: Vec<WordPreview>,

    /// containedInChinese → cic
    #[serde(rename = "cic", skip_serializing_if = "Vec::is_empty", default)]
    pub contained_in_chinese: Vec<WordPreview>,

    /// containedInJapanese → cij
    #[serde(rename = "cij", skip_serializing_if = "Vec::is_empty", default)]
    pub contained_in_japanese: Vec<WordPreview>,
}

// ============================================================================
// CHINESE CHARACTER TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedChineseChar {
    /// strokeCount → sc
    #[serde(rename = "sc", skip_serializing_if = "Option::is_none")]
    pub stroke_count: Option<i64>,

    /// pinyinFrequencies → pf
    #[serde(rename = "pf", skip_serializing_if = "Option::is_none")]
    pub pinyin_frequencies: Option<Vec<OptimizedPinyinFrequency>>,

    /// gloss → g
    #[serde(rename = "g", skip_serializing_if = "Option::is_none")]
    pub gloss: Option<String>,

    /// hint → h
    #[serde(rename = "h", skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,

    /// components → comp
    #[serde(rename = "comp", skip_serializing_if = "Option::is_none")]
    pub components: Option<Vec<OptimizedComponent>>,

    /// images → img
    #[serde(rename = "img", skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<OptimizedImage>>,

    /// statistics → stats
    #[serde(rename = "stats", skip_serializing_if = "Option::is_none")]
    pub statistics: Option<OptimizedStatistics>,

    /// variants → var
    #[serde(rename = "var", skip_serializing_if = "Option::is_none")]
    pub variants: Option<Vec<OptimizedVariant>>,

    /// comments → com
    #[serde(rename = "com", skip_serializing_if = "Option::is_none")]
    pub comments: Option<Vec<OptimizedComment>>,

    /// ids → ids (keep as-is, already short)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ids: Option<String>,

    /// idsApparent → idsa
    #[serde(rename = "idsa", skip_serializing_if = "Option::is_none")]
    pub ids_apparent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedPinyinFrequency {
    /// pinyin → py
    #[serde(rename = "py")]
    pub pinyin: String,

    /// count → cnt
    #[serde(rename = "cnt")]
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedComponent {
    /// character → ch
    #[serde(rename = "ch")]
    pub character: String,

    /// componentType → ct (was "type")
    #[serde(rename = "ct")]
    pub component_type: Vec<String>,

    /// hint → h
    #[serde(rename = "h", skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedImage {
    /// path → p (URL base extracted, only path stored)
    #[serde(rename = "p")]
    pub path: String,

    /// source → src
    #[serde(rename = "src", skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,

    /// description → d
    #[serde(rename = "d", skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// type → ty
    #[serde(rename = "ty", skip_serializing_if = "Option::is_none")]
    pub image_type: Option<String>,

    /// era → e
    #[serde(rename = "e", skip_serializing_if = "Option::is_none")]
    pub era: Option<String>,

    /// data → data (keep as-is for makemeahanzi stroke data)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedStatistics {
    /// hskLevel → hsk
    #[serde(rename = "hsk", skip_serializing_if = "Option::is_none")]
    pub hsk_level: Option<i64>,

    /// topWords → tw
    #[serde(rename = "tw", skip_serializing_if = "Option::is_none")]
    pub top_words: Option<Vec<OptimizedTopWord>>,

    /// movieWordCount → mwc
    #[serde(rename = "mwc", skip_serializing_if = "Option::is_none")]
    pub movie_word_count: Option<i64>,

    /// movieWordCountPercent → mwcp
    #[serde(rename = "mwcp", skip_serializing_if = "Option::is_none")]
    pub movie_word_count_percent: Option<f64>,

    /// movieWordRank → mwr
    #[serde(rename = "mwr", skip_serializing_if = "Option::is_none")]
    pub movie_word_rank: Option<i64>,

    /// movieWordContexts → mwx
    #[serde(rename = "mwx", skip_serializing_if = "Option::is_none")]
    pub movie_word_contexts: Option<i64>,

    /// movieWordContextsPercent → mwxp
    #[serde(rename = "mwxp", skip_serializing_if = "Option::is_none")]
    pub movie_word_contexts_percent: Option<f64>,

    /// bookWordCount → bwc
    #[serde(rename = "bwc", skip_serializing_if = "Option::is_none")]
    pub book_word_count: Option<i64>,

    /// bookWordCountPercent → bwcp
    #[serde(rename = "bwcp", skip_serializing_if = "Option::is_none")]
    pub book_word_count_percent: Option<f64>,

    /// bookWordRank → bwr
    #[serde(rename = "bwr", skip_serializing_if = "Option::is_none")]
    pub book_word_rank: Option<i64>,

    /// movieCharCount → mcc
    #[serde(rename = "mcc", skip_serializing_if = "Option::is_none")]
    pub movie_char_count: Option<i64>,

    /// movieCharCountPercent → mccp
    #[serde(rename = "mccp", skip_serializing_if = "Option::is_none")]
    pub movie_char_count_percent: Option<f64>,

    /// movieCharRank → mcr
    #[serde(rename = "mcr", skip_serializing_if = "Option::is_none")]
    pub movie_char_rank: Option<i64>,

    /// movieCharContexts → mcx
    #[serde(rename = "mcx", skip_serializing_if = "Option::is_none")]
    pub movie_char_contexts: Option<i64>,

    /// movieCharContextsPercent → mcxp
    #[serde(rename = "mcxp", skip_serializing_if = "Option::is_none")]
    pub movie_char_contexts_percent: Option<f64>,

    /// bookCharCount → bcc
    #[serde(rename = "bcc", skip_serializing_if = "Option::is_none")]
    pub book_char_count: Option<i64>,

    /// bookCharCountPercent → bccp
    #[serde(rename = "bccp", skip_serializing_if = "Option::is_none")]
    pub book_char_count_percent: Option<f64>,

    /// bookCharRank → bcr
    #[serde(rename = "bcr", skip_serializing_if = "Option::is_none")]
    pub book_char_rank: Option<i64>,

    /// pinyinFrequency → pf
    #[serde(rename = "pf", skip_serializing_if = "Option::is_none")]
    pub pinyin_frequency: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedTopWord {
    /// word → w
    #[serde(rename = "w")]
    pub word: String,

    /// share → sh
    #[serde(rename = "sh")]
    pub share: f64,

    /// trad → tr
    #[serde(rename = "tr")]
    pub trad: String,

    /// gloss → g
    #[serde(rename = "g")]
    pub gloss: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedVariant {
    /// char → ch
    #[serde(rename = "ch", skip_serializing_if = "Option::is_none")]
    pub char: Option<String>,

    /// parts → pts
    #[serde(rename = "pts", skip_serializing_if = "Option::is_none")]
    pub parts: Option<String>,

    /// source → src
    #[serde(rename = "src")]
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedComment {
    /// source → src
    #[serde(rename = "src")]
    pub source: String,

    /// text → txt
    #[serde(rename = "txt")]
    pub text: String,
}

// ============================================================================
// JAPANESE CHARACTER TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedJapaneseChar {
    /// literal → lit
    #[serde(rename = "lit")]
    pub literal: String,

    /// readingMeaning → rm
    #[serde(rename = "rm", skip_serializing_if = "Option::is_none")]
    pub reading_meaning: Option<OptimizedReadingMeaning>,

    /// misc → misc (keep as-is)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub misc: Option<OptimizedMisc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedReadingMeaning {
    /// readings → r
    #[serde(rename = "r")]
    pub readings: Vec<OptimizedReading>,

    /// meanings → m
    #[serde(rename = "m")]
    pub meanings: Vec<String>,

    /// nanori → nan
    #[serde(rename = "nan", skip_serializing_if = "Vec::is_empty", default)]
    pub nanori: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedReading {
    /// type → ty
    #[serde(rename = "ty")]
    pub reading_type: String,

    /// onType → ot
    #[serde(rename = "ot", skip_serializing_if = "Option::is_none")]
    pub on_type: Option<String>,

    /// status → st
    #[serde(rename = "st", skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    /// value → v
    #[serde(rename = "v")]
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedMisc {
    /// grade → gr
    #[serde(rename = "gr", skip_serializing_if = "Option::is_none")]
    pub grade: Option<i64>,

    /// strokeCounts → sc (only first value kept)
    #[serde(rename = "sc")]
    pub stroke_count: i64,

    /// variants → var
    #[serde(rename = "var", skip_serializing_if = "Vec::is_empty", default)]
    pub variants: Vec<serde_json::Value>,

    /// frequency → freq
    #[serde(rename = "freq", skip_serializing_if = "Option::is_none")]
    pub frequency: Option<i64>,

    /// radicalNames → rn
    #[serde(rename = "rn", skip_serializing_if = "Vec::is_empty", default)]
    pub radical_names: Vec<String>,

    /// jlptLevel → jlpt
    #[serde(rename = "jlpt", skip_serializing_if = "Option::is_none")]
    pub jlpt_level: Option<i64>,
}

// ============================================================================
// CHINESE WORD TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedChineseWord {
    /// items → i
    #[serde(rename = "i")]
    pub items: Vec<OptimizedChineseItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedChineseItem {
    /// pinyin → py
    #[serde(rename = "py")]
    pub pinyin: String,

    /// definitions → def
    #[serde(rename = "def")]
    pub definitions: Vec<String>,
}

// ============================================================================
// JAPANESE WORD TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedJapaneseWord {
    /// kanji → k
    #[serde(rename = "k", skip_serializing_if = "Vec::is_empty", default)]
    pub kanji: Vec<OptimizedKanji>,

    /// kana → ka
    #[serde(rename = "ka")]
    pub kana: Vec<OptimizedKana>,

    /// sense → s
    #[serde(rename = "s")]
    pub sense: Vec<OptimizedSense>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedKanji {
    /// common → c
    #[serde(rename = "c")]
    pub common: bool,

    /// text → t
    #[serde(rename = "t")]
    pub text: String,

    /// tags → tag
    #[serde(rename = "tag", skip_serializing_if = "Vec::is_empty", default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedKana {
    /// common → c
    #[serde(rename = "c")]
    pub common: bool,

    /// text → t
    #[serde(rename = "t")]
    pub text: String,

    /// tags → tag
    #[serde(rename = "tag", skip_serializing_if = "Vec::is_empty", default)]
    pub tags: Vec<String>,

    /// appliesToKanji → ak
    #[serde(rename = "ak", skip_serializing_if = "Vec::is_empty", default)]
    pub applies_to_kanji: Vec<String>,

    /// pitchAccents → pa
    #[serde(rename = "pa", skip_serializing_if = "Vec::is_empty", default)]
    pub pitch_accents: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedSense {
    /// partOfSpeech → pos
    #[serde(rename = "pos", skip_serializing_if = "Vec::is_empty", default)]
    pub part_of_speech: Vec<String>,

    /// misc → misc (keep as-is)
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub misc: Vec<String>,

    /// gloss → g
    #[serde(rename = "g")]
    pub gloss: Vec<String>,

    /// related → rel
    #[serde(rename = "rel", skip_serializing_if = "Vec::is_empty", default)]
    pub related: Vec<Vec<String>>,

    /// examples → ex
    #[serde(rename = "ex", skip_serializing_if = "Vec::is_empty", default)]
    pub examples: Vec<OptimizedExample>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedExample {
    /// source → src
    #[serde(rename = "src")]
    pub source: OptimizedExampleSource,

    /// text → t
    #[serde(rename = "t")]
    pub text: String,

    /// sentences → sent
    #[serde(rename = "sent")]
    pub sentences: Vec<OptimizedExampleSentence>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedExampleSource {
    /// type → ty
    #[serde(rename = "ty")]
    pub source_type: String,

    /// value → v
    #[serde(rename = "v")]
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizedExampleSentence {
    /// land → l
    #[serde(rename = "l")]
    pub lang: String,

    /// text → t
    #[serde(rename = "t")]
    pub text: String,
}

