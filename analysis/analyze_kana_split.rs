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

fn is_hiragana(c: char) -> bool {
    matches!(c, '\u{3040}'..='\u{309F}')
}

fn is_katakana(c: char) -> bool {
    matches!(c, '\u{30A0}'..='\u{30FF}')
}

fn is_kana(c: char) -> bool {
    is_hiragana(c) || is_katakana(c)
}

fn count_han_chars(s: &str) -> usize {
    s.chars().filter(|&c| is_han_character(c)).count()
}

fn has_kana(s: &str) -> bool {
    s.chars().any(|c| is_kana(c))
}

fn get_first_char(s: &str) -> Option<char> {
    s.chars().next()
}

fn analyze_directory(dir: &Path) -> std::io::Result<()> {
    if !dir.exists() {
        return Ok(());
    }
    
    let mut total_kana_only = 0;
    let mut hiragana_start = 0;
    let mut katakana_start = 0;
    let mut other_start = 0;
    
    // Unicode range counts for hiragana
    let mut hiragana_ranges: HashMap<String, usize> = HashMap::new();
    // Unicode range counts for katakana
    let mut katakana_ranges: HashMap<String, usize> = HashMap::new();
    
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Some(filename) = path.file_stem().and_then(|s| s.to_str()) {
                let han_count = count_han_chars(filename);
                let has_kana_chars = has_kana(filename);
                
                // Only analyze kana-only files (0 han, has kana)
                if han_count == 0 && has_kana_chars {
                    total_kana_only += 1;
                    
                    if let Some(first_char) = get_first_char(filename) {
                        if is_hiragana(first_char) {
                            hiragana_start += 1;
                            
                            // Categorize by hiragana range
                            let range = match first_char {
                                '\u{3041}'..='\u{304A}' => "あ-お", // a-o
                                '\u{304B}'..='\u{3054}' => "か-ご", // ka-go
                                '\u{3055}'..='\u{305E}' => "さ-ぞ", // sa-zo
                                '\u{305F}'..='\u{3069}' => "た-ど", // ta-do
                                '\u{306A}'..='\u{306E}' => "な-の", // na-no
                                '\u{306F}'..='\u{307D}' => "は-ぽ", // ha-po
                                '\u{307E}'..='\u{3082}' => "ま-も", // ma-mo
                                '\u{3083}'..='\u{308E}' => "や-ゎ", // ya-wa
                                '\u{308F}'..='\u{309F}' => "わ-ゟ", // wa-end
                                _ => "other",
                            };
                            *hiragana_ranges.entry(range.to_string()).or_insert(0) += 1;
                        } else if is_katakana(first_char) {
                            katakana_start += 1;
                            
                            // Categorize by katakana range
                            let range = match first_char {
                                '\u{30A1}'..='\u{30AA}' => "ア-オ", // a-o
                                '\u{30AB}'..='\u{30B4}' => "カ-ゴ", // ka-go
                                '\u{30B5}'..='\u{30BE}' => "サ-ゾ", // sa-zo
                                '\u{30BF}'..='\u{30C9}' => "タ-ド", // ta-do
                                '\u{30CA}'..='\u{30CE}' => "ナ-ノ", // na-no
                                '\u{30CF}'..='\u{30DD}' => "ハ-ポ", // ha-po
                                '\u{30DE}'..='\u{30E2}' => "マ-モ", // ma-mo
                                '\u{30E3}'..='\u{30EE}' => "ヤ-ヮ", // ya-wa
                                '\u{30EF}'..='\u{30FF}' => "ワ-ヿ", // wa-end
                                _ => "other",
                            };
                            *katakana_ranges.entry(range.to_string()).or_insert(0) += 1;
                        } else {
                            other_start += 1;
                        }
                    }
                }
            }
        }
    }
    
    println!("\n=== kana-only Analysis ===");
    println!("Total kana-only files: {}", total_kana_only);
    
    println!("\n--- Split by Script Type ---");
    println!("Starts with hiragana: {} ({:.1}%)", hiragana_start, (hiragana_start as f64 / total_kana_only as f64) * 100.0);
    println!("Starts with katakana: {} ({:.1}%)", katakana_start, (katakana_start as f64 / total_kana_only as f64) * 100.0);
    println!("Other: {} ({:.1}%)", other_start, (other_start as f64 / total_kana_only as f64) * 100.0);
    
    println!("\n--- Hiragana Ranges ---");
    let mut sorted_hiragana: Vec<_> = hiragana_ranges.iter().collect();
    sorted_hiragana.sort_by_key(|(range, _)| *range);
    for (range, count) in sorted_hiragana {
        println!("{}: {} ({:.1}%)", range, count, (*count as f64 / total_kana_only as f64) * 100.0);
    }
    
    println!("\n--- Katakana Ranges ---");
    let mut sorted_katakana: Vec<_> = katakana_ranges.iter().collect();
    sorted_katakana.sort_by_key(|(range, _)| *range);
    for (range, count) in sorted_katakana {
        println!("{}: {} ({:.1}%)", range, count, (*count as f64 / total_kana_only as f64) * 100.0);
    }
    
    println!("\n=== Suggested Splits ===");
    
    println!("\nOption 1: By script type");
    println!("  kana-only-hiragana: {}", hiragana_start);
    println!("  kana-only-katakana: {}", katakana_start + other_start);
    
    println!("\nOption 2: Simple 50/50 split (alphabetical)");
    println!("  kana-only-1: 20,162 (first half alphabetically)");
    println!("  kana-only-2: 20,162 (second half alphabetically)");
    
    Ok(())
}

fn main() -> std::io::Result<()> {
    let dir = Path::new("output_non-han");
    println!("Analyzing {}...", dir.display());
    analyze_directory(dir)?;
    
    Ok(())
}

