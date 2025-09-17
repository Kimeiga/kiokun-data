use std::fs;
use serde_json;

mod combined_types;
use combined_types::CombinedDictionary;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔍 Inspecting unified entries...");
    
    let content = fs::read_to_string("output/combined_dictionary.json")?;
    let dict: CombinedDictionary = serde_json::from_str(&content)?;
    
    println!("📊 Dictionary loaded: {} total entries", dict.entries.len());
    
    // Find unified entries (have both Chinese and Japanese data)
    let unified_entries: Vec<_> = dict.entries.iter()
        .filter(|entry| entry.metadata.is_unified)
        .take(10)
        .collect();
    
    println!("\n🔍 Sample unified entries for quality inspection:\n");
    
    for (i, entry) in unified_entries.iter().enumerate() {
        println!("{}. Word: {}", i + 1, entry.word);
        
        if let Some(chinese) = &entry.chinese_entry {
            println!("   🇨🇳 Chinese:");
            println!("      Simplified: {}", chinese.simp);
            println!("      Traditional: {}", chinese.trad);
            if let Some(gloss) = &chinese.gloss {
                println!("      Meaning: {}", gloss);
            }
            if let Some(first_item) = chinese.items.first() {
                if let Some(pinyin) = &first_item.pinyin {
                    println!("      Pinyin: {}", pinyin);
                }
                if let Some(definitions) = &first_item.definitions {
                    if let Some(first_def) = definitions.first() {
                        println!("      Definition: {}", first_def);
                    }
                }
            }
        }
        
        if let Some(japanese) = &entry.japanese_entry {
            println!("   🇯🇵 Japanese:");
            println!("      ID: {}", japanese.id);
            if let Some(first_kanji) = japanese.kanji.first() {
                println!("      Kanji: {}", first_kanji.text);
            }
            if let Some(first_kana) = japanese.kana.first() {
                println!("      Kana: {}", first_kana.text);
            }
            if let Some(first_sense) = japanese.sense.first() {
                if let Some(first_gloss) = first_sense.gloss.first() {
                    println!("      Meaning: {}", first_gloss.text);
                }
            }
        }
        
        println!("   📈 Metadata:");
        println!("      Chinese entries: {}", entry.metadata.chinese_count);
        println!("      Japanese entries: {}", entry.metadata.japanese_count);
        println!();
    }
    
    Ok(())
}
