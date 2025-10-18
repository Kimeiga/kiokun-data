use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

#[derive(Debug, Serialize)]
struct WordIndex {
    chinese_words: HashSet<String>,
    japanese_words: HashSet<String>,
    all_words: HashSet<String>,
}

fn main() -> Result<()> {
    println!("🔧 Generating word validation index for kanji game...");

    let mut chinese_words = HashSet::new();
    let mut japanese_words = HashSet::new();

    let output_dir = Path::new("output_dictionary");
    
    if !output_dir.exists() {
        eprintln!("❌ Error: output_dictionary folder not found!");
        eprintln!("   Please run the main dictionary generation first.");
        return Ok(());
    }

    println!("\n📚 Scanning output_dictionary for words...");
    
    let mut file_count = 0;
    let mut error_count = 0;

    for entry in fs::read_dir(output_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }

        file_count += 1;
        
        if file_count % 1000 == 0 {
            println!("  Processed {} files...", file_count);
        }

        // Read and parse the JSON file
        match fs::read_to_string(&path) {
            Ok(content) => {
                match serde_json::from_str::<Value>(&content) {
                    Ok(data) => {
                        // Extract Chinese words
                        if let Some(chinese_words_array) = data.get("chinese_words").and_then(|v| v.as_array()) {
                            for word_entry in chinese_words_array {
                                // Get simplified form
                                if let Some(simp) = word_entry.get("simp").and_then(|v| v.as_str()) {
                                    if !simp.is_empty() && simp.chars().all(|c| c.is_alphabetic() || c > '\u{4E00}') {
                                        chinese_words.insert(simp.to_string());
                                    }
                                }
                                // Get traditional form
                                if let Some(trad) = word_entry.get("trad").and_then(|v| v.as_str()) {
                                    if !trad.is_empty() && trad.chars().all(|c| c.is_alphabetic() || c > '\u{4E00}') {
                                        chinese_words.insert(trad.to_string());
                                    }
                                }
                            }
                        }

                        // Extract Japanese words
                        if let Some(japanese_words_array) = data.get("japanese_words").and_then(|v| v.as_array()) {
                            for word_entry in japanese_words_array {
                                // Get kanji forms
                                if let Some(kanji_array) = word_entry.get("kanji").and_then(|v| v.as_array()) {
                                    for kanji_entry in kanji_array {
                                        if let Some(text) = kanji_entry.get("text").and_then(|v| v.as_str()) {
                                            // Only include if it contains kanji (not just kana)
                                            if !text.is_empty() && text.chars().any(|c| c >= '\u{4E00}' && c <= '\u{9FFF}') {
                                                japanese_words.insert(text.to_string());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error_count += 1;
                        if error_count <= 5 {
                            eprintln!("  ⚠️  Warning: Failed to parse {:?}: {}", path.file_name(), e);
                        }
                    }
                }
            }
            Err(e) => {
                error_count += 1;
                if error_count <= 5 {
                    eprintln!("  ⚠️  Warning: Failed to read {:?}: {}", path.file_name(), e);
                }
            }
        }
    }

    println!("\n✅ Processed {} dictionary files", file_count);
    if error_count > 0 {
        println!("  ⚠️  {} files had errors", error_count);
    }

    // Combine all words
    let mut all_words = HashSet::new();
    all_words.extend(chinese_words.iter().cloned());
    all_words.extend(japanese_words.iter().cloned());

    println!("\n📊 Statistics:");
    println!("  - Chinese words: {}", chinese_words.len());
    println!("  - Japanese words: {}", japanese_words.len());
    println!("  - Total unique words: {}", all_words.len());

    // Create the word index
    let word_index = WordIndex {
        chinese_words,
        japanese_words,
        all_words,
    };

    // Create output directory
    fs::create_dir_all("kanji-game/data")?;

    // Write the index
    println!("\n💾 Writing word index to kanji-game/data/word_index.json...");
    let json = serde_json::to_string_pretty(&word_index)?;
    let mut file = File::create("kanji-game/data/word_index.json")?;
    file.write_all(json.as_bytes())?;
    println!("  ✅ Written");

    println!("\n✨ Word validation index generated successfully!");

    Ok(())
}

