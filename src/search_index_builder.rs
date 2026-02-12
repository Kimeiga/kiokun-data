/// Search Index Builder
/// Extracts all definitions from Chinese and Japanese dictionaries
/// and outputs them as CSV for bulk import into Cloudflare D1

use anyhow::Result;
use std::fs::File;
use std::io::Write;
use crate::chinese_types::ChineseDictionaryElement;
use crate::japanese_types::Word;
use crate::romaji::kana_to_romaji;
use crate::pinyin::normalize_pinyin;

/// Represents a searchable dictionary entry
#[derive(Debug, Clone)]
pub struct SearchEntry {
    pub word: String,
    pub language: String,
    pub definition: String,
    pub pronunciation: String,
    pub reading_search: String,  // Searchable romanization (romaji for Japanese, normalized pinyin for Chinese)
    pub is_common: bool,
}

/// Build search index from Chinese and Japanese dictionaries
/// Outputs CSV file that can be imported into D1 using wrangler
pub async fn build_search_index(
    chinese_entries: &[ChineseDictionaryElement],
    japanese_words: &[Word],
    output_path: &str,
) -> Result<()> {
    println!("🔍 Building search index...");
    
    let mut entries = Vec::new();
    
    // Extract Chinese entries
    println!("  📖 Processing Chinese entries...");
    for chinese_entry in chinese_entries {
        // Use traditional Chinese as the primary key
        let word = &chinese_entry.trad;

        for item in &chinese_entry.items {
            if let Some(definitions) = &item.definitions {
                let pronunciation = item.pinyin.as_deref().unwrap_or("");
                // Normalize pinyin for search (strip tones: "tiàn" → "tian")
                let reading_search = normalize_pinyin(pronunciation);

                for definition in definitions {
                    entries.push(SearchEntry {
                        word: word.clone(),
                        language: "chinese".to_string(),
                        definition: definition.clone(),
                        pronunciation: pronunciation.to_string(),
                        reading_search: reading_search.clone(),
                        is_common: false, // Chinese doesn't have is_common flag
                    });
                }
            }
        }
    }
    
    println!("  ✅ Processed {} Chinese entries", entries.len());
    
    // Extract Japanese entries
    println!("  📖 Processing Japanese entries...");
    let japanese_start = entries.len();

    for japanese_word in japanese_words {
        // Get the first kanji or kana as the word key
        let word = if !japanese_word.kanji.is_empty() {
            &japanese_word.kanji[0].text
        } else if !japanese_word.kana.is_empty() {
            &japanese_word.kana[0].text
        } else {
            continue; // Skip if no kanji or kana
        };

        // Get pronunciation (first kana reading)
        let pronunciation = if !japanese_word.kana.is_empty() {
            &japanese_word.kana[0].text
        } else {
            ""
        };

        // Convert kana to romaji for searchable reading
        let reading_search = kana_to_romaji(pronunciation);

        // Check if word is common (any kanji or kana marked as common)
        let is_common = japanese_word.kanji.iter().any(|k| k.common)
            || japanese_word.kana.iter().any(|k| k.common);

        // Extract all definitions from all senses
        for sense in &japanese_word.sense {
            for gloss in &sense.gloss {
                entries.push(SearchEntry {
                    word: word.clone(),
                    language: "japanese".to_string(),
                    definition: gloss.text.clone(),
                    pronunciation: pronunciation.to_string(),
                    reading_search: reading_search.clone(),
                    is_common,
                });
            }
        }
    }
    
    println!("  ✅ Processed {} Japanese entries", entries.len() - japanese_start);
    println!("  📊 Total entries: {}", entries.len());
    
    // Write to CSV file
    println!("  💾 Writing to {}...", output_path);
    let mut file = File::create(output_path)?;
    
    // Write CSV header
    writeln!(file, "word,language,definition,pronunciation,reading_search,is_common")?;

    // Write entries
    for entry in &entries {
        // Escape CSV fields (handle quotes and commas)
        let word = escape_csv_field(&entry.word);
        let language = &entry.language;
        let definition = escape_csv_field(&entry.definition);
        let pronunciation = escape_csv_field(&entry.pronunciation);
        let reading_search = escape_csv_field(&entry.reading_search);
        let is_common = if entry.is_common { "1" } else { "0" };

        writeln!(
            file,
            "{},{},{},{},{},{}",
            word, language, definition, pronunciation, reading_search, is_common
        )?;
    }
    
    println!("  ✅ Search index written to {}", output_path);
    println!("  📊 Total searchable definitions: {}", entries.len());
    
    // Print import instructions
    println!("\n📝 To import into Cloudflare D1:");
    println!("  1. Drop old table and run migration: wrangler d1 execute kiokun-notes-db --remote --file=sveltekit-app/migrations/0003_search_index_with_reading.sql");
    println!("  2. Import CSV: wrangler d1 execute kiokun-notes-db --remote --command=\".mode csv\" --command=\".import {} dictionary_search\"", output_path);
    println!("\n  Note: For local development, replace --remote with --local");
    println!("  The reading_search column enables searching by romaji (Japanese) or pinyin (Chinese).");
    
    Ok(())
}

/// Escape CSV field by wrapping in quotes and escaping internal quotes
fn escape_csv_field(field: &str) -> String {
    if field.contains(',') || field.contains('"') || field.contains('\n') {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_escape_csv_field() {
        assert_eq!(escape_csv_field("simple"), "simple");
        assert_eq!(escape_csv_field("with, comma"), "\"with, comma\"");
        assert_eq!(escape_csv_field("with \"quotes\""), "\"with \"\"quotes\"\"\"");
        assert_eq!(escape_csv_field("with\nnewline"), "\"with\nnewline\"");
    }
}

