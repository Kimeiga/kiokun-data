use crate::korean_types::KoreanWord;
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KoreanExampleSourceRow {
    pub id: String,
    pub korean: String,
    pub headword: String,
    pub definition: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KoreanExampleTranslationRow {
    id: String,
    korean: String,
    translation: String,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct KoreanExampleTranslationStats {
    pub records: usize,
    pub attached: usize,
    pub missing: usize,
    pub stale: usize,
}

fn definition_example_id(word_id: &str, definition_index: usize, example_index: usize) -> String {
    format!("{word_id}:d{definition_index}:e{example_index}")
}

fn word_example_id(word_id: &str, example_index: usize) -> String {
    format!("{word_id}:w:e{example_index}")
}

pub fn export_source_rows(words: &[KoreanWord], output_path: &Path) -> Result<usize> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("Failed to create {}", parent.display()))?;
    }

    let file = File::create(output_path)
        .with_context(|| format!("Failed to create {}", output_path.display()))?;
    let mut writer = BufWriter::new(file);
    let mut count = 0;

    for word in words {
        for (definition_index, definition) in word.definitions.iter().enumerate() {
            for (example_index, example) in definition.examples.iter().enumerate() {
                let row = KoreanExampleSourceRow {
                    id: definition_example_id(&word.id, definition_index, example_index),
                    korean: example.korean.clone(),
                    headword: word.hangul.clone(),
                    definition: definition.text.clone(),
                };
                serde_json::to_writer(&mut writer, &row)
                    .context("Failed to serialize Korean example source row")?;
                writer.write_all(b"\n")?;
                count += 1;
            }
        }

        let fallback_definition = word
            .definitions
            .iter()
            .map(|definition| definition.text.as_str())
            .collect::<Vec<_>>()
            .join(" — ");
        for (example_index, example) in word.examples.iter().enumerate() {
            let row = KoreanExampleSourceRow {
                id: word_example_id(&word.id, example_index),
                korean: example.korean.clone(),
                headword: word.hangul.clone(),
                definition: fallback_definition.clone(),
            };
            serde_json::to_writer(&mut writer, &row)
                .context("Failed to serialize Korean fallback example source row")?;
            writer.write_all(b"\n")?;
            count += 1;
        }
    }

    writer.flush()?;
    Ok(count)
}

fn translation_files(path: &Path) -> Result<Vec<PathBuf>> {
    if path.is_file() {
        return Ok(vec![path.to_path_buf()]);
    }
    if !path.is_dir() {
        bail!(
            "Korean example translation path does not exist: {}",
            path.display()
        );
    }

    let mut files = fs::read_dir(path)
        .with_context(|| format!("Failed to read {}", path.display()))?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|file| file.extension().and_then(|extension| extension.to_str()) == Some("jsonl"))
        .collect::<Vec<_>>();
    files.sort();
    Ok(files)
}

fn load_translations(path: &Path) -> Result<HashMap<String, KoreanExampleTranslationRow>> {
    let mut translations = HashMap::new();
    for file_path in translation_files(path)? {
        let reader = BufReader::new(
            File::open(&file_path)
                .with_context(|| format!("Failed to open {}", file_path.display()))?,
        );
        for (line_index, line) in reader.lines().enumerate() {
            let line = line.with_context(|| {
                format!(
                    "Failed to read {} line {}",
                    file_path.display(),
                    line_index + 1
                )
            })?;
            if line.trim().is_empty() {
                continue;
            }
            let row: KoreanExampleTranslationRow =
                serde_json::from_str(&line).with_context(|| {
                    format!(
                        "Failed to parse {} line {}",
                        file_path.display(),
                        line_index + 1
                    )
                })?;
            if row.id.trim().is_empty()
                || row.korean.trim().is_empty()
                || row.translation.trim().is_empty()
            {
                bail!(
                    "{} line {} has an empty id, Korean example, or translation",
                    file_path.display(),
                    line_index + 1
                );
            }
            if translations.insert(row.id.clone(), row).is_some() {
                bail!(
                    "Duplicate Korean example translation id in {} line {}",
                    file_path.display(),
                    line_index + 1
                );
            }
        }
    }
    Ok(translations)
}

fn attach_one(
    id: String,
    korean: &str,
    translation: &mut Option<String>,
    translations: &mut HashMap<String, KoreanExampleTranslationRow>,
    stats: &mut KoreanExampleTranslationStats,
) -> Result<()> {
    let Some(row) = translations.remove(&id) else {
        stats.missing += 1;
        return Ok(());
    };
    if row.korean != korean {
        bail!(
            "Korean example source changed for {id}: translation row has {:?}, dictionary has {:?}",
            row.korean,
            korean
        );
    }
    *translation = Some(row.translation.trim().to_string());
    stats.attached += 1;
    Ok(())
}

pub fn attach_translations(
    words: &mut [KoreanWord],
    translations_path: &Path,
) -> Result<KoreanExampleTranslationStats> {
    let mut translations = load_translations(translations_path)?;
    let mut stats = KoreanExampleTranslationStats {
        records: translations.len(),
        ..KoreanExampleTranslationStats::default()
    };
    for word in words {
        for (definition_index, definition) in word.definitions.iter_mut().enumerate() {
            for (example_index, example) in definition.examples.iter_mut().enumerate() {
                attach_one(
                    definition_example_id(&word.id, definition_index, example_index),
                    &example.korean,
                    &mut example.translation,
                    &mut translations,
                    &mut stats,
                )?;
            }
        }
        for (example_index, example) in word.examples.iter_mut().enumerate() {
            attach_one(
                word_example_id(&word.id, example_index),
                &example.korean,
                &mut example.translation,
                &mut translations,
                &mut stats,
            )?;
        }
    }

    stats.stale = translations.len();
    Ok(stats)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::korean_types::{KoreanDefinition, KoreanExample};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_word() -> KoreanWord {
        KoreanWord {
            id: "krdict_term_bank_1_00001".to_string(),
            hangul: "가다".to_string(),
            hanja: None,
            romanization: None,
            pronunciation: None,
            pos: Some("Verb".to_string()),
            definitions: vec![KoreanDefinition {
                text: "to go".to_string(),
                lang: Some("en".to_string()),
                sense_number: Some(1),
                examples: vec![KoreanExample {
                    korean: "학교에 간다.".to_string(),
                    translation: None,
                }],
            }],
            examples: Vec::new(),
            origin: None,
            frequency_rank: None,
        }
    }

    fn temporary_path(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "kiokun-korean-examples-{}-{nonce}-{name}",
            std::process::id()
        ))
    }

    #[test]
    fn exports_stable_occurrence_ids_and_context() {
        let path = temporary_path("source.jsonl");
        let count = export_source_rows(&[test_word()], &path).unwrap();
        assert_eq!(count, 1);
        let row: KoreanExampleSourceRow =
            serde_json::from_str(fs::read_to_string(&path).unwrap().trim()).unwrap();
        assert_eq!(row.id, "krdict_term_bank_1_00001:d0:e0");
        assert_eq!(row.korean, "학교에 간다.");
        assert_eq!(row.headword, "가다");
        assert_eq!(row.definition, "to go");
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn attaches_translation_to_the_exact_example_occurrence() {
        let path = temporary_path("translations.jsonl");
        let row = KoreanExampleTranslationRow {
            id: "krdict_term_bank_1_00001:d0:e0".to_string(),
            korean: "학교에 간다.".to_string(),
            translation: "They go to school.".to_string(),
        };
        fs::write(&path, format!("{}\n", serde_json::to_string(&row).unwrap())).unwrap();

        let mut words = vec![test_word()];
        let stats = attach_translations(&mut words, &path).unwrap();
        assert_eq!(
            stats,
            KoreanExampleTranslationStats {
                records: 1,
                attached: 1,
                missing: 0,
                stale: 0,
            }
        );
        assert_eq!(
            words[0].definitions[0].examples[0].translation.as_deref(),
            Some("They go to school.")
        );
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn rejects_a_translation_when_the_source_occurrence_changed() {
        let path = temporary_path("mismatch.jsonl");
        let row = KoreanExampleTranslationRow {
            id: "krdict_term_bank_1_00001:d0:e0".to_string(),
            korean: "다른 문장.".to_string(),
            translation: "A different sentence.".to_string(),
        };
        fs::write(&path, format!("{}\n", serde_json::to_string(&row).unwrap())).unwrap();

        let error = attach_translations(&mut [test_word()], &path)
            .unwrap_err()
            .to_string();
        assert!(error.contains("source changed"));
        fs::remove_file(path).unwrap();
    }
}
