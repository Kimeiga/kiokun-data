# Dictionary Types Reference

This document explains the generated Rust types for the Chinese and Japanese dictionaries.

## Generated Files

- `schemas/chinese_types.rs` - Rust types for Chinese dictionary (JSONL format)
- `schemas/japanese_types.rs` - Rust types for Japanese dictionary (JSON format)

## Usage in Rust Project

### 1. Add to your Cargo.toml

```toml
[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### 2. Include the generated types

```rust
// In your main.rs or lib.rs
mod chinese_types;
mod japanese_types;

use chinese_types::{ChineseDictionary, ChineseDictionaryElement};
use japanese_types::{JapaneseEntry, Word};
```

### 3. Parse the dictionaries

```rust
use std::fs;
use std::io::{BufRead, BufReader};

// Parse Japanese dictionary (single JSON file)
fn load_japanese_dict() -> Result<JapaneseEntry, Box<dyn std::error::Error>> {
    let content = fs::read_to_string("data/jmdict-examples-eng-3.6.1.json")?;
    let japanese_dict: JapaneseEntry = serde_json::from_str(&content)?;
    Ok(japanese_dict)
}

// Parse Chinese dictionary (JSONL file - line by line)
fn load_chinese_dict() -> Result<Vec<ChineseDictionaryElement>, Box<dyn std::error::Error>> {
    let file = fs::File::open("data/chinese_dictionary_word_2025-06-25.jsonl")?;
    let reader = BufReader::new(file);
    let mut entries = Vec::new();
    
    for line in reader.lines() {
        let line = line?;
        if !line.trim().is_empty() {
            let entry: ChineseDictionaryElement = serde_json::from_str(&line)?;
            entries.push(entry);
        }
    }
    
    Ok(entries)
}
```

### 4. Dictionary Matching Logic

```rust
use std::collections::HashMap;

fn create_combined_dictionary() -> Result<(), Box<dyn std::error::Error>> {
    // Load both dictionaries
    let japanese_dict = load_japanese_dict()?;
    let chinese_entries = load_chinese_dict()?;
    
    // Create lookup map for Chinese entries
    let mut chinese_map: HashMap<String, &ChineseDictionaryElement> = HashMap::new();
    
    for entry in &chinese_entries {
        // Index by both simplified and traditional forms
        chinese_map.insert(entry.simp.clone(), entry);
        chinese_map.insert(entry.trad.clone(), entry);
    }
    
    // Match Japanese words with Chinese entries
    for word in japanese_dict.words {
        for kanji in &word.kanji {
            if let Some(chinese_entry) = chinese_map.get(&kanji.text) {
                println!("Match found: {} (JP: {}, CN: {})", 
                    kanji.text,
                    word.sense.first()
                        .and_then(|s| s.gloss.first())
                        .map(|g| &g.text)
                        .unwrap_or("no meaning"),
                    chinese_entry.gloss
                );
                
                // Create combined entry here
                // ...
            }
        }
    }
    
    Ok(())
}
```

## Key Data Structures

### Chinese Dictionary Entry

```rust
ChineseDictionaryElement {
    id: String,           // MongoDB ObjectId
    simp: String,         // Simplified Chinese (KEY for matching)
    trad: String,         // Traditional Chinese (KEY for matching)
    items: Vec<Item>,     // Definitions, pronunciations
    gloss: String,        // English summary
    pinyin_search_string: String,
    statistics: Option<Statistics>, // Usage statistics
}
```

### Japanese Dictionary Entry

```rust
Word {
    id: String,           // JMDict ID
    kanji: Vec<Kanji>,    // Kanji forms (KEY for matching: kanji.text)
    kana: Vec<Kana>,      // Hiragana/Katakana readings
    sense: Vec<Sense>,    // Meanings, examples, etc.
}
```

## Matching Strategy

1. **Primary matching**: `japanese_word.kanji[].text` ↔ `chinese_entry.simp`
2. **Secondary matching**: `japanese_word.kanji[].text` ↔ `chinese_entry.trad`
3. **Create combined entry** when matches are found

## Scripts

- `scripts/generate_chinese_types.sh [sample_size]` - Regenerate Chinese types
- `scripts/jsonl_to_json.py` - Convert JSONL to JSON
- `scripts/test_types.py` - Test type definitions

## Example Match

**Chinese Entry:**
```json
{
  "simp": "学生",
  "trad": "學生", 
  "gloss": "student",
  "items": [{"pinyin": "xuésheng", "definitions": ["student", "schoolchild"]}]
}
```

**Japanese Entry:**
```json
{
  "kanji": [{"text": "学生"}],
  "kana": [{"text": "がくせい"}],
  "sense": [{"gloss": [{"text": "student (esp. a university student)"}]}]
}
```

**Result:** Perfect match on `学生` → Create combined dictionary entry with both Chinese and Japanese data.
