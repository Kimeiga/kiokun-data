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
mod search_index_builder;

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
use japanese_types::{JapaneseEntry, Word};
use chinese_char_types::ChineseCharacter;
use japanese_char_types::{KanjiDictionary, KanjiCharacter};
use ids_types::{IdsEntry, IdsDatabase};
use jmnedict_types::{JmnedictEntry, JmnedictRoot};
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
            Arg::new("build-search-index")
                .long("build-search-index")
                .help("Build search index CSV for Cloudflare D1 full-text search")
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
            Arg::new("exclude-dictionaries")
                .long("exclude-dictionaries")
                .value_name("DICTIONARIES")
                .help("Exclude specific dictionaries from loading (comma-separated: cedict,jmdict,kanjidic,chinese-char,jmnedict)")
                .value_delimiter(',')
                .value_parser(["cedict", "jmdict", "kanjidic", "chinese-char", "jmnedict"])
                .num_args(0..),
        )
        .arg(
            Arg::new("filter-characters")
                .long("filter-characters")
                .value_name("CHARACTERS")
                .help("Only output entries containing at least one of these characters (e.g., '図圖图' for development/testing)")
                .num_args(1),
        )
        .get_matches();

    if matches.get_flag("generate-j2c-mapping") {
        println!("🔄 Generating Japanese to Chinese mapping...");
        generate_j2c_mapping().await?;
        return Ok(());
    }

    // Check if search index building is requested
    if matches.get_flag("build-search-index") {
        println!("🔍 Building search index for Cloudflare D1...");
        println!("📚 Loading Chinese dictionary...");
        let chinese_entries = load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
            .context("Failed to load Chinese dictionary")?;

        println!("📚 Loading Japanese dictionary...");
        let japanese_dict = load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")
            .context("Failed to load Japanese dictionary")?;

        search_index_builder::build_search_index(
            &chinese_entries,
            &japanese_dict.words,
            "output_search_index.csv"
        ).await?;

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

    // Get excluded dictionaries
    let excluded_dicts: Vec<String> = matches
        .get_many::<String>("exclude-dictionaries")
        .map(|vals| vals.map(|s| s.to_string()).collect())
        .unwrap_or_default();

    if !excluded_dicts.is_empty() {
        println!("⚠️  Excluding dictionaries: {}", excluded_dicts.join(", "));
    }

    // Get character filter for development
    let filter_characters: Option<String> = matches
        .get_one::<String>("filter-characters")
        .map(|s| s.to_string());

    if let Some(ref chars) = filter_characters {
        println!("🔍 Filtering output to entries containing: {}", chars);
    }

    // Create output directory
    fs::create_dir_all("output")?;

    // Load dictionaries (conditionally based on exclusions)
    let chinese_entries = if excluded_dicts.contains(&"cedict".to_string()) {
        println!("⏭️  Skipping Chinese dictionary (CEDICT)");
        Vec::new()
    } else {
        println!("📚 Loading Chinese dictionary...");
        load_chinese_dictionary("data/chinese_dictionary_word_2025-06-25.jsonl")
            .context("Failed to load Chinese dictionary")?
    };

    let japanese_dict = if excluded_dicts.contains(&"jmdict".to_string()) {
        println!("⏭️  Skipping Japanese dictionary (JMdict)");
        japanese_types::JapaneseEntry {
            version: String::new(),
            languages: Vec::new(),
            common_only: false,
            dict_date: String::new(),
            dict_revisions: Vec::new(),
            tags: HashMap::new(),
            words: Vec::new(),
        }
    } else {
        println!("📚 Loading Japanese dictionary...");
        load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")
            .context("Failed to load Japanese dictionary")?
    };

    println!("📚 Loading Japanese to Chinese mapping...");
    let j2c_mapping = load_j2c_mapping("output/j2c_mapping.json")
        .context("Failed to load J2C mapping. Run with --generate-j2c-mapping first.")?;
    println!("  ✅ Loaded {} J2C mappings", j2c_mapping.len());

    // Merge word dictionaries
    println!("🔄 Merging word dictionaries...");
    let combined_dict = merge_dictionaries_with_mapping(chinese_entries, japanese_dict.words, j2c_mapping.clone())
        .context("Failed to merge dictionaries")?;

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

    // Load character dictionaries and JMnedict for individual file generation
    let mut chinese_char_dict_raw = if excluded_dicts.contains(&"chinese-char".to_string()) {
        println!("⏭️  Skipping Chinese character dictionary");
        Vec::new()
    } else {
        println!("📚 Loading Chinese character dictionary...");
        load_chinese_char_dictionary("data/chinese_dictionary_char_2025-06-25.jsonl")
            .context("Failed to load Chinese character dictionary")?
    };

    let mut japanese_char_dict_raw = if excluded_dicts.contains(&"kanjidic".to_string()) {
        println!("⏭️  Skipping Japanese character dictionary (KANJIDIC2)");
        KanjiDictionary {
            version: String::new(),
            languages: Vec::new(),
            dict_date: String::new(),
            file_version: 0,
            database_version: String::new(),
            characters: Vec::new(),
        }
    } else {
        println!("📚 Loading Japanese character dictionary (KANJIDIC2)...");
        load_japanese_char_dictionary("data/kanjidic2-en-3.6.1.json")
            .context("Failed to load Japanese character dictionary")?
    };

    let jmnedict_entries = if excluded_dicts.contains(&"jmnedict".to_string()) {
        println!("⏭️  Skipping JMnedict (Japanese Names Dictionary)");
        Vec::new()
    } else {
        println!("📚 Loading JMnedict (Japanese Names Dictionary)...");
        load_jmnedict("data/jmnedict-all-3.6.1.json")
            .context("Failed to load JMnedict")?
    };

    println!("📚 Loading IDS (character decomposition) database...");
    let ids_database = load_all_ids_files()
        .context("Failed to load IDS files")?;
    println!("  ✅ Total unique characters in IDS database: {}", ids_database.len());

    println!("🔧 Enriching character dictionaries with IDS decomposition data...");
    enrich_chinese_chars_with_ids(&mut chinese_char_dict_raw, &ids_database);
    enrich_japanese_chars_with_ids(&mut japanese_char_dict_raw, &ids_database);

    // Generate individual JSON files (default behavior)
    println!("🔄 Generating individual JSON files...");
    generate_simple_output_files(
        &aligned_dict,
        &chinese_char_dict_raw,
        &japanese_char_dict_raw.characters,
        &jmnedict_entries,
        shard_filter,
        filter_characters.as_deref()
    ).await?;

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

// Removed deprecated unified character merging functions (435 lines)
// These were only used with the deprecated --unified-output flag:
// - merge_character_dictionaries, merge_single_character, create_chinese_only_character
// - build_character_representations, build_decomposition, build_character_meanings
// - build_character_linguistic_info, build_character_visual_info
// - build_character_statistics, build_character_sources

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

/// Detect if a Chinese character entry is a Japanese variant and extract the traditional Chinese target
/// Returns Some(traditional_chinese_char) if this is a Japanese variant, None otherwise
fn detect_japanese_variant(chinese_char: &ChineseCharacter, chinese_word_entries: &[ChineseDictionaryElement]) -> Option<String> {
    // Check if there's a word entry for this single character
    let word_entry = chinese_word_entries.iter()
        .find(|entry| entry.trad == chinese_char.char)?;

    // Look for cedict items with "Japanese variant of" pattern
    for item in &word_entry.items {
        if let Some(ref source) = item.source {
            if matches!(source, crate::chinese_types::Source::Cedict) {
                if let Some(ref definitions) = item.definitions {
                    for definition in definitions {
                        // Pattern: "Japanese variant of 圖|图" or "Japanese variant of X|Y"
                        if definition.starts_with("Japanese variant of ") {
                            // Extract the traditional Chinese character (before the |)
                            let variant_part = definition.strip_prefix("Japanese variant of ")?;
                            if let Some(pipe_pos) = variant_part.find('|') {
                                let traditional = &variant_part[..pipe_pos];
                                // Return the first character (should be a single character)
                                return traditional.chars().next().map(|c| c.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

async fn generate_simple_output_files(
    combined_dict: &CombinedDictionary,
    chinese_chars: &[ChineseCharacter],
    kanjidic_entries: &[KanjiCharacter],
    jmnedict_entries: &[JmnedictEntry],
    shard_filter: Option<ShardType>,
    filter_characters: Option<&str>,
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

    // Collect all Chinese word entries for Japanese variant detection
    let chinese_word_entries: Vec<ChineseDictionaryElement> = combined_dict.entries.iter()
        .filter_map(|entry| entry.chinese_entry.clone())
        .collect();

    // Detect Japanese variant characters and build mapping
    println!("🔍 Detecting Japanese variant characters...");
    let mut japanese_variant_map: StdHashMap<String, String> = StdHashMap::new();
    for char_entry in chinese_chars {
        if let Some(traditional_target) = detect_japanese_variant(char_entry, &chinese_word_entries) {
            japanese_variant_map.insert(char_entry.char.clone(), traditional_target.clone());
            println!("  📍 Detected Japanese variant: {} → {}", char_entry.char, traditional_target);
        }
    }
    println!("  ✅ Found {} Japanese variant characters", japanese_variant_map.len());

    println!("🔄 Grouping entries by key...");
    let mut outputs: StdHashMap<String, SimpleOutput> = StdHashMap::new();

    // Load J2C mapping for Japanese->Chinese redirects
    let j2c_mapping = load_j2c_mapping("output/j2c_mapping.json")
        .unwrap_or_else(|_| {
            println!("  ⚠️  No J2C mapping found, Japanese words will redirect to first character");
            StdHashMap::new()
        });

    println!("  📊 Processing {} combined dictionary entries...", combined_dict.entries.len());

    // Process all combined entries (words)
    for entry in &combined_dict.entries {
        let key = if let Some(ref chinese) = entry.chinese_entry {
            chinese.trad.clone()  // Use traditional Chinese as key
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
                if key == "地圖" {
                    println!("    ✅ Adding Chinese word data to '地圖' entry");
                }
                output.chinese_words.push(filtered_chinese);
            } else if key == "地圖" {
                println!("    ⚠️  No Chinese items left after filtering for '地圖'");
            }
        } else if key == "地圖" {
            println!("    ⚠️  No Chinese entry for '地圖'");
        }

        if let Some(ref japanese) = entry.japanese_entry {
            if key == "地圖" {
                println!("    ✅ Adding Japanese word data to '地圖' entry (ID: {})", japanese.id);
            }
            output.japanese_words.push(japanese.clone());
        } else if key == "地圖" {
            println!("    ⚠️  No Japanese entry for '地圖'");
        }

        // IMPORTANT: Also add all japanese_specific_entries (additional entries with same key)
        for additional_japanese in &entry.japanese_specific_entries {
            output.japanese_words.push(additional_japanese.clone());
        }

        if let Some(ref japanese) = entry.japanese_entry {
            // Add cross-references for alternative kanji forms
            // If this word has multiple kanji forms, add the full entry to each form
            if japanese.kanji.len() > 1 {
                for (i, kanji_form) in japanese.kanji.iter().enumerate() {
                    if i == 0 {
                        continue; // Skip the first one (it's the primary key)
                    }

                    // For each alternative kanji form, add the full Japanese word entry
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

                        // Add the full Japanese word entry if not already present
                        if !alt_output.japanese_words.iter().any(|w| w.id == japanese.id) {
                            alt_output.japanese_words.push(japanese.clone());
                        }

                        // Also add reference to primary entry if not already present
                        if !alt_output.related_japanese_words.contains(&key) {
                            alt_output.related_japanese_words.push(key.clone());
                        }
                    }
                }
            }
        }
    }

    // Add character data with Japanese variant handling
    println!("📝 Processing Chinese character entries...");
    let mut japanese_variant_redirect_count = 0;
    let mut simplified_redirect_count = 0;

    for (key, char_entry) in chinese_char_by_key {
        // Check if this is a Japanese variant character
        if let Some(traditional_target) = japanese_variant_map.get(&key) {
            // This is a Japanese variant - create a redirect entry
            let redirect_entry = SimpleOutput {
                key: key.clone(),
                redirect: Some(traditional_target.clone()),
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
            outputs.insert(key.clone(), redirect_entry);
            japanese_variant_redirect_count += 1;
        } else if let Some(ref trad_variants) = char_entry.trad_variants {
            // This is a simplified character with traditional variant(s)
            // Create redirect to the first traditional variant that's different from the key
            let trad_target = trad_variants.iter()
                .find(|&variant| variant != &key)
                .cloned();

            if let Some(trad_target) = trad_target {
                let redirect_entry = SimpleOutput {
                    key: key.clone(),
                    redirect: Some(trad_target.clone()),
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
                outputs.insert(key.clone(), redirect_entry);
                simplified_redirect_count += 1;
            }
        } else {
            // Regular Chinese character (traditional or no variants) - add normally
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
    }
    println!("  ✅ Created {} Japanese variant redirects", japanese_variant_redirect_count);
    println!("  ✅ Created {} simplified→traditional redirects", simplified_redirect_count);

    println!("📝 Processing Japanese character entries (KANJIDIC)...");

    // Build reverse map: traditional Chinese → Japanese variant
    let mut traditional_to_variant: StdHashMap<String, String> = StdHashMap::new();
    for (variant, traditional) in &japanese_variant_map {
        traditional_to_variant.insert(traditional.clone(), variant.clone());
    }

    let mut merged_japanese_char_count = 0;
    let mut skipped_traditional_count = 0;
    let mut regular_count = 0;
    for (key, kanji_entry) in kanjidic_by_key {
        // Check if this Japanese character is a variant that should be merged into traditional Chinese
        if let Some(traditional_target) = japanese_variant_map.get(&key) {
            // This Japanese character should be added to the traditional Chinese entry
            let output = outputs.entry(traditional_target.clone()).or_insert_with(|| SimpleOutput {
                key: traditional_target.clone(),
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
            merged_japanese_char_count += 1;
        } else if traditional_to_variant.contains_key(&key) {
            // This is a traditional Chinese character that has a Japanese variant
            // Skip it - we already added the Japanese variant's KANJIDIC entry
            skipped_traditional_count += 1;
        } else {
            // Regular Japanese character - add normally
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
            regular_count += 1;
        }
    }
    println!("  ✅ Merged {} Japanese character entries into traditional Chinese entries", merged_japanese_char_count);
    println!("  ℹ️  Skipped {} traditional Chinese KANJIDIC entries (have Japanese variants)", skipped_traditional_count);
    println!("  ℹ️  Added {} regular Japanese character entries", regular_count);

    // Add JMnedict entries (Japanese names)
    println!("🏷️ Adding JMnedict entries (Japanese names)...");
    println!("  Processing {} JMnedict entries", jmnedict_entries.len());
    for jmnedict_entry in jmnedict_entries {
        let keys = jmnedict_entry.get_keys();

        println!("  JMnedict entry ID: {} has {} keys", jmnedict_entry.id, keys.len());

        // Get all possible keys for this name entry
        for key in keys {
            // Map Japanese variant characters to their traditional Chinese equivalents
            let final_key = if key.chars().count() == 1 {
                // Single character - check if it's a Japanese variant
                japanese_variant_map.get(&key).cloned().unwrap_or(key.clone())
            } else {
                // Multi-character - keep as is (already handled by J2C mapping in word processing)
                key.clone()
            };

            let output = outputs.entry(final_key.clone()).or_insert_with(|| SimpleOutput {
                key: final_key.clone(),
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

    // Build reverse map: traditional Chinese → Japanese variant (for containment lookup)
    let mut traditional_to_variant: StdHashMap<String, String> = StdHashMap::new();
    for (variant, traditional) in &japanese_variant_map {
        traditional_to_variant.insert(traditional.clone(), variant.clone());
    }

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
                        japanese_containment.entry(ch_str.clone()).or_insert_with(Vec::new).push(word_key.clone());

                        // ALSO add to traditional Chinese character if this is a Japanese variant
                        // e.g., if word contains 図, also add to 圖's containment list
                        if let Some(traditional_target) = japanese_variant_map.get(&ch_str) {
                            japanese_containment.entry(traditional_target.clone()).or_insert_with(Vec::new).push(word_key.clone());
                        }
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

    for (key, output) in &outputs {
        // Skip redirect entries - they should not have containment data
        if output.redirect.is_some() {
            continue;
        }

        if let Some(chinese_words) = chinese_containment.get(key) {
            // Deduplicate
            let mut unique_words: Vec<String> = chinese_words.iter().cloned().collect();
            unique_words.sort();
            unique_words.dedup();

            // Convert to WordPreview objects and limit to 100
            let previews: Vec<word_preview_types::WordPreview> = unique_words.iter()
                .filter_map(|word_key| {
                    outputs.get(word_key).and_then(|word_output| {
                        word_output.chinese_words.first()
                            .map(|chinese_word| word_preview_types::WordPreview::from_chinese(chinese_word))
                    })
                })
                .take(200)  // Limit to 200 after conversion
                .collect();
            chinese_previews_map.insert(key.clone(), previews);
        }

        if let Some(japanese_words) = japanese_containment.get(key) {
            // Deduplicate
            let mut unique_words: Vec<String> = japanese_words.iter().cloned().collect();
            unique_words.sort();
            unique_words.dedup();

            // Convert to WordPreview objects with their source Word for sorting
            let mut previews_with_words: Vec<(word_preview_types::WordPreview, &crate::japanese_types::Word)> = unique_words.iter()
                .filter_map(|word_key| {
                    outputs.get(word_key).and_then(|word_output| {
                        word_output.japanese_words.first()
                            .map(|japanese_word| {
                                let preview = word_preview_types::WordPreview::from_japanese(japanese_word);
                                (preview, japanese_word)
                            })
                    })
                })
                .collect();

            // Sort by common status (common words first)
            previews_with_words.sort_by_key(|(_, word)| {
                // A word is common if any of its kanji or kana forms are marked as common
                let is_common = word.kanji.iter().any(|k| k.common) || word.kana.iter().any(|k| k.common);
                !is_common // Reverse sort: false (common) comes before true (not common)
            });

            // Extract just the previews and limit to 200 AFTER sorting by common status
            let previews: Vec<word_preview_types::WordPreview> = previews_with_words.into_iter()
                .map(|(preview, _)| preview)
                .take(200)  // Limit to 200 after sorting, so we get the 200 most relevant (common first)
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
            if chinese.trad.chars().count() > 1 && !existing_keys.contains(&chinese.trad) {
                // Skip if shard_filter is set and this entry doesn't match
                if let Some(shard) = shard_filter {
                    if ShardType::from_key(&chinese.trad) != shard {
                        continue;
                    }
                }

                // Create redirect from traditional Chinese to first character
                let first_char = chinese.trad.chars().next().unwrap().to_string();
                let redirect_entry = SimpleOutput {
                    key: chinese.trad.clone(),
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

                outputs.insert(chinese.trad.clone(), redirect_entry);
                redirect_count += 1;
            }

            // Create redirect from Simplified Chinese to Traditional Chinese (if different)
            if chinese.simp != chinese.trad && !existing_keys.contains(&chinese.simp) {
                // Skip if shard_filter is set and this entry doesn't match
                if let Some(shard) = shard_filter {
                    if ShardType::from_key(&chinese.simp) != shard {
                        continue;
                    }
                }

                let redirect_entry = SimpleOutput {
                    key: chinese.simp.clone(),
                    redirect: Some(chinese.trad.clone()),
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
                        // Our dictionary uses traditional Chinese as keys, so use it directly
                        if existing_keys.contains(traditional_chinese) {
                            traditional_chinese.clone()
                        } else {
                            // Fallback to first character if traditional doesn't exist
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
    let mut outputs_vec: Vec<_> = outputs.into_iter().collect();

    // Apply character filter if specified (for development/testing)
    if let Some(filter_chars) = filter_characters {
        let filter_set: std::collections::HashSet<char> = filter_chars.chars().collect();
        let original_count = outputs_vec.len();

        outputs_vec.retain(|(key, _entry)| {
            // Keep entry if key contains any of the filter characters
            key.chars().any(|c| filter_set.contains(&c))
        });

        let filtered_count = outputs_vec.len();
        println!("  🔍 Filtered {} → {} entries (containing: {})",
                 original_count, filtered_count, filter_chars);
    }

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

