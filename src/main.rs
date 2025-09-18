mod chinese_types;
mod japanese_types;
mod combined_types;
mod unified_types;
mod unification_engine;
mod kanji_mapping_generated;
mod improved_unified_types;
mod improved_unification_engine;

use anyhow::{Context, Result};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::Command as ProcessCommand;
use clap::{Arg, ArgAction, Command};
use serde_json;

use chinese_types::{ChineseDictionary, ChineseDictionaryElement};
use japanese_types::{JapaneseEntry, Word};
use combined_types::{
    CombinedDictionary, CombinedEntry, CombinedMetadata, KeySource,
    MergeStatistics, DictionaryMetadata
};
use unified_types::UnifiedEntry;
use unification_engine::unify_entry;

#[tokio::main]
async fn main() -> Result<()> {
    let matches = Command::new("Dictionary Merger")
        .version("1.0")
        .about("Merges Chinese and Japanese dictionaries")
        .arg(
            Arg::new("generate-j2c-mapping")
                .long("generate-j2c-mapping")
                .help("Generate Japanese to Chinese mapping file")
                .action(clap::ArgAction::SetTrue)
        )
        .arg(
            Arg::new("unified-format")
                .long("unified-format")
                .help("Generate unified entries with combined Chinese/Japanese data")
                .action(clap::ArgAction::SetTrue),
        )
        .arg(
            Arg::new("individual-files")
                .long("individual-files")
                .help("Generate individual JSON files for each word")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("unified-only")
                .long("unified-only")
                .help("Only generate files for unified entries (entries with both Chinese and Japanese data)")
                .action(ArgAction::SetTrue),
        )
        .get_matches();

    if matches.get_flag("generate-j2c-mapping") {
        println!("🔄 Generating Japanese to Chinese mapping...");
        generate_j2c_mapping().await?;
        return Ok(());
    }

    println!("🚀 Starting dictionary merger...");

    // Create output directory
    fs::create_dir_all("output")?;
    
    // Load dictionaries
    println!("📚 Loading Chinese dictionary...");
    let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
        .context("Failed to load Chinese dictionary")?;
    
    println!("📚 Loading Japanese dictionary...");
    let japanese_dict = load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")
        .context("Failed to load Japanese dictionary")?;

    println!("📚 Loading Japanese to Chinese mapping...");
    let j2c_mapping = load_j2c_mapping("output/j2c_mapping.json")
        .context("Failed to load J2C mapping. Run with --generate-j2c-mapping first.")?;
    println!("  ✅ Loaded {} J2C mappings", j2c_mapping.len());

    // Merge dictionaries
    println!("🔄 Merging dictionaries...");
    let combined_dict = merge_dictionaries_with_mapping(chinese_entries, japanese_dict.words, j2c_mapping)
        .context("Failed to merge dictionaries")?;

    // Check if unified format is requested
    if matches.get_flag("unified-format") {
        println!("🔄 Generating unified entries...");
        generate_unified_entries(&combined_dict).await?;
        return Ok(());
    }

    // Check if individual files are requested
    if matches.get_flag("individual-files") {
        let unified_only = matches.get_flag("unified-only");
        println!("🔄 Generating individual JSON files{}...",
                 if unified_only { " (unified entries only)" } else { "" });
        generate_individual_files(&combined_dict, unified_only).await?;
        return Ok(());
    }

    // Save combined dictionary
    println!("💾 Saving combined dictionary...");
    save_combined_dictionary(&combined_dict, "output/combined_dictionary.json")
        .context("Failed to save combined dictionary")?;

    // Print statistics
    print_statistics(&combined_dict.statistics);

    println!("✅ Dictionary merger completed successfully!");
    println!("📁 Output saved to: output/combined_dictionary.json");
    
    Ok(())
}

async fn generate_unified_entries(combined_dict: &CombinedDictionary) -> Result<()> {
    println!("🔄 Converting to unified format...");

    let mut unified_entries = Vec::new();
    let mut unified_count = 0;
    let mut chinese_only_count = 0;
    let mut japanese_only_count = 0;

    for (i, entry) in combined_dict.entries.iter().enumerate() {
        if i % 10000 == 0 {
            println!("  Processed {} entries...", i);
        }

        let unified_entry = unify_entry(entry);

        // Count entry types
        match (entry.chinese_entry.is_some(), entry.japanese_entry.is_some()) {
            (true, true) => unified_count += 1,
            (true, false) => chinese_only_count += 1,
            (false, true) => japanese_only_count += 1,
            (false, false) => {}, // Shouldn't happen
        }

        unified_entries.push(unified_entry);
    }

    println!("💾 Saving unified dictionary...");

    // Create unified dictionary structure
    let unified_dict = serde_json::json!({
        "metadata": {
            "format": "unified",
            "version": "2.0",
            "created_at": chrono::Utc::now().to_string(),
            "total_entries": unified_entries.len(),
            "unified_entries": unified_count,
            "chinese_only_entries": chinese_only_count,
            "japanese_only_entries": japanese_only_count,
            "unification_rate": format!("{:.2}%", (unified_count as f32 / unified_entries.len() as f32) * 100.0)
        },
        "entries": unified_entries
    });

    // Save to file
    let output_path = "output/unified_dictionary.json";
    let json_string = serde_json::to_string_pretty(&unified_dict)
        .context("Failed to serialize unified dictionary")?;
    fs::write(output_path, json_string)
        .context("Failed to write unified dictionary file")?;

    println!("📊 Unified Dictionary Statistics:");
    println!("  Total entries: {}", unified_entries.len());
    println!("  Unified entries (both languages): {}", unified_count);
    println!("  Chinese-only entries: {}", chinese_only_count);
    println!("  Japanese-only entries: {}", japanese_only_count);
    println!("  Unification rate: {:.2}%", (unified_count as f32 / unified_entries.len() as f32) * 100.0);

    println!("✅ Unified dictionary generated successfully!");
    println!("📁 Output saved to: {}", output_path);

    // Show sample unified entries
    println!("\n🔍 Sample unified entries:");
    for (i, entry) in unified_entries.iter().take(5).enumerate() {
        if entry.metadata.unification_confidence > 0.7 {
            println!("  {}. {} (confidence: {:.1}%)",
                i + 1,
                entry.word,
                entry.metadata.unification_confidence * 100.0
            );
            println!("     Traditional: {}, Simplified: {}",
                entry.representations.traditional,
                entry.representations.simplified
            );
            if !entry.representations.japanese_kanji.is_empty() {
                println!("     Japanese: {}",
                    entry.representations.japanese_kanji[0].text
                );
            }
            if !entry.representations.japanese_kana.is_empty() {
                println!("     Reading: {}",
                    entry.representations.japanese_kana[0].text
                );
            }
            if !entry.pronunciations.pinyin.is_empty() {
                println!("     Pinyin: {}",
                    entry.pronunciations.pinyin[0].reading
                );
            }
            println!();
        }
    }

    Ok(())
}

fn load_chinese_dictionary(path: &str) -> Result<Vec<ChineseDictionaryElement>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let mut entries = Vec::new();
    
    for (line_num, line) in reader.lines().enumerate() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        
        match serde_json::from_str::<ChineseDictionaryElement>(&line) {
            Ok(entry) => entries.push(entry),
            Err(e) => {
                eprintln!("Warning: Failed to parse Chinese entry on line {}: {}", line_num + 1, e);
                continue;
            }
        }
        
        // Progress indicator
        if (entries.len()) % 10000 == 0 {
            println!("  Loaded {} Chinese entries...", entries.len());
        }
    }
    
    println!("  ✅ Loaded {} Chinese entries total", entries.len());
    Ok(entries)
}

fn load_japanese_dictionary(path: &str) -> Result<JapaneseEntry> {
    let content = fs::read_to_string(path)?;
    let japanese_dict: JapaneseEntry = serde_json::from_str(&content)?;
    println!("  ✅ Loaded {} Japanese words", japanese_dict.words.len());
    Ok(japanese_dict)
}

fn load_j2c_mapping(path: &str) -> Result<HashMap<String, String>> {
    let content = fs::read_to_string(path)
        .context("Failed to read J2C mapping file")?;
    let mapping: HashMap<String, String> = serde_json::from_str(&content)
        .context("Failed to parse J2C mapping JSON")?;
    Ok(mapping)
}

fn merge_dictionaries(
    chinese_entries: Vec<ChineseDictionaryElement>,
    japanese_words: Vec<Word>
) -> Result<CombinedDictionary> {
    let mut combined_map: HashMap<String, CombinedEntry> = HashMap::new();
    let mut stats = MergeStatistics {
        total_chinese_entries: chinese_entries.len(),
        total_japanese_words: japanese_words.len(),
        unified_entries: 0,
        chinese_only_entries: 0,
        japanese_only_entries: 0,
        total_combined_entries: 0,
        sample_unified_entries: Vec::new(),
    };
    
    // Phase 1: Process Chinese entries
    println!("  📝 Phase 1: Processing Chinese entries...");
    for (i, chinese_entry) in chinese_entries.into_iter().enumerate() {
        let key = chinese_entry.trad.clone(); // Use traditional form as key
        
        match combined_map.get_mut(&key) {
            Some(existing_entry) => {
                // Add to chinese_specific_entries
                existing_entry.chinese_specific_entries.push(chinese_entry);
                existing_entry.metadata.chinese_count += 1;
            }
            None => {
                // Create new entry
                let new_entry = CombinedEntry {
                    word: key.clone(),
                    chinese_entry: Some(chinese_entry),
                    chinese_specific_entries: Vec::new(),
                    japanese_entry: None,
                    japanese_specific_entries: Vec::new(),
                    metadata: CombinedMetadata {
                        chinese_count: 1,
                        japanese_count: 0,
                        is_unified: false,
                        key_source: KeySource::Chinese,
                    },
                };
                combined_map.insert(key, new_entry);
            }
        }
        
        if (i + 1) % 10000 == 0 {
            println!("    Processed {} Chinese entries...", i + 1);
        }
    }
    
    // Phase 2: Process Japanese entries
    println!("  📝 Phase 2: Processing Japanese entries...");
    for (i, japanese_word) in japanese_words.into_iter().enumerate() {
        // Get key from first kanji, then first kana if no kanji
        let key = get_japanese_key(&japanese_word);
        
        match combined_map.get_mut(&key) {
            Some(existing_entry) => {
                // Match found!
                if existing_entry.japanese_entry.is_none() {
                    // First Japanese entry for this word
                    existing_entry.japanese_entry = Some(japanese_word);
                    existing_entry.metadata.japanese_count = 1;
                    existing_entry.metadata.is_unified = true;
                    
                    // Add to sample for inspection
                    if stats.sample_unified_entries.len() < 20 {
                        stats.sample_unified_entries.push(key.clone());
                    }
                } else {
                    // Additional Japanese entry
                    existing_entry.japanese_specific_entries.push(japanese_word);
                    existing_entry.metadata.japanese_count += 1;
                }
            }
            None => {
                // Create new Japanese-only entry
                let new_entry = CombinedEntry {
                    word: key.clone(),
                    chinese_entry: None,
                    chinese_specific_entries: Vec::new(),
                    japanese_entry: Some(japanese_word),
                    japanese_specific_entries: Vec::new(),
                    metadata: CombinedMetadata {
                        chinese_count: 0,
                        japanese_count: 1,
                        is_unified: false,
                        key_source: KeySource::Japanese,
                    },
                };
                combined_map.insert(key, new_entry);
            }
        }
        
        if (i + 1) % 10000 == 0 {
            println!("    Processed {} Japanese words...", i + 1);
        }
    }
    
    // Calculate final statistics
    for entry in combined_map.values() {
        if entry.metadata.is_unified {
            stats.unified_entries += 1;
        } else if entry.chinese_entry.is_some() {
            stats.chinese_only_entries += 1;
        } else {
            stats.japanese_only_entries += 1;
        }
    }
    stats.total_combined_entries = combined_map.len();
    
    // Convert to vector
    let entries: Vec<CombinedEntry> = combined_map.into_values().collect();
    
    let combined_dict = CombinedDictionary {
        entries,
        statistics: stats,
        metadata: DictionaryMetadata {
            chinese_source: "chinese_dictionary_word_2025-06-25.jsonl".to_string(),
            japanese_source: "jmdict-examples-eng-3.6.1.json".to_string(),
            created_at: "2025-01-17T00:00:00Z".to_string(), // Simplified for now
            merger_version: "0.1.0".to_string(),
        },
    };
    
    Ok(combined_dict)
}

fn merge_dictionaries_with_mapping(
    chinese_entries: Vec<ChineseDictionaryElement>,
    japanese_words: Vec<Word>,
    j2c_mapping: HashMap<String, String>
) -> Result<CombinedDictionary> {
    let mut combined_map: HashMap<String, CombinedEntry> = HashMap::new();
    let mut stats = MergeStatistics {
        total_chinese_entries: chinese_entries.len(),
        total_japanese_words: japanese_words.len(),
        unified_entries: 0,
        chinese_only_entries: 0,
        japanese_only_entries: 0,
        total_combined_entries: 0,
        sample_unified_entries: Vec::new(),
    };

    // Phase 1: Process Chinese entries
    println!("  📝 Phase 1: Processing Chinese entries...");
    for (i, chinese_entry) in chinese_entries.into_iter().enumerate() {
        let key = chinese_entry.trad.clone(); // Use traditional Chinese as key

        let combined_entry = CombinedEntry {
            word: key.clone(),
            chinese_entry: Some(chinese_entry),
            chinese_specific_entries: Vec::new(),
            japanese_entry: None,
            japanese_specific_entries: Vec::new(),
            metadata: CombinedMetadata {
                chinese_count: 1,
                japanese_count: 0,
                is_unified: false,
                key_source: KeySource::Chinese,
            },
        };

        combined_map.insert(key, combined_entry);

        if i % 10000 == 0 {
            println!("    Processed {} Chinese entries...", i);
        }
    }

    // Phase 2: Process Japanese entries using J2C mapping
    println!("  📝 Phase 2: Processing Japanese entries with J2C mapping...");
    let mut debug_count = 0;

    for (i, japanese_word) in japanese_words.into_iter().enumerate() {
        // Get key from first kanji using J2C mapping
        let key = get_japanese_key_with_mapping(&japanese_word, &j2c_mapping);

        // Debug specific entries
        if key == "地図" || key == "地圖" || key == "学生" || key == "學生" || key.contains("地図") {
            println!("  🔍 DEBUG: Processing Japanese word ID {} → key '{}'", japanese_word.id, key);
            println!("    Kanji array length: {}", japanese_word.kanji.len());
            for (idx, kanji) in japanese_word.kanji.iter().enumerate() {
                println!("    Kanji[{}]: '{}'", idx, kanji.text);
            }
            if japanese_word.kanji.is_empty() {
                println!("    No kanji, kana array length: {}", japanese_word.kana.len());
                for (idx, kana) in japanese_word.kana.iter().enumerate() {
                    println!("    Kana[{}]: '{}'", idx, kana.text);
                }
            }
            println!("    Chinese dict contains key '{}': {}", key, combined_map.contains_key(&key));
            debug_count += 1;
        }

        match combined_map.get_mut(&key) {
            Some(existing_entry) => {
                // Match found!
                if existing_entry.japanese_entry.is_none() {
                    existing_entry.japanese_entry = Some(japanese_word);
                    existing_entry.metadata.japanese_count = 1;
                    existing_entry.metadata.is_unified = true;
                    stats.unified_entries += 1;

                    // Collect sample unified entries
                    if stats.sample_unified_entries.len() < 20 {
                        stats.sample_unified_entries.push(key.clone());
                    }
                } else {
                    // Additional Japanese entry for same key
                    existing_entry.japanese_specific_entries.push(japanese_word);
                    existing_entry.metadata.japanese_count += 1;
                }
            }
            None => {
                // Japanese-only entry
                let combined_entry = CombinedEntry {
                    word: key.clone(),
                    chinese_entry: None,
                    chinese_specific_entries: Vec::new(),
                    japanese_entry: Some(japanese_word),
                    japanese_specific_entries: Vec::new(),
                    metadata: CombinedMetadata {
                        chinese_count: 0,
                        japanese_count: 1,
                        is_unified: false,
                        key_source: KeySource::Japanese,
                    },
                };
                combined_map.insert(key, combined_entry);
                stats.japanese_only_entries += 1;
            }
        }

        if i % 10000 == 0 {
            println!("    Processed {} Japanese words...", i);
        }
    }

    // Calculate final statistics
    stats.total_combined_entries = combined_map.len();
    stats.chinese_only_entries = stats.total_combined_entries - stats.unified_entries - stats.japanese_only_entries;

    let combined_dict = CombinedDictionary {
        entries: combined_map.into_values().collect(),
        metadata: DictionaryMetadata {
            chinese_source: "CC-CEDICT (JSONL format)".to_string(),
            japanese_source: "JMDict (JSON format)".to_string(),
            created_at: chrono::Utc::now().to_string(),
            merger_version: "1.0 with J2C mapping".to_string(),
        },
        statistics: stats,
    };

    Ok(combined_dict)
}

fn get_japanese_key_with_mapping(word: &Word, j2c_mapping: &HashMap<String, String>) -> String {
    // First try kanji with J2C mapping
    if let Some(first_kanji) = word.kanji.first() {
        let japanese_text = &first_kanji.text;

        // Check if we have a mapping for this Japanese text
        if let Some(traditional_chinese) = j2c_mapping.get(japanese_text) {
            // Debug logging for specific cases
            if japanese_text == "地図" {
                println!("    KEY_GEN: '{}' mapped to '{}'", japanese_text, traditional_chinese);
            }
            return traditional_chinese.clone();
        }

        // Fallback to original Japanese text if no mapping
        if japanese_text == "地図" {
            println!("    KEY_GEN: '{}' NOT FOUND in mapping, using original", japanese_text);
        }
        return japanese_text.clone();
    }

    // Fallback to kana (no conversion needed)
    if let Some(first_kana) = word.kana.first() {
        if first_kana.text.contains("ちず") {
            println!("    KEY_GEN: No kanji, using kana '{}'", first_kana.text);
        }
        return first_kana.text.clone();
    }

    // Fallback to ID if no text found
    format!("jp_{}", word.id)
}

fn get_japanese_key(word: &Word) -> String {
    // First try kanji - convert to Traditional Chinese for better matching
    if let Some(first_kanji) = word.kanji.first() {
        let traditional = kanji_mapping_generated::convert_japanese_to_traditional(&first_kanji.text);
        return traditional;
    }

    // Fallback to kana (no conversion needed)
    if let Some(first_kana) = word.kana.first() {
        return first_kana.text.clone();
    }

    // Fallback to ID if no text found
    format!("jp_{}", word.id)
}

fn save_combined_dictionary(dict: &CombinedDictionary, path: &str) -> Result<()> {
    let json = serde_json::to_string_pretty(dict)?;
    fs::write(path, json)?;
    Ok(())
}

fn print_statistics(stats: &MergeStatistics) {
    println!("\n📊 Merge Statistics:");
    println!("  Chinese entries processed: {}", stats.total_chinese_entries);
    println!("  Japanese words processed: {}", stats.total_japanese_words);
    println!("  Total combined entries: {}", stats.total_combined_entries);
    println!("  Unified entries (both languages): {}", stats.unified_entries);
    println!("  Chinese-only entries: {}", stats.chinese_only_entries);
    println!("  Japanese-only entries: {}", stats.japanese_only_entries);
    
    let unification_rate = (stats.unified_entries as f64 / stats.total_combined_entries as f64) * 100.0;
    println!("  Unification rate: {:.2}%", unification_rate);
    
    println!("\n🔍 Sample unified entries for inspection:");
    for (i, word) in stats.sample_unified_entries.iter().enumerate() {
        println!("  {}. {}", i + 1, word);
    }
}

/// Generate Japanese to Chinese mapping by checking which Japanese kanji entries
/// exist in the Chinese dictionary after OpenCC conversion
async fn generate_j2c_mapping() -> Result<()> {
    println!("📚 Loading Chinese dictionary...");
    let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
        .context("Failed to load Chinese dictionary")?;

    // Create a set of all Chinese traditional characters for fast lookup
    let mut chinese_trad_set = std::collections::HashSet::new();
    for entry in &chinese_entries {
        chinese_trad_set.insert(entry.trad.clone());
    }
    println!("  ✅ Loaded {} Chinese entries", chinese_entries.len());

    println!("📚 Loading Japanese dictionary...");
    let japanese_dict = load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")
        .context("Failed to load Japanese dictionary")?;
    println!("  ✅ Loaded {} Japanese words", japanese_dict.words.len());

    println!("🔄 Processing Japanese entries and generating mappings...");
    let mut j2c_mapping: HashMap<String, String> = HashMap::new();
    let mut processed = 0;
    let mut mappings_created = 0;
    let mut debug_count = 0;

    for word in japanese_dict.words {
        // Only process entries with kanji (skip kana-only entries)
        if let Some(first_kanji) = word.kanji.first() {
            let japanese_text = &first_kanji.text;

            // Skip if contains hiragana or katakana
            if contains_kana(japanese_text) {
                continue;
            }

            // Convert to Traditional Chinese using OpenCC
            match convert_with_opencc(japanese_text) {
                Ok(traditional_chinese) => {
                    // Debug output for first few conversions
                    if debug_count < 5 {
                        println!("  DEBUG: {} → {}", japanese_text, traditional_chinese);
                        println!("  DEBUG: Chinese dict contains '{}': {}", traditional_chinese, chinese_trad_set.contains(&traditional_chinese));
                        debug_count += 1;
                    }

                    // Check if this traditional Chinese exists in our Chinese dictionary
                    if chinese_trad_set.contains(&traditional_chinese) && japanese_text != &traditional_chinese {
                        j2c_mapping.insert(japanese_text.clone(), traditional_chinese);
                        mappings_created += 1;

                        if mappings_created <= 5 {
                            println!("  MAPPING: {} → {}", japanese_text, j2c_mapping.get(japanese_text).unwrap());
                        }
                    }
                }
                Err(e) => {
                    if debug_count < 3 {
                        println!("  DEBUG ERROR: Failed to convert '{}': {}", japanese_text, e);
                        debug_count += 1;
                    }
                }
            }
        }

        processed += 1;
        if processed % 10000 == 0 {
            println!("  Processed {} entries, created {} mappings...", processed, mappings_created);
        }
    }

    println!("💾 Saving Japanese to Chinese mapping...");
    let output_path = "output/j2c_mapping.json";
    let json = serde_json::to_string_pretty(&j2c_mapping)?;
    fs::write(output_path, json)?;

    println!("✅ Japanese to Chinese mapping generation complete!");
    println!("📊 Statistics:");
    println!("  - Japanese entries processed: {}", processed);
    println!("  - Mappings created: {}", mappings_created);
    println!("  - Mapping rate: {:.2}%", (mappings_created as f64 / processed as f64) * 100.0);
    println!("📁 Output saved to: {}", output_path);

    Ok(())
}

/// Check if a string contains hiragana or katakana characters
fn contains_kana(text: &str) -> bool {
    text.chars().any(|c| {
        // Hiragana: U+3040–U+309F
        // Katakana: U+30A0–U+30FF
        (c >= '\u{3040}' && c <= '\u{309F}') || (c >= '\u{30A0}' && c <= '\u{30FF}')
    })
}

/// Convert Japanese text to Traditional Chinese using OpenCC
fn convert_with_opencc(text: &str) -> Result<String> {
    use std::process::Stdio;
    use std::io::Write;

    let mut child = ProcessCommand::new("opencc")
        .arg("-c")
        .arg("jp2t")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("Failed to spawn opencc command")?;

    // Write input to stdin
    if let Some(stdin) = child.stdin.as_mut() {
        stdin.write_all(text.as_bytes())
            .context("Failed to write to opencc stdin")?;
    }

    let output = child.wait_with_output()
        .context("Failed to wait for opencc command")?;

    if output.status.success() {
        let result = String::from_utf8(output.stdout)
            .context("Failed to parse opencc output as UTF-8")?;
        Ok(result.trim().to_string())
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("OpenCC conversion failed: {}", error);
    }
}

async fn generate_individual_files(combined_dict: &CombinedDictionary, unified_only: bool) -> Result<()> {
    use std::fs;
    use std::path::Path;

    println!("📁 Creating output directory...");
    let output_dir = Path::new("output_dictionary");
    if output_dir.exists() {
        fs::remove_dir_all(output_dir).context("Failed to remove existing output directory")?;
    }
    fs::create_dir_all(output_dir).context("Failed to create output directory")?;

    println!("🔄 Converting to improved unified format...");
    let mut unified_entries = Vec::new();
    let mut processed = 0;
    let mut filtered_count = 0;

    for entry in &combined_dict.entries {
        // Check if we should filter to unified-only entries
        if unified_only {
            let has_both = entry.chinese_entry.is_some() && entry.japanese_entry.is_some();
            if !has_both {
                filtered_count += 1;
                continue;
            }
        }

        let unified_entry = improved_unification_engine::convert_to_improved_unified(entry);
        unified_entries.push(unified_entry);

        processed += 1;
        if processed % 10000 == 0 {
            println!("  Converted {} entries...", processed);
        }
    }

    if unified_only {
        println!("  Filtered out {} non-unified entries", filtered_count);
        println!("  Keeping {} unified entries", unified_entries.len());
    }

    println!("💾 Writing {} individual JSON files...", unified_entries.len());

    // Use parallel processing for maximum performance
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    let counter = Arc::new(AtomicUsize::new(0));
    let total = unified_entries.len();

    // Process in parallel chunks for optimal performance
    let results: Result<Vec<_>, anyhow::Error> = unified_entries
        .par_iter()
        .map(|entry| -> Result<(), anyhow::Error> {
            let counter = Arc::clone(&counter);

            // Create safe filename from word
            let safe_filename = create_safe_filename(&entry.word);
            let file_path = output_dir.join(format!("{}.json", safe_filename));

            // Serialize to minified JSON
            let json_content = serde_json::to_string(entry)
                .map_err(|e| anyhow::anyhow!("Failed to serialize entry '{}': {}", entry.word, e))?;

            // Write file synchronously (faster for many small files)
            std::fs::write(&file_path, json_content)
                .map_err(|e| anyhow::anyhow!("Failed to write file '{}': {}", file_path.display(), e))?;

            let current = counter.fetch_add(1, Ordering::Relaxed) + 1;
            if current % 10000 == 0 {
                println!("  Written {}/{} files ({:.1}%)", current, total, (current as f64 / total as f64) * 100.0);
            }

            Ok(())
        })
        .collect();

    results?;

    println!("✅ Successfully generated {} individual JSON files!", total);
    println!("📁 Files saved to: output_dictionary/");
    println!("💡 Usage: cat output_dictionary/地圖.json");

    Ok(())
}

fn create_safe_filename(word: &str) -> String {
    // Replace problematic characters for filesystem
    word.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect()
}
