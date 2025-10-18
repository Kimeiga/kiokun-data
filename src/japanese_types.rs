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

// Pitch accent data structures
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PitchAccentDatabase {
    pub build_info: PitchAccentBuildInfo,
    pub entries: HashMap<String, Vec<PitchAccentEntry>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PitchAccentBuildInfo {
    pub timestamp_utc: String,
    pub sources: Vec<String>,
    pub kanjium_commit: String,
    pub notes: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PitchAccentEntry {
    pub kanji: String,
    pub reading: String,
    pub accents: Vec<u8>,
}

// Minimal pitch accent representation for output
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct PitchAccent {
    pub reading: String,
    pub accents: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JapaneseEntry {
    pub version: String,
    pub languages: Vec<Lan>,
    pub common_only: bool,
    pub dict_date: String,
    pub dict_revisions: Vec<String>,
    pub tags: HashMap<String, String>,
    pub words: Vec<Word>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Lan {
    Eng,
    Jpn,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Word {
    pub id: String,
    pub kanji: Vec<Kan>,
    pub kana: Vec<Kan>,
    pub sense: Vec<Sense>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Kan {
    pub common: bool,
    pub text: String,
    pub tags: Vec<Tag>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub applies_to_kanji: Option<Vec<String>>,
    // Pitch accent data - minimal representation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pitch_accents: Option<Vec<u8>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Tag {
    Ateji,
    Gikun,
    #[serde(rename = "iK")]
    IK,
    Ik,
    Io,
    #[serde(rename = "oK")]
    OK,
    Ok,
    #[serde(rename = "rK")]
    RK,
    Rk,
    #[serde(rename = "sK")]
    SK,
    Sk,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sense {
    pub part_of_speech: Vec<PartOfSpeech>,
    pub applies_to_kanji: Vec<String>,
    pub applies_to_kana: Vec<String>,
    pub related: Vec<Vec<Antonym>>,
    pub antonym: Vec<Vec<Antonym>>,
    pub field: Vec<Field>,
    pub dialect: Vec<Dialect>,
    pub misc: Vec<Misc>,
    pub info: Vec<String>,
    pub language_source: Vec<LanguageSource>,
    pub gloss: Vec<Gloss>,
    pub examples: Vec<Example>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Antonym {
    Integer(i64),
    String(String),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Dialect {
    Bra,
    Hob,
    Ksb,
    Ktb,
    Kyb,
    Kyu,
    Nab,
    Osb,
    Rkb,
    Thb,
    Tsb,
    Tsug,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Example {
    pub source: Source,
    pub text: String,
    pub sentences: Vec<Sentence>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Sentence {
    pub land: Lan,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Source {
    #[serde(rename = "type")]
    pub source_type: SourceType,
    pub value: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceType {
    Tatoeba,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Field {
    Agric,
    Anat,
    Archeol,
    Archit,
    Art,
    Astron,
    Audvid,
    Aviat,
    Baseb,
    Biochem,
    Biol,
    Bot,
    Boxing,
    #[serde(rename = "Buddh")]
    Buddh,
    Bus,
    Cards,
    Chem,
    Chmyth,
    #[serde(rename = "Christn")]
    Christn,
    Civeng,
    Cloth,
    Comp,
    Cryst,
    Dent,
    Ecol,
    Econ,
    Elec,
    Electr,
    Embryo,
    Engr,
    Ent,
    Figskt,
    Film,
    Finc,
    Fish,
    Food,
    Gardn,
    Genet,
    Geogr,
    Geol,
    Geom,
    Go,
    Golf,
    Gramm,
    Grmyth,
    Hanaf,
    Horse,
    Internet,
    Jpmyth,
    Kabuki,
    Law,
    Ling,
    Logic,
    #[serde(rename = "MA")]
    Ma,
    Mahj,
    Manga,
    Math,
    Mech,
    Med,
    Met,
    Mil,
    Min,
    Mining,
    Motor,
    Music,
    Noh,
    Ornith,
    Paleo,
    Pathol,
    Pharm,
    Phil,
    Photo,
    Physics,
    Physiol,
    Politics,
    Print,
    Prowres,
    Psy,
    Psyanal,
    Psych,
    Rail,
    Rommyth,
    #[serde(rename = "Shinto")]
    Shinto,
    Shogi,
    Ski,
    Sports,
    Stat,
    Stockm,
    Sumo,
    Surg,
    Telec,
    Tradem,
    Tv,
    Vet,
    Vidg,
    Zool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Gloss {
    pub lang: Lan,
    pub gender: Option<String>,
    #[serde(rename = "type")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gloss_type: Option<GlossType>,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GlossType {
    Explanation,
    Figurative,
    Literal,
    Trademark,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LanguageSource {
    pub lang: Lang,
    pub full: bool,
    pub wasei: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Lang {
    Afr,
    Ain,
    Alg,
    Amh,
    Ara,
    Arn,
    Bnt,
    Bre,
    Bul,
    Bur,
    Chi,
    Chn,
    Cze,
    Dan,
    Dut,
    Eng,
    Epo,
    Est,
    Fil,
    Fin,
    Fre,
    Geo,
    Ger,
    Glg,
    Grc,
    Gre,
    Haw,
    Heb,
    Hin,
    Hun,
    Ice,
    Ind,
    Ita,
    Khm,
    Kor,
    Kur,
    Lat,
    Lit,
    Mal,
    Mao,
    May,
    Mnc,
    Mol,
    Mon,
    Nor,
    Per,
    Pol,
    Por,
    Rum,
    Rus,
    San,
    Scr,
    Slo,
    Slv,
    Som,
    Spa,
    Swa,
    Swe,
    Tah,
    Tam,
    Tgl,
    Tha,
    Tib,
    Tur,
    Ukr,
    Urd,
    Uzb,
    Vie,
    Yid,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Misc {
    Abbr,
    Arch,
    Char,
    Chn,
    Col,
    Company,
    Creat,
    Dated,
    Dei,
    Derog,
    Doc,
    Euph,
    Ev,
    Fam,
    Fem,
    Fict,
    Form,
    Given,
    Group,
    Hist,
    Hon,
    Hum,
    Id,
    Joc,
    Leg,
    #[serde(rename = "m-sl")]
    MSl,
    Male,
    Myth,
    #[serde(rename = "net-sl")]
    NetSl,
    Obj,
    Obs,
    #[serde(rename = "on-mim")]
    OnMim,
    Organization,
    Person,
    Place,
    Poet,
    Pol,
    Product,
    Proverb,
    Quote,
    Rare,
    Sens,
    Serv,
    Ship,
    Sl,
    Surname,
    Uk,
    Unclass,
    Vulg,
    Work,
    Yoji,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PartOfSpeech {
    #[serde(rename = "adj-f")]
    AdjF,
    #[serde(rename = "adj-i")]
    AdjI,
    #[serde(rename = "adj-ix")]
    AdjIx,
    #[serde(rename = "adj-ku")]
    AdjKu,
    #[serde(rename = "adj-na")]
    AdjNa,
    #[serde(rename = "adj-nari")]
    AdjNari,
    #[serde(rename = "adj-no")]
    AdjNo,
    #[serde(rename = "adj-pn")]
    AdjPn,
    #[serde(rename = "adj-shiku")]
    AdjShiku,
    #[serde(rename = "adj-t")]
    AdjT,
    #[serde(rename = "adv")]
    Adv,
    #[serde(rename = "adv-to")]
    AdvTo,
    #[serde(rename = "aux")]
    Aux,
    #[serde(rename = "aux-adj")]
    AuxAdj,
    #[serde(rename = "aux-v")]
    AuxV,
    #[serde(rename = "conj")]
    Conj,
    #[serde(rename = "cop")]
    Cop,
    #[serde(rename = "ctr")]
    Ctr,
    #[serde(rename = "exp")]
    Exp,
    #[serde(rename = "int")]
    Int,
    #[serde(rename = "n")]
    N,
    #[serde(rename = "n-pref")]
    NPref,
    #[serde(rename = "n-suf")]
    NSuf,
    #[serde(rename = "num")]
    Num,
    #[serde(rename = "pn")]
    Pn,
    #[serde(rename = "pref")]
    Pref,
    #[serde(rename = "prt")]
    Prt,
    #[serde(rename = "suf")]
    Suf,
    #[serde(rename = "unc")]
    Unc,
    #[serde(rename = "v1")]
    V1,
    #[serde(rename = "v1-s")]
    V1S,
    #[serde(rename = "v2a-s")]
    V2AS,
    #[serde(rename = "v2b-k")]
    V2BK,
    #[serde(rename = "v2d-s")]
    V2DS,
    #[serde(rename = "v2g-k")]
    V2GK,
    #[serde(rename = "v2g-s")]
    V2GS,
    #[serde(rename = "v2h-k")]
    V2HK,
    #[serde(rename = "v2h-s")]
    V2HS,
    #[serde(rename = "v2k-k")]
    V2KK,
    #[serde(rename = "v2k-s")]
    V2KS,
    #[serde(rename = "v2m-s")]
    V2MS,
    #[serde(rename = "v2n-s")]
    V2NS,
    #[serde(rename = "v2r-k")]
    V2RK,
    #[serde(rename = "v2r-s")]
    V2RS,
    #[serde(rename = "v2s-s")]
    V2SS,
    #[serde(rename = "v2t-k")]
    V2TK,
    #[serde(rename = "v2t-s")]
    V2TS,
    #[serde(rename = "v2w-s")]
    V2WS,
    #[serde(rename = "v2y-k")]
    V2YK,
    #[serde(rename = "v2y-s")]
    V2YS,
    #[serde(rename = "v2z-s")]
    V2ZS,
    #[serde(rename = "v4b")]
    V4B,
    #[serde(rename = "v4g")]
    V4G,
    #[serde(rename = "v4h")]
    V4H,
    #[serde(rename = "v4k")]
    V4K,
    #[serde(rename = "v4m")]
    V4M,
    #[serde(rename = "v4r")]
    V4R,
    #[serde(rename = "v4s")]
    V4S,
    #[serde(rename = "v4t")]
    V4T,
    #[serde(rename = "v5aru")]
    V5Aru,
    #[serde(rename = "v5b")]
    V5B,
    #[serde(rename = "v5g")]
    V5G,
    #[serde(rename = "v5k")]
    V5K,
    #[serde(rename = "v5k-s")]
    V5KS,
    #[serde(rename = "v5m")]
    V5M,
    #[serde(rename = "v5n")]
    V5N,
    #[serde(rename = "v5r")]
    V5R,
    #[serde(rename = "v5r-i")]
    V5RI,
    #[serde(rename = "v5s")]
    V5S,
    #[serde(rename = "v5t")]
    V5T,
    #[serde(rename = "v5u")]
    V5U,
    #[serde(rename = "v5u-s")]
    V5US,
    #[serde(rename = "vi")]
    Vi,
    #[serde(rename = "vk")]
    Vk,
    #[serde(rename = "vn")]
    Vn,
    #[serde(rename = "vr")]
    Vr,
    #[serde(rename = "vs")]
    Vs,
    #[serde(rename = "vs-c")]
    VsC,
    #[serde(rename = "vs-i")]
    VsI,
    #[serde(rename = "vs-s")]
    VsS,
    #[serde(rename = "vt")]
    Vt,
    #[serde(rename = "vz")]
    Vz,
}
