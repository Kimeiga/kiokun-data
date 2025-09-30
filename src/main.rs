// Core types
mod chinese_types;
mod japanese_types;
mod chinese_char_types;
mod japanese_char_types;
mod ids_types;
mod combined_types;
mod kanji_mapping_generated;
mod analysis;
mod simple_output_types;

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
use legacy_unification::unified_character_types::UnifiedCharacterEntry;
use combined_types::{
    CombinedDictionary, CombinedEntry, CombinedMetadata, KeySource,
    MergeStatistics, DictionaryMetadata
};
use legacy_unification::semantic_unification_engine::SemanticUnificationEngine;

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
    let japanese_dict = load_japanese_dictionary("data/jmdict-examples-eng-3.6.1.json")
        .context("Failed to load Japanese dictionary")?;

    println!("📚 Loading Chinese character dictionary...");
    let mut chinese_char_dict = load_chinese_char_dictionary("data/chinese_dictionary_char_2025-06-25.jsonl")
        .context("Failed to load Chinese character dictionary")?;

    println!("📚 Loading Japanese character dictionary (KANJIDIC2)...");
    let mut japanese_char_dict = load_japanese_char_dictionary("data/kanjidic2-en-3.6.1.json")
        .context("Failed to load Japanese character dictionary")?;

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

    // Check if individual files are requested
    if matches.get_flag("individual-files") {
        // Check if unified output is requested (non-default)
        if matches.get_flag("unified-output") {
            let unified_only = matches.get_flag("unified-only");
            println!("🔄 Generating unified individual JSON files (word + character data){}...",
                     if unified_only { " (unified entries only)" } else { "" });
            generate_unified_output_files(&aligned_dict, &unified_characters, unified_only).await?;
        } else {
            // Default: simple output with no unification
            println!("🔄 Generating simple individual JSON files (no unification)...");
            // Need to reload the raw character dictionaries since they were consumed
            let chinese_char_dict_raw = load_chinese_char_dictionary("data/chinese_dictionary_char_2025-06-25.jsonl")
                .context("Failed to load Chinese character dictionary")?;
            let japanese_char_dict_raw = load_japanese_char_dictionary("data/kanjidic2-en-3.6.1.json")
                .context("Failed to load Japanese character dictionary")?;

            generate_simple_output_files(
                &aligned_dict,
                &chinese_char_dict_raw,
                &japanese_char_dict_raw.characters
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
        let mut nanori = rm.nanori.clone();

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
                    existing_entry.japanese_specific_entries.push(japanese_word);
                    existing_entry.metadata.japanese_count += 1;
                }
            }
            None => {
                // Japanese-only entry
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

#[allow(dead_code)]
fn get_japanese_key(word: &Word) -> String {
    // First try kanji - convert to Traditional Chinese for better matching
    if let Some(first_kanji) = word.kanji.first() {
        let traditional = kanji_mapping_generated::convert_japanese_to_traditional(&first_kanji.text);
        return traditional;
    }

    // Fallback to kana (no conversion needed)
    if let Some(first_kana) = word.kana.first() {
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
    use std::process::Stdio;
    use std::io::Write;

    let mut child = ProcessCommand::new("opencc")
        .arg("-c")
        .arg("jp2t")
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
    unified_only: bool
) -> Result<()> {
    use std::fs;
    use std::path::Path;
    use std::collections::HashMap as StdHashMap;
    use legacy_unification::unified_output_types::UnifiedOutput;

    println!("📁 Creating output directory...");
    let output_dir = Path::new("output_dictionary");
    if output_dir.exists() {
        fs::remove_dir_all(output_dir).context("Failed to remove existing output directory")?;
    }
    fs::create_dir_all(output_dir).context("Failed to create output directory")?;

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
) -> Result<()> {
    use std::fs;
    use std::path::Path;
    use std::collections::HashMap as StdHashMap;
    use simple_output_types::SimpleOutput;

    println!("📁 Creating output directory...");
    let output_dir = Path::new("output_dictionary");
    if output_dir.exists() {
        fs::remove_dir_all(output_dir).context("Failed to remove existing output directory")?;
    }
    fs::create_dir_all(output_dir).context("Failed to create output directory")?;

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
            chinese_words: Vec::new(),
            chinese_char: None,
            japanese_words: Vec::new(),
            japanese_char: None,
        });

        if let Some(ref chinese) = entry.chinese_entry {
            output.chinese_words.push(chinese.clone());
        }

        if let Some(ref japanese) = entry.japanese_entry {
            output.japanese_words.push(japanese.clone());
        }
    }

    // Add character data
    for (key, char_entry) in chinese_char_by_key {
        let output = outputs.entry(key.clone()).or_insert_with(|| SimpleOutput {
            key: key.clone(),
            chinese_words: Vec::new(),
            chinese_char: None,
            japanese_words: Vec::new(),
            japanese_char: None,
        });
        output.chinese_char = Some(char_entry.clone());
    }

    for (key, kanji_entry) in kanjidic_by_key {
        let output = outputs.entry(key.clone()).or_insert_with(|| SimpleOutput {
            key: key.clone(),
            chinese_words: Vec::new(),
            chinese_char: None,
            japanese_words: Vec::new(),
            japanese_char: None,
        });
        output.japanese_char = Some(kanji_entry.clone());
    }

    println!("💾 Writing {} individual JSON files...", outputs.len());

    // Use parallel processing for maximum performance
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    let counter = Arc::new(AtomicUsize::new(0));
    let total = outputs.len();

    // Convert to vec for parallel processing
    let outputs_vec: Vec<_> = outputs.into_iter().collect();

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

    println!("✅ Successfully generated {} simple JSON files!", total);
    println!("📁 Files saved to: output_dictionary/");
    println!("💡 Usage: cat output_dictionary/好.json");

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
    let j2c_mapping = load_j2c_mapping("output/j2c_mapping.json")
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
