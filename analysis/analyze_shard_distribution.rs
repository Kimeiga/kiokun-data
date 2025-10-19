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

fn get_shard_name(word: &str) -> String {
    let total_len = word.chars().count();
    let han_count = count_han_chars(word);
    let has_kana = has_kana(word);
    
    // Non-han (Latin, numbers, etc.)
    if han_count == 0 && !has_kana {
        return "non-han-non-kana".to_string();
    }
    
    // Kana only
    if han_count == 0 && has_kana {
        return "kana-only".to_string();
    }
    
    // 1 han character
    if han_count == 1 {
        return match total_len {
            1 => "han1-len1".to_string(),
            2 => "han1-len2".to_string(),
            3 => "han1-len3".to_string(),
            _ => "han1-len4plus".to_string(),
        };
    }
    
    // 2 han characters
    if han_count == 2 {
        return match total_len {
            2 => "han2-len2".to_string(),
            3 => "han2-len3".to_string(),
            4 => "han2-len4".to_string(),
            _ => "han2-len5plus".to_string(),
        };
    }
    
    // 3 han characters
    if han_count == 3 {
        return match total_len {
            3 => "han3-len3".to_string(),
            4 => "han3-len4".to_string(),
            5 => "han3-len5".to_string(),
            _ => "han3-len6plus".to_string(),
        };
    }
    
    // 4+ han characters
    "han4plus".to_string()
}

fn analyze_directory(dir: &Path, shard_counts: &mut HashMap<String, usize>) -> std::io::Result<()> {
    if !dir.exists() {
        return Ok(());
    }
    
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Some(filename) = path.file_stem().and_then(|s| s.to_str()) {
                let shard = get_shard_name(filename);
                *shard_counts.entry(shard).or_insert(0) += 1;
            }
        }
    }
    
    Ok(())
}

fn main() -> std::io::Result<()> {
    let mut shard_counts: HashMap<String, usize> = HashMap::new();
    
    // Analyze all existing output directories
    let dirs = ["output_non-han", "output_han-1char", "output_han-2char", "output_han-3plus"];
    
    for dir_name in &dirs {
        let dir = Path::new(dir_name);
        println!("Analyzing {}...", dir_name);
        analyze_directory(dir, &mut shard_counts)?;
    }
    
    // Sort by count (descending)
    let mut sorted: Vec<_> = shard_counts.iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(a.1));
    
    println!("\n=== Proposed Shard Distribution ===\n");
    println!("{:<20} {:>10}", "Shard Name", "File Count");
    println!("{}", "=".repeat(32));
    
    let mut total = 0;
    for (shard, count) in &sorted {
        println!("{:<20} {:>10}", shard, count);
        total += *count;
    }
    
    println!("{}", "=".repeat(32));
    println!("{:<20} {:>10}", "TOTAL", total);
    
    // Find max shard size
    if let Some((max_shard, max_count)) = sorted.first() {
        println!("\nLargest shard: {} with {} files", max_shard, max_count);
    }
    
    // Calculate GitHub repo limits (20K files per repo)
    let github_limit = 20_000;
    let repos_needed = (total + github_limit - 1) / github_limit;
    println!("GitHub repos needed (20K limit): {}", repos_needed);
    
    Ok(())
}

