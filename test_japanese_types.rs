use std::fs;
use serde_json;

mod japanese_types;
use japanese_types::JapaneseEntry;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Testing Japanese types deserialization...");
    
    // Read just the first 1000 characters to test
    let content = fs::read_to_string("data/jmdict-examples-eng-3.6.1.json")?;
    let first_part = &content[0..std::cmp::min(10000, content.len())];
    
    println!("First part of JSON: {}", &first_part[0..500]);
    
    // Try to parse the full file
    println!("Attempting to parse full Japanese dictionary...");
    match serde_json::from_str::<JapaneseEntry>(&content) {
        Ok(dict) => {
            println!("✅ Successfully parsed Japanese dictionary!");
            println!("Number of words: {}", dict.words.len());
        }
        Err(e) => {
            println!("❌ Failed to parse: {}", e);
            
            // Try to find the problematic line
            if let Some(line_info) = e.to_string().split(" at line ").nth(1) {
                if let Some(line_num) = line_info.split(" column ").next() {
                    if let Ok(line_number) = line_num.parse::<usize>() {
                        let lines: Vec<&str> = content.lines().collect();
                        if line_number > 0 && line_number <= lines.len() {
                            println!("Problematic line {}: {}", line_number, lines[line_number - 1]);
                        }
                    }
                }
            }
        }
    }
    
    Ok(())
}
