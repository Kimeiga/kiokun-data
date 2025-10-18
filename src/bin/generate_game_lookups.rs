use anyhow::Result;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;



fn main() -> Result<()> {
    println!("🎮 Generating game lookup files...\n");

    // 1. Generate component_combinations.json
    println!("📦 Step 1: Generating component_combinations.json");
    let component_combinations = generate_component_combinations()?;
    
    // 2. Generate character_words.json
    println!("\n📚 Step 2: Generating character_words.json");
    let character_words = generate_character_words()?;
    
    // 3. Write files
    println!("\n💾 Writing output files...");
    write_json_file("kanji-card-game/static/data/component_combinations.json", &component_combinations)?;
    write_json_file("kanji-card-game/static/data/character_words.json", &character_words)?;
    
    println!("\n✅ Done!");
    println!("   - component_combinations.json: {} components", component_combinations.len());
    println!("   - character_words.json: {} characters", character_words.len());
    
    Ok(())
}

fn generate_component_combinations() -> Result<HashMap<String, Vec<String>>> {
    // Use the already-generated ids_forward.json file
    let ids_forward_path = "kanji-game/data/ids_forward.json";

    if !Path::new(ids_forward_path).exists() {
        eprintln!("❌ Error: {} not found!", ids_forward_path);
        eprintln!("   Please run: cargo run --bin generate_ids_lookups");
        return Ok(HashMap::new());
    }

    let content = fs::read_to_string(ids_forward_path)?;
    let ids_forward: HashMap<String, Value> = serde_json::from_str(&content)?;

    let mut combinations: HashMap<String, Vec<String>> = HashMap::new();
    let mut valid_decompositions = 0;

    for (result_char, entry) in &ids_forward {
        let components = entry.get("components")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        if components.len() < 2 {
            continue;
        }

        // For each pair of components, create bidirectional mappings
        for i in 0..components.len() {
            for j in 0..components.len() {
                if i != j {
                    let comp1 = &components[i];
                    let comp2 = &components[j];

                    // Add comp1 -> "comp2:result"
                    combinations
                        .entry(comp1.clone())
                        .or_insert_with(Vec::new)
                        .push(format!("{}:{}", comp2, result_char));
                }
            }
        }

        valid_decompositions += 1;
    }

    // Deduplicate entries
    for combs in combinations.values_mut() {
        combs.sort();
        combs.dedup();
    }

    println!("   Processed {} character decompositions", ids_forward.len());
    println!("   Found {} valid decompositions with 2+ components", valid_decompositions);
    println!("   Created combinations for {} components", combinations.len());

    Ok(combinations)
}



fn generate_character_words() -> Result<HashMap<String, Vec<String>>> {
    let output_dir = Path::new("output_dictionary");
    
    if !output_dir.exists() {
        eprintln!("❌ Error: output_dictionary folder not found!");
        eprintln!("   Please run the main dictionary generation first.");
        return Ok(HashMap::new());
    }

    let mut character_words: HashMap<String, Vec<String>> = HashMap::new();
    let mut file_count = 0;
    let mut word_count = 0;

    for entry in fs::read_dir(output_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }

        file_count += 1;
        
        if file_count % 1000 == 0 {
            println!("   Processed {} files...", file_count);
        }

        match fs::read_to_string(&path) {
            Ok(content) => {
                if let Ok(data) = serde_json::from_str::<Value>(&content) {
                    // Process Chinese words
                    if let Some(chinese_words_array) = data.get("chinese_words").and_then(|v| v.as_array()) {
                        for word_entry in chinese_words_array {
                            // Get simplified form
                            if let Some(simp) = word_entry.get("simp").and_then(|v| v.as_str()) {
                                if is_valid_word(simp) {
                                    add_word_to_index(&mut character_words, simp);
                                    word_count += 1;
                                }
                            }
                            // Get traditional form
                            if let Some(trad) = word_entry.get("trad").and_then(|v| v.as_str()) {
                                if is_valid_word(trad) {
                                    add_word_to_index(&mut character_words, trad);
                                    word_count += 1;
                                }
                            }
                        }
                    }

                    // Process Japanese words
                    if let Some(japanese_words_array) = data.get("japanese_words").and_then(|v| v.as_array()) {
                        for word_entry in japanese_words_array {
                            if let Some(kanji_array) = word_entry.get("kanji").and_then(|v| v.as_array()) {
                                for kanji_entry in kanji_array {
                                    if let Some(text) = kanji_entry.get("text").and_then(|v| v.as_str()) {
                                        // Only include if it's all kanji (no kana)
                                        if is_all_kanji(text) {
                                            add_word_to_index(&mut character_words, text);
                                            word_count += 1;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(_) => continue,
        }
    }

    println!("   Processed {} files", file_count);
    println!("   Found {} words (kanji/hanzi only)", word_count);
    println!("   Created index for {} characters", character_words.len());

    Ok(character_words)
}

fn is_valid_word(word: &str) -> bool {
    !word.is_empty() && word.chars().all(|c| c >= '\u{4E00}' && c <= '\u{9FFF}')
}

fn is_all_kanji(text: &str) -> bool {
    !text.is_empty() && text.chars().all(|c| {
        // CJK Unified Ideographs
        (c >= '\u{4E00}' && c <= '\u{9FFF}') ||
        // CJK Extension A
        (c >= '\u{3400}' && c <= '\u{4DBF}') ||
        // CJK Extension B and beyond
        (c >= '\u{20000}' && c <= '\u{2A6DF}')
    })
}

fn add_word_to_index(index: &mut HashMap<String, Vec<String>>, word: &str) {
    for ch in word.chars() {
        let ch_str = ch.to_string();
        index
            .entry(ch_str)
            .or_insert_with(Vec::new)
            .push(word.to_string());
    }
}

fn write_json_file<T: Serialize>(path: &str, data: &T) -> Result<()> {
    // Create parent directory if it doesn't exist
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent)?;
    }
    
    let mut file = File::create(path)?;
    let json = serde_json::to_string_pretty(data)?;
    file.write_all(json.as_bytes())?;
    
    println!("   ✅ Wrote {}", path);
    
    Ok(())
}

