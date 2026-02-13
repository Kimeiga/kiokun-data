// Core types - Testing auto-deployment 2025-01-27
mod chinese_types;
mod japanese_types;
mod korean_types;
mod chinese_char_types;
mod japanese_char_types;
mod ids_types;
mod combined_types;
mod jmnedict_types;
mod analysis;
mod simple_output_types;
mod word_preview_types;
mod search_index_builder;
mod romaji;
mod pinyin;

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

/// Determines which shard a key belongs to based on Han character count and hash
/// This creates 30 shards optimized for GitHub deployment (~10K-15K files each)
/// Each shard also uses 256 subdirectories (00-ff) to keep directory listings small
///
/// ARCHITECTURE (30-shard system with subdirectories):
/// =================================================
/// - non-han-1 through non-han-4:     ~45K files / 4 = ~11K files each
/// - han-1char-1 through han-1char-8: ~90K files / 8 = ~11K files each
/// - han-2char-1 through han-2char-8: ~103K files / 8 = ~13K files each
/// - han-3plus-1 through han-3plus-8: ~96K files / 8 = ~12K files each

///
/// Each repo has 256 subdirectories (00-ff based on hash), so:
/// - ~11K files / 256 subdirs = ~43 files per subdirectory
///
/// This keeps both repo size and directory listings well within GitHub's limits.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum ShardType {
    // Non-Han (all non-Chinese: ~45K files → 4 shards)
    NonHan1, NonHan2, NonHan3, NonHan4,

    // Han 1-character split (90K total → 8 shards)
    Han1Char1, Han1Char2, Han1Char3, Han1Char4,
    Han1Char5, Han1Char6, Han1Char7, Han1Char8,

    // Han 2-character split (103K total → 8 shards)
    Han2Char1, Han2Char2, Han2Char3, Han2Char4,
    Han2Char5, Han2Char6, Han2Char7, Han2Char8,

    // Han 3+ character split (96K total → 8 shards)
    Han3Plus1, Han3Plus2, Han3Plus3, Han3Plus4,
    Han3Plus5, Han3Plus6, Han3Plus7, Han3Plus8,
}

impl ShardType {
    /// Determine shard type from a key string (30-shard system)
    fn from_key(key: &str) -> Self {
        let han_count = key.chars().filter(|c| is_han_character(*c)).count();
        let hash = Self::simple_hash(key);

        match han_count {
            0 => {
                // All non-Han characters: split into 4 shards
                match hash % 4 {
                    0 => ShardType::NonHan1,
                    1 => ShardType::NonHan2,
                    2 => ShardType::NonHan3,
                    _ => ShardType::NonHan4,
                }
            }
            1 => {
                // Single Han character: split into 8 shards
                match hash % 8 {
                    0 => ShardType::Han1Char1,
                    1 => ShardType::Han1Char2,
                    2 => ShardType::Han1Char3,
                    3 => ShardType::Han1Char4,
                    4 => ShardType::Han1Char5,
                    5 => ShardType::Han1Char6,
                    6 => ShardType::Han1Char7,
                    _ => ShardType::Han1Char8,
                }
            }
            2 => {
                // Two Han characters: split into 8 shards
                match hash % 8 {
                    0 => ShardType::Han2Char1,
                    1 => ShardType::Han2Char2,
                    2 => ShardType::Han2Char3,
                    3 => ShardType::Han2Char4,
                    4 => ShardType::Han2Char5,
                    5 => ShardType::Han2Char6,
                    6 => ShardType::Han2Char7,
                    _ => ShardType::Han2Char8,
                }
            }
            _ => {
                // Three or more Han characters: split into 8 shards
                match hash % 8 {
                    0 => ShardType::Han3Plus1,
                    1 => ShardType::Han3Plus2,
                    2 => ShardType::Han3Plus3,
                    3 => ShardType::Han3Plus4,
                    4 => ShardType::Han3Plus5,
                    5 => ShardType::Han3Plus6,
                    6 => ShardType::Han3Plus7,
                    _ => ShardType::Han3Plus8,
                }
            }
        }
    }

    /// Simple hash function for consistent distribution
    /// Public for testing hash consistency between frontend and backend
    pub fn simple_hash(s: &str) -> usize {
        s.chars().fold(0usize, |acc, c| acc.wrapping_mul(31).wrapping_add(c as usize))
    }

    /// Get the subdirectory for a key (first 2 hex digits of hash: 00-ff)
    /// This creates 256 subdirectories per shard for optimal directory listing performance
    pub fn get_subdir(key: &str) -> String {
        let hash = Self::simple_hash(key);
        format!("{:02x}", (hash & 0xFF) as u8)
    }

    /// Get the shard name (used for repo names and URLs)
    fn shard_name(&self) -> &'static str {
        match self {
            ShardType::NonHan1 => "non-han-1",
            ShardType::NonHan2 => "non-han-2",
            ShardType::NonHan3 => "non-han-3",
            ShardType::NonHan4 => "non-han-4",
            ShardType::Han1Char1 => "han-1char-1",
            ShardType::Han1Char2 => "han-1char-2",
            ShardType::Han1Char3 => "han-1char-3",
            ShardType::Han1Char4 => "han-1char-4",
            ShardType::Han1Char5 => "han-1char-5",
            ShardType::Han1Char6 => "han-1char-6",
            ShardType::Han1Char7 => "han-1char-7",
            ShardType::Han1Char8 => "han-1char-8",
            ShardType::Han2Char1 => "han-2char-1",
            ShardType::Han2Char2 => "han-2char-2",
            ShardType::Han2Char3 => "han-2char-3",
            ShardType::Han2Char4 => "han-2char-4",
            ShardType::Han2Char5 => "han-2char-5",
            ShardType::Han2Char6 => "han-2char-6",
            ShardType::Han2Char7 => "han-2char-7",
            ShardType::Han2Char8 => "han-2char-8",
            ShardType::Han3Plus1 => "han-3plus-1",
            ShardType::Han3Plus2 => "han-3plus-2",
            ShardType::Han3Plus3 => "han-3plus-3",
            ShardType::Han3Plus4 => "han-3plus-4",
            ShardType::Han3Plus5 => "han-3plus-5",
            ShardType::Han3Plus6 => "han-3plus-6",
            ShardType::Han3Plus7 => "han-3plus-7",
            ShardType::Han3Plus8 => "han-3plus-8",
        }
    }

    /// Get the output directory name for this shard (for local builds)
    fn output_dir(&self) -> String {
        format!("output_{}", self.shard_name())
    }

    /// Parse from CLI mode string (30-shard system)
    fn from_mode_str(mode: &str) -> Option<Self> {
        match mode {
            "non-han-1" => Some(ShardType::NonHan1),
            "non-han-2" => Some(ShardType::NonHan2),
            "non-han-3" => Some(ShardType::NonHan3),
            "non-han-4" => Some(ShardType::NonHan4),
            "han-1char-1" => Some(ShardType::Han1Char1),
            "han-1char-2" => Some(ShardType::Han1Char2),
            "han-1char-3" => Some(ShardType::Han1Char3),
            "han-1char-4" => Some(ShardType::Han1Char4),
            "han-1char-5" => Some(ShardType::Han1Char5),
            "han-1char-6" => Some(ShardType::Han1Char6),
            "han-1char-7" => Some(ShardType::Han1Char7),
            "han-1char-8" => Some(ShardType::Han1Char8),
            "han-2char-1" => Some(ShardType::Han2Char1),
            "han-2char-2" => Some(ShardType::Han2Char2),
            "han-2char-3" => Some(ShardType::Han2Char3),
            "han-2char-4" => Some(ShardType::Han2Char4),
            "han-2char-5" => Some(ShardType::Han2Char5),
            "han-2char-6" => Some(ShardType::Han2Char6),
            "han-2char-7" => Some(ShardType::Han2Char7),
            "han-2char-8" => Some(ShardType::Han2Char8),
            "han-3plus-1" => Some(ShardType::Han3Plus1),
            "han-3plus-2" => Some(ShardType::Han3Plus2),
            "han-3plus-3" => Some(ShardType::Han3Plus3),
            "han-3plus-4" => Some(ShardType::Han3Plus4),
            "han-3plus-5" => Some(ShardType::Han3Plus5),
            "han-3plus-6" => Some(ShardType::Han3Plus6),
            "han-3plus-7" => Some(ShardType::Han3Plus7),
            "han-3plus-8" => Some(ShardType::Han3Plus8),
            _ => None,
        }
    }

    /// Get all shard types (for iteration)
    #[allow(dead_code)]
    fn all_shards() -> Vec<ShardType> {
        vec![
            ShardType::NonHan1, ShardType::NonHan2, ShardType::NonHan3, ShardType::NonHan4,
            ShardType::Han1Char1, ShardType::Han1Char2, ShardType::Han1Char3, ShardType::Han1Char4,
            ShardType::Han1Char5, ShardType::Han1Char6, ShardType::Han1Char7, ShardType::Han1Char8,
            ShardType::Han2Char1, ShardType::Han2Char2, ShardType::Han2Char3, ShardType::Han2Char4,
            ShardType::Han2Char5, ShardType::Han2Char6, ShardType::Han2Char7, ShardType::Han2Char8,
            ShardType::Han3Plus1, ShardType::Han3Plus2, ShardType::Han3Plus3, ShardType::Han3Plus4,
            ShardType::Han3Plus5, ShardType::Han3Plus6, ShardType::Han3Plus7, ShardType::Han3Plus8,
        ]
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
            Arg::new("test-hash")
                .long("test-hash")
                .value_name("WORD")
                .help("Test hash function with a word (for verifying frontend-backend consistency)")
                .num_args(1)
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
                .help("Specify which shard to build (30-shard system) or 'all' for all shards (default: all)")
                .value_parser([
                    "non-han-1", "non-han-2", "non-han-3", "non-han-4",
                    "han-1char-1", "han-1char-2", "han-1char-3", "han-1char-4",
                    "han-1char-5", "han-1char-6", "han-1char-7", "han-1char-8",
                    "han-2char-1", "han-2char-2", "han-2char-3", "han-2char-4",
                    "han-2char-5", "han-2char-6", "han-2char-7", "han-2char-8",
                    "han-3plus-1", "han-3plus-2", "han-3plus-3", "han-3plus-4",
                    "han-3plus-5", "han-3plus-6", "han-3plus-7", "han-3plus-8",
                    "all"
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
        .arg(
            Arg::new("prod")
                .long("prod")
                .help("Production mode: use maximum compression (level 9) for smallest file sizes. Default uses level 6 for faster builds.")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("dev-server")
                .long("dev-server")
                .help("Dev server mode: output a single SQLite database instead of individual files. Much faster builds (~30s vs 7min).")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("word-containment")
                .long("word-containment")
                .help("Enable word-to-word containment: show which words contain this word as a substring (e.g., 食べる → 食べ過ぎる). Can significantly increase build time.")
                .action(ArgAction::SetTrue),
        )
        .arg(
            Arg::new("containment-limit")
                .long("containment-limit")
                .help("Maximum number of words to show in 'contained in' lists (default: 200)")
                .value_name("LIMIT")
                .value_parser(clap::value_parser!(usize)),
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

    // Check if hash test is requested
    if let Some(word) = matches.get_one::<String>("test-hash") {
        let hash = ShardType::simple_hash(word);
        let shard = ShardType::from_key(word);
        println!("{}", hash);  // Print only hash for script parsing
        eprintln!("Word: {}", word);
        eprintln!("Hash: {}", hash);
        eprintln!("Shard: {:?}", shard);
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

    // Get production mode flag
    let prod_mode = matches.get_flag("prod");
    if prod_mode {
        println!("🏭 Production mode: using maximum compression (level 9)");
    }

    // Get dev server mode flag
    let dev_server_mode = matches.get_flag("dev-server");
    if dev_server_mode {
        println!("🚀 Dev server mode: outputting SQLite database for fast local development");
    }

    // Get word containment mode flag
    let word_containment_mode = matches.get_flag("word-containment");
    if word_containment_mode {
        println!("📚 Word containment mode: will build word-to-word containment relationships");
    }

    // Get containment limit (default: 200)
    let containment_limit = matches.get_one::<usize>("containment-limit").copied().unwrap_or(200);
    if containment_limit != 200 {
        println!("📊 Containment limit: {} words", containment_limit);
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
    let combined_dict = merge_dictionaries_with_mapping(chinese_entries.clone(), japanese_dict.words, j2c_mapping.clone())
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
        anyhow::bail!("Invalid mode: {}. Use --help to see all 30 available shard types or 'all'", mode_str);
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

    // Load Korean dictionary (KRDICT)
    let korean_words = if excluded_dicts.contains(&"krdict".to_string()) {
        println!("⏭️  Skipping Korean dictionary (KRDICT)");
        Vec::new()
    } else if std::path::Path::new("data/krdict-en").exists() {
        println!("📚 Loading Korean dictionary (KRDICT)...");
        load_korean_dictionary("data/krdict-en")
            .context("Failed to load Korean dictionary")?
    } else {
        println!("⚠️  Korean dictionary not found at data/krdict-en, skipping");
        Vec::new()
    };

    println!("📚 Loading IDS (character decomposition) database...");
    let ids_database = load_all_ids_files()
        .context("Failed to load IDS files")?;
    println!("  ✅ Total unique characters in IDS database: {}", ids_database.len());

    println!("🔧 Enriching character dictionaries with IDS decomposition data...");
    enrich_chinese_chars_with_ids(&mut chinese_char_dict_raw, &ids_database);
    enrich_japanese_chars_with_ids(&mut japanese_char_dict_raw, &ids_database);

    println!("🔧 Enriching component metadata with pinyin and meaning...");
    enrich_components_with_metadata(&mut chinese_char_dict_raw, &chinese_entries);

    println!("🔧 Loading MakeMeAHanzi stroke-component mappings...");
    let makemeahanzi_matches = load_makemeahanzi_matches()
        .context("Failed to load MakeMeAHanzi matches")?;

    println!("🔧 Enriching makemeahanzi images with stroke-component mappings...");
    enrich_makemeahanzi_with_matches(&mut chinese_char_dict_raw, &makemeahanzi_matches);

    // Build Korean character reading map
    println!("🇰🇷 Building Korean character reading map...");
    let unihan_path = if std::path::Path::new("data/unihan/Unihan_Readings.txt").exists() {
        Some("data/unihan/Unihan_Readings.txt")
    } else {
        println!("  ℹ️  Unihan not found, using KANJIDIC2 only for Korean readings");
        None
    };
    let korean_char_map = build_korean_character_map(&japanese_char_dict_raw.characters, unihan_path);

    // Generate output files (or SQLite database in dev server mode)
    if dev_server_mode {
        println!("🔄 Generating SQLite database for dev server...");
    } else {
        println!("🔄 Generating individual JSON files...");
    }

    generate_simple_output_files(
        &aligned_dict,
        &chinese_char_dict_raw,
        &japanese_char_dict_raw.characters,
        &jmnedict_entries,
        &korean_words,
        &korean_char_map,
        shard_filter,
        filter_characters.as_deref(),
        prod_mode,
        dev_server_mode,
        word_containment_mode,
        containment_limit,
    ).await?;

    println!("✅ Dictionary merger completed successfully!");
    
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

/// Load Korean dictionary from KRDICT Yomitan format
/// This parses the term_bank_*.json files and extracts Korean words
fn load_korean_dictionary(dir_path: &str) -> Result<Vec<korean_types::KoreanWord>> {
    use regex::Regex;
    use std::collections::HashSet;

    println!("📖 Loading Korean dictionary from {}", dir_path);

    // Find all term bank files
    let mut term_bank_files: Vec<_> = std::fs::read_dir(dir_path)?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name().to_string_lossy().starts_with("term_bank_")
                && e.file_name().to_string_lossy().ends_with(".json")
        })
        .collect();

    term_bank_files.sort_by_key(|e| e.file_name());

    if term_bank_files.is_empty() {
        anyhow::bail!("No term_bank_*.json files found in {}", dir_path);
    }

    // Regex to extract Hanja from content (〔親〕 format)
    let hanja_regex = Regex::new(r"〔([^〕]+)〕").unwrap();

    // Track processed entries to avoid duplicates (Hangul entries only)
    let mut processed: HashSet<String> = HashSet::new();
    let mut words: Vec<korean_types::KoreanWord> = Vec::new();

    for entry in &term_bank_files {
        let file_path = entry.path();
        let content = std::fs::read_to_string(&file_path)
            .with_context(|| format!("Failed to read {:?}", file_path))?;

        // Parse as array of arrays
        let entries: Vec<serde_json::Value> = serde_json::from_str(&content)
            .with_context(|| format!("Failed to parse {:?}", file_path))?;

        for entry_val in entries {
            if let Some(arr) = entry_val.as_array() {
                if arr.len() < 7 {
                    continue;
                }

                let term = arr[0].as_str().unwrap_or("");
                let _reading = arr[1].as_str().unwrap_or("");
                let tags = arr[2].as_str().unwrap_or("");
                let definitions = &arr[5];
                let sequence = arr[6].as_i64().unwrap_or(0);

                // Skip if term is empty
                if term.is_empty() {
                    continue;
                }

                // Check if term is Hangul or Hanja
                // Hangul Unicode range: U+AC00 - U+D7AF (syllables) or U+1100 - U+11FF (jamo)
                let is_hangul = term.chars().next().map_or(false, |c| {
                    ('\u{AC00}'..='\u{D7AF}').contains(&c) ||
                    ('\u{1100}'..='\u{11FF}').contains(&c) ||
                    ('\u{3130}'..='\u{318F}').contains(&c)
                });

                // Only process Hangul entries (skip Hanja-indexed duplicates)
                if !is_hangul {
                    continue;
                }

                // Create unique key to avoid duplicates
                let unique_key = format!("{}_{}", term, sequence);
                if processed.contains(&unique_key) {
                    continue;
                }
                processed.insert(unique_key);

                // Extract data from structured content
                let (extracted_defs, extracted_hanja, extracted_examples) =
                    extract_korean_content(definitions, &hanja_regex);

                // Parse part of speech from tags
                let pos = parse_korean_pos(tags);

                // Parse frequency from star ratings
                let frequency_rank = parse_korean_frequency(tags);

                // Determine word origin based on Hanja presence
                let origin = if extracted_hanja.is_some() {
                    Some(korean_types::WordOrigin::SinoKorean)
                } else {
                    Some(korean_types::WordOrigin::Native)
                };

                let word = korean_types::KoreanWord {
                    id: format!("krdict_{}", sequence),
                    hangul: term.to_string(),
                    hanja: extracted_hanja,
                    romanization: None, // Will be added from IPA data
                    pronunciation: None, // Will be added from IPA data
                    pos,
                    definitions: extracted_defs,
                    examples: extracted_examples,
                    origin,
                    frequency_rank,
                };

                words.push(word);
            }
        }

        println!("  Processed {:?}, total words: {}", file_path.file_name().unwrap(), words.len());
    }

    // Load IPA/pronunciation data
    let ipa_path = dir_path.replace("krdict-en", "krdict-ipa");
    if std::path::Path::new(&ipa_path).exists() {
        load_korean_ipa(&ipa_path, &mut words)?;
    }

    println!("  ✅ Loaded {} Korean words total", words.len());
    Ok(words)
}

/// Extract definitions, hanja, and examples from KRDICT structured content
fn extract_korean_content(
    definitions: &serde_json::Value,
    hanja_regex: &regex::Regex
) -> (Vec<korean_types::KoreanDefinition>, Option<String>, Vec<korean_types::KoreanExample>) {
    let mut defs = Vec::new();
    let mut hanja: Option<String> = None;
    let mut examples = Vec::new();

    // The definitions can be an array of structured-content objects
    if let Some(def_array) = definitions.as_array() {
        for def_obj in def_array {
            if let Some(obj) = def_obj.as_object() {
                if obj.get("type").and_then(|v| v.as_str()) == Some("structured-content") {
                    if let Some(content) = obj.get("content") {
                        let (d, h, e) = parse_structured_content(content, hanja_regex, 1);
                        defs.extend(d);
                        if hanja.is_none() && h.is_some() {
                            hanja = h;
                        }
                        examples.extend(e);
                    }
                }
            }
        }
    }

    (defs, hanja, examples)
}

/// Recursively parse structured content to extract text
fn parse_structured_content(
    content: &serde_json::Value,
    hanja_regex: &regex::Regex,
    sense_num: u32,
) -> (Vec<korean_types::KoreanDefinition>, Option<String>, Vec<korean_types::KoreanExample>) {
    let mut defs = Vec::new();
    let mut hanja: Option<String> = None;
    let mut examples = Vec::new();

    match content {
        serde_json::Value::String(s) => {
            // Check for hanja in 〔...〕 format
            if let Some(caps) = hanja_regex.captures(s) {
                if let Some(h) = caps.get(1) {
                    hanja = Some(h.as_str().to_string());
                }
            }
            // Check if this looks like an English definition
            let trimmed = s.trim();
            if !trimmed.is_empty()
                && !trimmed.starts_with("〔")
                && !trimmed.starts_with("See More")
                && !trimmed.contains("〔")
                && is_likely_english(trimmed)
            {
                // Skip numbered prefixes like "1. ", "2. ", etc.
                if !trimmed.chars().next().map_or(false, |c| c.is_ascii_digit()) {
                    defs.push(korean_types::KoreanDefinition {
                        text: trimmed.to_string(),
                        lang: Some("en".to_string()),
                        sense_number: Some(sense_num),
                    });
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                let (d, h, e) = parse_structured_content(item, hanja_regex, sense_num);
                defs.extend(d);
                if hanja.is_none() && h.is_some() {
                    hanja = h;
                }
                examples.extend(e);
            }
        }
        serde_json::Value::Object(obj) => {
            // Check tag type
            let tag = obj.get("tag").and_then(|v| v.as_str()).unwrap_or("");
            let lang = obj.get("lang").and_then(|v| v.as_str()).unwrap_or("");

            // Skip Korean-language content (we want English definitions)
            if lang == "ko" && tag != "span" {
                // But still extract hanja from Korean spans
                if let Some(c) = obj.get("content") {
                    if let serde_json::Value::String(s) = c {
                        if let Some(caps) = hanja_regex.captures(s) {
                            if let Some(h) = caps.get(1) {
                                hanja = Some(h.as_str().to_string());
                            }
                        }
                    }
                }
                return (defs, hanja, examples);
            }

            // Skip details/summary (expandable sections)
            if tag == "details" || tag == "summary" {
                return (defs, hanja, examples);
            }

            // Recurse into content
            if let Some(c) = obj.get("content") {
                let (d, h, e) = parse_structured_content(c, hanja_regex, sense_num);
                defs.extend(d);
                if hanja.is_none() && h.is_some() {
                    hanja = h;
                }
                examples.extend(e);
            }
        }
        _ => {}
    }

    (defs, hanja, examples)
}

/// Check if text is likely English (simple heuristic)
fn is_likely_english(s: &str) -> bool {
    // Check if mostly ASCII letters and common punctuation
    let ascii_count = s.chars().filter(|c| c.is_ascii_alphabetic()).count();
    let total_alpha = s.chars().filter(|c| c.is_alphabetic()).count();

    if total_alpha == 0 {
        return false;
    }

    // At least 70% ASCII alphabetic
    (ascii_count as f64 / total_alpha as f64) > 0.7
}

/// Parse part of speech from KRDICT tags
fn parse_korean_pos(tags: &str) -> Option<String> {
    let parts: Vec<&str> = tags.split_whitespace().collect();
    if let Some(first) = parts.first() {
        // Remove star ratings
        let pos = first.trim_start_matches('⭐');
        if !pos.is_empty() && !pos.starts_with('⭐') {
            return Some(pos.to_string());
        }
    }

    // Try to find POS among parts
    for part in parts {
        let clean = part.trim_start_matches('⭐').trim_end_matches('⭐');
        match clean {
            "Noun" | "Verb" | "Adjective" | "Adverb" | "Affix" |
            "Bound Noun" | "Interjection" | "Determiner" | "Pronoun" => {
                return Some(clean.to_string());
            }
            _ => {}
        }
    }

    None
}

/// Parse frequency rank from star ratings (⭐⭐⭐ = rank 1, ⭐⭐ = rank 2, ⭐ = rank 3)
fn parse_korean_frequency(tags: &str) -> Option<u32> {
    let star_count = tags.chars().filter(|&c| c == '⭐').count();
    match star_count {
        3 => Some(1), // Most frequent
        2 => Some(2),
        1 => Some(3),
        _ => None,    // No frequency data
    }
}

/// Load IPA pronunciation data and merge with Korean words
fn load_korean_ipa(ipa_dir: &str, words: &mut Vec<korean_types::KoreanWord>) -> Result<()> {
    use std::collections::HashMap;

    // Find term_meta_bank files
    let meta_files: Vec<_> = std::fs::read_dir(ipa_dir)?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name().to_string_lossy().starts_with("term_meta_bank_")
                && e.file_name().to_string_lossy().ends_with(".json")
        })
        .collect();

    // Build pronunciation map
    let mut ipa_map: HashMap<String, String> = HashMap::new();

    for entry in meta_files {
        let file_path = entry.path();
        let content = std::fs::read_to_string(&file_path)?;

        let entries: Vec<serde_json::Value> = serde_json::from_str(&content)?;

        for entry_val in entries {
            if let Some(arr) = entry_val.as_array() {
                if arr.len() >= 3 {
                    let term = arr[0].as_str().unwrap_or("");
                    let meta_type = arr[1].as_str().unwrap_or("");

                    if meta_type == "ipa" {
                        if let Some(data) = arr[2].as_object() {
                            if let Some(transcriptions) = data.get("transcriptions") {
                                if let Some(trans_arr) = transcriptions.as_array() {
                                    if let Some(first) = trans_arr.first() {
                                        if let Some(ipa) = first.get("ipa").and_then(|v| v.as_str()) {
                                            ipa_map.insert(term.to_string(), ipa.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    println!("  Loaded {} IPA pronunciations", ipa_map.len());

    // Apply IPA to words
    let mut matched = 0;
    for word in words.iter_mut() {
        if let Some(ipa) = ipa_map.get(&word.hangul) {
            word.pronunciation = Some(ipa.clone());
            matched += 1;
        }
    }

    println!("  Applied IPA to {} words", matched);
    Ok(())
}

/// Load Unihan Korean readings from Unihan_Readings.txt
/// Returns a HashMap mapping character to (hangul_readings, romanization_readings)
fn load_unihan_korean_readings(path: &str) -> Result<std::collections::HashMap<String, (Vec<String>, Vec<String>)>> {
    use std::collections::HashMap;
    use std::io::{BufRead, BufReader};

    let file = File::open(path)?;
    let reader = BufReader::new(file);

    let mut korean_map: HashMap<String, (Vec<String>, Vec<String>)> = HashMap::new();

    for line in reader.lines() {
        let line = line?;
        if line.starts_with('#') || line.trim().is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            let codepoint = parts[0];
            let field = parts[1];
            let value = parts[2];

            // Convert codepoint (e.g., "U+4E00") to character
            if let Some(hex_str) = codepoint.strip_prefix("U+") {
                if let Ok(code) = u32::from_str_radix(hex_str, 16) {
                    if let Some(ch) = char::from_u32(code) {
                        let char_str = ch.to_string();
                        let entry = korean_map.entry(char_str).or_insert_with(|| (Vec::new(), Vec::new()));

                        match field {
                            "kHangul" => {
                                // Parse kHangul format: "온:N 은:N" -> ["온", "은"]
                                for reading in value.split_whitespace() {
                                    let hangul = reading.split(':').next().unwrap_or(reading);
                                    if !entry.0.contains(&hangul.to_string()) {
                                        entry.0.push(hangul.to_string());
                                    }
                                }
                            }
                            "kKorean" => {
                                // Parse kKorean format: "IL" or "MAN MWUK" (Yale romanization)
                                for reading in value.split_whitespace() {
                                    if !entry.1.contains(&reading.to_string()) {
                                        entry.1.push(reading.to_string());
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
            }
        }
    }

    println!("  ✅ Loaded Unihan Korean readings for {} characters", korean_map.len());
    Ok(korean_map)
}

/// Load Korean compatibility variant mappings from Unihan_IRGSources.txt
/// Returns a HashMap mapping unified CJK character to Korean compatibility character(s)
/// These are characters in the U+F900-U+FAFF range that have Korean-specific glyph forms
fn load_korean_compatibility_variants(path: &str) -> Result<std::collections::HashMap<String, String>> {
    use std::fs::File;
    use std::collections::HashMap;
    use std::io::{BufRead, BufReader};

    let file = File::open(path)?;
    let reader = BufReader::new(file);

    // Map from unified CJK character to Korean compatibility character
    let mut unified_to_korean: HashMap<String, String> = HashMap::new();

    for line in reader.lines() {
        let line = line?;
        if line.starts_with('#') || line.trim().is_empty() {
            continue;
        }

        // Format: U+F900	kCompatibilityVariant	U+8C48
        // Meaning: F900 (Korean form) is a variant of 8C48 (unified form)
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 && parts[1] == "kCompatibilityVariant" {
            let korean_cp = parts[0];  // e.g., U+F900
            let unified_cp = parts[2]; // e.g., U+8C48

            // Convert codepoints to characters
            if let (Some(korean_hex), Some(unified_hex)) =
                (korean_cp.strip_prefix("U+"), unified_cp.strip_prefix("U+"))
            {
                if let (Ok(korean_code), Ok(unified_code)) =
                    (u32::from_str_radix(korean_hex, 16), u32::from_str_radix(unified_hex, 16))
                {
                    if let (Some(korean_char), Some(unified_char)) =
                        (char::from_u32(korean_code), char::from_u32(unified_code))
                    {
                        // Only include Korean compatibility characters (U+F900-U+FAFF range)
                        // that have Korean IRG sources
                        if (0xF900..=0xFAFF).contains(&korean_code) {
                            let unified_str = unified_char.to_string();
                            let korean_str = korean_char.to_string();

                            // Store the first Korean variant for each unified character
                            // (some characters have multiple variants, we take the first)
                            unified_to_korean.entry(unified_str).or_insert(korean_str);
                        }
                    }
                }
            }
        }
    }

    println!("  ✅ Loaded {} Korean compatibility variant mappings", unified_to_korean.len());
    Ok(unified_to_korean)
}

/// Extract Korean readings from KANJIDIC2 characters
/// Returns a HashMap mapping character to KoreanCharacter
fn extract_kanjidic_korean_readings(
    kanjidic_entries: &[KanjiCharacter]
) -> std::collections::HashMap<String, korean_types::KoreanCharacter> {
    use std::collections::HashMap;

    let mut korean_chars: HashMap<String, korean_types::KoreanCharacter> = HashMap::new();
    let mut chars_with_korean = 0;

    for kanji in kanjidic_entries {
        let mut hangul_readings: Vec<String> = Vec::new();
        let mut roman_readings: Vec<String> = Vec::new();
        let mut meanings_en: Vec<String> = Vec::new();

        if let Some(ref rm) = kanji.reading_meaning {
            for group in &rm.groups {
                // Extract Korean readings
                for reading in &group.readings {
                    match reading.reading_type.as_str() {
                        "korean_h" => {
                            if !hangul_readings.contains(&reading.value) {
                                hangul_readings.push(reading.value.clone());
                            }
                        }
                        "korean_r" => {
                            if !roman_readings.contains(&reading.value) {
                                roman_readings.push(reading.value.clone());
                            }
                        }
                        _ => {}
                    }
                }

                // Extract English meanings
                for meaning in &group.meanings {
                    if meaning.lang == "en" && !meanings_en.contains(&meaning.value) {
                        meanings_en.push(meaning.value.clone());
                    }
                }
            }
        }

        // Only create entry if we have Korean readings
        if !hangul_readings.is_empty() || !roman_readings.is_empty() {
            // Build Korean readings with romanization paired
            let readings: Vec<korean_types::KoreanReading> = hangul_readings.iter().enumerate().map(|(i, hangul)| {
                korean_types::KoreanReading {
                    hangul: hangul.clone(),
                    romanization: roman_readings.get(i).cloned(),
                    reading_type: None,
                }
            }).collect();

            // Get stroke count (first value)
            let strokes = kanji.misc.stroke_counts.first().map(|&s| s as u32);

            // Get radical
            let radical = kanji.radicals.first().map(|r| r.value.to_string());

            let korean_char = korean_types::KoreanCharacter {
                character: kanji.literal.clone(),
                hanja_form: None, // Will be populated later from Unihan compatibility variants
                readings,
                meanings: Vec::new(), // Korean meanings would need a separate source
                meanings_en,
                strokes,
                radical,
            };

            korean_chars.insert(kanji.literal.clone(), korean_char);
            chars_with_korean += 1;
        }
    }

    println!("  ✅ Extracted Korean readings from KANJIDIC2 for {} characters", chars_with_korean);
    korean_chars
}

/// Build combined Korean character map from KANJIDIC2 and Unihan
fn build_korean_character_map(
    kanjidic_entries: &[KanjiCharacter],
    unihan_path: Option<&str>,
) -> std::collections::HashMap<String, korean_types::KoreanCharacter> {
    // Start with KANJIDIC2 (primary source - has both Hangul and romanization)
    let mut korean_chars = extract_kanjidic_korean_readings(kanjidic_entries);
    let kanjidic_count = korean_chars.len();

    // Supplement with Unihan if available
    if let Some(path) = unihan_path {
        if std::path::Path::new(path).exists() {
            match load_unihan_korean_readings(path) {
                Ok(unihan_korean) => {
                    let mut added_from_unihan = 0;

                    for (char, (hangul, roman)) in unihan_korean {
                        if !korean_chars.contains_key(&char) && (!hangul.is_empty() || !roman.is_empty()) {
                            // Build readings from Unihan data
                            let readings: Vec<korean_types::KoreanReading> = if !hangul.is_empty() {
                                hangul.iter().enumerate().map(|(i, h)| {
                                    korean_types::KoreanReading {
                                        hangul: h.clone(),
                                        romanization: roman.get(i).cloned(),
                                        reading_type: None,
                                    }
                                }).collect()
                            } else {
                                // Only romanization available - still useful
                                roman.iter().map(|r| {
                                    korean_types::KoreanReading {
                                        hangul: r.to_lowercase(), // Yale romanization as fallback
                                        romanization: Some(r.clone()),
                                        reading_type: None,
                                    }
                                }).collect()
                            };

                            let korean_char = korean_types::KoreanCharacter {
                                character: char.clone(),
                                hanja_form: None, // Will be populated below
                                readings,
                                meanings: Vec::new(),
                                meanings_en: Vec::new(),
                                strokes: None,
                                radical: None,
                            };

                            korean_chars.insert(char, korean_char);
                            added_from_unihan += 1;
                        }
                    }

                    println!("  ✅ Added {} characters from Unihan (not in KANJIDIC2)", added_from_unihan);
                }
                Err(e) => {
                    println!("  ⚠️  Failed to load Unihan Korean readings: {}", e);
                }
            }
        }
    }

    println!("  📊 Total characters with Korean readings: {} (KANJIDIC2: {}, Unihan supplement: {})",
             korean_chars.len(), kanjidic_count, korean_chars.len() - kanjidic_count);

    // Load Korean compatibility variants and populate hanja_form field
    // These are characters in U+F900-U+FAFF that have Korean-specific glyph forms
    let irg_sources_path = "data/unihan/Unihan_IRGSources.txt";
    if std::path::Path::new(irg_sources_path).exists() {
        match load_korean_compatibility_variants(irg_sources_path) {
            Ok(compat_variants) => {
                let mut variants_added = 0;
                for (unified_char, korean_form) in &compat_variants {
                    if let Some(korean_char) = korean_chars.get_mut(unified_char) {
                        korean_char.hanja_form = Some(korean_form.clone());
                        variants_added += 1;
                    }
                }
                println!("  ✅ Added {} Korean Hanja variant forms", variants_added);
            }
            Err(e) => {
                println!("  ⚠️  Failed to load Korean compatibility variants: {}", e);
            }
        }
    }

    korean_chars
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

/// Enrich component metadata with pinyin and meaning from word dictionary
fn enrich_components_with_metadata(
    chinese_chars: &mut Vec<ChineseCharacter>,
    chinese_words: &Vec<ChineseDictionaryElement>,
) {
    // Build lookup map: character -> (pinyin, meaning)
    let mut char_metadata: HashMap<String, (String, String)> = HashMap::new();
    
    for word in chinese_words {
        // Only process single-character words
        if word.simp.chars().count() == 1 {
            if let Some(first_item) = word.items.first() {
                if let Some(pinyin) = &first_item.pinyin {
                    if let Some(definitions) = &first_item.definitions {
                        if let Some(first_def) = definitions.first() {
                            char_metadata.insert(
                                word.simp.clone(),
                                (pinyin.clone(), first_def.clone())
                            );
                        }
                    }
                }
            }
        }
    }
    
    // Enrich components
    let mut enriched_count = 0;
    for char_entry in chinese_chars.iter_mut() {
        if let Some(components) = &mut char_entry.components {
            for component in components.iter_mut() {
                if let Some((pinyin, meaning)) = char_metadata.get(&component.character) {
                    component.pinyin = Some(pinyin.clone());
                    component.meaning = Some(meaning.clone());
                    enriched_count += 1;
                }
            }
        }
    }
    
    println!("  ✅ Enriched {} components with pinyin/meaning metadata", enriched_count);
}

/// MakeMeAHanzi dictionary entry for parsing
#[derive(Debug, serde::Deserialize)]
struct MakeMeAHanziEntry {
    character: String,
    #[serde(default)]
    matches: Option<Vec<Option<Vec<i32>>>>,
}

/// Load MakeMeAHanzi dictionary from GitHub (cached locally)
fn load_makemeahanzi_matches() -> Result<HashMap<String, Vec<Option<Vec<i32>>>>> {
    let cache_path = "data/makemeahanzi_dictionary.txt";
    let url = "https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt";

    // Check if cached file exists
    let content = if std::path::Path::new(cache_path).exists() {
        println!("  📂 Loading MakeMeAHanzi from cache: {}", cache_path);
        fs::read_to_string(cache_path)?
    } else {
        println!("  🌐 Downloading MakeMeAHanzi dictionary from GitHub...");
        let response = reqwest::blocking::get(url)
            .context("Failed to download MakeMeAHanzi dictionary")?;
        let content = response.text()
            .context("Failed to read MakeMeAHanzi response")?;

        // Cache for future runs
        fs::write(cache_path, &content)
            .context("Failed to cache MakeMeAHanzi dictionary")?;
        println!("  💾 Cached to: {}", cache_path);
        content
    };

    // Parse the JSONL content
    let mut matches_db: HashMap<String, Vec<Option<Vec<i32>>>> = HashMap::new();

    for line in content.lines() {
        if line.trim().is_empty() {
            continue;
        }

        if let Ok(entry) = serde_json::from_str::<MakeMeAHanziEntry>(line) {
            if let Some(matches) = entry.matches {
                matches_db.insert(entry.character, matches);
            }
        }
    }

    println!("  ✅ Loaded {} characters with stroke-component mappings", matches_db.len());
    Ok(matches_db)
}

/// Enrich Chinese character images with MakeMeAHanzi matches (stroke-to-component mapping)
fn enrich_makemeahanzi_with_matches(
    chinese_chars: &mut Vec<ChineseCharacter>,
    matches_db: &HashMap<String, Vec<Option<Vec<i32>>>>,
) {
    let mut enriched_count = 0;

    for char_entry in chinese_chars.iter_mut() {
        // Check if this character has matches data
        if let Some(matches) = matches_db.get(&char_entry.char) {
            // Find the makemeahanzi image entry
            if let Some(images) = &mut char_entry.images {
                for image in images.iter_mut() {
                    if image.source == "makemeahanzi" {
                        // Add matches to the data field
                        if let Some(data) = &mut image.data {
                            if let Some(obj) = data.as_object_mut() {
                                obj.insert(
                                    "matches".to_string(),
                                    serde_json::to_value(matches).unwrap()
                                );
                                enriched_count += 1;
                            }
                        } else {
                            // Create new data object with matches
                            let mut obj = serde_json::Map::new();
                            obj.insert(
                                "matches".to_string(),
                                serde_json::to_value(matches).unwrap()
                            );
                            image.data = Some(serde_json::Value::Object(obj));
                            enriched_count += 1;
                        }
                    }
                }
            }
        }
    }

    println!("  ✅ Enriched {} makemeahanzi images with stroke-component mappings", enriched_count);
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

/// Load JPDB frequency data from CSV file
/// Returns a HashMap where key is (term, reading) and value is frequency rank (1 = most common)
fn load_jpdb_frequency(path: &str) -> Result<HashMap<(String, String), u32>> {
    let file = File::open(path)
        .with_context(|| format!("Failed to open JPDB frequency file: {}", path))?;
    let reader = BufReader::new(file);
    let mut frequency_map = HashMap::new();

    for (line_num, line) in reader.lines().enumerate() {
        let line = line.with_context(|| format!("Failed to read line {} from JPDB file", line_num + 1))?;

        // Skip header line
        if line_num == 0 && line.starts_with("term") {
            continue;
        }

        // Tab-separated: term, reading, frequency, kana_frequency
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            let term = parts[0].to_string();
            let reading = parts[1].to_string();
            if let Ok(frequency) = parts[2].parse::<u32>() {
                frequency_map.insert((term, reading), frequency);
            }
        }
    }

    println!("  ✅ Loaded {} JPDB frequency entries", frequency_map.len());
    Ok(frequency_map)
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
    korean_words: &[korean_types::KoreanWord],
    korean_char_map: &std::collections::HashMap<String, korean_types::KoreanCharacter>,
    shard_filter: Option<ShardType>,
    filter_characters: Option<&str>,
    prod_mode: bool,
    dev_server_mode: bool,
    word_containment_mode: bool,
    containment_limit: usize,
) -> Result<()> {
    use std::fs;
    use std::path::Path;
    use std::collections::HashMap as StdHashMap;
    use simple_output_types::SimpleOutput;

    // Load JPDB frequency data for Japanese word sorting
    println!("📚 Loading JPDB frequency data...");
    let jpdb_frequency = load_jpdb_frequency("data/jpdb_v2.2_freq_list_2024-10-13.csv")
        .unwrap_or_else(|e| {
            println!("  ⚠️  Failed to load JPDB frequency data: {}. Falling back to common flag only.", e);
            StdHashMap::new()
        });

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
    // When there are duplicates (e.g., U+50CF and U+2F80B for 像), prefer the entry with more sources
    let mut chinese_char_by_key: StdHashMap<String, &ChineseCharacter> = StdHashMap::new();
    for char_entry in chinese_chars {
        let key = char_entry.char.clone();

        // Check if we already have an entry for this character
        if let Some(existing) = chinese_char_by_key.get(&key) {
            // Prefer the entry with more sources (more complete data)
            // If sources are equal, prefer the one with more fields populated
            let existing_score = existing.sources.len() * 100
                + if existing.components.is_some() { 10 } else { 0 }
                + if existing.images.is_some() { 10 } else { 0 }
                + if existing.pinyin_frequencies.is_some() { 10 } else { 0 };

            let new_score = char_entry.sources.len() * 100
                + if char_entry.components.is_some() { 10 } else { 0 }
                + if char_entry.images.is_some() { 10 } else { 0 }
                + if char_entry.pinyin_frequencies.is_some() { 10 } else { 0 };

            // Only replace if the new entry has a higher score
            if new_score > existing_score {
                chinese_char_by_key.insert(key, char_entry);
            }
            // If scores are equal, keep the existing one (first occurrence)
        } else {
            // No existing entry, insert this one
            chinese_char_by_key.insert(key, char_entry);
        }
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
            simplified_form_of: None,
            chinese_words: Vec::new(),
            chinese_char: None,
            japanese_words: Vec::new(),
            japanese_char: None,
            related_japanese_words: Vec::new(),
            japanese_names: Vec::new(),
            contains: Vec::new(),
            contained_in_chinese: Vec::new(),
            contained_in_japanese: Vec::new(),
            korean_words: Vec::new(),
            korean_char: None,
            contained_in_korean: Vec::new(),
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
                            simplified_form_of: None,
                            chinese_words: Vec::new(),
                            chinese_char: None,
                            japanese_words: Vec::new(),
                            japanese_char: None,
                            related_japanese_words: Vec::new(),
                            japanese_names: Vec::new(),
                            contains: Vec::new(),
                            contained_in_chinese: Vec::new(),
                            contained_in_japanese: Vec::new(),
                            korean_words: Vec::new(),
                            korean_char: None,
                            contained_in_korean: Vec::new(),
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
                simplified_form_of: None,
                chinese_words: Vec::new(),
                chinese_char: None,
                japanese_words: Vec::new(),
                japanese_char: None,
                related_japanese_words: Vec::new(),
                japanese_names: Vec::new(),
                contains: Vec::new(),
                contained_in_chinese: Vec::new(),
                contained_in_japanese: Vec::new(),
                korean_words: Vec::new(),
                korean_char: None,
                contained_in_korean: Vec::new(),
            };
            outputs.insert(key.clone(), redirect_entry);
            japanese_variant_redirect_count += 1;
        } else if let Some(ref trad_variants) = char_entry.trad_variants {
            // This is a simplified character with traditional variant(s)
            // Create redirect to the first traditional variant that's different from the key
            // BUT keep the simplified character's own data (especially components) for display
            let trad_target = trad_variants.iter()
                .find(|&variant| variant != &key)
                .cloned();

            if let Some(trad_target) = trad_target {
                // Check if this simplified character has its own independent word entries
                // (i.e., entries where trad == simp == this character)
                // If so, don't redirect - this is a "merged character" case like 制/製
                let has_own_word_entries = outputs.get(&key)
                    .map(|o| !o.chinese_words.is_empty())
                    .unwrap_or(false);

                if has_own_word_entries {
                    // This is a merged character case (e.g., 制 has its own meaning AND is simplified form of 製)
                    // Don't create a redirect - instead, add the character data and set simplified_form_of
                    let output = outputs.entry(key.clone()).or_insert_with(|| SimpleOutput {
                        key: key.clone(),
                        redirect: None,
                        simplified_form_of: None,
                        chinese_words: Vec::new(),
                        chinese_char: None,
                        japanese_words: Vec::new(),
                        japanese_char: None,
                        related_japanese_words: Vec::new(),
                        japanese_names: Vec::new(),
                        contains: Vec::new(),
                        contained_in_chinese: Vec::new(),
                        contained_in_japanese: Vec::new(),
                        korean_words: Vec::new(),
                        korean_char: None,
                        contained_in_korean: Vec::new(),
                    });
                    output.chinese_char = Some(char_entry.clone());
                    output.simplified_form_of = Some(trad_target.clone());
                    println!("  📍 Merged character detected: {} (also simplified form of {})", key, trad_target);
                } else {
                    // Normal simplified character - create redirect
                    let redirect_entry = SimpleOutput {
                        key: key.clone(),
                        redirect: Some(trad_target.clone()),
                        simplified_form_of: None,
                        chinese_words: Vec::new(),
                        // Keep the simplified character's own data (components, etymology, etc.)
                        // This allows showing simplified-specific component breakdown
                        chinese_char: Some(char_entry.clone()),
                        japanese_words: Vec::new(),
                        japanese_char: None,
                        related_japanese_words: Vec::new(),
                        japanese_names: Vec::new(),
                        contains: Vec::new(),
                        contained_in_chinese: Vec::new(),
                        contained_in_japanese: Vec::new(),
                        korean_words: Vec::new(),
                        korean_char: None,
                        contained_in_korean: Vec::new(),
                    };
                    outputs.insert(key.clone(), redirect_entry);
                    simplified_redirect_count += 1;
                }
            }
        } else {
            // Regular Chinese character (traditional or no variants) - add normally
            let output = outputs.entry(key.clone()).or_insert_with(|| SimpleOutput {
                key: key.clone(),
                redirect: None,
                simplified_form_of: None,
                chinese_words: Vec::new(),
                chinese_char: None,
                japanese_words: Vec::new(),
                japanese_char: None,
                related_japanese_words: Vec::new(),
                japanese_names: Vec::new(),
                contains: Vec::new(),
                contained_in_chinese: Vec::new(),
                contained_in_japanese: Vec::new(),
                korean_words: Vec::new(),
                korean_char: None,
                contained_in_korean: Vec::new(),
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
                simplified_form_of: None,
                chinese_words: Vec::new(),
                chinese_char: None,
                japanese_words: Vec::new(),
                japanese_char: None,
                related_japanese_words: Vec::new(),
                japanese_names: Vec::new(),
                contains: Vec::new(),
                contained_in_chinese: Vec::new(),
                contained_in_japanese: Vec::new(),
                korean_words: Vec::new(),
                korean_char: None,
                contained_in_korean: Vec::new(),
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
                simplified_form_of: None,
                chinese_words: Vec::new(),
                chinese_char: None,
                japanese_words: Vec::new(),
                japanese_char: None,
                related_japanese_words: Vec::new(),
                japanese_names: Vec::new(),
                contains: Vec::new(),
                contained_in_chinese: Vec::new(),
                contained_in_japanese: Vec::new(),
                korean_words: Vec::new(),
                korean_char: None,
                contained_in_korean: Vec::new(),
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

    // Load J2C mapping for multi-character name entries
    let j2c_mapping_for_names = load_j2c_mapping("output/j2c_mapping.json")
        .unwrap_or_else(|_| {
            println!("  ⚠️  No J2C mapping found for JMnedict entries");
            StdHashMap::new()
        });

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
                // Multi-character - use J2C mapping if available
                j2c_mapping_for_names.get(&key).cloned().unwrap_or(key.clone())
            };

            let output = outputs.entry(final_key.clone()).or_insert_with(|| SimpleOutput {
                key: final_key.clone(),
                redirect: None,
                simplified_form_of: None,
                chinese_words: Vec::new(),
                chinese_char: None,
                japanese_words: Vec::new(),
                japanese_char: None,
                related_japanese_words: Vec::new(),
                japanese_names: Vec::new(),
                contains: Vec::new(),
                contained_in_chinese: Vec::new(),
                contained_in_japanese: Vec::new(),
                korean_words: Vec::new(),
                korean_char: None,
                contained_in_korean: Vec::new(),
            });

            // Add the name entry to this key's japanese_names
            output.japanese_names.push(jmnedict_entry.clone());
        }
    }

    // Populate Korean character readings for all single-character entries
    println!("📝 Adding Korean character readings...");
    let mut korean_char_added = 0;
    for (key, output) in outputs.iter_mut() {
        // Only add Korean character data for single-character keys
        if key.chars().count() == 1 {
            if let Some(korean_char) = korean_char_map.get(key) {
                output.korean_char = Some(korean_char.clone());
                korean_char_added += 1;
            }
        }
    }
    println!("  ✅ Added Korean readings to {} character entries", korean_char_added);

    // Process Korean words
    println!("📝 Processing Korean word entries (KRDICT)...");
    let mut sino_korean_merged = 0;
    let mut native_korean_added = 0;

    // Build a map from Hanja to Korean words for efficient lookup
    // Key is the Hanja (traditional Chinese characters), value is list of Korean words
    let mut hanja_to_korean: std::collections::HashMap<String, Vec<korean_types::KoreanWord>> =
        std::collections::HashMap::new();
    let mut native_korean_words: Vec<korean_types::KoreanWord> = Vec::new();

    for korean_word in korean_words {
        if let Some(ref hanja) = korean_word.hanja {
            // Sino-Korean word with Hanja - index by Hanja for merging
            hanja_to_korean
                .entry(hanja.clone())
                .or_default()
                .push(korean_word.clone());
        } else {
            // Native Korean word without Hanja - will create standalone entry
            native_korean_words.push(korean_word.clone());
        }
    }

    println!("  📊 {} Sino-Korean words (with Hanja), {} native Korean words",
             hanja_to_korean.values().map(|v| v.len()).sum::<usize>(),
             native_korean_words.len());

    // Merge Sino-Korean words into existing entries by Hanja key
    // The Hanja should match the traditional Chinese character used as key
    for (hanja, korean_word_list) in &hanja_to_korean {
        // Check if we have an existing entry for this Hanja
        if let Some(output) = outputs.get_mut(hanja) {
            for korean_word in korean_word_list {
                // Add Korean word to the entry if not already present
                if !output.korean_words.iter().any(|w| w.id == korean_word.id) {
                    output.korean_words.push(korean_word.clone());
                    sino_korean_merged += 1;
                }
            }
        }
        // Note: If no existing entry, the Korean word won't be added to any entry
        // This is expected - we only merge into entries that have Chinese/Japanese data
    }

    println!("  ✅ Merged {} Sino-Korean words into existing entries", sino_korean_merged);

    // Create standalone entries for native Korean words
    for korean_word in &native_korean_words {
        let key = korean_word.hangul.clone();

        // Only create entry if no existing entry with this key
        // (Native Korean words shouldn't conflict with Han character keys)
        if !outputs.contains_key(&key) {
            // Check shard filter if applicable
            if let Some(ref filter) = shard_filter {
                if ShardType::from_key(&key) != *filter {
                    continue;
                }
            }

            let output = SimpleOutput {
                key: key.clone(),
                redirect: None,
                simplified_form_of: None,
                chinese_words: Vec::new(),
                chinese_char: None,
                japanese_words: Vec::new(),
                japanese_char: None,
                related_japanese_words: Vec::new(),
                japanese_names: Vec::new(),
                contains: Vec::new(),
                contained_in_chinese: Vec::new(),
                contained_in_japanese: Vec::new(),
                korean_words: vec![korean_word.clone()],
                korean_char: None,
                contained_in_korean: Vec::new(),
            };

            outputs.insert(key, output);
            native_korean_added += 1;
        }
    }

    println!("  ✅ Created {} standalone entries for native Korean words", native_korean_added);

    // Merge words from traditional variants into merged characters
    // For characters like 制 that have simplified_form_of set (e.g., 製),
    // we need to copy the Chinese words from 製 into 制's entry
    println!("🔀 Merging words for merged characters...");
    let mut merged_word_count = 0;

    // First, collect all the merged character relationships
    let merged_chars: Vec<(String, String)> = outputs.iter()
        .filter_map(|(key, output)| {
            output.simplified_form_of.as_ref().map(|trad| (key.clone(), trad.clone()))
        })
        .collect();

    // Then, for each merged character, copy words from the traditional variant
    for (simp_key, trad_key) in &merged_chars {
        // Get the words from the traditional variant
        let trad_words: Vec<ChineseDictionaryElement> = outputs.get(trad_key)
            .map(|o| o.chinese_words.clone())
            .unwrap_or_default();

        if !trad_words.is_empty() {
            // Add these words to the simplified character's entry
            if let Some(simp_output) = outputs.get_mut(simp_key) {
                for word in trad_words {
                    // Only add if not already present (avoid duplicates)
                    if !simp_output.chinese_words.iter().any(|w| w.id == word.id) {
                        simp_output.chinese_words.push(word);
                        merged_word_count += 1;
                    }
                }
            }
            println!("  📍 Merged words from {} into {}", trad_key, simp_key);
        }
    }
    println!("  ✅ Merged {} words into {} merged character entries", merged_word_count, merged_chars.len());

    // Populate frequency_rank for all Japanese words
    println!("📊 Populating JPDB frequency ranks for Japanese words...");
    let mut words_with_frequency = 0;
    let mut total_japanese_words = 0;

    for output in outputs.values_mut() {
        for japanese_word in &mut output.japanese_words {
            total_japanese_words += 1;

            // Get the best (lowest) frequency rank by checking all kanji+reading combinations
            let mut best_rank: Option<u32> = None;

            // Try each kanji form with each applicable kana reading
            for kanji_form in &japanese_word.kanji {
                for kana_form in &japanese_word.kana {
                    // Check if this kana applies to this kanji
                    let applies = kana_form.applies_to_kanji.as_ref()
                        .map(|applies| {
                            applies.is_empty()
                            || applies.iter().any(|s| s == "*")
                            || applies.contains(&kanji_form.text)
                        })
                        .unwrap_or(true);

                    if applies {
                        if let Some(&rank) = jpdb_frequency.get(&(kanji_form.text.clone(), kana_form.text.clone())) {
                            best_rank = Some(best_rank.map_or(rank, |r| r.min(rank)));
                        }
                    }
                }
            }

            // Only try kana-only lookup if word has NO kanji forms (true kana-only words)
            if japanese_word.kanji.is_empty() {
                for kana_form in &japanese_word.kana {
                    if let Some(&rank) = jpdb_frequency.get(&(kana_form.text.clone(), kana_form.text.clone())) {
                        best_rank = Some(best_rank.map_or(rank, |r| r.min(rank)));
                    }
                }
            }

            if best_rank.is_some() {
                words_with_frequency += 1;
            }
            japanese_word.frequency_rank = best_rank;
        }
    }
    println!("  ✅ Added frequency data to {}/{} Japanese words", words_with_frequency, total_japanese_words);

    // Build reverse index for "contained in" relationships
    println!("🔍 Building reverse index for word containment...");
    // Use HashSet to automatically deduplicate entries
    let mut chinese_containment: StdHashMap<String, std::collections::HashSet<String>> = StdHashMap::new();
    let mut japanese_containment: StdHashMap<String, std::collections::HashSet<String>> = StdHashMap::new();
    let mut korean_containment: StdHashMap<String, std::collections::HashSet<String>> = StdHashMap::new();

    // Build reverse map: traditional Chinese → Japanese variant (for containment lookup)
    let mut traditional_to_variant: StdHashMap<String, String> = StdHashMap::new();
    for (variant, traditional) in &japanese_variant_map {
        traditional_to_variant.insert(traditional.clone(), variant.clone());
    }

    for (word_key, output) in &outputs {
        // For Chinese words, check each character in the word
        // Include both full entries and redirect entries (e.g., 好处 → 好處)
        if !output.chinese_words.is_empty() || output.redirect.is_some() {
            for ch in word_key.chars() {
                let ch_str = ch.to_string();
                if ch_str != *word_key {  // Don't add self-references
                    chinese_containment.entry(ch_str).or_default().insert(word_key.clone());
                }
            }
        }

        // For Japanese words, check each character in kanji forms
        for japanese_word in &output.japanese_words {
            for kanji_form in &japanese_word.kanji {
                for ch in kanji_form.text.chars() {
                    let ch_str = ch.to_string();
                    if ch_str != *word_key {  // Don't add self-references
                        japanese_containment.entry(ch_str.clone()).or_default().insert(word_key.clone());

                        // ALSO add to traditional Chinese character if this is a Japanese variant
                        // e.g., if word contains 図, also add to 圖's containment list
                        if let Some(traditional_target) = japanese_variant_map.get(&ch_str) {
                            japanese_containment.entry(traditional_target.clone()).or_default().insert(word_key.clone());
                        }
                    }
                }
            }
        }

        // For Korean words with Hanja, add to containment index for each Hanja character
        for korean_word in &output.korean_words {
            if let Some(hanja) = &korean_word.hanja {
                for ch in hanja.chars() {
                    let ch_str = ch.to_string();
                    if ch_str != *word_key {  // Don't add self-references
                        korean_containment.entry(ch_str).or_default().insert(word_key.clone());
                    }
                }
            }
        }
    }

    // Word-to-word containment: For each multi-character word, find other words that contain it as a substring
    // Optimized: Build index grouped by first character to reduce search space
    if word_containment_mode {
        println!("  📝 Building word-to-word containment index...");
        let mut word_containment_chinese = 0;
        let mut word_containment_japanese = 0;

        // Build indices: group all words by their first character
        // This allows efficient lookup of words that START with a given character
        let mut chinese_by_first_char: StdHashMap<char, Vec<String>> = StdHashMap::new();
        let mut japanese_by_first_char: StdHashMap<char, Vec<String>> = StdHashMap::new();

        for (word_key, output) in &outputs {
            let char_count = word_key.chars().count();
            // Index words with 3+ characters (we want to find words containing 2+ char substrings)
            if char_count >= 3 {
                if !output.chinese_words.is_empty() || output.redirect.is_some() {
                    if let Some(first_char) = word_key.chars().next() {
                        chinese_by_first_char.entry(first_char).or_default().push(word_key.clone());
                    }
                }
                if !output.japanese_words.is_empty() {
                    if let Some(first_char) = word_key.chars().next() {
                        japanese_by_first_char.entry(first_char).or_default().push(word_key.clone());
                    }
                }
            }
        }

        // For each multi-character word (2+ chars), find longer words that contain it as a prefix
        let total_words = outputs.len();
        let mut processed = 0;

        for (word_key, output) in &outputs {
            processed += 1;
            if processed % 100000 == 0 {
                println!("    Progress: {}/{} words processed...", processed, total_words);
            }

            let word_len = word_key.chars().count();
            // Only process words with 2+ characters
            if word_len < 2 {
                continue;
            }

            // Check Chinese containment: find words that START with this word
            if !output.chinese_words.is_empty() || output.redirect.is_some() {
                let first_char = word_key.chars().next().unwrap();
                if let Some(candidates) = chinese_by_first_char.get(&first_char) {
                    for candidate_key in candidates {
                        // Skip self, skip if candidate is shorter or equal length
                        if candidate_key == word_key || candidate_key.chars().count() <= word_len {
                            continue;
                        }
                        // Check if word_key is a PREFIX of candidate
                        if candidate_key.starts_with(word_key) {
                            if chinese_containment.entry(word_key.clone()).or_default().insert(candidate_key.clone()) {
                                word_containment_chinese += 1;
                            }
                        }
                    }
                }
            }

            // Check Japanese containment: find words that START with this word
            if !output.japanese_words.is_empty() {
                let first_char = word_key.chars().next().unwrap();
                if let Some(candidates) = japanese_by_first_char.get(&first_char) {
                    for candidate_key in candidates {
                        // Skip self, skip if candidate is shorter or equal length
                        if candidate_key == word_key || candidate_key.chars().count() <= word_len {
                            continue;
                        }
                        // Check if word_key is a PREFIX of candidate
                        if candidate_key.starts_with(word_key) {
                            if japanese_containment.entry(word_key.clone()).or_default().insert(candidate_key.clone()) {
                                word_containment_japanese += 1;
                            }
                        }
                    }
                }
            }
        }
        println!("  ✅ Added {} Chinese and {} Japanese word-to-word containment entries (prefix matches)",
                 word_containment_chinese, word_containment_japanese);
    }

    // Pre-populate containment index with simplified forms that will be created as redirects later
    // This ensures simplified forms appear in the "Appears In" section with correct frequency sorting
    // We also build a mapping from simplified to traditional forms for lookup later
    println!("  📝 Pre-populating containment index with simplified forms...");
    let mut simplified_forms_added = 0;
    let mut simp_to_trad_map: StdHashMap<String, String> = StdHashMap::new();
    for (_key, output) in &outputs {
        // Only process entries that have Chinese words (not redirects or character-only entries)
        if !output.chinese_words.is_empty() {
            if let Some(ref chinese_word) = output.chinese_words.first() {
                // Check if this word has both simplified and traditional forms that are different
                if chinese_word.simp != chinese_word.trad {
                    // Store the mapping from simplified to traditional
                    simp_to_trad_map.insert(chinese_word.simp.clone(), chinese_word.trad.clone());

                    // Add the simplified form to the containment index for each character
                    for ch in chinese_word.simp.chars() {
                        let ch_str = ch.to_string();
                        if ch_str != chinese_word.simp {  // Don't add self-references
                            if chinese_containment.entry(ch_str).or_default().insert(chinese_word.simp.clone()) {
                                simplified_forms_added += 1;
                            }
                        }
                    }
                }
            }
        }
    }
    println!("  ✅ Added {} simplified form entries to containment index", simplified_forms_added);

    // Populate the contained_in fields (limit to 100 entries each)
    println!("  📝 Populating containment data for {} entries...", outputs.len());

    // First pass: collect all the word keys we need
    let mut chinese_previews_map: StdHashMap<String, Vec<word_preview_types::WordPreview>> = StdHashMap::new();
    let mut japanese_previews_map: StdHashMap<String, Vec<word_preview_types::WordPreview>> = StdHashMap::new();
    let mut korean_previews_map: StdHashMap<String, Vec<word_preview_types::WordPreview>> = StdHashMap::new();

    for (key, output) in &outputs {
        // Skip redirect entries - they should not have containment data
        if output.redirect.is_some() {
            continue;
        }

        if let Some(chinese_words) = chinese_containment.get(key) {
            // HashSet already ensures uniqueness, just collect and sort for consistent ordering
            let mut unique_words: Vec<String> = chinese_words.iter().cloned().collect();
            unique_words.sort();

            // Build a lookup map from the character's topWords to get frequency/share for each word
            // Index by BOTH simplified (tw.word) and traditional (tw.trad) forms
            let top_words_map: StdHashMap<String, f64> = output.chinese_char.as_ref()
                .and_then(|ch| ch.statistics.as_ref())
                .and_then(|stats| stats.top_words.as_ref())
                .map(|top_words| {
                    let mut map = StdHashMap::new();
                    for tw in top_words {
                        // Index by simplified form
                        map.insert(tw.word.clone(), tw.share);
                        // Also index by traditional form if different
                        if tw.trad != tw.word {
                            map.insert(tw.trad.clone(), tw.share);
                        }
                    }
                    map
                })
                .unwrap_or_default();

            // Convert to WordPreview objects with their share values for sorting
            let mut previews_with_share: Vec<(word_preview_types::WordPreview, f64)> = unique_words.iter()
                .filter_map(|word_key| {
                    // Try to get the entry from outputs
                    // If the word_key doesn't exist (e.g., simplified form before redirect is created),
                    // try to find it in the simp_to_trad_map to get the traditional form
                    let word_output_opt = outputs.get(word_key).or_else(|| {
                        // Word not found in outputs - might be a simplified form that hasn't been created as a redirect yet
                        // Try to find it in simp_to_trad_map to get the traditional form
                        simp_to_trad_map.get(word_key).and_then(|trad_form| {
                            // Get the traditional form and look it up in outputs
                            outputs.get(trad_form)
                        })
                    });

                    word_output_opt.and_then(|word_output| {
                        // For redirect entries, follow the redirect to get the actual data
                        if let Some(ref redirect_target) = word_output.redirect {
                            outputs.get(redirect_target).and_then(|target_output| {
                                target_output.chinese_words.first()
                                    .map(|chinese_word| {
                                        let preview = word_preview_types::WordPreview::from_chinese(chinese_word);
                                        // Get the share value from topWords, default to 0.0 if not found
                                        let share = top_words_map.get(word_key).copied().unwrap_or(0.0);
                                        (preview, share)
                                    })
                            })
                        } else {
                            // Regular entry with chinese_words
                            word_output.chinese_words.first()
                                .map(|chinese_word| {
                                    let preview = word_preview_types::WordPreview::from_chinese(chinese_word);
                                    // Get the share value from topWords, default to 0.0 if not found
                                    let share = top_words_map.get(word_key).copied().unwrap_or(0.0);
                                    (preview, share)
                                })
                        }
                    })
                })
                .collect();

            // Sort by share value (higher share = more common, so reverse sort)
            previews_with_share.sort_by(|(_, share_a), (_, share_b)| {
                share_b.partial_cmp(share_a).unwrap_or(std::cmp::Ordering::Equal)
            });

            // Extract just the previews and limit AFTER sorting by frequency
            let previews: Vec<word_preview_types::WordPreview> = previews_with_share.into_iter()
                .map(|(preview, _)| preview)
                .take(containment_limit)  // Limit after sorting, so we get the most common words
                .collect();

            chinese_previews_map.insert(key.clone(), previews);
        }

        if let Some(japanese_words) = japanese_containment.get(key) {
            // HashSet already ensures uniqueness, just collect and sort for consistent ordering
            let mut unique_words: Vec<String> = japanese_words.iter().cloned().collect();
            unique_words.sort();

            // Convert to WordPreview objects with their source Word for sorting
            // Also track Word IDs to deduplicate (multiple word_keys can point to the same Word)
            let mut seen_word_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
            let mut previews_with_words: Vec<(word_preview_types::WordPreview, &crate::japanese_types::Word)> = unique_words.iter()
                .filter_map(|word_key| {
                    outputs.get(word_key).and_then(|word_output| {
                        word_output.japanese_words.first()
                            .and_then(|japanese_word| {
                                // Deduplicate by Word ID - skip if we've already seen this word
                                if seen_word_ids.contains(&japanese_word.id) {
                                    None
                                } else {
                                    seen_word_ids.insert(japanese_word.id.clone());
                                    let preview = word_preview_types::WordPreview::from_japanese(japanese_word);
                                    Some((preview, japanese_word))
                                }
                            })
                    })
                })
                .collect();

            // Sort by JPDB frequency rank (lower = more common), with common flag as fallback
            previews_with_words.sort_by(|(_, word_a), (_, word_b)| {
                // Get the best (lowest) frequency rank for each word by checking all kanji+reading combinations
                let get_best_rank = |word: &crate::japanese_types::Word| -> Option<u32> {
                    let mut best_rank: Option<u32> = None;

                    // Try each kanji form with each applicable kana reading
                    for kanji_form in &word.kanji {
                        for kana_form in &word.kana {
                            // Check if this kana applies to this kanji
                            // applies_to_kanji can be: None (applies to all), empty vec (applies to all),
                            // ["*"] (applies to all), or specific kanji forms
                            let applies = kana_form.applies_to_kanji.as_ref()
                                .map(|applies| {
                                    applies.is_empty()
                                    || applies.iter().any(|s| s == "*")
                                    || applies.contains(&kanji_form.text)
                                })
                                .unwrap_or(true);

                            if applies {
                                if let Some(&rank) = jpdb_frequency.get(&(kanji_form.text.clone(), kana_form.text.clone())) {
                                    best_rank = Some(best_rank.map_or(rank, |r| r.min(rank)));
                                }
                            }
                        }
                    }

                    // Only try kana-only lookup if word has NO kanji forms (true kana-only words)
                    if word.kanji.is_empty() {
                        for kana_form in &word.kana {
                            if let Some(&rank) = jpdb_frequency.get(&(kana_form.text.clone(), kana_form.text.clone())) {
                                best_rank = Some(best_rank.map_or(rank, |r| r.min(rank)));
                            }
                        }
                    }

                    best_rank
                };

                let rank_a = get_best_rank(word_a);
                let rank_b = get_best_rank(word_b);

                match (rank_a, rank_b) {
                    // Both have frequency data: sort by rank (lower = more common)
                    (Some(a), Some(b)) => a.cmp(&b),
                    // Only a has frequency data: a comes first
                    (Some(_), None) => std::cmp::Ordering::Less,
                    // Only b has frequency data: b comes first
                    (None, Some(_)) => std::cmp::Ordering::Greater,
                    // Neither has frequency data: fall back to common flag
                    (None, None) => {
                        let is_common_a = word_a.kanji.iter().any(|k| k.common) || word_a.kana.iter().any(|k| k.common);
                        let is_common_b = word_b.kanji.iter().any(|k| k.common) || word_b.kana.iter().any(|k| k.common);
                        // Common words should come first (reverse sort: true < false)
                        is_common_b.cmp(&is_common_a)
                    }
                }
            });

            // Extract just the previews and limit AFTER sorting by frequency
            let previews: Vec<word_preview_types::WordPreview> = previews_with_words.into_iter()
                .map(|(preview, _)| preview)
                .take(containment_limit)  // Limit after sorting, so we get the most relevant (common first)
                .collect();

            japanese_previews_map.insert(key.clone(), previews);
        }

        // Build Korean word previews for this character
        if let Some(korean_words) = korean_containment.get(key) {
            // HashSet already ensures uniqueness, just collect and sort for consistent ordering
            let mut unique_words: Vec<String> = korean_words.iter().cloned().collect();
            unique_words.sort();

            // Convert to WordPreview objects
            let previews: Vec<word_preview_types::WordPreview> = unique_words.iter()
                .filter_map(|word_key| {
                    outputs.get(word_key).and_then(|word_output| {
                        word_output.korean_words.first()
                            .map(|korean_word| word_preview_types::WordPreview::from_korean(korean_word))
                    })
                })
                .take(containment_limit)
                .collect();

            if !previews.is_empty() {
                korean_previews_map.insert(key.clone(), previews);
            }
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
        if let Some(previews) = korean_previews_map.get(key) {
            output.contained_in_korean = previews.clone();
        }
    }

    // Build "contains" relationships for multi-character words
    println!("🔍 Building 'contains' relationships for multi-character words...");
    let existing_keys: std::collections::HashSet<String> = outputs.keys().cloned().collect();

    // First pass: collect all contained words
    let mut contains_map: StdHashMap<String, Vec<String>> = StdHashMap::new();

    for (key, output) in &outputs {
        // Only process multi-character words (2+ characters)
        if key.chars().count() < 2 {
            continue;
        }

        let mut contained_words: std::collections::HashSet<String> = std::collections::HashSet::new();

        // Collect all text forms to process:
        // 1. The key itself
        // 2. All alternate kanji forms from Japanese words
        let mut text_forms: Vec<String> = vec![key.clone()];

        // Add all kanji forms from Japanese words (for entries like 不図 which has forms 不図, 不斗, 不圖)
        for japanese_word in &output.japanese_words {
            for kanji_form in &japanese_word.kanji {
                if !text_forms.contains(&kanji_form.text) {
                    text_forms.push(kanji_form.text.clone());
                }
            }
        }

        // Process each text form to find contained substrings
        for text_form in &text_forms {
            let chars: Vec<char> = text_form.chars().collect();
            let len = chars.len();

            // Generate all possible substrings
            for start in 0..len {
                for end in (start + 1)..=len {
                    let substring: String = chars[start..end].iter().collect();

                    // Skip if it's the same as the original key or any of the text forms
                    if substring == *key || text_forms.contains(&substring) {
                        continue;
                    }

                    // Check if this substring exists in the dictionary
                    if existing_keys.contains(&substring) {
                        contained_words.insert(substring);
                    }
                }
            }
        }

        // Convert to sorted Vec
        let mut contained_words_vec: Vec<String> = contained_words.into_iter().collect();
        contained_words_vec.sort();

        contains_map.insert(key.clone(), contained_words_vec);
    }

    // Second pass: convert to WordPreview objects
    let mut contains_previews_map: StdHashMap<String, Vec<word_preview_types::WordPreview>> = StdHashMap::new();

    for (key, contained_words) in &contains_map {
        // Use a HashSet to track seen word texts and deduplicate
        // This handles cases where different variant characters (e.g., 圖 and 図)
        // resolve to the same unified entry
        let mut seen_words: std::collections::HashSet<String> = std::collections::HashSet::new();

        let previews: Vec<word_preview_types::WordPreview> = contained_words.iter()
            .filter_map(|word_key| {
                // First try to get the output directly
                let word_output = outputs.get(word_key);

                // If the output is a redirect, follow it to get the actual data
                let actual_output = word_output.and_then(|wo| {
                    if let Some(ref redirect_target) = wo.redirect {
                        outputs.get(redirect_target)
                    } else {
                        Some(wo)
                    }
                });

                actual_output.and_then(|wo| {
                    // For single characters, use combined preview to show both Chinese and Japanese readings
                    let is_single_char = word_key.chars().count() == 1;

                    if is_single_char && (wo.chinese_char.is_some() || wo.japanese_char.is_some()) {
                        // Use combined preview for single characters with character data
                        Some(word_preview_types::WordPreview::from_combined_char(
                            wo.chinese_char.as_ref(),
                            wo.japanese_char.as_ref(),
                            word_key,
                        ))
                    } else if !wo.chinese_words.is_empty() && !wo.japanese_words.is_empty() {
                        // For multi-character words with BOTH Chinese and Japanese readings
                        Some(word_preview_types::WordPreview::from_combined_word(
                            wo.chinese_words.first(),
                            wo.japanese_words.first(),
                            word_key,
                        ))
                    } else if let Some(chinese_word) = wo.chinese_words.first() {
                        // For multi-character Chinese-only words
                        Some(word_preview_types::WordPreview::from_chinese(chinese_word))
                    } else if let Some(japanese_word) = wo.japanese_words.first() {
                        // For multi-character Japanese-only words
                        Some(word_preview_types::WordPreview::from_japanese(japanese_word))
                    } else if let Some(ref chinese_char) = wo.chinese_char {
                        // Fallback for single chars without Japanese data
                        Some(word_preview_types::WordPreview::from_chinese_char(chinese_char))
                    } else {
                        None
                    }
                })
            })
            // Deduplicate by word text - important because variant characters
            // (e.g., Traditional 圖, Japanese 図, Simplified 图) may all resolve
            // to the same entry and produce identical previews
            .filter(|preview| seen_words.insert(preview.word.clone()))
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

    // ============================================================================
    // REDIRECT CREATION LOOP
    // ============================================================================
    // CRITICAL: This loop creates redirect entries for words that don't have
    // their own dictionary entries. Redirects can belong to different shards
    // than their targets (e.g., "地図" in han-2char-3 → "地圖" in han-2char-2).
    //
    // ⚠️  WARNING: DO NOT use `continue` statements inside shard filtering!
    //     Using `continue` will skip the entire entry, preventing subsequent
    //     redirect types (e.g., Japanese redirects) from being created.
    //     Instead, use conditional checks to skip only the specific redirect.
    //
    // Example of WRONG pattern:
    //   if shard_filter.is_some() && shard_doesn't_match {
    //       continue;  // ❌ Skips entire entry!
    //   }
    //
    // Example of CORRECT pattern:
    //   let should_create = shard_filter.map_or(true, |s| shard_matches);
    //   if should_create {
    //       // Create redirect
    //   }
    //   // Execution continues to next redirect type
    // ============================================================================

    for entry in &combined_dict.entries {
        if let Some(ref chinese) = entry.chinese_entry {
            if chinese.trad.chars().count() > 1 && !existing_keys.contains(&chinese.trad) {
                // Check if shard_filter matches before creating redirect
                let should_create_trad_redirect = if let Some(shard) = shard_filter {
                    ShardType::from_key(&chinese.trad) == shard
                } else {
                    true
                };

                if should_create_trad_redirect {
                    // Create redirect from traditional Chinese to first character
                    let first_char = chinese.trad.chars().next().unwrap().to_string();
                    let redirect_entry = SimpleOutput {
                        key: chinese.trad.clone(),
                        redirect: Some(first_char),
                        simplified_form_of: None,
                        chinese_words: Vec::new(),
                        chinese_char: None,
                        japanese_words: Vec::new(),
                        japanese_char: None,
                        related_japanese_words: Vec::new(),
                        japanese_names: Vec::new(),
                        contains: Vec::new(),
                        contained_in_chinese: Vec::new(),
                        contained_in_japanese: Vec::new(),
                        korean_words: Vec::new(),
                        korean_char: None,
                        contained_in_korean: Vec::new(),
                    };

                    outputs.insert(chinese.trad.clone(), redirect_entry);
                    redirect_count += 1;
                }
            }

            // Create redirect from Simplified Chinese to Traditional Chinese (if different)
            if chinese.simp != chinese.trad && !existing_keys.contains(&chinese.simp) {
                // Check if shard_filter matches before creating redirect
                let should_create_simp_redirect = if let Some(shard) = shard_filter {
                    ShardType::from_key(&chinese.simp) == shard
                } else {
                    true
                };

                if should_create_simp_redirect {
                    let redirect_entry = SimpleOutput {
                        key: chinese.simp.clone(),
                        redirect: Some(chinese.trad.clone()),
                        simplified_form_of: None,
                        chinese_words: Vec::new(),
                        chinese_char: None,
                        japanese_words: Vec::new(),
                        japanese_char: None,
                        related_japanese_words: Vec::new(),
                        japanese_names: Vec::new(),
                        contains: Vec::new(),
                        contained_in_chinese: Vec::new(),
                        contained_in_japanese: Vec::new(),
                        korean_words: Vec::new(),
                        korean_char: None,
                        contained_in_korean: Vec::new(),
                    };

                    outputs.insert(chinese.simp.clone(), redirect_entry);
                    redirect_count += 1;

                    // Also add the simplified form to the containment index for each character
                    // This ensures simplified forms like 好处 appear in the "Appears In" section
                    for ch in chinese.simp.chars() {
                        let ch_str = ch.to_string();
                        if ch_str != chinese.simp {  // Don't add self-references
                            chinese_containment.entry(ch_str).or_default().insert(chinese.simp.clone());
                        }
                    }
                }
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
                        redirect: Some(redirect_target.clone()),
                        simplified_form_of: None,
                        chinese_words: Vec::new(),
                        chinese_char: None,
                        japanese_words: Vec::new(),
                        japanese_char: None,
                        related_japanese_words: Vec::new(),
                        japanese_names: Vec::new(),
                        contains: Vec::new(),
                        contained_in_chinese: Vec::new(),
                        contained_in_japanese: Vec::new(),
                        korean_words: Vec::new(),
                        korean_char: None,
                        contained_in_korean: Vec::new(),
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

    println!("💾 Serializing {} entries...", outputs.len());

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

    // Branch based on output mode
    if dev_server_mode {
        // DEV SERVER MODE: Write to SQLite database (much faster - one file instead of 1.4M)
        write_sqlite_database(&outputs_vec, output_dir)?;
    } else {
        // PRODUCTION MODE: Write individual compressed files
        write_individual_files(&outputs_vec, output_dir, prod_mode, total)?;
    }

    Ok(())
}

/// Write all entries to a SQLite database for fast local development
fn write_sqlite_database(
    outputs_vec: &[(String, simple_output_types::SimpleOutput)],
    output_dir: &std::path::Path,
) -> Result<()> {
    use rusqlite::{Connection, params};
    use flate2::write::DeflateEncoder;
    use flate2::Compression;
    use std::io::Write;

    let db_path = output_dir.join("dictionary.db");

    // Remove existing database if present
    if db_path.exists() {
        std::fs::remove_file(&db_path)?;
    }

    // Create new database
    let conn = Connection::open(&db_path)?;

    // Create table with word as primary key, JSON data as blob (compressed)
    conn.execute(
        "CREATE TABLE entries (
            word TEXT PRIMARY KEY,
            json_data BLOB NOT NULL
        )",
        [],
    )?;

    let total = outputs_vec.len();
    println!("💾 Writing {} entries to SQLite database...", total);

    // Use a transaction for much faster inserts
    conn.execute("BEGIN TRANSACTION", [])?;

    // Prepare statement once
    let mut stmt = conn.prepare("INSERT INTO entries (word, json_data) VALUES (?1, ?2)")?;

    // Progress tracking
    let mut count = 0;
    let progress_interval = if total > 20 { total / 20 } else { 1 }; // Update every 5%

    for (key, entry) in outputs_vec {
        // Serialize to JSON, then compress
        let json_content = serde_json::to_string(entry)
            .map_err(|e| anyhow::anyhow!("Failed to serialize entry '{}': {}", key, e))?;

        // Compress with Deflate level 6 (fast)
        let mut encoder = DeflateEncoder::new(Vec::new(), Compression::new(6));
        encoder.write_all(json_content.as_bytes())
            .map_err(|e| anyhow::anyhow!("Failed to compress entry '{}': {}", key, e))?;
        let compressed = encoder.finish()
            .map_err(|e| anyhow::anyhow!("Failed to finish compression for '{}': {}", key, e))?;

        // Insert into database
        stmt.execute(params![key, compressed])?;

        count += 1;
        if count % progress_interval == 0 {
            let pct = (count as f64 / total as f64 * 100.0) as u32;
            println!("  {}% complete ({}/{})", pct, count, total);
        }
    }

    // Commit transaction
    conn.execute("COMMIT", [])?;

    println!("✅ Successfully generated SQLite database with {} entries!", total);
    println!("📁 Database saved to: output_dictionary/dictionary.db");
    println!("💡 Use with: npm run dev (SvelteKit will query this database)");

    // Generate frequency list JSON for the frontend
    generate_frequency_list(outputs_vec, output_dir)?;

    Ok(())
}

/// Generate a static JSON file with the top 1000 most common Japanese and Chinese words
fn generate_frequency_list(
    outputs_vec: &[(String, simple_output_types::SimpleOutput)],
    output_dir: &std::path::Path,
) -> Result<()> {
    use serde::Serialize;

    #[derive(Serialize)]
    struct FrequencyWord {
        rank: u32,
        word: String,
        reading: String,
        definition: String,
        common: bool,
    }

    #[derive(Serialize)]
    struct FrequencyList {
        japanese: Vec<FrequencyWord>,
        chinese: Vec<FrequencyWord>,
    }

    println!("📊 Generating frequency list JSON...");

    let mut japanese_words: Vec<FrequencyWord> = Vec::new();
    let mut chinese_words: Vec<FrequencyWord> = Vec::new();
    let mut seen_japanese: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut seen_chinese: std::collections::HashSet<String> = std::collections::HashSet::new();

    for (_key, output) in outputs_vec {
        // Extract Japanese words with frequency rank
        for jw in &output.japanese_words {
            if let Some(rank) = jw.frequency_rank {
                let word_text = jw.kanji.first().map(|k| &k.text)
                    .or_else(|| jw.kana.first().map(|k| &k.text));

                if let Some(word) = word_text {
                    if !seen_japanese.contains(word) {
                        seen_japanese.insert(word.clone());
                        let is_common = jw.kanji.iter().any(|k| k.common) || jw.kana.iter().any(|k| k.common);
                        let reading = jw.kana.first().map(|k| k.text.clone()).unwrap_or_default();
                        let definition = jw.sense.first()
                            .and_then(|s| s.gloss.first())
                            .map(|g| g.text.clone())
                            .unwrap_or_default();

                        japanese_words.push(FrequencyWord {
                            rank,
                            word: word.clone(),
                            reading,
                            definition,
                            common: is_common,
                        });
                    }
                }
            }
        }

        // Extract Chinese words with frequency rank
        for cw in &output.chinese_words {
            if let Some(stats) = &cw.statistics {
                if let Some(rank) = stats.movie_word_rank.or(stats.book_word_rank) {
                    if !seen_chinese.contains(&cw.simp) {
                        seen_chinese.insert(cw.simp.clone());
                        let reading = cw.items.first()
                            .and_then(|i| i.pinyin.clone())
                            .unwrap_or_default();
                        let definition = cw.items.first()
                            .and_then(|i| i.definitions.as_ref())
                            .and_then(|d| d.first())
                            .cloned()
                            .unwrap_or_default();

                        chinese_words.push(FrequencyWord {
                            rank: rank as u32,
                            word: cw.simp.clone(),
                            reading,
                            definition,
                            common: false, // Chinese doesn't have a common flag
                        });
                    }
                }
            }
        }
    }

    // Sort by frequency rank and take top 1000
    japanese_words.sort_by_key(|w| w.rank);
    chinese_words.sort_by_key(|w| w.rank);
    japanese_words.truncate(1000);
    chinese_words.truncate(1000);

    let frequency_list = FrequencyList {
        japanese: japanese_words,
        chinese: chinese_words,
    };

    let json_content = serde_json::to_string(&frequency_list)?;

    // Save to output_dictionary for backward compatibility
    let json_path = output_dir.join("frequency_list.json");
    std::fs::write(&json_path, &json_content)?;

    // Also save to sveltekit-app/static for Cloudflare Pages deployment
    // This allows the frontend to fetch it directly without needing fs.readFileSync
    let static_path = std::path::Path::new("sveltekit-app/static/frequency_list.json");
    std::fs::write(static_path, &json_content)?;

    println!("  ✅ Generated frequency list: {} Japanese, {} Chinese words",
        frequency_list.japanese.len(), frequency_list.chinese.len());
    println!("  📁 Saved to: {} and {}", json_path.display(), static_path.display());

    Ok(())
}

/// Write individual compressed JSON files (production mode)
/// Files are organized into subdirectories (00-ff) based on hash for optimal GitHub performance
fn write_individual_files(
    outputs_vec: &[(String, simple_output_types::SimpleOutput)],
    output_dir: &std::path::Path,
    prod_mode: bool,
    total: usize,
) -> Result<()> {
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::io::Write;
    use flate2::write::DeflateEncoder;
    use flate2::Compression;
    use std::collections::HashSet;

    // Use level 9 (best) for production, level 6 (fast) for development
    let compression_level = if prod_mode { 9 } else { 6 };

    // Collect all subdirectories we'll need to create
    let subdirs_needed: HashSet<String> = outputs_vec
        .iter()
        .map(|(key, _)| ShardType::get_subdir(key))
        .collect();

    // Create all subdirectories upfront
    println!("📁 Creating {} subdirectories (00-ff based on hash)...", subdirs_needed.len());
    for subdir in &subdirs_needed {
        let subdir_path = output_dir.join(subdir);
        if !subdir_path.exists() {
            fs::create_dir_all(&subdir_path)
                .map_err(|e| anyhow::anyhow!("Failed to create subdir '{}': {}", subdir_path.display(), e))?;
        }
    }

    // Serialize entries with their subdirectory info
    let serialized: Result<Vec<_>, anyhow::Error> = outputs_vec
        .par_iter()
        .map(|(key, entry)| -> Result<(String, String, Vec<u8>), anyhow::Error> {
            let safe_filename = create_safe_filename(key);
            let subdir = ShardType::get_subdir(key);

            // Serialize to JSON
            let json_content = serde_json::to_string(entry)
                .map_err(|e| anyhow::anyhow!("Failed to serialize entry '{}': {}", key, e))?;

            // Compress with Deflate (level depends on prod_mode)
            let mut encoder = DeflateEncoder::new(Vec::new(), Compression::new(compression_level));
            encoder.write_all(json_content.as_bytes())
                .map_err(|e| anyhow::anyhow!("Failed to compress entry '{}': {}", key, e))?;
            let compressed = encoder.finish()
                .map_err(|e| anyhow::anyhow!("Failed to finish compression for '{}': {}", key, e))?;

            Ok((subdir, safe_filename, compressed))
        })
        .collect();

    let serialized = serialized?;

    println!("💾 Writing {} compressed files to disk (with subdirectories)...", serialized.len());
    let counter = Arc::new(AtomicUsize::new(0));

    // Write compressed files in parallel
    let results: Result<Vec<_>, anyhow::Error> = serialized
        .par_iter()
        .map(|(subdir, safe_filename, compressed_content)| -> Result<(), anyhow::Error> {
            let counter = Arc::clone(&counter);
            // Files go into subdirectory: output_dir/XX/filename.json.deflate
            let file_path = output_dir.join(subdir).join(format!("{}.json.deflate", safe_filename));

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
    println!("📁 Files saved to: output_dictionary/XX/ (256 subdirectories)");
    if prod_mode {
        println!("💡 Compression: Deflate level 9 (maximum compression for production)");
    } else {
        println!("💡 Compression: Deflate level 6 (fast builds for development)");
    }
    println!("💡 Structure: Each file is in a subdirectory based on hash (00-ff)");

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

