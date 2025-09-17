mod chinese_types;
mod japanese_types;
mod combined_types;
mod test_types;

use anyhow::{Context, Result};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::Path;

use chinese_types::{ChineseDictionary, ChineseDictionaryElement};
use japanese_types::{JapaneseEntry, Word};
use combined_types::{
    CombinedDictionary, CombinedEntry, CombinedMetadata, KeySource, 
    MergeStatistics, DictionaryMetadata
};

#[tokio::main]
async fn main() -> Result<()> {
    println!("🚀 Starting dictionary merger...");
    
    // Create output directory
    fs::create_dir_all("output")?;
    
    // Load dictionaries
    println!("📚 Loading Chinese dictionary...");
    let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
        .context("Failed to load Chinese dictionary")?;
    
    println!("📚 Testing Japanese dictionary parsing...");
    test_types::test_japanese_parsing()
        .context("Failed to test Japanese dictionary parsing")?;

    println!("📚 Loading Japanese dictionary...");
    let japanese_dict = load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")
        .context("Failed to load Japanese dictionary")?;
    
    // Merge dictionaries
    println!("🔄 Merging dictionaries...");
    let combined_dict = merge_dictionaries(chinese_entries, japanese_dict.words)
        .context("Failed to merge dictionaries")?;
    
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

fn get_japanese_key(word: &Word) -> String {
    // First try kanji
    if let Some(first_kanji) = word.kanji.first() {
        return first_kanji.text.clone();
    }
    
    // Fallback to kana
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
