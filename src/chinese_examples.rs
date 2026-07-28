use crate::chinese_types::{ChineseDefinitionExamples, ChineseDictionaryElement, ChineseExample};
use crate::pinyin::normalize_pinyin;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::Path;

const MAX_EXAMPLES_PER_DEFINITION: usize = 4;
const MIN_MATCH_SCORE: f64 = 0.82;
const MIN_MATCH_MARGIN: f64 = 0.12;

#[derive(Debug, Clone, Deserialize)]
struct KaikkiEntry {
    word: String,
    #[serde(default)]
    forms: Vec<KaikkiForm>,
    #[serde(default)]
    sounds: Vec<KaikkiSound>,
    #[serde(default)]
    senses: Vec<KaikkiSense>,
}

#[derive(Debug, Clone, Deserialize)]
struct KaikkiForm {
    form: String,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct KaikkiSound {
    zh_pron: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct KaikkiSense {
    id: Option<String>,
    #[serde(default)]
    glosses: Vec<String>,
    #[serde(default)]
    raw_glosses: Vec<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    examples: Vec<KaikkiExample>,
}

#[derive(Debug, Clone, Deserialize)]
struct KaikkiExample {
    text: Option<String>,
    english: Option<String>,
    translation: Option<String>,
    roman: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    raw_tags: Vec<String>,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
struct Target {
    entry_index: usize,
    item_index: usize,
    definition_index: usize,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
struct AlignmentKey {
    entry_id: String,
    pinyin: String,
    definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChineseExampleAlignment {
    entry_id: String,
    pinyin: String,
    definition: String,
    examples: Vec<ChineseExample>,
}

#[derive(Debug, Default)]
pub struct BuildStats {
    pub source_entries: usize,
    pub source_senses_with_examples: usize,
    pub matched_senses: usize,
    pub matched_definitions: usize,
    pub examples: usize,
}

pub fn build_kaikki_alignment_file(
    chinese_entries: &[ChineseDictionaryElement],
    kaikki_path: &Path,
    output_path: &Path,
) -> Result<BuildStats> {
    let form_index = build_form_index(chinese_entries);
    let input = File::open(kaikki_path)
        .with_context(|| format!("Failed to open Kaikki data at {}", kaikki_path.display()))?;
    let reader = BufReader::with_capacity(1024 * 1024, input);
    let mut alignments: HashMap<AlignmentKey, Vec<ChineseExample>> = HashMap::new();
    let mut stats = BuildStats::default();

    for (line_index, line) in reader.lines().enumerate() {
        let line =
            line.with_context(|| format!("Failed reading Kaikki line {}", line_index + 1))?;
        if line.trim().is_empty() {
            continue;
        }

        let entry: KaikkiEntry = match serde_json::from_str(&line) {
            Ok(entry) => entry,
            Err(error) => {
                eprintln!(
                    "Warning: failed to parse Kaikki line {}: {}",
                    line_index + 1,
                    error
                );
                continue;
            }
        };
        stats.source_entries += 1;

        let eligible_targets = eligible_targets_for_entry(&entry, chinese_entries, &form_index);
        if eligible_targets.is_empty() {
            continue;
        }

        for sense in &entry.senses {
            if sense.examples.is_empty() || sense_is_non_mandarin(sense) {
                continue;
            }
            stats.source_senses_with_examples += 1;

            let paired_examples = pair_examples(sense);
            if paired_examples.is_empty() {
                continue;
            }

            let glosses = source_glosses(sense);
            if glosses.is_empty() {
                continue;
            }

            let Some((target, confidence)) =
                choose_definition(&glosses, &eligible_targets, chinese_entries)
            else {
                continue;
            };

            let entry = &chinese_entries[target.entry_index];
            let item = &entry.items[target.item_index];
            let definition = item
                .definitions
                .as_ref()
                .and_then(|definitions| definitions.get(target.definition_index))
                .expect("definition target should remain valid")
                .clone();
            let source_sense_id = sense.id.clone().unwrap_or_else(|| {
                format!(
                    "kaikki:{}:{}",
                    entry.id,
                    stable_text_hash(&glosses.join("\u{0}"))
                )
            });
            let source_gloss = glosses.join("; ");

            let key = AlignmentKey {
                entry_id: entry.id.clone(),
                pinyin: item.pinyin.clone().unwrap_or_default(),
                definition,
            };
            let destination = alignments.entry(key).or_default();
            for mut example in paired_examples.clone() {
                example.source_sense_id = source_sense_id.clone();
                example.source_gloss = source_gloss.clone();
                example.match_confidence = confidence;
                if !destination
                    .iter()
                    .any(|existing| same_example(existing, &example))
                {
                    destination.push(example);
                }
            }
            stats.matched_senses += 1;
        }

        if stats.source_entries % 25_000 == 0 {
            println!(
                "  Scanned {} Kaikki entries; matched {} senses...",
                stats.source_entries, stats.matched_senses
            );
        }
    }

    let mut records: Vec<ChineseExampleAlignment> = alignments
        .into_iter()
        .map(|(key, mut examples)| {
            examples.sort_by(example_sort_order);
            examples.truncate(MAX_EXAMPLES_PER_DEFINITION);
            ChineseExampleAlignment {
                entry_id: key.entry_id,
                pinyin: key.pinyin,
                definition: key.definition,
                examples,
            }
        })
        .collect();
    records.sort_by(|left, right| {
        (
            &left.entry_id,
            normalize_reading(&left.pinyin),
            &left.definition,
        )
            .cmp(&(
                &right.entry_id,
                normalize_reading(&right.pinyin),
                &right.definition,
            ))
    });

    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let output = File::create(output_path)
        .with_context(|| format!("Failed to create {}", output_path.display()))?;
    let mut writer = BufWriter::new(output);
    for record in &records {
        serde_json::to_writer(&mut writer, record)?;
        writer.write_all(b"\n")?;
    }
    writer.flush()?;

    stats.matched_definitions = records.len();
    stats.examples = records.iter().map(|record| record.examples.len()).sum();
    Ok(stats)
}

pub fn attach_definition_examples(
    chinese_entries: &mut [ChineseDictionaryElement],
    alignment_path: &Path,
) -> Result<(usize, usize)> {
    let mut entry_index = HashMap::new();
    for (index, entry) in chinese_entries.iter().enumerate() {
        entry_index.insert(entry.id.clone(), index);
    }

    let input = File::open(alignment_path).with_context(|| {
        format!(
            "Failed to open Chinese example alignments at {}",
            alignment_path.display()
        )
    })?;
    let reader = BufReader::new(input);
    let mut attached_definitions = 0;
    let mut attached_examples = 0;

    for (line_index, line) in reader.lines().enumerate() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let alignment: ChineseExampleAlignment =
            serde_json::from_str(&line).with_context(|| {
                format!(
                    "Failed to parse Chinese example alignment line {}",
                    line_index + 1
                )
            })?;
        let Some(&entry_position) = entry_index.get(&alignment.entry_id) else {
            continue;
        };
        let entry = &mut chinese_entries[entry_position];
        let normalized_pinyin = normalize_reading(&alignment.pinyin);

        let Some(item) = entry.items.iter_mut().find(|item| {
            normalize_reading(item.pinyin.as_deref().unwrap_or_default()) == normalized_pinyin
                && item
                    .definitions
                    .as_ref()
                    .is_some_and(|definitions| definitions.contains(&alignment.definition))
        }) else {
            continue;
        };

        if let Some(existing) = item
            .definition_examples
            .iter_mut()
            .find(|record| record.definition == alignment.definition)
        {
            for example in alignment.examples {
                if !existing
                    .examples
                    .iter()
                    .any(|candidate| same_example(candidate, &example))
                {
                    existing.examples.push(example);
                    attached_examples += 1;
                }
            }
            existing.examples.sort_by(example_sort_order);
            existing.examples.truncate(MAX_EXAMPLES_PER_DEFINITION);
        } else {
            attached_examples += alignment.examples.len();
            item.definition_examples.push(ChineseDefinitionExamples {
                definition: alignment.definition,
                examples: alignment.examples,
            });
            attached_definitions += 1;
        }
    }

    for entry in chinese_entries {
        for item in &mut entry.items {
            item.definition_examples.sort_by_key(|record| {
                definition_position(item.definitions.as_ref(), &record.definition)
            });
        }
    }

    Ok((attached_definitions, attached_examples))
}

fn build_form_index(entries: &[ChineseDictionaryElement]) -> HashMap<String, Vec<(usize, usize)>> {
    let mut index: HashMap<String, Vec<(usize, usize)>> = HashMap::new();
    for (entry_index, entry) in entries.iter().enumerate() {
        for (item_index, item) in entry.items.iter().enumerate() {
            if !matches!(
                item.source.as_ref(),
                Some(crate::chinese_types::Source::Cedict)
            ) {
                continue;
            }
            if item.definitions.as_ref().is_none_or(Vec::is_empty) {
                continue;
            }
            for form in [&entry.simp, &entry.trad] {
                let target = (entry_index, item_index);
                let targets = index.entry(form.clone()).or_default();
                if !targets.contains(&target) {
                    targets.push(target);
                }
            }
        }
    }
    index
}

fn eligible_targets_for_entry(
    source: &KaikkiEntry,
    entries: &[ChineseDictionaryElement],
    form_index: &HashMap<String, Vec<(usize, usize)>>,
) -> Vec<Target> {
    let mut forms = HashSet::new();
    forms.insert(source.word.clone());
    for form in &source.forms {
        if form.tags.iter().any(|tag| {
            matches!(
                tag.as_str(),
                "Simplified-Chinese" | "Traditional-Chinese" | "alternative"
            )
        }) {
            forms.insert(form.form.clone());
        }
    }

    let source_readings = mandarin_readings(source);
    let mut item_targets = HashSet::new();
    for form in forms {
        if let Some(targets) = form_index.get(&form) {
            item_targets.extend(targets.iter().copied());
        }
    }

    if !source_readings.is_empty() {
        item_targets.retain(|(entry_index, item_index)| {
            let reading = entries[*entry_index].items[*item_index]
                .pinyin
                .as_deref()
                .unwrap_or_default();
            source_readings.contains(&normalize_reading(reading))
        });
    } else {
        let readings: HashSet<String> = item_targets
            .iter()
            .map(|(entry_index, item_index)| {
                normalize_reading(
                    entries[*entry_index].items[*item_index]
                        .pinyin
                        .as_deref()
                        .unwrap_or_default(),
                )
            })
            .collect();
        if readings.len() > 1 {
            return Vec::new();
        }
    }

    let mut definitions = Vec::new();
    for (entry_index, item_index) in item_targets {
        if let Some(item_definitions) = &entries[entry_index].items[item_index].definitions {
            for (definition_index, definition) in item_definitions.iter().enumerate() {
                if !is_metadata_definition(definition) {
                    definitions.push(Target {
                        entry_index,
                        item_index,
                        definition_index,
                    });
                }
            }
        }
    }
    definitions.sort_by_key(|target| {
        (
            target.entry_index,
            target.item_index,
            target.definition_index,
        )
    });
    definitions.dedup();
    definitions
}

fn mandarin_readings(entry: &KaikkiEntry) -> HashSet<String> {
    entry
        .sounds
        .iter()
        .filter(|sound| {
            sound.tags.iter().any(|tag| tag == "Mandarin")
                && sound.tags.iter().any(|tag| tag == "Pinyin")
                && !sound.tags.iter().any(|tag| {
                    matches!(tag.as_str(), "Cantonese" | "Tongyong-Pinyin" | "Wade-Giles")
                })
        })
        .filter_map(|sound| sound.zh_pron.as_deref())
        .map(|reading| {
            let primary = reading.split(['(', '/']).next().unwrap_or(reading);
            normalize_reading(primary)
        })
        .filter(|reading| !reading.is_empty())
        .collect()
}

fn normalize_reading(reading: &str) -> String {
    normalize_pinyin(reading)
        .chars()
        .filter(|character| character.is_ascii_alphabetic())
        .collect()
}

fn source_glosses(sense: &KaikkiSense) -> Vec<String> {
    let source = if sense.glosses.is_empty() {
        &sense.raw_glosses
    } else {
        &sense.glosses
    };
    let mut glosses = Vec::new();
    for gloss in source {
        for clause in gloss.split([';', '/']) {
            let clause = clause.trim();
            if !clause.is_empty() && !glosses.iter().any(|existing| existing == clause) {
                glosses.push(clause.to_string());
            }
        }
    }
    glosses
}

fn sense_is_non_mandarin(sense: &KaikkiSense) -> bool {
    let explicitly_mandarin = sense.tags.iter().any(|tag| tag == "Mandarin");
    sense.tags.iter().any(|tag| {
        is_non_mandarin_tag(tag)
            || matches!(
                tag.as_str(),
                "obsolete"
                    | "archaic"
                    | "historical"
                    | "literary"
                    | "Classical"
                    | "Classical-Chinese"
            )
            || (!explicitly_mandarin && matches!(tag.as_str(), "dialectal" | "Jin"))
    })
}

fn choose_definition(
    glosses: &[String],
    targets: &[Target],
    entries: &[ChineseDictionaryElement],
) -> Option<(Target, f64)> {
    if targets.is_empty() {
        return None;
    }
    if targets.len() == 1 {
        let target = &targets[0];
        let definition = entries[target.entry_index].items[target.item_index]
            .definitions
            .as_ref()
            .and_then(|definitions| definitions.get(target.definition_index))
            .expect("definition target should remain valid");
        let score = glosses
            .iter()
            .map(|gloss| definition_match_score(gloss, definition))
            .fold(0.0, f64::max);
        return (score >= 0.55).then(|| (target.clone(), score));
    }

    let mut scored: Vec<(Target, f64)> = targets
        .iter()
        .map(|target| {
            let definition = entries[target.entry_index].items[target.item_index]
                .definitions
                .as_ref()
                .and_then(|definitions| definitions.get(target.definition_index))
                .expect("definition target should remain valid");
            let score = glosses
                .iter()
                .map(|gloss| definition_match_score(gloss, definition))
                .fold(0.0, f64::max);
            (target.clone(), score)
        })
        .collect();
    scored.sort_by(|left, right| {
        right
            .1
            .partial_cmp(&left.1)
            .unwrap_or(Ordering::Equal)
            .then_with(|| {
                (
                    left.0.entry_index,
                    left.0.item_index,
                    left.0.definition_index,
                )
                    .cmp(&(
                        right.0.entry_index,
                        right.0.item_index,
                        right.0.definition_index,
                    ))
            })
    });

    let best = &scored[0];
    let runner_up = scored.get(1).map(|candidate| candidate.1).unwrap_or(0.0);
    if best.1 >= MIN_MATCH_SCORE && best.1 - runner_up >= MIN_MATCH_MARGIN {
        Some((best.0.clone(), best.1))
    } else {
        None
    }
}

fn definition_match_score(source: &str, target: &str) -> f64 {
    let source = normalize_definition(source);
    let target = normalize_definition(target);
    if source.is_empty() || target.is_empty() {
        return 0.0;
    }
    if source == target {
        return 1.0;
    }
    if (source.contains(&target) || target.contains(&source)) && source.len().min(target.len()) >= 4
    {
        return 0.94;
    }

    let source_tokens: HashSet<&str> = source.split_whitespace().collect();
    let target_tokens: HashSet<&str> = target.split_whitespace().collect();
    let overlap = source_tokens.intersection(&target_tokens).count() as f64;
    if overlap == 0.0 {
        return 0.0;
    }
    let precision = overlap / source_tokens.len() as f64;
    let recall = overlap / target_tokens.len() as f64;
    let token_f1 = 2.0 * precision * recall / (precision + recall);
    let bigram_dice = character_bigram_dice(&source, &target);
    0.75 * token_f1 + 0.25 * bigram_dice
}

fn normalize_definition(value: &str) -> String {
    let mut normalized = String::with_capacity(value.len());
    let mut parenthesis_depth = 0usize;
    for character in value.to_lowercase().chars() {
        match character {
            '(' | '[' => parenthesis_depth += 1,
            ')' | ']' => parenthesis_depth = parenthesis_depth.saturating_sub(1),
            _ if parenthesis_depth > 0 => {}
            '\'' | '’' => {}
            character if character.is_ascii_alphanumeric() => normalized.push(character),
            _ => normalized.push(' '),
        }
    }

    let stop_words = [
        "a",
        "an",
        "the",
        "to",
        "of",
        "for",
        "one",
        "ones",
        "someone",
        "something",
    ];
    normalized
        .split_whitespace()
        .filter(|token| !stop_words.contains(token))
        .map(simple_stem)
        .collect::<Vec<_>>()
        .join(" ")
}

fn simple_stem(token: &str) -> &str {
    if token.len() > 5 {
        if let Some(stem) = token.strip_suffix("ing") {
            return stem;
        }
        if let Some(stem) = token.strip_suffix("ed") {
            return stem;
        }
    }
    if token.len() > 4 {
        if let Some(stem) = token.strip_suffix('s') {
            return stem;
        }
    }
    token
}

fn character_bigram_dice(left: &str, right: &str) -> f64 {
    let left_bigrams = bigrams(left);
    let right_bigrams = bigrams(right);
    if left_bigrams.is_empty() || right_bigrams.is_empty() {
        return 0.0;
    }
    let overlap = left_bigrams.intersection(&right_bigrams).count() as f64;
    2.0 * overlap / (left_bigrams.len() + right_bigrams.len()) as f64
}

fn bigrams(value: &str) -> HashSet<(char, char)> {
    let characters: Vec<char> = value
        .chars()
        .filter(|character| !character.is_whitespace())
        .collect();
    characters
        .windows(2)
        .map(|window| (window[0], window[1]))
        .collect()
}

fn is_metadata_definition(definition: &str) -> bool {
    let normalized = definition.trim().to_lowercase();
    normalized.starts_with("cl:")
        || normalized.starts_with("classifier for")
        || normalized.starts_with("see also")
}

fn pair_examples(sense: &KaikkiSense) -> Vec<ChineseExample> {
    #[derive(Default)]
    struct PairedExample {
        simp: Option<String>,
        trad: Option<String>,
        en: String,
        pinyin: Option<String>,
    }

    let mut paired: HashMap<String, PairedExample> = HashMap::new();
    let source_sense_id = sense.id.clone().unwrap_or_default();
    for example in &sense.examples {
        if example_is_non_mandarin(example) {
            continue;
        }
        let Some(text) = example
            .text
            .as_deref()
            .map(str::trim)
            .filter(|text| !text.is_empty())
        else {
            continue;
        };
        if text.chars().count() > 160 || contains_non_mandarin_label(text) {
            continue;
        }
        if !text.chars().any(crate::is_han_character) {
            continue;
        }
        let Some(english) = example
            .english
            .as_deref()
            .or(example.translation.as_deref())
            .map(str::trim)
            .filter(|translation| !translation.is_empty())
        else {
            continue;
        };
        if contains_non_mandarin_label(english) {
            continue;
        }
        let roman = example
            .roman
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if roman.is_some_and(romanization_is_non_mandarin) {
            continue;
        }
        let key = format!(
            "{}\u{0}{}",
            english.to_lowercase(),
            roman.unwrap_or_default().to_lowercase()
        );
        let destination = paired.entry(key).or_insert_with(|| PairedExample {
            en: english.to_string(),
            pinyin: roman.map(ToString::to_string),
            ..PairedExample::default()
        });

        if example.tags.iter().any(|tag| tag == "Simplified-Chinese") {
            destination.simp = Some(text.to_string());
        } else if example.tags.iter().any(|tag| tag == "Traditional-Chinese") {
            destination.trad = Some(text.to_string());
        } else {
            destination.simp.get_or_insert_with(|| text.to_string());
            destination.trad.get_or_insert_with(|| text.to_string());
        }
    }

    let mut examples: Vec<ChineseExample> = paired
        .into_values()
        .map(|example| {
            let simp = example
                .simp
                .clone()
                .or_else(|| example.trad.clone())
                .unwrap_or_default();
            let trad = example.trad.unwrap_or_else(|| simp.clone());
            ChineseExample {
                simp,
                trad,
                en: example.en,
                pinyin: example.pinyin,
                source: "wiktionary".to_string(),
                source_sense_id: source_sense_id.clone(),
                source_gloss: String::new(),
                match_confidence: 0.0,
            }
        })
        .filter(|example| !example.simp.is_empty())
        .collect();
    examples.sort_by(example_sort_order);
    examples.truncate(MAX_EXAMPLES_PER_DEFINITION);
    examples
}

fn example_is_non_mandarin(example: &KaikkiExample) -> bool {
    example
        .tags
        .iter()
        .chain(&example.raw_tags)
        .any(|tag| is_non_mandarin_tag(tag) || contains_non_mandarin_label(tag))
}

fn is_non_mandarin_tag(tag: &str) -> bool {
    matches!(
        tag,
        "Cantonese"
            | "Coastal-Min"
            | "Eastern"
            | "Gan"
            | "Hainanese"
            | "Hakka"
            | "Hokkien"
            | "Leizhou-Min"
            | "Min"
            | "Min-Nan"
            | "Northern-Min"
            | "Peng'im"
            | "POJ"
            | "Puxian-Min"
            | "Southern"
            | "Taishanese"
            | "Tai-lo"
            | "Taiwanese-Hokkien"
            | "Teochew"
            | "Wu"
            | "Wugniu"
            | "Xiang"
            | "Zhangzhou-Hokkien"
    )
}

fn contains_non_mandarin_label(value: &str) -> bool {
    let value = value.to_lowercase();
    [
        "[cantonese",
        "[hakka",
        "[hokkien",
        "[jyutping",
        "[literary cantonese",
        "[min nan",
        "[min-nan",
        "[peng'im",
        "[poj",
        "[tai-lo",
        "[teochew",
        "[wugniu",
    ]
    .iter()
    .any(|marker| value.contains(marker))
}

fn romanization_is_non_mandarin(value: &str) -> bool {
    const PINYIN_LETTERS: &str = "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüêńňǹḿĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛÜÊŃŇǸḾ";
    const PINYIN_COMBINING_MARKS: &str = "\u{300}\u{301}\u{304}\u{308}\u{30c}";
    const ALLOWED_TYPOGRAPHY: &str = "，。！？；：“”‘’—…·〈〉《》「」『』（）【】、";

    contains_non_mandarin_label(value)
        || value.chars().any(|character| {
            !character.is_ascii()
                && !PINYIN_LETTERS.contains(character)
                && !PINYIN_COMBINING_MARKS.contains(character)
                && !ALLOWED_TYPOGRAPHY.contains(character)
        })
}

fn example_sort_order(left: &ChineseExample, right: &ChineseExample) -> Ordering {
    (
        left.simp.chars().count(),
        left.en.chars().count(),
        &left.simp,
        &left.en,
    )
        .cmp(&(
            right.simp.chars().count(),
            right.en.chars().count(),
            &right.simp,
            &right.en,
        ))
}

fn same_example(left: &ChineseExample, right: &ChineseExample) -> bool {
    left.simp == right.simp && left.trad == right.trad && left.en == right.en
}

fn definition_position(definitions: Option<&Vec<String>>, definition: &str) -> usize {
    definitions
        .and_then(|definitions| {
            definitions
                .iter()
                .position(|candidate| candidate == definition)
        })
        .unwrap_or(usize::MAX)
}

fn stable_text_hash(value: &str) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chinese_types::{Item, Source};

    fn dictionary_entry(definitions: Vec<&str>) -> ChineseDictionaryElement {
        ChineseDictionaryElement {
            id: "cedict-test".to_string(),
            simp: "远景".to_string(),
            trad: "遠景".to_string(),
            items: vec![Item {
                source: Some(Source::Cedict),
                pinyin: Some("yuǎn\u{200b}jǐng".to_string()),
                jyutping: None,
                simp_trad: None,
                definitions: Some(definitions.into_iter().map(ToString::to_string).collect()),
                definition_examples: Vec::new(),
                tang: None,
                variant_refs: None,
            }],
            gloss: None,
            pinyin_search_string: "yuǎnjǐng yuan3jing3 yuanjing".to_string(),
            jyutping_search_string: None,
            statistics: None,
        }
    }

    #[test]
    fn matches_simplified_form_and_normalized_pinyin() {
        let entries = vec![dictionary_entry(vec!["prospect", "long-range view"])];
        let index = build_form_index(&entries);
        let source = KaikkiEntry {
            word: "遠景".to_string(),
            forms: vec![KaikkiForm {
                form: "远景".to_string(),
                tags: vec!["Simplified-Chinese".to_string()],
            }],
            sounds: vec![KaikkiSound {
                zh_pron: Some("yuǎnjǐng".to_string()),
                tags: vec![
                    "Mandarin".to_string(),
                    "Standard-Chinese".to_string(),
                    "Pinyin".to_string(),
                ],
            }],
            senses: Vec::new(),
        };

        let targets = eligible_targets_for_entry(&source, &entries, &index);
        assert_eq!(targets.len(), 2);
    }

    #[test]
    fn exact_gloss_wins_over_other_senses() {
        let entries = vec![dictionary_entry(vec!["prospect", "long-range view"])];
        let targets = vec![
            Target {
                entry_index: 0,
                item_index: 0,
                definition_index: 0,
            },
            Target {
                entry_index: 0,
                item_index: 0,
                definition_index: 1,
            },
        ];

        let (target, score) =
            choose_definition(&["long-range view".to_string()], &targets, &entries).unwrap();
        assert_eq!(target.definition_index, 1);
        assert_eq!(score, 1.0);
    }

    #[test]
    fn ambiguous_overlap_is_rejected() {
        let entries = vec![dictionary_entry(vec!["distant view", "long-range view"])];
        let targets = vec![
            Target {
                entry_index: 0,
                item_index: 0,
                definition_index: 0,
            },
            Target {
                entry_index: 0,
                item_index: 0,
                definition_index: 1,
            },
        ];

        assert!(choose_definition(&["view".to_string()], &targets, &entries).is_none());
    }

    #[test]
    fn single_definition_still_requires_semantic_evidence() {
        let entries = vec![dictionary_entry(vec!["jade ornament"])];
        let targets = vec![Target {
            entry_index: 0,
            item_index: 0,
            definition_index: 0,
        }];

        assert!(
            choose_definition(&["used in personal names".to_string()], &targets, &entries)
                .is_none()
        );
    }

    #[test]
    fn simplified_and_traditional_examples_are_paired() {
        let sense = KaikkiSense {
            id: Some("sense-1".to_string()),
            glosses: vec!["distant view".to_string()],
            raw_glosses: Vec::new(),
            tags: Vec::new(),
            examples: vec![
                KaikkiExample {
                    text: Some("从阳台上可以看到远景。".to_string()),
                    english: Some("The balcony has a distant view.".to_string()),
                    translation: None,
                    roman: Some("Cóng yángtái shàng kěyǐ kàndào yuǎnjǐng.".to_string()),
                    tags: vec!["Simplified-Chinese".to_string()],
                    raw_tags: Vec::new(),
                },
                KaikkiExample {
                    text: Some("從陽台上可以看到遠景。".to_string()),
                    english: Some("The balcony has a distant view.".to_string()),
                    translation: None,
                    roman: Some("Cóng yángtái shàng kěyǐ kàndào yuǎnjǐng.".to_string()),
                    tags: vec!["Traditional-Chinese".to_string()],
                    raw_tags: Vec::new(),
                },
            ],
        };

        let examples = pair_examples(&sense);
        assert_eq!(examples.len(), 1);
        assert_eq!(examples[0].simp, "从阳台上可以看到远景。");
        assert_eq!(examples[0].trad, "從陽台上可以看到遠景。");
    }

    #[test]
    fn dialect_examples_are_not_mixed_into_mandarin_senses() {
        let sense = KaikkiSense {
            id: Some("sense-1".to_string()),
            glosses: vec!["to claim".to_string()],
            raw_glosses: Vec::new(),
            tags: Vec::new(),
            examples: vec![KaikkiExample {
                text: Some("個銀包冇人認領。".to_string()),
                english: Some("No one has claimed the wallet.".to_string()),
                translation: None,
                roman: Some("go³ ngan⁴ baau¹ mou⁵ jan⁴ jing⁶ leng⁵.".to_string()),
                tags: vec!["Traditional-Chinese".to_string(), "Jyutping".to_string()],
                raw_tags: Vec::new(),
            }],
        };

        assert!(pair_examples(&sense).is_empty());
    }

    #[test]
    fn min_senses_are_not_treated_as_mandarin() {
        let sense = KaikkiSense {
            id: Some("sense-1".to_string()),
            glosses: vec!["now".to_string()],
            raw_glosses: vec!["(Southern Min) now".to_string()],
            tags: vec!["Min".to_string(), "Southern".to_string()],
            examples: Vec::new(),
        };

        assert!(sense_is_non_mandarin(&sense));
    }

    #[test]
    fn untagged_ipa_romanization_is_rejected() {
        let sense = KaikkiSense {
            id: Some("sense-1".to_string()),
            glosses: vec!["to fall".to_string()],
            raw_glosses: Vec::new(),
            tags: Vec::new(),
            examples: vec![KaikkiExample {
                text: Some("天逿其石".to_string()),
                english: Some("a rock that has fallen from the sky".to_string()),
                translation: None,
                roman: Some("tiĕng dâung gì siŏh / [tʰieŋ⁵⁵ tɑuŋ²⁴²]".to_string()),
                tags: vec!["Traditional-Chinese".to_string()],
                raw_tags: Vec::new(),
            }],
        };

        assert!(pair_examples(&sense).is_empty());
    }

    #[test]
    fn untagged_hokkien_romanization_is_rejected() {
        assert!(romanization_is_non_mandarin(
            "tùi bîn-chhn̂g siak lo̍h thô͘-kha"
        ));
        assert!(!romanization_is_non_mandarin("Wǒ yào qù Yínháng qǔ qián."));
    }
}
