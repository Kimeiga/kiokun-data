// Core types - Testing auto-deployment 2025-01-27
mod chinese_types;
mod japanese_types;
mod chinese_char_types;
mod japanese_char_types;
mod ids_types;
mod combined_types;
mod jmnedict_types;
mod analysis;
mod simple_output_types;
mod word_preview_types;

// Legacy unification code (not used in default simple output)
mod legacy_unification {
    pub mod improved_unified_types;
    pub mod improved_unification_engine;
    pub mod unified_character_types;
    pub mod unified_output_types;
    pub mod semantic_unification_engine;
    pub mod learner_focused_analyzer;
}

use anyhow::{Context, Result};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};

use std::process::Command as ProcessCommand;
use clap::{Arg, ArgAction, Command};
use serde_json;

use chinese_types::ChineseDictionaryElement;
use japanese_types::{JapaneseEntry, Word, PitchAccentDatabase};
use chinese_char_types::ChineseCharacter;
use japanese_char_types::{KanjiDictionary, KanjiCharacter};
use ids_types::{IdsEntry, IdsDatabase};
use jmnedict_types::{JmnedictEntry, JmnedictRoot};
use legacy_unification::unified_character_types::UnifiedCharacterEntry;
use combined_types::{
    CombinedDictionary, CombinedEntry, CombinedMetadata, KeySource,
    MergeStatistics, DictionaryMetadata
};
use legacy_unification::semantic_unification_engine::SemanticUnificationEngine;

/// Determines which shard a key belongs to based on Han character count and length
/// This creates 10 shards optimized for GitHub deployment (32K-45K files each)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum ShardType {
    // Non-Han (all non-Chinese: ~44,890 files)
    NonHan,

    // Han 1-character split (89,626 total → 2 shards)
    Han1Char1,  // ~44,813 files (hash-based split)
    Han1Char2,  // ~44,813 files (hash-based split)

    // Han 2-character split (102,800 total → 3 shards)
    Han2Char1,  // ~34,267 files (hash-based split)
    Han2Char2,  // ~34,267 files (hash-based split)
    Han2Char3,  // ~34,266 files (hash-based split)

    // Han 3+ character split (96,129 total → 3 shards)
    Han3Plus1,  // ~32,043 files (hash-based split)
    Han3Plus2,  // ~32,043 files (hash-based split)
    Han3Plus3,  // ~32,043 files (hash-based split)

    // Reserved for future growth
    Reserved,
}

impl ShardType {
    /// Determine shard type from a key string (10-shard system)
    fn from_key(key: &str) -> Self {
        let han_count = key.chars().filter(|c| is_han_character(*c)).count();

        match han_count {
            0 => {
                // All non-Han characters (includes kana, Latin, etc.)
                ShardType::NonHan
            }
            1 => {
                // Single Han character: split into 2 shards using hash
                let hash = Self::simple_hash(key);
                if hash % 2 == 0 {
                    ShardType::Han1Char1
                } else {
                    ShardType::Han1Char2
                }
            }
            2 => {
                // Two Han characters: split into 3 shards using hash
                let hash = Self::simple_hash(key);
                match hash % 3 {
                    0 => ShardType::Han2Char1,
                    1 => ShardType::Han2Char2,
                    _ => ShardType::Han2Char3,
                }
            }
            _ => {
                // Three or more Han characters: split into 3 shards using hash
                let hash = Self::simple_hash(key);
                match hash % 3 {
                    0 => ShardType::Han3Plus1,
                    1 => ShardType::Han3Plus2,
                    _ => ShardType::Han3Plus3,
                }
            }
        }
    }

    /// Simple hash function for consistent distribution
    fn simple_hash(s: &str) -> usize {
        s.chars().fold(0usize, |acc, c| acc.wrapping_mul(31).wrapping_add(c as usize))
    }

    /// Get the output directory name for this shard
    fn output_dir(&self) -> &'static str {
        match self {
            ShardType::NonHan => "output_non-han",
            ShardType::Han1Char1 => "output_han-1char-1",
            ShardType::Han1Char2 => "output_han-1char-2",
            ShardType::Han2Char1 => "output_han-2char-1",
            ShardType::Han2Char2 => "output_han-2char-2",
            ShardType::Han2Char3 => "output_han-2char-3",
            ShardType::Han3Plus1 => "output_han-3plus-1",
            ShardType::Han3Plus2 => "output_han-3plus-2",
            ShardType::Han3Plus3 => "output_han-3plus-3",
            ShardType::Reserved => "output_reserved",
        }
    }

    /// Parse from CLI mode string (10-shard system)
    fn from_mode_str(mode: &str) -> Option<Self> {
        match mode {
            "non-han" => Some(ShardType::NonHan),
            "han-1char-1" => Some(ShardType::Han1Char1),
            "han-1char-2" => Some(ShardType::Han1Char2),
            "han-2char-1" => Some(ShardType::Han2Char1),
            "han-2char-2" => Some(ShardType::Han2Char2),
            "han-2char-3" => Some(ShardType::Han2Char3),
            "han-3plus-1" => Some(ShardType::Han3Plus1),
            "han-3plus-2" => Some(ShardType::Han3Plus2),
            "han-3plus-3" => Some(ShardType::Han3Plus3),
            "reserved" => Some(ShardType::Reserved),
            _ => None,
        }
    }
}

/// Check if a character is kana (hiragana or katakana)
#[allow(dead_code)]
fn is_kana(c: char) -> bool {
    matches!(c,
        '\u{3040}'..='\u{309F}' | // Hiragana
        '\u{30A0}'..='\u{30FF}'   // Katakana
    )
}

/// Check if a character is a Han character (CJK Unified Ideographs)
fn is_han_character(c: char) -> bool {
    matches!(c,
        '\u{4E00}'..='\u{9FFF}'   | // CJK Unified Ideographs
        '\u{3400}'..='\u{4DBF}'   | // CJK Unified Ideographs Extension A
        '\u{20000}'..='\u{2A6DF}' | // CJK Unified Ideographs Extension B
        '\u{2A700}'..='\u{2B73F}' | // CJK Unified Ideographs Extension C
        '\u{2B740}'..='\u{2B81F}' | // CJK Unified Ideographs Extension D
        '\u{2B820}'..='\u{2CEAF}' | // CJK Unified Ideographs Extension E
        '\u{2CEB0}'..='\u{2EBEF}' | // CJK Unified Ideographs Extension F
        '\u{30000}'..='\u{3134F}'   // CJK Unified Ideographs Extension G
    )
}

#[tokio::main]
async fn main() -> Result<()> {
    let matches = Command::new("Dictionary Merger")
        .version("1.0")
        .about("Merges Chinese and Japanese dictionaries")
        .arg(
            Arg::new("generate-j2c-mapping")
                .long("generate-j2c-mapping")
                .help("Generate Japanese to Chinese mapping file")
                .action(clap::ArgAction::SetTrue)
        )

        .arg(
            Arg::new("individual-files")
                .long("individual-files")
                .help("Generate individual JSON files for each word")
                .action(ArgAction::SetTrue),
        )

        .arg(
            Arg::new("unified-only")
                .long("unified-only")
                .help("Only generate files for unified entries (entries with both Chinese and Japanese data)")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("analysis")
                .long("analysis")
                .help("Run analysis mode - load data in memory without generating files")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("find-max-representations")
                .long("find-max-representations")
                .help("Find Japanese entries with the most kanji and kana representations (≥2 each)")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("analyze-variants")
                .long("analyze-variants")
                .help("Analyze Chinese dictionary entries with 'variant of' definitions")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("analyze-variant-file-size")
                .long("analyze-variant-file-size")
                .help("Analyze file size impact of adding variant_refs field")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("analyze-variant-resolution")
                .long("analyze-variant-resolution")
                .help("Analyze file size impact of resolving variant definitions")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("compare-variant-approaches")
                .long("compare-variant-approaches")
                .help("Compare variant_refs vs full resolution approaches")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("resolve-variants")
                .long("resolve-variants")
                .help("Resolve variant definitions during dictionary processing")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("analyze-pinyin-coverage")
                .long("analyze-pinyin-coverage")
                .help("Analyze pinyin-definition coverage in Chinese dictionary")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("analyze-unicode-source")
                .long("analyze-unicode-source")
                .help("Analyze Unicode source items for definition coverage")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("analyze-multi-reading-overlap")
                .long("analyze-multi-reading-overlap")
                .help("Find characters with multiple readings in both languages like 的")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("analyze-complexity-tiers")
                .long("analyze-complexity-tiers")
                .help("Analyze complexity tiers for multi-reading characters")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("test-learner-focused")
                .long("test-learner-focused")
                .help("Test learner-focused analysis on specific characters")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("test-semantic-unification")
                .long("test-semantic-unification")
                .help("Test semantic unification engine on specific characters")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("unified-output")
                .long("unified-output")
                .help("Generate unified output with semantic unification and merged character data")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("include-pitch-accent")
                .long("include-pitch-accent")
                .help("Include pitch accent data in Japanese word entries")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("mode")
                .long("mode")
                .value_name("SHARD_TYPE")
                .help("Specify which shard to build (10-shard system) or 'all' for all shards (default: all)")
                .value_parser([
                    "non-han", "han-1char-1", "han-1char-2", "han-2char-1", 
                    "han-2char-2", "han-2char-3", "han-3plus-1", "han-3plus-2", 
                    "han-3plus-3", "reserved", "all"
                ])
                .default_value("all"),
        )
        .arg(
            Arg::new("shard-output")
                .long("shard-output")
                .help("Output files into 10 shard subdirectories using the optimized sharding system")
                .action(ArgAction::SetTrue),
        )
        .get_matches();

    if matches.get_flag("generate-j2c-mapping") {
        println!("🔄 Generating Japanese to Chinese mapping...");
        generate_j2c_mapping().await?;
        return Ok(());
    }

    // Check if kanji-kana representation analysis is requested
    if matches.get_flag("find-max-representations") {
        println!("🔍 Running kanji-kana representation analysis...");
        println!("📚 Loading Japanese dictionary...");
        let japanese_dict = load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")
            .context("Failed to load Japanese dictionary")?;

        analysis::find_most_kanji_kana_representations(&japanese_dict.words).await?;
        return Ok(());
    }

    // Check if variant analysis is requested
    if matches.get_flag("analyze-variants") {
        println!("🔍 Running variant analysis...");
        println!("📚 Loading Chinese dictionary...");
        let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
            .context("Failed to load Chinese dictionary")?;

        analysis::analyze_variant_definitions(&chinese_entries).await?;
        return Ok(());
    }

    // Check if variant file size analysis is requested
    if matches.get_flag("analyze-variant-file-size") {
        println!("🔍 Running variant file size analysis...");
        println!("📚 Loading Chinese dictionary...");
        let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
            .context("Failed to load Chinese dictionary")?;

        analysis::analyze_variant_file_size_impact(&chinese_entries).await?;
        return Ok(());
    }

    // Check if variant resolution analysis is requested
    if matches.get_flag("analyze-variant-resolution") {
        println!("🔍 Running variant resolution analysis...");
        println!("📚 Loading Chinese dictionary...");
        let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
            .context("Failed to load Chinese dictionary")?;

        analysis::analyze_variant_resolution_impact(&chinese_entries).await?;
        return Ok(());
    }

    // Check if pinyin coverage analysis is requested
    if matches.get_flag("analyze-pinyin-coverage") {
        println!("🔍 Running pinyin-definition coverage analysis...");
        println!("📚 Loading Chinese dictionary...");
        let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
            .context("Failed to load Chinese dictionary")?;

        analysis::analyze_pinyin_definition_coverage(&chinese_entries).await?;
        return Ok(());
    }

    // Check if Unicode source analysis is requested
    if matches.get_flag("analyze-unicode-source") {
        println!("🔍 Running Unicode source analysis...");
        println!("📚 Loading Chinese dictionary...");
        let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
            .context("Failed to load Chinese dictionary")?;

        analysis::analyze_unicode_source_coverage(&chinese_entries).await?;
        return Ok(());
    }

    // Check if multi-reading overlap analysis is requested
    if matches.get_flag("analyze-multi-reading-overlap") {
        println!("🔍 Running multi-reading overlap analysis...");
        println!("📚 Loading dictionaries...");
        let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
            .context("Failed to load Chinese dictionary")?;
        let japanese_dict = load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")
            .context("Failed to load Japanese dictionary")?;

        analysis::analyze_multi_reading_overlap(&chinese_entries, &japanese_dict.words).await?;
        return Ok(());
    }

    // Check if detailed complexity analysis is requested
    if matches.get_flag("analyze-complexity-tiers") {
        println!("🔍 Running detailed complexity tier analysis...");
        println!("📚 Loading dictionaries...");
        let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
            .context("Failed to load Chinese dictionary")?;
        let japanese_dict = load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")
            .context("Failed to load Japanese dictionary")?;

        analysis::analyze_complexity_tiers(&chinese_entries, &japanese_dict.words).await?;
        return Ok(());
    }

    // Check if learner-focused analysis test is requested
    if matches.get_flag("test-learner-focused") {
        println!("🔍 Testing learner-focused analysis...");
        test_learner_focused_analysis().await?;
        return Ok(());
    }

    // Check if semantic unification test is requested
    if matches.get_flag("test-semantic-unification") {
        println!("🧠 Testing semantic unification engine...");
        test_semantic_unification().await?;
        return Ok(());
    }

    // Check if variant approach comparison is requested
    if matches.get_flag("compare-variant-approaches") {
        println!("🔍 Comparing variant handling approaches...");
        println!("📚 Loading Chinese dictionary...");
        let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
            .context("Failed to load Chinese dictionary")?;

        analysis::compare_variant_approaches(&chinese_entries).await?;
        return Ok(());
    }

    println!("🚀 Starting dictionary merger...");

    // Create output directory
    fs::create_dir_all("output")?;
    
    // Load dictionaries
    println!("📚 Loading Chinese dictionary...");
    let mut chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
        .context("Failed to load Chinese dictionary")?;

    // Resolve variant definitions if requested
    if matches.get_flag("resolve-variants") {
        analysis::resolve_variant_definitions(&mut chinese_entries).await?;
    }

    println!("📚 Loading Japanese dictionary...");
    let mut japanese_dict = load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")
        .context("Failed to load Japanese dictionary")?;

    // Load and integrate pitch accent data if requested
    if matches.get_flag("include-pitch-accent") {
        println!("📚 Loading pitch accent data...");
        let pitch_data = load_pitch_accent_data("data/jmdict_pitch.json")
            .context("Failed to load pitch accent data")?;

        println!("🔧 Enriching Japanese words with pitch accent data...");
        enrich_japanese_words_with_pitch_accent(&mut japanese_dict.words, &pitch_data);
    }

    println!("📚 Loading Chinese character dictionary...");
    let mut chinese_char_dict = load_chinese_char_dictionary("data/chinese_dictionary_char_2025-06-25.jsonl")
        .context("Failed to load Chinese character dictionary")?;

    println!("📚 Loading Japanese character dictionary (KANJIDIC2)...");
    let mut japanese_char_dict = load_japanese_char_dictionary("data/kanjidic2-en-3.6.1.json")
        .context("Failed to load Japanese character dictionary")?;

    println!("📚 Loading JMnedict (Japanese Names Dictionary)...");
    let jmnedict_entries = load_jmnedict("data/jmnedict-all-3.6.1.json")
        .context("Failed to load JMnedict")?;

    println!("📚 Loading IDS (character decomposition) database...");
    let ids_database = load_all_ids_files()
        .context("Failed to load IDS files")?;
    println!("  ✅ Total unique characters in IDS database: {}", ids_database.len());

    println!("🔧 Enriching character dictionaries with IDS decomposition data...");
    enrich_chinese_chars_with_ids(&mut chinese_char_dict, &ids_database);
    enrich_japanese_chars_with_ids(&mut japanese_char_dict, &ids_database);

    println!("📚 Loading Japanese to Chinese mapping...");
    let j2c_mapping = load_j2c_mapping("output/j2c_mapping.json")
        .context("Failed to load J2C mapping. Run with --generate-j2c-mapping first.")?;
    println!("  ✅ Loaded {} J2C mappings", j2c_mapping.len());

    // Merge word dictionaries
    println!("🔄 Merging word dictionaries...");
    let combined_dict = merge_dictionaries_with_mapping(chinese_entries, japanese_dict.words, j2c_mapping.clone())
        .context("Failed to merge dictionaries")?;

    // Merge character dictionaries
    println!("🔄 Merging character dictionaries...");
    let unified_characters = merge_character_dictionaries(chinese_char_dict, japanese_char_dict, &j2c_mapping)
        .context("Failed to merge character dictionaries")?;

    // Check if analysis mode is requested
    if matches.get_flag("analysis") {
        println!("🔍 Running analysis mode...");
        analysis::run_analysis(&combined_dict).await?;
        return Ok(());
    }

    // Apply semantic alignment before generating output
    println!("🎯 Applying semantic alignment...");
    let aligned_dict = analysis::apply_semantic_alignment(combined_dict).await?;

    // Parse the mode argument to determine which shard(s) to build
    let mode_str = matches.get_one::<String>("mode").map(|s| s.as_str()).unwrap_or("all");
    let shard_filter: Option<ShardType> = ShardType::from_mode_str(mode_str);

    if mode_str != "all" && shard_filter.is_none() {
        anyhow::bail!("Invalid mode: {}. Use --help to see all 10 available shard types or 'all'", mode_str);
    }

    if let Some(shard) = shard_filter {
        println!("🎯 Building shard: {} (output to: {})", mode_str, shard.output_dir());
    } else {
        println!("🎯 Building all shards (output to: output_dictionary)");
    }

    // Check if individual files are requested
    if matches.get_flag("individual-files") {
        // Check if unified output is requested (non-default)
        if matches.get_flag("unified-output") {
            let unified_only = matches.get_flag("unified-only");
            println!("🔄 Generating unified individual JSON files (word + character data){}...",
                     if unified_only { " (unified entries only)" } else { "" });
            generate_unified_output_files(&aligned_dict, &unified_characters, unified_only, shard_filter).await?;
        } else {
            // Default: simple output with no unification
            // Need to reload the raw character dictionaries since they were consumed
            let chinese_char_dict_raw = load_chinese_char_dictionary("data/chinese_dictionary_char_2025-06-25.jsonl")
                .context("Failed to load Chinese character dictionary")?;
            let japanese_char_dict_raw = load_japanese_char_dictionary("data/kanjidic2-en-3.6.1.json")
                .context("Failed to load Japanese character dictionary")?;

            // Generate simple individual JSON files
            println!("🔄 Generating individual JSON files...");
            generate_simple_output_files(
                &aligned_dict,
                &chinese_char_dict_raw,
                &japanese_char_dict_raw.characters,
                &jmnedict_entries,
                shard_filter
            ).await?;
        }

        return Ok(());
    }

    // Save combined dictionary
    println!("💾 Saving combined dictionary...");
    save_combined_dictionary(&aligned_dict, "output/combined_dictionary.json")
        .context("Failed to save combined dictionary")?;

    // Print statistics
    print_statistics(&aligned_dict.statistics);

    println!("✅ Dictionary merger completed successfully!");
    println!("📁 Output saved to: output/combined_dictionary.json");
    
    Ok(())
}



fn load_chinese_dictionary(path: &str) -> Result<Vec<ChineseDictionaryElement>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let mut entries = Vec::new();
    
    for (line_num, line) in reader.lines().enumerate() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        
        match serde_json::from_str::<ChineseDictionaryElement>(&line) {
            Ok(entry) => entries.push(entry),
            Err(e) => {
                eprintln!("Warning: Failed to parse Chinese entry on line {}: {}", line_num + 1, e);
                continue;
            }
        }
        
        // Progress indicator
        if (entries.len()) % 10000 == 0 {
            println!("  Loaded {} Chinese entries...", entries.len());
        }
    }
    
    println!("  ✅ Loaded {} Chinese entries total", entries.len());
    Ok(entries)
}

fn load_japanese_dictionary(path: &str) -> Result<JapaneseEntry> {
    let content = fs::read_to_string(path)?;
    let japanese_dict: JapaneseEntry = serde_json::from_str(&content)?;
    println!("  ✅ Loaded {} Japanese words", japanese_dict.words.len());
    Ok(japanese_dict)
}

fn load_pitch_accent_data(path: &str) -> Result<PitchAccentDatabase> {
    let content = fs::read_to_string(path)?;
    let pitch_data: PitchAccentDatabase = serde_json::from_str(&content)?;
    println!("  ✅ Loaded pitch accent data for {} JMdict entries", pitch_data.entries.len());
    Ok(pitch_data)
}

fn enrich_japanese_words_with_pitch_accent(
    japanese_words: &mut Vec<Word>,
    pitch_data: &PitchAccentDatabase,
) {
    let mut enriched_words = 0;
    let mut enriched_readings = 0;

    for word in japanese_words.iter_mut() {
        if let Some(pitch_entries) = pitch_data.entries.get(&word.id) {
            let mut word_enriched = false;

            // For each kana reading in the word
            for kana in word.kana.iter_mut() {
                // Find matching pitch accent entries for this reading
                let matching_accents: Vec<u8> = pitch_entries
                    .iter()
                    .filter(|entry| entry.reading == kana.text)
                    .flat_map(|entry| entry.accents.iter())
                    .cloned()
                    .collect();

                if !matching_accents.is_empty() {
                    // Remove duplicates and sort
                    let mut unique_accents = matching_accents;
                    unique_accents.sort_unstable();
                    unique_accents.dedup();

                    kana.pitch_accents = Some(unique_accents);
                    enriched_readings += 1;
                    word_enriched = true;
                }
            }

            if word_enriched {
                enriched_words += 1;
            }
        }
    }

    println!("  ✅ Enriched {} Japanese words with pitch accent data ({} readings total)",
             enriched_words, enriched_readings);
}

fn load_chinese_char_dictionary(path: &str) -> Result<Vec<ChineseCharacter>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let mut entries = Vec::new();

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        match serde_json::from_str::<ChineseCharacter>(&line) {
            Ok(entry) => entries.push(entry),
            Err(_e) => {
                // Silently skip parse errors
                continue;
            }
        }
    }

    println!("  ✅ Loaded {} Chinese character entries", entries.len());
    Ok(entries)
}

fn load_japanese_char_dictionary(path: &str) -> Result<KanjiDictionary> {
    let content = fs::read_to_string(path)?;
    let kanji_dict: KanjiDictionary = serde_json::from_str(&content)?;
    println!("  ✅ Loaded {} Japanese kanji characters", kanji_dict.characters.len());
    Ok(kanji_dict)
}

/// Load JMnedict (Japanese Names Dictionary) from JSON file
fn load_jmnedict(path: &str) -> Result<Vec<JmnedictEntry>> {
    println!("📖 Loading JMnedict from {}", path);
    
    let file = std::fs::File::open(path)
        .with_context(|| format!("Failed to open JMnedict file: {}", path))?;
    
    let reader = std::io::BufReader::new(file);
    let jmnedict_root: JmnedictRoot = serde_json::from_reader(reader)
        .with_context(|| format!("Failed to parse JMnedict JSON: {}", path))?;
    
    println!("  ✅ Loaded {} JMnedict entries (version: {})", 
             jmnedict_root.words.len(), jmnedict_root.version);
    
    Ok(jmnedict_root.words)
}

fn load_ids_file(path: &str) -> Result<IdsDatabase> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let mut database = IdsDatabase::new();
    let mut total_entries = 0;
    let mut decomposed_entries = 0;

    for line in reader.lines() {
        let line = line?;

        if let Some(entry) = IdsEntry::from_line(&line) {
            total_entries += 1;
            if entry.has_decomposition() {
                decomposed_entries += 1;
            }
            database.insert(entry.character.clone(), entry);
        }
    }

    println!("  ✅ Loaded {} IDS entries ({} with decomposition)", total_entries, decomposed_entries);
    Ok(database)
}

fn load_all_ids_files() -> Result<IdsDatabase> {
    let mut combined_db = IdsDatabase::new();

    let ids_files = vec![
        "data/ids/IDS-UCS-Basic.txt",
        "data/ids/IDS-UCS-Ext-A.txt",
        "data/ids/IDS-JIS-X0208-1990.txt",
    ];

    for file_path in ids_files {
        if let Ok(db) = load_ids_file(file_path) {
            println!("  📖 Loaded {}", file_path);
            // Merge into combined database (later entries override earlier ones)
            for (char, entry) in db {
                combined_db.insert(char, entry);
            }
        } else {
            eprintln!("  ⚠️  Warning: Could not load {}", file_path);
        }
    }

    Ok(combined_db)
}

fn enrich_chinese_chars_with_ids(
    chinese_chars: &mut Vec<ChineseCharacter>,
    ids_db: &IdsDatabase,
) {
    let mut enriched_count = 0;

    for char_entry in chinese_chars.iter_mut() {
        if let Some(ids_entry) = ids_db.get(&char_entry.char) {
            // Only add IDS if it's different from the character itself (i.e., has decomposition)
            if ids_entry.has_decomposition() {
                char_entry.ids = Some(ids_entry.ids.clone());
                char_entry.ids_apparent = ids_entry.apparent_ids.clone();
                enriched_count += 1;
            }
        }
    }

    println!("  ✅ Enriched {} Chinese characters with IDS decomposition data", enriched_count);
}

fn enrich_japanese_chars_with_ids(
    kanji_dict: &mut KanjiDictionary,
    ids_db: &IdsDatabase,
) {
    let mut enriched_count = 0;

    for kanji_entry in kanji_dict.characters.iter_mut() {
        if let Some(ids_entry) = ids_db.get(&kanji_entry.literal) {
            // Only add IDS if it's different from the character itself (i.e., has decomposition)
            if ids_entry.has_decomposition() {
                kanji_entry.ids = Some(ids_entry.ids.clone());
                kanji_entry.ids_apparent = ids_entry.apparent_ids.clone();
                enriched_count += 1;
            }
        }
    }

    println!("  ✅ Enriched {} Japanese kanji with IDS decomposition data", enriched_count);
}

fn merge_character_dictionaries(
    chinese_chars: Vec<ChineseCharacter>,
    kanji_dict: KanjiDictionary,
    j2c_mapping: &HashMap<String, String>,
) -> Result<Vec<UnifiedCharacterEntry>> {
    use legacy_unification::unified_character_types::*;
    use std::collections::HashMap as StdHashMap;

    println!("🔄 Merging character dictionaries...");

    // Index Chinese characters by character
    // Keep only the first occurrence (which typically has the most complete data)
    let mut chinese_by_char: StdHashMap<String, ChineseCharacter> = StdHashMap::new();
    for chinese_char in chinese_chars {
        chinese_by_char.entry(chinese_char.char.clone())
            .or_insert(chinese_char);
    }

    let mut unified_chars: Vec<UnifiedCharacterEntry> = Vec::new();
    let mut matched_count = 0;
    let mut japanese_only_count = 0;

    // Build set of kanji characters first (before consuming the vector)
    let kanji_chars: std::collections::HashSet<String> = kanji_dict.characters.iter()
        .map(|k| k.literal.clone())
        .collect();

    // Process each Japanese kanji
    for kanji in kanji_dict.characters {
        let kanji_char = kanji.literal.clone();

        // Try to find matching Chinese character
        // First try direct match, then try j2c_mapping
        let chinese_match = chinese_by_char.get(&kanji_char)
            .or_else(|| {
                j2c_mapping.get(&kanji_char)
                    .and_then(|mapped_char| chinese_by_char.get(mapped_char))
            });

        let unified = if let Some(chinese_char) = chinese_match {
            matched_count += 1;
            merge_single_character(&kanji, Some(chinese_char))
        } else {
            japanese_only_count += 1;
            merge_single_character(&kanji, None)
        };

        unified_chars.push(unified);
    }

    // Add Chinese-only characters

    let mut chinese_only_count = 0;
    for (char_str, chinese_char) in chinese_by_char {
        if !kanji_chars.contains(&char_str) {
            chinese_only_count += 1;
            let unified = create_chinese_only_character(&chinese_char);
            unified_chars.push(unified);
        }
    }

    println!("  ✅ Merged {} characters:", unified_chars.len());
    println!("     - {} matched (in both dictionaries)", matched_count);
    println!("     - {} Japanese-only", japanese_only_count);
    println!("     - {} Chinese-only", chinese_only_count);

    Ok(unified_chars)
}

fn merge_single_character(
    kanji: &KanjiCharacter,
    chinese: Option<&ChineseCharacter>,
) -> UnifiedCharacterEntry {
    use legacy_unification::unified_character_types::*;

    let character = kanji.literal.clone();

    // Get codepoint from kanji
    let codepoint = kanji.codepoints.first()
        .map(|cp| cp.value.clone())
        .unwrap_or_else(|| format!("U+{:04X}", character.chars().next().unwrap() as u32));

    // Build representations
    let representations = build_character_representations(kanji, chinese);

    // Build decomposition
    let decomposition = build_decomposition(kanji, chinese);

    // Build meanings
    let meanings = build_character_meanings(kanji, chinese);

    // Build linguistic info
    let linguistic_info = build_character_linguistic_info(kanji, chinese);

    // Build visual info
    let visual_info = build_character_visual_info(kanji, chinese);

    // Build statistics
    let statistics = build_character_statistics(kanji, chinese);

    // Build sources
    let sources = build_character_sources(kanji, chinese);

    UnifiedCharacterEntry {
        character,
        codepoint,
        representations,
        decomposition,
        meanings,
        linguistic_info,
        visual_info,
        statistics,
        sources,
    }
}

fn create_chinese_only_character(chinese: &ChineseCharacter) -> UnifiedCharacterEntry {
    use legacy_unification::unified_character_types::*;

    let character = chinese.char.clone();
    let codepoint = chinese.codepoint.clone();

    // Build representations (Chinese only)
    let representations = CharacterRepresentations {
        chinese: Some(ChineseReadings {
            pinyin: chinese.pinyin_frequencies.as_ref()
                .map(|freqs| freqs.iter().map(|f| f.pinyin.clone()).collect())
                .unwrap_or_default(),
            traditional: chinese.trad_variants.as_ref().and_then(|v| v.first().cloned()),
            simplified: chinese.simp_variants.as_ref().and_then(|v| v.first().cloned()),
        }),
        japanese: None,
    };

    // Build decomposition
    let decomposition = if let Some(ids) = &chinese.ids {
        Some(CharacterDecomposition {
            ids: ids.clone(),
            ids_apparent: chinese.ids_apparent.clone(),
            components: None,
        })
    } else {
        None
    };

    // Build meanings
    let meanings = CharacterMeanings {
        english: vec![],
        chinese_gloss: chinese.gloss.clone(),
        shuowen: chinese.shuowen.clone(),
    };

    // Build linguistic info
    let linguistic_info = CharacterLinguisticInfo {
        radicals: vec![],
        grade: None,
        jlpt: None,
        frequency: None,
    };

    // Build visual info
    let visual_info = CharacterVisualInfo {
        stroke_count: chinese.stroke_count,
        images: chinese.images.as_ref().map(|imgs| {
            imgs.iter().map(|img| HistoricalImage {
                source: img.source.clone(),
                url: img.url.clone(),
                description: img.description.clone(),
                image_type: img.image_type.clone(),
                era: img.era.clone(),
            }).collect()
        }).unwrap_or_default(),
        variants: chinese.variants.as_ref().map(|vars| {
            vars.iter().map(|var| CharacterVariant {
                variant_type: var.source.clone(),  // Use source as variant_type
                character: var.char.clone(),
                parts: var.parts.as_ref().map(|p| vec![p.clone()]),  // Convert String to Vec<String>
            }).collect()
        }).unwrap_or_default(),
    };

    // Build statistics
    let statistics = chinese.statistics.as_ref().map(|stats| {
        CharacterStatistics {
            chinese: Some(ChineseCharStats {
                hsk_level: stats.hsk_level,
                frequency_rank: stats.movie_char_rank.or(stats.book_char_rank),  // Use available rank
                general_standard_num: None,  // Not available in this dataset
            }),
            japanese: None,
        }
    });

    // Build sources
    let sources = CharacterSources {
        in_kanjidic: false,
        in_chinese_dict: true,
        kanjidic_id: None,
        chinese_dict_id: Some(chinese.id.clone()),
        dictionary_references: vec![],
    };

    UnifiedCharacterEntry {
        character,
        codepoint,
        representations,
        decomposition,
        meanings,
        linguistic_info,
        visual_info,
        statistics,
        sources,
    }
}

fn build_character_representations(
    kanji: &KanjiCharacter,
    chinese: Option<&ChineseCharacter>,
) -> legacy_unification::unified_character_types::CharacterRepresentations {
    use legacy_unification::unified_character_types::*;

    // Extract Japanese readings
    let japanese = kanji.reading_meaning.as_ref().map(|rm| {
        let mut onyomi = vec![];
        let mut kunyomi = vec![];
        let nanori = rm.nanori.clone();

        // Iterate through all reading groups
        for group in &rm.groups {
            for reading in &group.readings {
                match reading.reading_type.as_str() {
                    "ja_on" => onyomi.push(reading.value.clone()),
                    "ja_kun" => kunyomi.push(reading.value.clone()),
                    _ => {}
                }
            }
        }

        JapaneseReadings {
            onyomi,
            kunyomi,
            nanori,
        }
    });

    // Extract Chinese readings
    let chinese_readings = chinese.map(|ch| {
        // Extract pinyin from pinyinFrequencies (sorted by frequency)
        let pinyin = ch.pinyin_frequencies.as_ref()
            .map(|freqs| {
                freqs.iter()
                    .map(|f| f.pinyin.clone())
                    .collect()
            })
            .unwrap_or_default();

        ChineseReadings {
            pinyin,
            traditional: ch.trad_variants.as_ref().and_then(|v| v.first().cloned()),
            simplified: ch.simp_variants.as_ref().and_then(|v| v.first().cloned()),
        }
    });

    CharacterRepresentations {
        chinese: chinese_readings,
        japanese,
    }
}

fn build_decomposition(
    kanji: &KanjiCharacter,
    chinese: Option<&ChineseCharacter>,
) -> Option<legacy_unification::unified_character_types::CharacterDecomposition> {
    use legacy_unification::unified_character_types::*;

    // Prefer kanji IDS, fallback to Chinese IDS
    let ids = kanji.ids.as_ref()
        .or_else(|| chinese.and_then(|ch| ch.ids.as_ref()));

    let ids_apparent = kanji.ids_apparent.as_ref()
        .or_else(|| chinese.and_then(|ch| ch.ids_apparent.as_ref()));

    ids.map(|ids_str| CharacterDecomposition {
        ids: ids_str.clone(),
        ids_apparent: ids_apparent.cloned(),
        components: None, // Could parse IDS string to extract components
    })
}

fn build_character_meanings(
    kanji: &KanjiCharacter,
    chinese: Option<&ChineseCharacter>,
) -> legacy_unification::unified_character_types::CharacterMeanings {
    use legacy_unification::unified_character_types::*;

    // Extract English meanings from kanji (from all groups)
    let english = kanji.reading_meaning.as_ref()
        .map(|rm| {
            let mut meanings = vec![];
            for group in &rm.groups {
                for meaning in &group.meanings {
                    if meaning.lang == "en" {
                        meanings.push(meaning.value.clone());
                    }
                }
            }
            meanings
        })
        .unwrap_or_default();

    // Extract Chinese gloss and shuowen
    let chinese_gloss = chinese.and_then(|ch| ch.gloss.clone());
    let shuowen = chinese.and_then(|ch| ch.shuowen.clone());

    CharacterMeanings {
        english,
        chinese_gloss,
        shuowen,
    }
}

fn build_character_linguistic_info(
    kanji: &KanjiCharacter,
    _chinese: Option<&ChineseCharacter>,
) -> legacy_unification::unified_character_types::CharacterLinguisticInfo {
    use legacy_unification::unified_character_types::*;

    // Extract radicals
    let radicals = kanji.radicals.iter().map(|rad| RadicalInfo {
        radical_type: rad.radical_type.clone(),
        value: rad.value,
    }).collect();

    // Extract grade, JLPT, frequency from misc
    let grade = kanji.misc.grade;
    let jlpt = kanji.misc.jlpt_level;  // Correct field name
    let frequency = kanji.misc.frequency;

    CharacterLinguisticInfo {
        radicals,
        grade,
        jlpt,
        frequency,
    }
}

fn build_character_visual_info(
    kanji: &KanjiCharacter,
    chinese: Option<&ChineseCharacter>,
) -> legacy_unification::unified_character_types::CharacterVisualInfo {
    use legacy_unification::unified_character_types::*;

    // Get stroke count (prefer kanji, fallback to Chinese)
    let stroke_count = kanji.misc.stroke_counts.first().copied()  // Correct field name
        .unwrap_or_else(|| chinese.map(|ch| ch.stroke_count).unwrap_or(0));

    // Get historical images from Chinese dict
    let images = chinese.and_then(|ch| ch.images.as_ref())
        .map(|imgs| imgs.iter().map(|img| HistoricalImage {
            source: img.source.clone(),
            url: img.url.clone(),
            description: img.description.clone(),
            image_type: img.image_type.clone(),
            era: img.era.clone(),
        }).collect())
        .unwrap_or_default();

    // Get variants from Chinese dict
    let variants = chinese.and_then(|ch| ch.variants.as_ref())
        .map(|vars| vars.iter().map(|var| CharacterVariant {
            variant_type: var.source.clone(),  // Use source as variant_type
            character: var.char.clone(),
            parts: var.parts.as_ref().map(|p| vec![p.clone()]),  // Convert String to Vec<String>
        }).collect())
        .unwrap_or_default();

    CharacterVisualInfo {
        stroke_count,
        images,
        variants,
    }
}

fn build_character_statistics(
    kanji: &KanjiCharacter,
    chinese: Option<&ChineseCharacter>,
) -> Option<legacy_unification::unified_character_types::CharacterStatistics> {
    use legacy_unification::unified_character_types::*;

    let japanese_stats = Some(JapaneseCharStats {
        frequency: kanji.misc.frequency,
        grade: kanji.misc.grade,
        jlpt: kanji.misc.jlpt_level,  // Correct field name
    });

    let chinese_stats = chinese.and_then(|ch| ch.statistics.as_ref())
        .map(|stats| ChineseCharStats {
            hsk_level: stats.hsk_level,
            frequency_rank: stats.movie_char_rank.or(stats.book_char_rank),  // Use available rank
            general_standard_num: None,  // Not available in this dataset
        });

    Some(CharacterStatistics {
        chinese: chinese_stats,
        japanese: japanese_stats,
    })
}

fn build_character_sources(
    kanji: &KanjiCharacter,
    chinese: Option<&ChineseCharacter>,
) -> legacy_unification::unified_character_types::CharacterSources {
    use legacy_unification::unified_character_types::*;

    // Build dictionary references from kanji
    let dictionary_references = kanji.dictionary_references.iter().map(|dict_ref| {
        DictionaryReference {
            reference_type: dict_ref.dictionary_reference_type.clone(),
            value: dict_ref.value.clone(),
            morohashi: dict_ref.morohashi.as_ref().map(|m| MorohashiReference {
                volume: m.volume,
                page: m.page,
            }),
        }
    }).collect();

    CharacterSources {
        in_kanjidic: true,
        in_chinese_dict: chinese.is_some(),
        kanjidic_id: Some(kanji.literal.clone()),
        chinese_dict_id: chinese.map(|ch| ch.id.clone()),
        dictionary_references,
    }
}

fn load_j2c_mapping(path: &str) -> Result<HashMap<String, String>> {
    let content = fs::read_to_string(path)
        .context("Failed to read J2C mapping file")?;
    let mapping: HashMap<String, String> = serde_json::from_str(&content)
        .context("Failed to parse J2C mapping JSON")?;
    Ok(mapping)
}



fn merge_dictionaries_with_mapping(
    chinese_entries: Vec<ChineseDictionaryElement>,
    japanese_words: Vec<Word>,
    j2c_mapping: HashMap<String, String>
) -> Result<CombinedDictionary> {
    let mut combined_map: HashMap<String, CombinedEntry> = HashMap::new();
    let mut stats = MergeStatistics {
        total_chinese_entries: chinese_entries.len(),
        total_japanese_words: japanese_words.len(),
        unified_entries: 0,
        chinese_only_entries: 0,
        japanese_only_entries: 0,
        total_combined_entries: 0,
        sample_unified_entries: Vec::new(),
    };

    // Phase 1: Process Chinese entries
    println!("  📝 Phase 1: Processing Chinese entries...");
    for (i, chinese_entry) in chinese_entries.into_iter().enumerate() {
        let key = chinese_entry.trad.clone(); // Use traditional Chinese as key

        match combined_map.get_mut(&key) {
            Some(existing_entry) => {
                // Additional Chinese entry for same traditional character
                existing_entry.chinese_specific_entries.push(chinese_entry);
                existing_entry.metadata.chinese_count += 1;
            }
            None => {
                // First Chinese entry for this traditional character
                let combined_entry = CombinedEntry {
                    word: key.clone(),
                    chinese_entry: Some(chinese_entry),
                    chinese_specific_entries: Vec::new(),
                    japanese_entry: None,
                    japanese_specific_entries: Vec::new(),
                    metadata: CombinedMetadata {
                        chinese_count: 1,
                        japanese_count: 0,
                        is_unified: false,
                        key_source: KeySource::Chinese,
                    },
                };
                combined_map.insert(key, combined_entry);
            }
        }

        if i % 10000 == 0 {
            println!("    Processed {} Chinese entries...", i);
        }
    }

    // Phase 2: Process Japanese entries using J2C mapping
    println!("  📝 Phase 2: Processing Japanese entries with J2C mapping...");
    let mut _debug_count = 0;

    for (i, japanese_word) in japanese_words.into_iter().enumerate() {
        // Get key from first kanji using J2C mapping
        let key = get_japanese_key_with_mapping(&japanese_word, &j2c_mapping);

        // Debug specific entries
        if key == "地図" || key == "地圖" || key == "学生" || key == "學生" || key.contains("地図") {
            println!("  🔍 DEBUG: Processing Japanese word ID {} → key '{}'", japanese_word.id, key);
            println!("    Kanji array length: {}", japanese_word.kanji.len());
            for (idx, kanji) in japanese_word.kanji.iter().enumerate() {
                println!("    Kanji[{}]: '{}'", idx, kanji.text);
            }
            if japanese_word.kanji.is_empty() {
                println!("    No kanji, kana array length: {}", japanese_word.kana.len());
                for (idx, kana) in japanese_word.kana.iter().enumerate() {
                    println!("    Kana[{}]: '{}'", idx, kana.text);
                }
            }
            println!("    Chinese dict contains key '{}': {}", key, combined_map.contains_key(&key));
            _debug_count += 1;
        }



        match combined_map.get_mut(&key) {
            Some(existing_entry) => {
                // Match found!
                if existing_entry.japanese_entry.is_none() {
                    existing_entry.japanese_entry = Some(japanese_word);
                    existing_entry.metadata.japanese_count = 1;
                    existing_entry.metadata.is_unified = true;
                    stats.unified_entries += 1;

                    // Collect sample unified entries
                    if stats.sample_unified_entries.len() < 20 {
                        stats.sample_unified_entries.push(key.clone());
                    }
                } else {
                    // Additional Japanese entry for same key
                    if japanese_word.id == "1160790" {
                        println!("    📍 MERGE: Adding as additional Japanese entry");
                    }
                    existing_entry.japanese_specific_entries.push(japanese_word);
                    existing_entry.metadata.japanese_count += 1;
                }
            }
            None => {
                // Japanese-only entry
                if japanese_word.id == "1160790" {
                    println!("    📍 MERGE: Creating new Japanese-only entry");
                }
                let combined_entry = CombinedEntry {
                    word: key.clone(),
                    chinese_entry: None,
                    chinese_specific_entries: Vec::new(),
                    japanese_entry: Some(japanese_word),
                    japanese_specific_entries: Vec::new(),
                    metadata: CombinedMetadata {
                        chinese_count: 0,
                        japanese_count: 1,
                        is_unified: false,
                        key_source: KeySource::Japanese,
                    },
                };
                combined_map.insert(key, combined_entry);
                stats.japanese_only_entries += 1;
            }
        }

        if i % 10000 == 0 {
            println!("    Processed {} Japanese words...", i);
        }
    }

    // Calculate final statistics
    stats.total_combined_entries = combined_map.len();
    stats.chinese_only_entries = stats.total_combined_entries - stats.unified_entries - stats.japanese_only_entries;

    let combined_dict = CombinedDictionary {
        entries: combined_map.into_values().collect(),
        metadata: DictionaryMetadata {
            chinese_source: "CC-CEDICT (JSONL format)".to_string(),
            japanese_source: "JMDict (JSON format)".to_string(),
            created_at: chrono::Utc::now().to_string(),
            merger_version: "1.0 with J2C mapping".to_string(),
        },
        statistics: stats,
    };

    Ok(combined_dict)
}

fn get_japanese_key_with_mapping(word: &Word, j2c_mapping: &HashMap<String, String>) -> String {
    // First try kanji with J2C mapping
    if let Some(first_kanji) = word.kanji.first() {
        let japanese_text = &first_kanji.text;

        // Check if we have a mapping for this Japanese text
        if let Some(traditional_chinese) = j2c_mapping.get(japanese_text) {
            // Debug logging for specific cases
            if japanese_text == "地図" {
                println!("    KEY_GEN: '{}' mapped to '{}'", japanese_text, traditional_chinese);
            }
            return traditional_chinese.clone();
        }

        // Fallback to original Japanese text if no mapping
        if japanese_text == "地図" {
            println!("    KEY_GEN: '{}' NOT FOUND in mapping, using original", japanese_text);
        }
        return japanese_text.clone();
    }

    // Fallback to kana (no conversion needed)
    if let Some(first_kana) = word.kana.first() {
        if first_kana.text.contains("ちず") {
            println!("    KEY_GEN: No kanji, using kana '{}'", first_kana.text);
        }
        return first_kana.text.clone();
    }

    // Fallback to ID if no text found
    format!("jp_{}", word.id)
}

fn save_combined_dictionary(dict: &CombinedDictionary, path: &str) -> Result<()> {
    let json = serde_json::to_string_pretty(dict)?;
    fs::write(path, json)?;
    Ok(())
}

fn print_statistics(stats: &MergeStatistics) {
    println!("\n📊 Merge Statistics:");
    println!("  Chinese entries processed: {}", stats.total_chinese_entries);
    println!("  Japanese words processed: {}", stats.total_japanese_words);
    println!("  Total combined entries: {}", stats.total_combined_entries);
    println!("  Unified entries (both languages): {}", stats.unified_entries);
    println!("  Chinese-only entries: {}", stats.chinese_only_entries);
    println!("  Japanese-only entries: {}", stats.japanese_only_entries);
    
    let unification_rate = (stats.unified_entries as f64 / stats.total_combined_entries as f64) * 100.0;
    println!("  Unification rate: {:.2}%", unification_rate);
    
    println!("\n🔍 Sample unified entries for inspection:");
    for (i, word) in stats.sample_unified_entries.iter().enumerate() {
        println!("  {}. {}", i + 1, word);
    }
}

/// Generate Japanese to Chinese mapping by checking which Japanese kanji entries
/// exist in the Chinese dictionary after OpenCC conversion
async fn generate_j2c_mapping() -> Result<()> {
    println!("📚 Loading Chinese dictionary...");
    let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
        .context("Failed to load Chinese dictionary")?;

    // Create a set of all Chinese traditional characters for fast lookup
    let mut chinese_trad_set = std::collections::HashSet::new();
    for entry in &chinese_entries {
        chinese_trad_set.insert(entry.trad.clone());
    }
    println!("  ✅ Loaded {} Chinese entries", chinese_entries.len());

    println!("📚 Loading Japanese dictionary...");
    let japanese_dict = load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")
        .context("Failed to load Japanese dictionary")?;
    println!("  ✅ Loaded {} Japanese words", japanese_dict.words.len());

    println!("🔄 Processing Japanese entries and generating mappings...");
    let mut j2c_mapping: HashMap<String, String> = HashMap::new();
    let mut processed = 0;
    let mut mappings_created = 0;
    let mut debug_count = 0;

    for word in japanese_dict.words {
        // Only process entries with kanji (skip kana-only entries)
        if let Some(first_kanji) = word.kanji.first() {
            let japanese_text = &first_kanji.text;

            // Skip if contains hiragana or katakana
            if contains_kana(japanese_text) {
                continue;
            }

            // Convert to Traditional Chinese using OpenCC
            match convert_with_opencc(japanese_text) {
                Ok(traditional_chinese) => {
                    // Debug output for first few conversions
                    if debug_count < 5 {
                        println!("  DEBUG: {} → {}", japanese_text, traditional_chinese);
                        println!("  DEBUG: Chinese dict contains '{}': {}", traditional_chinese, chinese_trad_set.contains(&traditional_chinese));
                        debug_count += 1;
                    }

                    // Check if this traditional Chinese exists in our Chinese dictionary
                    if chinese_trad_set.contains(&traditional_chinese) && japanese_text != &traditional_chinese {
                        j2c_mapping.insert(japanese_text.clone(), traditional_chinese);
                        mappings_created += 1;

                        if mappings_created <= 5 {
                            println!("  MAPPING: {} → {}", japanese_text, j2c_mapping.get(japanese_text).unwrap());
                        }
                    }
                }
                Err(e) => {
                    if debug_count < 3 {
                        println!("  DEBUG ERROR: Failed to convert '{}': {}", japanese_text, e);
                        debug_count += 1;
                    }
                }
            }
        }

        processed += 1;
        if processed % 10000 == 0 {
            println!("  Processed {} entries, created {} mappings...", processed, mappings_created);
        }
    }

    println!("💾 Saving Japanese to Chinese mapping...");
    let output_path = "output/j2c_mapping.json";
    let json = serde_json::to_string_pretty(&j2c_mapping)?;
    fs::write(output_path, json)?;

    println!("✅ Japanese to Chinese mapping generation complete!");
    println!("📊 Statistics:");
    println!("  - Japanese entries processed: {}", processed);
    println!("  - Mappings created: {}", mappings_created);
    println!("  - Mapping rate: {:.2}%", (mappings_created as f64 / processed as f64) * 100.0);
    println!("📁 Output saved to: {}", output_path);

    Ok(())
}

/// Check if a string contains hiragana or katakana characters
fn contains_kana(text: &str) -> bool {
    text.chars().any(|c| {
        // Hiragana: U+3040–U+309F
        // Katakana: U+30A0–U+30FF
        (c >= '\u{3040}' && c <= '\u{309F}') || (c >= '\u{30A0}' && c <= '\u{30FF}')
    })
}

/// Convert Japanese text to Traditional Chinese using OpenCC
fn convert_with_opencc(text: &str) -> Result<String> {
    convert_with_opencc_config(text, "jp2t")
}

/// Convert Traditional Chinese to Simplified Chinese using OpenCC
#[allow(dead_code)]
fn convert_traditional_to_simplified(text: &str) -> Result<String> {
    convert_with_opencc_config(text, "t2s")
}

/// Generic OpenCC conversion with configurable conversion type
fn convert_with_opencc_config(text: &str, config: &str) -> Result<String> {
    use std::process::Stdio;
    use std::io::Write;

    let mut child = ProcessCommand::new("opencc")
        .arg("-c")
        .arg(config)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("Failed to spawn opencc command")?;

    // Write input to stdin
    if let Some(stdin) = child.stdin.as_mut() {
        stdin.write_all(text.as_bytes())
            .context("Failed to write to opencc stdin")?;
    }

    let output = child.wait_with_output()
        .context("Failed to wait for opencc command")?;

    if output.status.success() {
        let result = String::from_utf8(output.stdout)
            .context("Failed to parse opencc output as UTF-8")?;
        Ok(result.trim().to_string())
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("OpenCC conversion failed: {}", error);
    }
}

async fn generate_unified_output_files(
    combined_dict: &CombinedDictionary,
    unified_characters: &[UnifiedCharacterEntry],
    unified_only: bool,
    shard_filter: Option<ShardType>,
) -> Result<()> {
    use std::fs;
    use std::path::Path;
    use std::collections::HashMap as StdHashMap;
    use legacy_unification::unified_output_types::UnifiedOutput;

    println!("📁 Preparing output directory...");
    let output_dir = Path::new("output_dictionary");

    // OPTIMIZATION: Instead of removing directory (slow!), just overwrite files
    if !output_dir.exists() {
        fs::create_dir_all(output_dir).context("Failed to create output directory")?;
    } else {
        println!("  ℹ️  Directory exists, will overwrite files (faster than deleting)");
    }

    // Index characters by their character string for quick lookup
    let mut char_by_key: StdHashMap<String, &UnifiedCharacterEntry> = StdHashMap::new();
    for char_entry in unified_characters {
        char_by_key.insert(char_entry.character.clone(), char_entry);
    }

    println!("🔄 Converting word entries to improved unified format...");
    let mut word_entries_map: StdHashMap<String, legacy_unification::improved_unified_types::ImprovedUnifiedEntry> = StdHashMap::new();
    let mut processed = 0;
    let mut filtered_count = 0;

    for entry in &combined_dict.entries {
        // Check if we should filter to unified-only entries
        if unified_only {
            let has_both = entry.chinese_entry.is_some() && entry.japanese_entry.is_some();
            if !has_both {
                filtered_count += 1;
                continue;
            }
        }

        let unified_entry = legacy_unification::improved_unification_engine::convert_to_improved_unified(entry);
        let key = unified_entry.word.clone();
        word_entries_map.insert(key, unified_entry);

        processed += 1;
        if processed % 10000 == 0 {
            println!("  Converted {} word entries...", processed);
        }
    }

    if unified_only {
        println!("  Filtered out {} non-unified word entries", filtered_count);
        println!("  Keeping {} unified word entries", word_entries_map.len());
    }

    println!("🔄 Merging word and character data...");
    let mut unified_outputs: StdHashMap<String, UnifiedOutput> = StdHashMap::new();

    let word_count = word_entries_map.len();

    // Add all word entries
    for (key, word_entry) in word_entries_map {
        let char_data = char_by_key.get(&key).map(|c| (*c).clone());
        unified_outputs.insert(key.clone(), UnifiedOutput {
            key: key.clone(),
            word: Some(word_entry),
            character: char_data,
        });
    }

    // Add character-only entries (characters that don't have word entries)
    for (key, char_entry) in char_by_key {
        if !unified_outputs.contains_key(&key) {
            unified_outputs.insert(key.clone(), UnifiedOutput {
                key: key.clone(),
                word: None,
                character: Some(char_entry.clone()),
            });
        }
    }

    println!("  ✅ Created {} unified entries ({} with words, {} character-only)",
             unified_outputs.len(),
             word_count,
             unified_outputs.len() - word_count);

    // Filter by shard if specified
    let unified_outputs = if let Some(shard) = shard_filter {
        println!("🔍 Filtering entries for shard: {:?}", shard);
        unified_outputs.into_iter()
            .filter(|(key, _)| ShardType::from_key(key) == shard)
            .collect()
    } else {
        unified_outputs
    };

    println!("💾 Writing {} individual JSON files...", unified_outputs.len());

    // Use parallel processing for maximum performance
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    let counter = Arc::new(AtomicUsize::new(0));
    let total = unified_outputs.len();

    // Convert to vec for parallel processing
    let outputs_vec: Vec<_> = unified_outputs.into_iter().collect();

    // Process in parallel chunks for optimal performance
    let results: Result<Vec<_>, anyhow::Error> = outputs_vec
        .par_iter()
        .map(|(key, entry)| -> Result<(), anyhow::Error> {
            let counter = Arc::clone(&counter);

            // Create safe filename from key
            let safe_filename = create_safe_filename(key);
            let file_path = output_dir.join(format!("{}.json", safe_filename));

            // Serialize to minified JSON
            let json_content = serde_json::to_string(entry)
                .map_err(|e| anyhow::anyhow!("Failed to serialize entry '{}': {}", key, e))?;

            // Write file synchronously (faster for many small files)
            std::fs::write(&file_path, json_content)
                .map_err(|e| anyhow::anyhow!("Failed to write file '{}': {}", file_path.display(), e))?;

            let current = counter.fetch_add(1, Ordering::Relaxed) + 1;
            if current % 10000 == 0 {
                println!("  Written {}/{} files ({:.1}%)", current, total, (current as f64 / total as f64) * 100.0);
            }

            Ok(())
        })
        .collect();

    results?;

    println!("✅ Successfully generated {} unified JSON files!", total);
    println!("📁 Files saved to: output_dictionary/");
    println!("💡 Usage: cat output_dictionary/好.json");

    Ok(())
}

async fn generate_simple_output_files(
    combined_dict: &CombinedDictionary,
    chinese_chars: &[ChineseCharacter],
    kanjidic_entries: &[KanjiCharacter],
    jmnedict_entries: &[JmnedictEntry],
    shard_filter: Option<ShardType>,
) -> Result<()> {
    use std::fs;
    use std::path::Path;
    use std::collections::HashMap as StdHashMap;
    use simple_output_types::SimpleOutput;

    println!("📁 Preparing output directory...");
    let output_dir = Path::new("output_dictionary");

    // OPTIMIZATION: Instead of removing directory (slow!), just overwrite files
    // This is much faster when the directory already exists
    if !output_dir.exists() {
        fs::create_dir_all(output_dir).context("Failed to create output directory")?;
        println!("  ✅ Created output directory: {}", output_dir.display());
    } else {
        println!("  ℹ️  Directory exists, will overwrite files (faster than deleting)");
    }

    // Index Chinese characters by character string
    let mut chinese_char_by_key: StdHashMap<String, &ChineseCharacter> = StdHashMap::new();
    for char_entry in chinese_chars {
        chinese_char_by_key.insert(char_entry.char.clone(), char_entry);
    }

    // Index KANJIDIC entries by literal
    let mut kanjidic_by_key: StdHashMap<String, &KanjiCharacter> = StdHashMap::new();
    for kanji_entry in kanjidic_entries {
        kanjidic_by_key.insert(kanji_entry.literal.clone(), kanji_entry);
    }

    println!("🔄 Grouping entries by key...");
    let mut outputs: StdHashMap<String, SimpleOutput> = StdHashMap::new();

    println!("  📊 Processing {} combined dictionary entries...", combined_dict.entries.len());

    // Process all combined entries (words)
    for entry in &combined_dict.entries {
        let key = if let Some(ref chinese) = entry.chinese_entry {
            chinese.simp.clone()
        } else if let Some(ref japanese) = entry.japanese_entry {
            // Get first kanji or first kana
            japanese.kanji.first()
                .map(|k| k.text.clone())
                .or_else(|| japanese.kana.first().map(|k| k.text.clone()))
                .unwrap_or_default()
        } else {
            continue;
        };

        let output = outputs.entry(key.clone()).or_insert_with(|| SimpleOutput {
            key: key.clone(),
            redirect: None,
            chinese_words: Vec::new(),
            chinese_char: None,
            japanese_words: Vec::new(),
            japanese_char: None,
            related_japanese_words: Vec::new(),
            japanese_names: Vec::new(),
            contains: Vec::new(),
            contained_in_chinese: Vec::new(),
            contained_in_japanese: Vec::new(),
        });

        if let Some(ref chinese) = entry.chinese_entry {
            // Filter out unicode source items (redundant/empty compared to cedict)
            let mut filtered_chinese = chinese.clone();
            filtered_chinese.items.retain(|item| {
                !matches!(item.source, Some(crate::chinese_types::Source::Unicode))
            });

            // Only add if there are items left after filtering
            if !filtered_chinese.items.is_empty() {
                output.chinese_words.push(filtered_chinese);
            }
        }

        if let Some(ref japanese) = entry.japanese_entry {
            output.japanese_words.push(japanese.clone());
        }

        // IMPORTANT: Also add all japanese_specific_entries (additional entries with same key)
        for additional_japanese in &entry.japanese_specific_entries {
            output.japanese_words.push(additional_japanese.clone());
        }

        if let Some(ref japanese) = entry.japanese_entry {
            // Add cross-references for alternative kanji forms
            // If this word has multiple kanji forms, add references from each form to the primary key
            if japanese.kanji.len() > 1 {
                for (i, kanji_form) in japanese.kanji.iter().enumerate() {
                    if i == 0 {
                        continue; // Skip the first one (it's the primary key)
                    }

                    // For each alternative kanji form, add a reference to the primary entry
                    let alt_key = kanji_form.text.clone();
                    if alt_key != key {
                        let alt_output = outputs.entry(alt_key.clone()).or_insert_with(|| SimpleOutput {
                            key: alt_key.clone(),
                            redirect: None,
                            chinese_words: Vec::new(),
                            chinese_char: None,
                            japanese_words: Vec::new(),
                            japanese_char: None,
                            related_japanese_words: Vec::new(),
                            japanese_names: Vec::new(),
                            contains: Vec::new(),
                            contained_in_chinese: Vec::new(),
                            contained_in_japanese: Vec::new(),
                        });

                        // Add reference to primary entry if not already present
                        if !alt_output.related_japanese_words.contains(&key) {
                            alt_output.related_japanese_words.push(key.clone());
                        }
                    }
                }
            }
        }
    }

    // Add character data
    for (key, char_entry) in chinese_char_by_key {
        let output = outputs.entry(key.clone()).or_insert_with(|| SimpleOutput {
            key: key.clone(),
            redirect: None,
            chinese_words: Vec::new(),
            chinese_char: None,
            japanese_words: Vec::new(),
            japanese_char: None,
            related_japanese_words: Vec::new(),
            japanese_names: Vec::new(),
            contains: Vec::new(),
            contained_in_chinese: Vec::new(),
            contained_in_japanese: Vec::new(),
        });
        output.chinese_char = Some(char_entry.clone());
    }

    for (key, kanji_entry) in kanjidic_by_key {
        let output = outputs.entry(key.clone()).or_insert_with(|| SimpleOutput {
            key: key.clone(),
            redirect: None,
            chinese_words: Vec::new(),
            chinese_char: None,
            japanese_words: Vec::new(),
            japanese_char: None,
            related_japanese_words: Vec::new(),
            japanese_names: Vec::new(),
            contains: Vec::new(),
            contained_in_chinese: Vec::new(),
            contained_in_japanese: Vec::new(),
        });
        output.japanese_char = Some(kanji_entry.clone());
    }

    // Add JMnedict entries (Japanese names)
    println!("🏷️ Adding JMnedict entries (Japanese names)...");
    println!("  Processing {} JMnedict entries", jmnedict_entries.len());
    for jmnedict_entry in jmnedict_entries {
        let keys = jmnedict_entry.get_keys();

        println!("  JMnedict entry ID: {} has {} keys", jmnedict_entry.id, keys.len());

        // Get all possible keys for this name entry
        for key in keys {
            let output = outputs.entry(key.clone()).or_insert_with(|| SimpleOutput {
                key: key.clone(),
                redirect: None,
                chinese_words: Vec::new(),
                chinese_char: None,
                japanese_words: Vec::new(),
                japanese_char: None,
                related_japanese_words: Vec::new(),
                japanese_names: Vec::new(),
                contains: Vec::new(),
                contained_in_chinese: Vec::new(),
                contained_in_japanese: Vec::new(),
            });

            // Add the name entry to this key's japanese_names
            output.japanese_names.push(jmnedict_entry.clone());
        }
    }

    // Build reverse index for "contained in" relationships
    println!("🔍 Building reverse index for word containment...");
    let mut chinese_containment: StdHashMap<String, Vec<String>> = StdHashMap::new();
    let mut japanese_containment: StdHashMap<String, Vec<String>> = StdHashMap::new();

    for (word_key, output) in &outputs {
        // For Chinese words, check each character in the word
        if !output.chinese_words.is_empty() {
            for ch in word_key.chars() {
                let ch_str = ch.to_string();
                if ch_str != *word_key {  // Don't add self-references
                    chinese_containment.entry(ch_str).or_insert_with(Vec::new).push(word_key.clone());
                }
            }
        }

        // For Japanese words, check each character in kanji forms
        for japanese_word in &output.japanese_words {
            for kanji_form in &japanese_word.kanji {
                for ch in kanji_form.text.chars() {
                    let ch_str = ch.to_string();
                    if ch_str != *word_key {  // Don't add self-references
                        japanese_containment.entry(ch_str).or_insert_with(Vec::new).push(word_key.clone());
                    }
                }
            }
        }
    }

    // Populate the contained_in fields (limit to 100 entries each)
    println!("  📝 Populating containment data for {} entries...", outputs.len());

    // First pass: collect all the word keys we need
    let mut chinese_previews_map: StdHashMap<String, Vec<word_preview_types::WordPreview>> = StdHashMap::new();
    let mut japanese_previews_map: StdHashMap<String, Vec<word_preview_types::WordPreview>> = StdHashMap::new();

    for (key, _) in &outputs {
        if let Some(chinese_words) = chinese_containment.get(key) {
            // Deduplicate and limit to 100
            let mut unique_words: Vec<String> = chinese_words.iter().cloned().collect();
            unique_words.sort();
            unique_words.dedup();
            unique_words.truncate(100);

            // Convert to WordPreview objects
            let previews: Vec<word_preview_types::WordPreview> = unique_words.iter()
                .filter_map(|word_key| {
                    outputs.get(word_key).and_then(|word_output| {
                        word_output.chinese_words.first()
                            .map(|chinese_word| word_preview_types::WordPreview::from_chinese(chinese_word))
                    })
                })
                .collect();
            chinese_previews_map.insert(key.clone(), previews);
        }

        if let Some(japanese_words) = japanese_containment.get(key) {
            // Deduplicate and limit to 100
            let mut unique_words: Vec<String> = japanese_words.iter().cloned().collect();
            unique_words.sort();
            unique_words.dedup();
            unique_words.truncate(100);

            // Convert to WordPreview objects
            let previews: Vec<word_preview_types::WordPreview> = unique_words.iter()
                .filter_map(|word_key| {
                    outputs.get(word_key).and_then(|word_output| {
                        word_output.japanese_words.first()
                            .map(|japanese_word| word_preview_types::WordPreview::from_japanese(japanese_word))
                    })
                })
                .collect();
            japanese_previews_map.insert(key.clone(), previews);
        }
    }

    // Second pass: populate the outputs
    for (key, output) in outputs.iter_mut() {
        if let Some(previews) = chinese_previews_map.get(key) {
            output.contained_in_chinese = previews.clone();
        }
        if let Some(previews) = japanese_previews_map.get(key) {
            output.contained_in_japanese = previews.clone();
        }
    }

    // Build "contains" relationships for multi-character words
    println!("🔍 Building 'contains' relationships for multi-character words...");
    let existing_keys: std::collections::HashSet<String> = outputs.keys().cloned().collect();

    // First pass: collect all contained words
    let mut contains_map: StdHashMap<String, Vec<String>> = StdHashMap::new();

    for key in outputs.keys() {
        // Only process multi-character words (2+ characters)
        if key.chars().count() < 2 {
            continue;
        }

        let mut contained_words: Vec<String> = Vec::new();
        let chars: Vec<char> = key.chars().collect();
        let len = chars.len();

        // Generate all possible substrings
        for start in 0..len {
            for end in (start + 1)..=len {
                let substring: String = chars[start..end].iter().collect();

                // Skip if it's the same as the original word
                if substring == *key {
                    continue;
                }

                // Check if this substring exists in the dictionary
                if existing_keys.contains(&substring) {
                    contained_words.push(substring);
                }
            }
        }

        // Deduplicate and sort
        contained_words.sort();
        contained_words.dedup();

        contains_map.insert(key.clone(), contained_words);
    }

    // Second pass: convert to WordPreview objects
    let mut contains_previews_map: StdHashMap<String, Vec<word_preview_types::WordPreview>> = StdHashMap::new();

    for (key, contained_words) in &contains_map {
        let previews: Vec<word_preview_types::WordPreview> = contained_words.iter()
            .filter_map(|word_key| {
                outputs.get(word_key).and_then(|word_output| {
                    // Try Chinese first, then Japanese
                    word_output.chinese_words.first()
                        .map(|chinese_word| word_preview_types::WordPreview::from_chinese(chinese_word))
                        .or_else(|| {
                            word_output.japanese_words.first()
                                .map(|japanese_word| word_preview_types::WordPreview::from_japanese(japanese_word))
                        })
                })
            })
            .collect();
        contains_previews_map.insert(key.clone(), previews);
    }

    // Third pass: populate the outputs
    for (key, output) in outputs.iter_mut() {
        if let Some(previews) = contains_previews_map.get(key) {
            output.contains = previews.clone();
        }
    }

    // Create redirect entries for multi-character words that don't have full entries
    println!("🔗 Creating redirect entries for multi-character words...");
    let existing_keys: std::collections::HashSet<String> = outputs.keys().cloned().collect();
    let mut redirect_count = 0;

    // Load J2C mapping for Japanese->Chinese redirects
    let j2c_mapping = load_j2c_mapping("output/j2c_mapping.json")
        .unwrap_or_else(|_| {
            println!("  ⚠️  No J2C mapping found, Japanese words will redirect to first character");
            StdHashMap::new()
        });

    // Create redirects for Chinese multi-character words
    for entry in &combined_dict.entries {
        if let Some(ref chinese) = entry.chinese_entry {
            if chinese.simp.chars().count() > 1 && !existing_keys.contains(&chinese.simp) {
                // Skip if shard_filter is set and this entry doesn't match
                if let Some(shard) = shard_filter {
                    if ShardType::from_key(&chinese.simp) != shard {
                        continue;
                    }
                }

                // Create redirect from simplified to first character
                let first_char = chinese.simp.chars().next().unwrap().to_string();
                let redirect_entry = SimpleOutput {
                    key: chinese.simp.clone(),
                    redirect: Some(first_char),
                    chinese_words: Vec::new(),
                    chinese_char: None,
                    japanese_words: Vec::new(),
                    japanese_char: None,
                    related_japanese_words: Vec::new(),
                    japanese_names: Vec::new(),
                    contains: Vec::new(),
                    contained_in_chinese: Vec::new(),
                    contained_in_japanese: Vec::new(),
                };

                outputs.insert(chinese.simp.clone(), redirect_entry);
                redirect_count += 1;
            }
        }

        // Create redirects for Japanese multi-character words
        if let Some(ref japanese) = entry.japanese_entry {
            for kanji_form in &japanese.kanji {
                if kanji_form.text.chars().count() > 1 && !existing_keys.contains(&kanji_form.text) {
                    // Skip if shard_filter is set and this entry doesn't match
                    if let Some(shard) = shard_filter {
                        if ShardType::from_key(&kanji_form.text) != shard {
                            continue;
                        }
                    }

                    // Check if this Japanese word has a J2C mapping to traditional Chinese
                    let redirect_target = if let Some(traditional_chinese) = j2c_mapping.get(&kanji_form.text) {
                        // Convert traditional Chinese to simplified Chinese (our dictionary uses simplified as keys)
                        if let Ok(simplified_chinese) = convert_traditional_to_simplified(traditional_chinese) {
                            // If the simplified Chinese exists in our dictionary, redirect to it
                            if existing_keys.contains(&simplified_chinese) {
                                simplified_chinese
                            } else {
                                // Fallback to first character if simplified doesn't exist
                                kanji_form.text.chars().next().unwrap().to_string()
                            }
                        } else {
                            // Fallback to first character if conversion fails
                            kanji_form.text.chars().next().unwrap().to_string()
                        }
                    } else {
                        // No J2C mapping, use first character
                        kanji_form.text.chars().next().unwrap().to_string()
                    };

                    let redirect_entry = SimpleOutput {
                        key: kanji_form.text.clone(),
                        redirect: Some(redirect_target),
                        chinese_words: Vec::new(),
                        chinese_char: None,
                        japanese_words: Vec::new(),
                        japanese_char: None,
                        related_japanese_words: Vec::new(),
                        japanese_names: Vec::new(),
                        contains: Vec::new(),
                        contained_in_chinese: Vec::new(),
                        contained_in_japanese: Vec::new(),
                    };

                    outputs.insert(kanji_form.text.clone(), redirect_entry);
                    redirect_count += 1;
                }
            }
        }
    }

    println!("  ✅ Created {} redirect entries", redirect_count);

    // Count redirects before filtering
    let redirect_count_before = outputs.values().filter(|o| o.redirect.is_some()).count();
    println!("  📊 Total entries before shard filter: {} ({} redirects)", outputs.len(), redirect_count_before);

    // Filter by shard if specified
    let outputs = if let Some(shard) = shard_filter {
        println!("🔍 Filtering entries for shard: {:?}", shard);
        outputs.into_iter()
            .filter(|(key, _)| ShardType::from_key(key) == shard)
            .collect()
    } else {
        outputs
    };

    // Count redirects after filtering
    let redirect_count_after = outputs.values().filter(|o| o.redirect.is_some()).count();
    println!("  📊 Total entries after shard filter: {} ({} redirects)", outputs.len(), redirect_count_after);

    println!("💾 Serializing {} entries in parallel...", outputs.len());

    // Use parallel processing for maximum performance
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::io::Write;

    let total = outputs.len();

    // Convert to vec for parallel processing
    let outputs_vec: Vec<_> = outputs.into_iter().collect();

    // OPTIMIZATION 1: Serialize and compress all entries in parallel (CPU-bound)
    use flate2::write::DeflateEncoder;
    use flate2::Compression;

    let serialized: Result<Vec<_>, anyhow::Error> = outputs_vec
        .par_iter()
        .map(|(key, entry)| -> Result<(String, Vec<u8>), anyhow::Error> {
            let safe_filename = create_safe_filename(key);

            // Serialize to JSON
            let json_content = serde_json::to_string(entry)
                .map_err(|e| anyhow::anyhow!("Failed to serialize entry '{}': {}", key, e))?;

            // Compress with Deflate level 9 (best compression)
            let mut encoder = DeflateEncoder::new(Vec::new(), Compression::best());
            encoder.write_all(json_content.as_bytes())
                .map_err(|e| anyhow::anyhow!("Failed to compress entry '{}': {}", key, e))?;
            let compressed = encoder.finish()
                .map_err(|e| anyhow::anyhow!("Failed to finish compression for '{}': {}", key, e))?;

            Ok((safe_filename, compressed))
        })
        .collect();

    let serialized = serialized?;

    println!("💾 Writing {} compressed files to disk...", serialized.len());
    let counter = Arc::new(AtomicUsize::new(0));

    // OPTIMIZATION 2: Write compressed files in parallel
    let results: Result<Vec<_>, anyhow::Error> = serialized
        .par_iter()
        .map(|(safe_filename, compressed_content)| -> Result<(), anyhow::Error> {
            let counter = Arc::clone(&counter);
            let file_path = output_dir.join(format!("{}.json.deflate", safe_filename));

            // Write compressed bytes directly
            std::fs::write(&file_path, compressed_content)
                .map_err(|e| anyhow::anyhow!("Failed to write file '{}': {}", file_path.display(), e))?;

            let current = counter.fetch_add(1, Ordering::Relaxed) + 1;
            if current % 10000 == 0 {
                println!("  Written {}/{} files ({:.1}%)", current, total, (current as f64 / total as f64) * 100.0);
            }

            Ok(())
        })
        .collect();

    results?;

    println!("✅ Successfully generated {} compressed JSON files!", total);
    println!("📁 Files saved to: output_dictionary/");
    println!("💡 Compression: Deflate level 9 (64% reduction)");
    println!("💡 Usage: Files are compressed with .deflate extension");

    Ok(())
}

/// Test the learner-focused analysis on specific characters
async fn test_learner_focused_analysis() -> Result<()> {
    use legacy_unification::learner_focused_analyzer::LearnerFocusedAnalyzer;
    use legacy_unification::improved_unification_engine::convert_to_improved_unified;
    use combined_types::CombinedEntry;

    println!("📚 Loading dictionaries for learner-focused test...");

    // Load dictionaries
    let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
        .context("Failed to load Chinese dictionary")?;
    let japanese_dict = load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")
        .context("Failed to load Japanese dictionary")?;
    let _j2c_mapping = load_j2c_mapping("output/j2c_mapping.json")
        .context("Failed to load J2C mapping")?;

    let analyzer = LearnerFocusedAnalyzer::new();

    // Test characters from our analysis
    let test_characters = vec!["的", "和", "空", "仇", "比"];

    println!("\n🎯 Testing learner-focused analysis on {} characters...", test_characters.len());

    for character in test_characters {
        println!("\n{}", "=".repeat(50));
        println!("🔍 Analyzing character: {}", character);

        // Find the character in Chinese dictionary
        if let Some(chinese_entry) = chinese_entries.iter().find(|e| e.trad == character) {
            // Find matching Japanese entries
            let japanese_entries: Vec<Word> = japanese_dict.words.iter()
                .filter(|word| word.kanji.iter().any(|k| k.text == character))
                .cloned()
                .collect();

            if !japanese_entries.is_empty() {
                println!("  ✅ Found in both dictionaries");

                // Create combined entry
                let japanese_count = japanese_entries.len();
                let combined_entry = CombinedEntry {
                    word: character.to_string(),
                    chinese_entry: Some(chinese_entry.clone()),
                    chinese_specific_entries: vec![],
                    japanese_entry: japanese_entries.first().cloned(),
                    japanese_specific_entries: japanese_entries.into_iter().skip(1).collect(),
                    metadata: combined_types::CombinedMetadata {
                        chinese_count: 1,
                        japanese_count,
                        is_unified: true,
                        key_source: combined_types::KeySource::Chinese,
                    },
                };

                // Create unified entry
                let improved_unified = convert_to_improved_unified(&combined_entry);
                let unified_entry = &improved_unified.unified;

                // Test learner-focused analysis
                let needs_focus = analyzer.needs_learner_focus_full(&improved_unified);
                println!("  📊 Needs learner focus: {}", needs_focus);

                if needs_focus {
                    let learner_entry = analyzer.create_learner_focused_entry(&unified_entry);

                    println!("  📈 Complexity score: {:.2}", learner_entry.complexity_score);

                    if let Some(chinese_section) = &learner_entry.chinese_section {
                        println!("  🇨🇳 Chinese: {} readings", chinese_section.total_readings);
                        println!("     Primary: {} [{}] - {}",
                                chinese_section.primary_meaning.reading,
                                chinese_section.primary_meaning.frequency_level,
                                chinese_section.primary_meaning.definition);

                        for secondary in &chinese_section.secondary_meanings {
                            println!("     Secondary: {} - {}", secondary.reading, secondary.definition);
                        }
                    }

                    if let Some(japanese_section) = &learner_entry.japanese_section {
                        println!("  🇯🇵 Japanese: {} readings", japanese_section.total_readings);
                        println!("     Primary: {} [{}] - {}",
                                japanese_section.primary_meaning.reading,
                                japanese_section.primary_meaning.frequency_level,
                                japanese_section.primary_meaning.definition);

                        for secondary in &japanese_section.secondary_meanings {
                            println!("     Secondary: {} - {}", secondary.reading, secondary.definition);
                        }
                    }

                    if !learner_entry.cross_linguistic_insights.is_empty() {
                        println!("  🔗 Cross-linguistic insights:");
                        for insight in &learner_entry.cross_linguistic_insights {
                            println!("     {:?}: {} (confidence: {:.2})",
                                    insight.insight_type, insight.description, insight.confidence);
                        }
                    }
                } else {
                    println!("  ℹ️  Character doesn't need special learner focus");
                }
            } else {
                println!("  ❌ Not found in Japanese dictionary");
            }
        } else {
            println!("  ❌ Not found in Chinese dictionary");
        }
    }

    println!("\n✅ Learner-focused analysis test completed!");
    Ok(())
}

async fn test_semantic_unification() -> Result<()> {
    println!("🧠 Testing Semantic Unification Engine");
    println!("=====================================");

    // Load dictionaries
    let chinese_entries_vec = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")?;
    let japanese_dict = load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")?;

    // Convert Chinese entries to HashMap for lookup
    let mut chinese_entries = HashMap::new();
    for entry in chinese_entries_vec {
        chinese_entries.insert(entry.trad.clone(), entry);
    }

    // Create semantic unification engine
    let semantic_engine = SemanticUnificationEngine::new();

    // Test characters
    let test_characters = vec!["的", "和", "空", "仇", "比"];

    for character in test_characters {
        println!("\n🔍 Testing character: {}", character);
        println!("{}", "─".repeat(40));

        if let Some(chinese_entry) = chinese_entries.get(character) {
            // Find Japanese entries for this character
            let japanese_entries: Vec<_> = japanese_dict.words.iter()
                .filter(|word| word.kanji.iter().any(|k| k.text == character))
                .cloned()
                .collect();

            if !japanese_entries.is_empty() {
                // Create combined entry
                let combined_entry = combined_types::CombinedEntry {
                    word: character.to_string(),
                    chinese_entry: Some(chinese_entry.clone()),
                    japanese_entry: japanese_entries.first().cloned(),
                    japanese_specific_entries: japanese_entries.clone(),
                    chinese_specific_entries: vec![], // No additional Chinese entries for this test
                    metadata: combined_types::CombinedMetadata {
                        chinese_count: 1,
                        japanese_count: japanese_entries.len(),
                        is_unified: true,
                        key_source: combined_types::KeySource::Chinese,
                    },
                };

                // Generate semantic unified data
                let semantic_data = semantic_engine.create_semantic_unified_entry(&combined_entry);

                // Save to JSON file
                fs::create_dir_all("output_dictionary")?;
                let json_output = serde_json::to_string_pretty(&semantic_data)?;
                let output_path = format!("output_dictionary/{}.json", character);
                fs::write(&output_path, json_output)?;
                println!("💾 Saved semantic unified data to: {}", output_path);

                println!("📖 Unified Meanings: {}", semantic_data.unified_meanings.len());
                for (i, meaning) in semantic_data.unified_meanings.iter().enumerate() {
                    println!("  {}. {} (confidence: {:.1})",
                        i + 1,
                        meaning.unified_explanation,
                        meaning.confidence
                    );

                    if let Some(chinese_aspect) = &meaning.chinese_aspect {
                        println!("     🇨🇳 Chinese: {} - {}",
                            chinese_aspect.readings.join(", "),
                            chinese_aspect.specific_function
                        );
                    }

                    if let Some(japanese_aspect) = &meaning.japanese_aspect {
                        println!("     🇯🇵 Japanese: {} - {}",
                            japanese_aspect.readings.join(", "),
                            japanese_aspect.specific_function
                        );
                    }

                    if let Some(note) = &meaning.cross_linguistic_note {
                        println!("     🔗 Note: {}", note);
                    }
                }

                println!("🇨🇳 Chinese-only meanings: {}", semantic_data.chinese_only_meanings.len());
                for meaning in &semantic_data.chinese_only_meanings {
                    println!("  • {} - {}", meaning.reading, meaning.definition);
                }

                println!("🇯🇵 Japanese-only meanings: {}", semantic_data.japanese_only_meanings.len());
                for meaning in &semantic_data.japanese_only_meanings {
                    println!("  • {} - {}", meaning.reading, meaning.definition);
                }

            } else {
                println!("  ❌ Not found in Japanese dictionary");
            }
        } else {
            println!("  ❌ Not found in Chinese dictionary");
        }
    }

    println!("\n✅ Semantic unification test completed!");
    Ok(())
}

fn create_safe_filename(word: &str) -> String {
    // Replace problematic characters for filesystem
    word.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect()
}

