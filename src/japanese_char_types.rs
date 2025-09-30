// Japanese character dictionary types (KANJIDIC2)
// Generated from kanjidic2-en-3.6.1.json

use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KanjiDictionary {
    pub version: String,
    pub languages: Vec<String>,
    pub dict_date: String,
    pub file_version: i64,
    pub database_version: String,
    pub characters: Vec<KanjiCharacter>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KanjiCharacter {
    pub literal: String,
    pub codepoints: Vec<Codepoint>,
    pub radicals: Vec<Radical>,
    pub misc: Misc,
    pub dictionary_references: Vec<DictionaryReference>,
    pub query_codes: Vec<QueryCode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reading_meaning: Option<ReadingMeaning>,

    // IDS decomposition data (added from CHISE IDS database)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ids: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ids_apparent: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Codepoint {
    #[serde(rename = "type")]
    pub codepoint_type: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DictionaryReference {
    #[serde(rename = "type")]
    pub dictionary_reference_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub morohashi: Option<Morohashi>,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Morohashi {
    pub volume: i64,
    pub page: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Misc {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grade: Option<i64>,
    pub stroke_counts: Vec<i64>,
    pub variants: Vec<Codepoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency: Option<i64>,
    pub radical_names: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jlpt_level: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryCode {
    #[serde(rename = "type")]
    pub query_code_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skip_misclassification: Option<String>,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Radical {
    #[serde(rename = "type")]
    pub radical_type: String,
    pub value: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReadingMeaning {
    pub groups: Vec<ReadingMeaningGroup>,
    pub nanori: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReadingMeaningGroup {
    pub readings: Vec<Reading>,
    pub meanings: Vec<Meaning>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Meaning {
    pub lang: String,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reading {
    #[serde(rename = "type")]
    pub reading_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    pub value: String,
}

