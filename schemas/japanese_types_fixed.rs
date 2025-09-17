// Example code that deserializes and serializes the model.
// extern crate serde;
// #[macro_use]
// extern crate serde_derive;
// extern crate serde_json;
//
// use generated_module::JapaneseEntry;
//
// fn main() {
//     let json = r#"{"answer": 42}"#;
//     let model: JapaneseEntry = serde_json::from_str(&json).unwrap();
// }

use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JapaneseEntry {
    version: String,

    languages: Vec<String>,

    common_only: bool,

    dict_date: String,

    dict_revisions: Vec<String>,

    tags: HashMap<String, String>,

    words: Vec<Word>,
}

#[derive(Serialize, Deserialize)]
pub struct Word {
    id: String,

    kanji: Vec<Kan>,

    kana: Vec<Kan>,

    sense: Vec<Sense>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Kan {
    common: bool,

    text: String,

    tags: Vec<String>,

    applies_to_kanji: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sense {
    part_of_speech: Vec<String>,

    applies_to_kanji: Vec<String>,

    applies_to_kana: Vec<String>,

    related: Vec<Vec<Antonym>>,

    antonym: Vec<Vec<Antonym>>,

    field: Vec<String>,

    dialect: Vec<String>,

    misc: Vec<String>,

    info: Vec<String>,

    language_source: Vec<LanguageSource>,

    gloss: Vec<Gloss>,

    examples: Vec<Example>,
}

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
pub enum Antonym {
    Integer(i64),

    String(String),
}

#[derive(Serialize, Deserialize)]
pub struct Example {
    source: Source,

    text: String,

    sentences: Vec<Sentence>,
}

#[derive(Serialize, Deserialize)]
pub struct Sentence {
    land: String,

    text: String,
}

#[derive(Serialize, Deserialize)]
pub struct Source {
    #[serde(rename = "type")]
    source_type: String,

    value: String,
}

#[derive(Serialize, Deserialize)]
pub struct Gloss {
    lang: String,

    gender: Option<serde_json::Value>,

    #[serde(rename = "type")]
    gloss_type: Option<String>,

    text: String,
}

#[derive(Serialize, Deserialize)]
pub struct LanguageSource {
    lang: String,

    full: bool,

    wasei: bool,

    text: Option<String>,
}
