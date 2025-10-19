use std::collections::HashMap;
use std::fs;
use std::path::Path;

fn is_han_character(c: char) -> bool {
    matches!(c,
        '\u{4E00}'..='\u{9FFF}'   | // CJK Unified Ideographs
        '\u{3400}'..='\u{4DBF}'   | // CJK Extension A
        '\u{20000}'..='\u{2A6DF}' | // CJK Extension B
        '\u{2A700}'..='\u{2B73F}' | // CJK Extension C
        '\u{2B740}'..='\u{2B81F}' | // CJK Extension D
        '\u{2B820}'..='\u{2CEAF}' | // CJK Extension E
        '\u{2CEB0}'..='\u{2EBEF}' | // CJK Extension F
        '\u{30000}'..='\u{3134F}'   // CJK Extension G
    )
}

fn is_kana(c: char) -> bool {
    matches!(c,
        '\u{3040}'..='\u{309F}' | // Hiragana
        '\u{30A0}'..='\u{30FF}'   // Katakana
    )
}

fn count_han_chars(s: &str) -> usize {
    s.chars().filter(|&c| is_han_character(c)).count()
}

fn has_kana(s: &str) -> bool {
    s.chars().any(|c| is_kana(c))
}

fn get_first_han_char(s: &str) -> Option<char> {
    s.chars().find(|&c| is_han_character(c))
}

fn analyze_directory(dir: &Path) -> std::io::Result<()> {
    if !dir.exists() {
        return Ok(());
    }
    
    let mut total_han2_len2 = 0;
    let mut with_kana = 0;
    let mut no_kana = 0;
    
    // Unicode range splits
    let mut range_counts: HashMap<String, usize> = HashMap::new();
    
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Some(filename) = path.file_stem().and_then(|s| s.to_str()) {
                let total_len = filename.chars().count();
                let han_count = count_han_chars(filename);
                
                // Only analyze han2-len2 files
                if han_count == 2 && total_len == 2 {
                    total_han2_len2 += 1;
                    
                    // Kana analysis
                    if has_kana(filename) {
                        with_kana += 1;
                    } else {
                        no_kana += 1;
                    }
                    
                    // Unicode range analysis
                    if let Some(first_char) = get_first_han_char(filename) {
                        let code = first_char as u32;
                        let range = match code {
                            0x4E00..=0x5FFF => "4E00-5FFF",
                            0x6000..=0x6FFF => "6000-6FFF",
                            0x7000..=0x7FFF => "7000-7FFF",
                            0x8000..=0x8FFF => "8000-8FFF",
                            0x9000..=0x9FFF => "9000-9FFF",
                            _ => "other",
                        };
                        *range_counts.entry(range.to_string()).or_insert(0) += 1;
                    }
                }
            }
        }
    }
    
    println!("\n=== han2-len2 Analysis ===");
    println!("Total han2-len2 files: {}", total_han2_len2);
    
    println!("\n--- Split by Kana Presence ---");
    println!("With kana: {} ({:.1}%)", with_kana, (with_kana as f64 / total_han2_len2 as f64) * 100.0);
    println!("No kana:   {} ({:.1}%)", no_kana, (no_kana as f64 / total_han2_len2 as f64) * 100.0);
    
    println!("\n--- Split by Unicode Range (first character) ---");
    let mut sorted_ranges: Vec<_> = range_counts.iter().collect();
    sorted_ranges.sort_by_key(|(range, _)| *range);
    
    for (range, count) in sorted_ranges {
        println!("{}: {} ({:.1}%)", range, count, (*count as f64 / total_han2_len2 as f64) * 100.0);
    }
    
    // Suggest optimal splits
    println!("\n=== Suggested Splits ===");
    
    // Option 1: By kana
    println!("\nOption 1: Split by kana presence");
    println!("  han2-len2-with-kana: {}", with_kana);
    println!("  han2-len2-no-kana:   {}", no_kana);
    
    // Option 2: By Unicode range (2-way split)
    let range1 = range_counts.get("4E00-5FFF").unwrap_or(&0) + 
                 range_counts.get("6000-6FFF").unwrap_or(&0);
    let range2 = range_counts.get("7000-7FFF").unwrap_or(&0) + 
                 range_counts.get("8000-8FFF").unwrap_or(&0) + 
                 range_counts.get("9000-9FFF").unwrap_or(&0);
    
    println!("\nOption 2: Split by Unicode range (2-way)");
    println!("  han2-len2-4E-6F: {} (U+4E00-U+6FFF)", range1);
    println!("  han2-len2-70-9F: {} (U+7000-U+9FFF)", range2);
    
    // Option 3: By Unicode range (3-way split)
    let r1 = range_counts.get("4E00-5FFF").unwrap_or(&0);
    let r2 = range_counts.get("6000-6FFF").unwrap_or(&0) + 
             range_counts.get("7000-7FFF").unwrap_or(&0);
    let r3 = range_counts.get("8000-8FFF").unwrap_or(&0) + 
             range_counts.get("9000-9FFF").unwrap_or(&0);
    
    println!("\nOption 3: Split by Unicode range (3-way)");
    println!("  han2-len2-4E-5F: {} (U+4E00-U+5FFF)", r1);
    println!("  han2-len2-60-7F: {} (U+6000-U+7FFF)", r2);
    println!("  han2-len2-80-9F: {} (U+8000-U+9FFF)", r3);
    
    Ok(())
}

fn main() -> std::io::Result<()> {
    // Analyze han-2char directory (where han2-len2 files are)
    let dir = Path::new("output_han-2char");
    println!("Analyzing {}...", dir.display());
    analyze_directory(dir)?;
    
    Ok(())
}

