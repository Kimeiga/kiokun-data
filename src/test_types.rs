use std::fs;
use crate::japanese_types::JapaneseEntry;

pub fn test_japanese_parsing() -> anyhow::Result<()> {
    println!("🧪 Testing Japanese types parsing...");
    
    let content = fs::read_to_string("data/jmdict-examples-eng-3.6.1.json")?;
    
    match serde_json::from_str::<JapaneseEntry>(&content) {
        Ok(dict) => {
            println!("✅ Successfully parsed Japanese dictionary!");
            println!("📊 Number of words: {}", dict.words.len());
            
            // Show first few entries
            for (i, word) in dict.words.iter().take(3).enumerate() {
                println!("  {}. ID: {}", i + 1, word.id);
                if let Some(first_kanji) = word.kanji.first() {
                    println!("     Kanji: {}", first_kanji.text);
                }
                if let Some(first_kana) = word.kana.first() {
                    println!("     Kana: {}", first_kana.text);
                }
                if let Some(first_sense) = word.sense.first() {
                    if let Some(first_gloss) = first_sense.gloss.first() {
                        println!("     Meaning: {}", first_gloss.text);
                    }
                }
                println!();
            }
            
            Ok(())
        }
        Err(e) => {
            println!("❌ Failed to parse Japanese dictionary: {}", e);
            
            // Try to find the problematic part
            if let Some(line_info) = e.to_string().split(" at line ").nth(1) {
                if let Some(line_num) = line_info.split(" column ").next() {
                    if let Ok(line_number) = line_num.parse::<usize>() {
                        let lines: Vec<&str> = content.lines().collect();
                        if line_number > 0 && line_number <= lines.len() {
                            println!("🔍 Problematic line {}: {}", line_number, lines[line_number - 1]);
                            
                            // Show context
                            let start = line_number.saturating_sub(3);
                            let end = std::cmp::min(line_number + 2, lines.len());
                            println!("📄 Context:");
                            for i in start..end {
                                let marker = if i + 1 == line_number { ">>> " } else { "    " };
                                println!("{}{}: {}", marker, i + 1, lines[i]);
                            }
                        }
                    }
                }
            }
            
            Err(e.into())
        }
    }
}
