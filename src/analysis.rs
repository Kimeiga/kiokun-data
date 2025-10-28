use anyhow::Result;
use crate::combined_types::CombinedDictionary;
use crate::japanese_types::Word;
use crate::chinese_types::ChineseDictionaryElement;

/// Run analysis on the combined dictionary data
pub async fn run_analysis(combined_dict: &CombinedDictionary) -> Result<()> {
    println!("🔍 Starting analysis...");

    // Get counts of single vs multi-kanji words with multiple JMdict entries
    count_single_vs_multi_kanji_entries(combined_dict).await?;

    // Run semantic alignment analysis
    run_semantic_alignment_analysis(combined_dict).await?;

    // Check the 450 multi-kanji cases for correct unification
    // check_multi_kanji_unification_quality(combined_dict).await?;

    // Find the unified entry with the most Japanese pronunciations
    // find_most_japanese_pronunciations(combined_dict).await?;

    // Show how the best entry would look in our new unified structure
    // show_proposed_unified_structure(combined_dict).await?;

    println!("✅ Analysis complete!");
    Ok(())
}

/// Find the Japanese entry with the largest combined number of kanji and kana representations
/// Requires at least 2 kanji and 2 kana representations
pub async fn find_most_kanji_kana_representations(japanese_words: &[Word]) -> Result<()> {
    println!("🔍 Finding Japanese entries with the most kanji and kana representations...");
    println!("📋 Filtering for entries with at least 2 kanji AND 2 kana representations...");

    let mut candidates = Vec::new();

    for word in japanese_words {
        let kanji_count = word.kanji.len();
        let kana_count = word.kana.len();
        let total_representations = kanji_count + kana_count;

        // Filter for entries with at least 2 kanji AND 2 kana
        if kanji_count >= 2 && kana_count >= 2 {
            candidates.push((word, kanji_count, kana_count, total_representations));
        }
    }

    // Sort by total representations (descending), then by kanji count, then by kana count
    candidates.sort_by(|a, b| {
        b.3.cmp(&a.3)
            .then(b.1.cmp(&a.1))
            .then(b.2.cmp(&a.2))
    });

    println!("📊 Results:");
    println!("  Total entries with ≥2 kanji AND ≥2 kana: {}", candidates.len());

    if let Some((_top_word, top_kanji, top_kana, top_total)) = candidates.first() {
        println!("  Maximum total representations: {} ({} kanji + {} kana)", top_total, top_kanji, top_kana);
    }

    println!("\n🏆 Top 20 Japanese entries by total kanji+kana representations:");
    for (i, (word, kanji_count, kana_count, total)) in candidates.iter().take(20).enumerate() {
        println!("  {}. ID:{} - {} total ({} kanji + {} kana)",
                 i + 1, word.id, total, kanji_count, kana_count);

        // Show all kanji representations
        println!("     🔤 Kanji ({}):", kanji_count);
        for (j, kanji) in word.kanji.iter().enumerate() {
            let common_marker = if kanji.common { "★" } else { "" };
            let tags_str = if kanji.tags.is_empty() {
                String::new()
            } else {
                format!(" [{}]", kanji.tags.iter().map(|t| format!("{:?}", t)).collect::<Vec<_>>().join(","))
            };
            println!("       {}. {}{}{}", j + 1, kanji.text, common_marker, tags_str);
        }

        // Show all kana representations
        println!("     🔤 Kana ({}):", kana_count);
        for (j, kana) in word.kana.iter().enumerate() {
            let common_marker = if kana.common { "★" } else { "" };
            let tags_str = if kana.tags.is_empty() {
                String::new()
            } else {
                format!(" [{}]", kana.tags.iter().map(|t| format!("{:?}", t)).collect::<Vec<_>>().join(","))
            };
            let applies_to = if let Some(applies) = &kana.applies_to_kanji {
                if applies.contains(&"*".to_string()) {
                    " (applies to all kanji)".to_string()
                } else {
                    format!(" (applies to: {})", applies.join(", "))
                }
            } else {
                " (applies to all kanji)".to_string()
            };
            println!("       {}. {}{}{}{}", j + 1, kana.text, common_marker, tags_str, applies_to);
        }

        // Show primary meaning
        if let Some(sense) = word.sense.first() {
            if let Some(gloss) = sense.gloss.first() {
                println!("     💭 Primary meaning: \"{}\"", gloss.text);
            }
        }

        println!(); // Empty line for readability
    }

    Ok(())
}

/// Find unified entries with the most JMdict entries (multiple Japanese entries for same kanji)
/// Now filtering for multi-kanji words (2+ characters)
#[allow(dead_code)]
pub async fn find_most_japanese_pronunciations(combined_dict: &CombinedDictionary) -> Result<()> {
    println!("🔍 Finding unified multi-kanji entries (2+ characters) with most JMdict entries...");

    let mut all_candidates = Vec::new();

    for entry in &combined_dict.entries {
        // Only consider unified entries (both Chinese and Japanese)
        if !entry.metadata.is_unified {
            continue;
        }

        // Only consider multi-kanji words (2+ characters)
        if entry.word.chars().count() < 2 {
            continue;
        }

        // Count total number of JMdict entries for this unified word
        let mut total_jmdict_entries = 0;

        // Count primary Japanese entry
        if entry.japanese_entry.is_some() {
            total_jmdict_entries += 1;
        }

        // Count additional Japanese entries
        total_jmdict_entries += entry.japanese_specific_entries.len();

        if total_jmdict_entries > 0 {
            all_candidates.push((entry, total_jmdict_entries));
        }
    }

    // Sort by JMdict entry count (descending)
    all_candidates.sort_by(|a, b| b.1.cmp(&a.1));

    let max_entries = all_candidates.first().map(|(_, count)| *count).unwrap_or(0);
    
    println!("📊 Results:");
    println!("  Maximum JMdict entries found: {}", max_entries);
    println!("  Total unified entries: {}", all_candidates.len());

    println!("\n🏆 Top 50 unified multi-kanji entries by JMdict entry count:");
    for (i, (entry, count)) in all_candidates.iter().take(50).enumerate() {
        println!("  {}. '{}' ({} JMdict entries)", i + 1, entry.word, count);

        // Show all JMdict entry IDs and their primary meanings
        let mut entry_details = Vec::new();

        // Primary Japanese entry
        if let Some(japanese_entry) = &entry.japanese_entry {
            let primary_kana = japanese_entry.kana.first()
                .map(|k| k.text.as_str())
                .unwrap_or("N/A");
            let primary_gloss = japanese_entry.sense.first()
                .and_then(|s| s.gloss.first())
                .map(|g| g.text.as_str())
                .unwrap_or("N/A");
            entry_details.push(format!("ID:{} [{}] \"{}\"", japanese_entry.id, primary_kana, primary_gloss));
        }

        // Additional Japanese entries
        for japanese_entry in &entry.japanese_specific_entries {
            let primary_kana = japanese_entry.kana.first()
                .map(|k| k.text.as_str())
                .unwrap_or("N/A");
            let primary_gloss = japanese_entry.sense.first()
                .and_then(|s| s.gloss.first())
                .map(|g| g.text.as_str())
                .unwrap_or("N/A");
            entry_details.push(format!("ID:{} [{}] \"{}\"", japanese_entry.id, primary_kana, primary_gloss));
        }

        // Show first few entries (limit to keep output manageable)
        for (j, detail) in entry_details.iter().take(5).enumerate() {
            println!("     {}. {}", j + 1, detail);
        }
        if entry_details.len() > 5 {
            println!("     ... and {} more entries", entry_details.len() - 5);
        }

        // Show Chinese info
        if let Some(chinese_entry) = &entry.chinese_entry {
            let pinyin = chinese_entry.items.first()
                .and_then(|item| item.pinyin.as_ref())
                .map(|s| s.as_str())
                .unwrap_or("N/A");
            let gloss = chinese_entry.gloss.as_ref()
                .map(|s| s.as_str())
                .unwrap_or("N/A");
            println!("     Chinese: {} ({}), Definition: {}", chinese_entry.trad, pinyin, gloss);
        }
        println!();
    }
    
    Ok(())
}

/// Show how the entry with most pronunciations would look in our proposed unified structure
#[allow(dead_code)]
pub async fn show_proposed_unified_structure(combined_dict: &CombinedDictionary) -> Result<()> {
    println!("\n🏗️  Proposed Unified Structure Example:");

    // Find the entry with most pronunciations (we know it's 私)
    let best_entry = combined_dict.entries.iter()
        .filter(|entry| entry.metadata.is_unified)
        .max_by_key(|entry| {
            let mut total_kana = 0;
            if let Some(jp) = &entry.japanese_entry {
                total_kana += jp.kana.len();
            }
            for jp in &entry.japanese_specific_entries {
                total_kana += jp.kana.len();
            }
            total_kana
        });

    if let Some(entry) = best_entry {
        println!("📝 Word: '{}'", entry.word);
        println!("```json");
        println!("{{");
        println!("  \"word\": \"{}\",", entry.word);
        println!("  \"unified\": {{");

        // Primary form
        println!("    \"primary_form\": {{");
        if let Some(chinese) = &entry.chinese_entry {
            println!("      \"chinese_traditional\": \"{}\",", chinese.trad);
            println!("      \"chinese_simplified\": \"{}\",", chinese.simp);
        }
        if let Some(japanese) = &entry.japanese_entry {
            if let Some(first_kanji) = japanese.kanji.first() {
                println!("      \"japanese_kanji\": \"{}\"", first_kanji.text);
            }
        }
        println!("    }},");

        // Alternative Japanese forms
        println!("    \"alternative_japanese_forms\": [");
        let mut form_count = 0;

        // Process all Japanese entries to build alternative forms
        let mut all_japanese_entries = Vec::new();
        if let Some(jp) = &entry.japanese_entry {
            all_japanese_entries.push(jp);
        }
        for jp in &entry.japanese_specific_entries {
            all_japanese_entries.push(jp);
        }

        // Group pronunciations by kanji form
        use std::collections::HashMap;
        let mut kanji_to_pronunciations: HashMap<String, Vec<String>> = HashMap::new();

        for jp_entry in &all_japanese_entries {
            for kanji in &jp_entry.kanji {
                for kana in &jp_entry.kana {
                    // Check if this kana applies to this kanji
                    let applies = if let Some(applies_to) = &kana.applies_to_kanji {
                        applies_to.contains(&"*".to_string()) || applies_to.contains(&kanji.text)
                    } else {
                        true // Default to applying to all
                    };

                    if applies {
                        kanji_to_pronunciations
                            .entry(kanji.text.clone())
                            .or_insert_with(Vec::new)
                            .push(kana.text.clone());
                    }
                }
            }
        }

        // Show alternative forms (skip the primary one)
        let primary_kanji = entry.japanese_entry.as_ref()
            .and_then(|jp| jp.kanji.first())
            .map(|k| &k.text);

        for (kanji, pronunciations) in &kanji_to_pronunciations {
            // Skip if this is the primary kanji with only the primary pronunciation
            if Some(kanji) == primary_kanji {
                let primary_kana = entry.japanese_entry.as_ref()
                    .and_then(|jp| jp.kana.first())
                    .map(|k| &k.text);
                if pronunciations.len() == 1 && pronunciations.first() == primary_kana {
                    continue;
                }
            }

            if form_count > 0 { println!("      }},"); }
            println!("      {{");
            println!("        \"kanji\": \"{}\",", kanji);
            println!("        \"pronunciations\": [");
            for (i, pronunciation) in pronunciations.iter().enumerate() {
                let comma = if i < pronunciations.len() - 1 { "," } else { "" };
                println!("          \"{}\"{}",  pronunciation, comma);
            }
            println!("        ],");
            println!("        \"common\": false,");
            println!("        \"tags\": []");
            form_count += 1;
        }

        if form_count > 0 {
            println!("      }}");
        }
        println!("    ],");

        // Pronunciations section
        println!("    \"pronunciations\": {{");
        if let Some(chinese) = &entry.chinese_entry {
            println!("      \"chinese\": [");
            let pinyin = chinese.items.first()
                .and_then(|item| item.pinyin.as_ref())
                .map(|s| s.as_str())
                .unwrap_or("N/A");
            println!("        {{");
            println!("          \"pinyin\": \"{}\",", pinyin);
            println!("          \"source\": \"Cedict\"");
            println!("        }}");
            println!("      ],");
        }

        // Japanese primary pronunciation
        if let Some(japanese) = &entry.japanese_entry {
            if let Some(primary_kana) = japanese.kana.first() {
                println!("      \"japanese\": {{");
                println!("        \"primary\": {{");
                println!("          \"kana\": \"{}\",", primary_kana.text);
                println!("          \"common\": {}", primary_kana.common);
                println!("        }}");
                println!("      }}");
            }
        }

        println!("    }}");
        println!("    // ... rest of unified structure");
        println!("  }}");
        println!("}}");
        println!("```");

        println!("\n💡 This structure shows:");
        println!("  - Primary form with shared logographic characters");
        println!("  - Alternative Japanese forms grouped by kanji with their pronunciations");
        println!("  - Clean separation of Chinese and Japanese pronunciations");
        println!("  - No duplication between representations and pronunciations");
    }

    Ok(())
}

/// Count single-kanji vs multi-kanji unified words with multiple JMdict entries
pub async fn count_single_vs_multi_kanji_entries(combined_dict: &CombinedDictionary) -> Result<()> {
    println!("📊 Counting single vs multi-kanji unified words with multiple JMdict entries...");

    let mut single_kanji_total = 0;
    let mut single_kanji_multiple_entries = 0;
    let mut multi_kanji_total = 0;
    let mut multi_kanji_multiple_entries = 0;

    for entry in &combined_dict.entries {
        // Only consider unified entries (both Chinese and Japanese)
        if !entry.metadata.is_unified {
            continue;
        }

        // Count total number of JMdict entries for this unified word
        let mut total_jmdict_entries = 0;

        // Count primary Japanese entry
        if entry.japanese_entry.is_some() {
            total_jmdict_entries += 1;
        }

        // Count additional Japanese entries
        total_jmdict_entries += entry.japanese_specific_entries.len();

        // Categorize by character count
        let char_count = entry.word.chars().count();

        if char_count == 1 {
            // Single kanji
            single_kanji_total += 1;
            if total_jmdict_entries > 1 {
                single_kanji_multiple_entries += 1;
            }
        } else if char_count >= 2 {
            // Multi kanji
            multi_kanji_total += 1;
            if total_jmdict_entries > 1 {
                multi_kanji_multiple_entries += 1;
            }
        }
    }

    println!("\n📈 Results:");
    println!("🔤 Single-kanji unified words:");
    println!("  Total: {}", single_kanji_total);
    println!("  With multiple JMdict entries: {}", single_kanji_multiple_entries);
    println!("  Percentage with multiple entries: {:.2}%",
        (single_kanji_multiple_entries as f64 / single_kanji_total as f64) * 100.0);

    println!("\n🔤🔤 Multi-kanji unified words:");
    println!("  Total: {}", multi_kanji_total);
    println!("  With multiple JMdict entries: {}", multi_kanji_multiple_entries);
    println!("  Percentage with multiple entries: {:.2}%",
        (multi_kanji_multiple_entries as f64 / multi_kanji_total as f64) * 100.0);

    println!("\n🎯 Summary:");
    println!("  Single-kanji words are {:.1}x more likely to have multiple JMdict entries",
        (single_kanji_multiple_entries as f64 / single_kanji_total as f64) /
        (multi_kanji_multiple_entries as f64 / multi_kanji_total as f64));

    println!("  Total unified entries analyzed: {}", single_kanji_total + multi_kanji_total);

    Ok(())
}

/// Check the quality of unification for multi-kanji words with multiple JMdict entries
#[allow(dead_code)]
pub async fn check_multi_kanji_unification_quality(combined_dict: &CombinedDictionary) -> Result<()> {
    println!("\n🔍 Checking unification quality for multi-kanji words with multiple JMdict entries...");

    let mut multi_kanji_candidates = Vec::new();

    for entry in &combined_dict.entries {
        // Only consider unified entries (both Chinese and Japanese)
        if !entry.metadata.is_unified {
            continue;
        }

        // Only consider multi-kanji words (2+ characters)
        if entry.word.chars().count() < 2 {
            continue;
        }

        // Count total number of JMdict entries for this unified word
        let mut total_jmdict_entries = 0;

        // Count primary Japanese entry
        if entry.japanese_entry.is_some() {
            total_jmdict_entries += 1;
        }

        // Count additional Japanese entries
        total_jmdict_entries += entry.japanese_specific_entries.len();

        // Only include entries with multiple JMdict entries
        if total_jmdict_entries > 1 {
            multi_kanji_candidates.push(entry);
        }
    }

    println!("📊 Found {} multi-kanji unified words with multiple JMdict entries", multi_kanji_candidates.len());
    println!("\n🔍 Analyzing unification quality (showing all {} cases):", multi_kanji_candidates.len());

    for (i, entry) in multi_kanji_candidates.iter().enumerate() {
        println!("\n{}. '{}' - {} JMdict entries",
            i + 1,
            entry.word,
            1 + entry.japanese_specific_entries.len()
        );

        // Show Chinese meaning
        if let Some(chinese_entry) = &entry.chinese_entry {
            let pinyin = chinese_entry.items.first()
                .and_then(|item| item.pinyin.as_ref())
                .map(|s| s.as_str())
                .unwrap_or("N/A");
            let gloss = chinese_entry.gloss.as_ref()
                .map(|s| s.as_str())
                .unwrap_or("N/A");
            println!("   🇨🇳 Chinese: {} ({}) = \"{}\"", chinese_entry.trad, pinyin, gloss);
        }

        // Show primary Japanese entry (the one being unified)
        if let Some(japanese_entry) = &entry.japanese_entry {
            let primary_kana = japanese_entry.kana.first()
                .map(|k| k.text.as_str())
                .unwrap_or("N/A");
            let primary_gloss = japanese_entry.sense.first()
                .and_then(|s| s.gloss.first())
                .map(|g| g.text.as_str())
                .unwrap_or("N/A");
            println!("   🇯🇵 PRIMARY (unified): ID:{} [{}] = \"{}\"",
                japanese_entry.id, primary_kana, primary_gloss);
        }

        // Show alternative Japanese entries (not unified)
        for (j, japanese_entry) in entry.japanese_specific_entries.iter().enumerate() {
            let kana = japanese_entry.kana.first()
                .map(|k| k.text.as_str())
                .unwrap_or("N/A");
            let gloss = japanese_entry.sense.first()
                .and_then(|s| s.gloss.first())
                .map(|g| g.text.as_str())
                .unwrap_or("N/A");
            println!("   🇯🇵 Alt {}: ID:{} [{}] = \"{}\"",
                j + 1, japanese_entry.id, kana, gloss);
        }

        // Simple semantic alignment check
        if let (Some(chinese_entry), Some(japanese_entry)) = (&entry.chinese_entry, &entry.japanese_entry) {
            let chinese_gloss = chinese_entry.gloss.as_ref().map(|s| s.as_str()).unwrap_or("");
            let japanese_gloss = japanese_entry.sense.first()
                .and_then(|s| s.gloss.first())
                .map(|g| g.text.as_str())
                .unwrap_or("");

            // Basic keyword matching for semantic alignment
            let chinese_words: Vec<&str> = chinese_gloss.split_whitespace().collect();
            let japanese_words: Vec<&str> = japanese_gloss.split_whitespace().collect();

            let mut has_overlap = false;
            for c_word in &chinese_words {
                for j_word in &japanese_words {
                    if c_word.to_lowercase() == j_word.to_lowercase() ||
                       c_word.to_lowercase().contains(&j_word.to_lowercase()) ||
                       j_word.to_lowercase().contains(&c_word.to_lowercase()) {
                        has_overlap = true;
                        break;
                    }
                }
                if has_overlap { break; }
            }

            if has_overlap {
                println!("   ✅ GOOD: Semantic overlap detected");
            } else {
                println!("   ⚠️  CHECK: No obvious semantic overlap - may need review");
            }
        }
    }

    Ok(())
}

/// Run semantic alignment analysis to find the best Japanese entry to unify with Chinese
pub async fn run_semantic_alignment_analysis(combined_dict: &CombinedDictionary) -> Result<()> {
    println!("\n🎯 Running semantic alignment analysis...");

    let mut alignment_recommendations = Vec::new();
    let mut total_unified = 0;
    let mut needs_realignment = 0;

    for entry in &combined_dict.entries {
        // Only consider unified entries with multiple Japanese entries
        if !entry.metadata.is_unified {
            continue;
        }

        // Skip entries with only one Japanese entry (already correctly aligned)
        let total_japanese_entries = if entry.japanese_entry.is_some() { 1 } else { 0 }
            + entry.japanese_specific_entries.len();

        if total_japanese_entries <= 1 {
            continue;
        }

        total_unified += 1;

        // Get Chinese meaning for comparison
        let chinese_gloss = entry.chinese_entry.as_ref()
            .and_then(|c| c.gloss.as_ref())
            .map(|s| s.as_str())
            .unwrap_or("");

        if chinese_gloss.is_empty() {
            continue;
        }

        // Collect all Japanese entries with their similarity scores
        let mut japanese_candidates = Vec::new();

        // Add primary Japanese entry
        if let Some(jp_entry) = &entry.japanese_entry {
            let jp_gloss = jp_entry.sense.first()
                .and_then(|s| s.gloss.first())
                .map(|g| g.text.as_str())
                .unwrap_or("");

            let similarity = calculate_semantic_similarity(jp_gloss, chinese_gloss);
            japanese_candidates.push((jp_entry.id.clone(), jp_gloss.to_string(), similarity, true)); // true = currently primary
        }

        // Add alternative Japanese entries
        for jp_entry in &entry.japanese_specific_entries {
            let jp_gloss = jp_entry.sense.first()
                .and_then(|s| s.gloss.first())
                .map(|g| g.text.as_str())
                .unwrap_or("");

            let similarity = calculate_semantic_similarity(jp_gloss, chinese_gloss);
            japanese_candidates.push((jp_entry.id.clone(), jp_gloss.to_string(), similarity, false)); // false = currently alternative
        }

        // Sort by similarity score (highest first)
        japanese_candidates.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));

        // Check if the best match is not currently the primary
        if let Some(best_match) = japanese_candidates.first() {
            if !best_match.3 { // If best match is not currently primary
                needs_realignment += 1;

                alignment_recommendations.push(AlignmentRecommendation {
                    word: entry.word.clone(),
                    chinese_gloss: chinese_gloss.to_string(),
                    current_primary_id: entry.japanese_entry.as_ref().map(|j| j.id.clone()).unwrap_or_default(),
                    current_primary_gloss: entry.japanese_entry.as_ref()
                        .and_then(|j| j.sense.first())
                        .and_then(|s| s.gloss.first())
                        .map(|g| g.text.clone())
                        .unwrap_or_default(),
                    recommended_primary_id: best_match.0.clone(),
                    recommended_primary_gloss: best_match.1.to_string(),
                    similarity_score: best_match.2,
                    all_candidates: japanese_candidates.clone(),
                });
            }
        }
    }

    println!("📊 Semantic Alignment Results:");
    println!("  Total unified entries with multiple Japanese entries: {}", total_unified);
    println!("  Entries needing realignment: {}", needs_realignment);
    println!("  Alignment accuracy: {:.1}%", ((total_unified - needs_realignment) as f64 / total_unified as f64) * 100.0);

    // Show top realignment recommendations
    alignment_recommendations.sort_by(|a, b| b.similarity_score.partial_cmp(&a.similarity_score).unwrap_or(std::cmp::Ordering::Equal));

    // First, let's check some specific examples we discussed
    println!("\n🔍 Checking specific examples we discussed:");
    let test_cases = vec!["私", "頭", "博士", "來日", "下家", "直", "上"];

    for test_word in &test_cases {
        if let Some(rec) = alignment_recommendations.iter().find(|r| r.word == *test_word) {
            println!("\n✅ FOUND: '{}'", test_word);
            println!("   🇨🇳 Chinese: \"{}\"", rec.chinese_gloss);
            println!("   ❌ Current primary: \"{}\"", rec.current_primary_gloss);
            println!("   ✅ Recommended: \"{}\" (score: {:.3})", rec.recommended_primary_gloss, rec.similarity_score);
        } else {
            // Check if it's already correctly aligned (not in recommendations)
            if let Some(entry) = combined_dict.entries.iter().find(|e| e.word == *test_word && e.metadata.is_unified) {
                let total_japanese_entries = if entry.japanese_entry.is_some() { 1 } else { 0 }
                    + entry.japanese_specific_entries.len();

                if total_japanese_entries > 1 {
                    println!("\n✅ ALREADY CORRECT: '{}'", test_word);
                    if let Some(chinese_entry) = &entry.chinese_entry {
                        if let Some(jp_entry) = &entry.japanese_entry {
                            let jp_gloss = jp_entry.sense.first()
                                .and_then(|s| s.gloss.first())
                                .map(|g| g.text.as_str())
                                .unwrap_or("");
                            println!("   🇨🇳 Chinese: \"{}\"", chinese_entry.gloss.as_ref().unwrap_or(&"".to_string()));
                            println!("   ✅ Current primary: \"{}\" (already best match)", jp_gloss);
                        }
                    }
                } else {
                    println!("\n❓ NOT FOUND: '{}' (may have only 1 Japanese entry)", test_word);
                }
            } else {
                println!("\n❓ NOT FOUND: '{}' (not unified or doesn't exist)", test_word);
            }
        }
    }

    println!("\n🔄 Top 50 Realignment Recommendations:");
    for (i, rec) in alignment_recommendations.iter().take(50).enumerate() {
        println!("\n{}. '{}' (similarity: {:.3})", i + 1, rec.word, rec.similarity_score);
        println!("   🇨🇳 Chinese: \"{}\"", rec.chinese_gloss);
        println!("   ❌ Current primary: ID:{} \"{}\"", rec.current_primary_id, rec.current_primary_gloss);
        println!("   ✅ Recommended: ID:{} \"{}\"", rec.recommended_primary_id, rec.recommended_primary_gloss);

        // Show all candidates with scores
        println!("   📋 All candidates:");
        for (j, (id, gloss, score, is_current_primary)) in rec.all_candidates.iter().enumerate() {
            let marker = if *is_current_primary { "🔸" } else if j == 0 { "⭐" } else { "  " };
            println!("      {} ID:{} ({:.3}) \"{}\"", marker, id, score, gloss);
        }
    }

    Ok(())
}

#[derive(Debug, Clone)]
struct AlignmentRecommendation {
    word: String,
    chinese_gloss: String,
    current_primary_id: String,
    current_primary_gloss: String,
    recommended_primary_id: String,
    recommended_primary_gloss: String,
    similarity_score: f64,
    all_candidates: Vec<(String, String, f64, bool)>, // (id, gloss, score, is_current_primary)
}

/// Calculate semantic similarity between Japanese and Chinese glosses
fn calculate_semantic_similarity(japanese_gloss: &str, chinese_gloss: &str) -> f64 {
    if japanese_gloss.is_empty() || chinese_gloss.is_empty() {
        return 0.0;
    }

    // Normalize and tokenize both glosses
    let jp_words = normalize_and_tokenize(japanese_gloss);
    let cn_words = normalize_and_tokenize(chinese_gloss);

    if jp_words.is_empty() || cn_words.is_empty() {
        return 0.0;
    }

    let mut score = 0.0;
    let mut total_comparisons = 0;

    // 1. Exact word matches (highest weight)
    for jp_word in &jp_words {
        for cn_word in &cn_words {
            total_comparisons += 1;
            if jp_word.to_lowercase() == cn_word.to_lowercase() {
                score += 1.0; // Perfect match
            } else if jp_word.to_lowercase().contains(&cn_word.to_lowercase()) ||
                     cn_word.to_lowercase().contains(&jp_word.to_lowercase()) {
                score += 0.7; // Partial match
            } else {
                // 2. Semantic category matching
                score += calculate_category_similarity(jp_word, cn_word);
            }
        }
    }

    // Normalize score by number of comparisons
    if total_comparisons > 0 {
        score / total_comparisons as f64
    } else {
        0.0
    }
}

/// Normalize text and extract meaningful words
fn normalize_and_tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split_whitespace()
        .filter_map(|word| {
            // Remove punctuation and parenthetical content
            let cleaned = word.trim_matches(|c: char| c.is_ascii_punctuation())
                .replace("(", "")
                .replace(")", "")
                .replace("[", "")
                .replace("]", "");

            // Filter out very short words and common stop words
            if cleaned.len() >= 2 && !is_stop_word(&cleaned) {
                Some(cleaned)
            } else {
                None
            }
        })
        .collect()
}

/// Check if a word is a common stop word
fn is_stop_word(word: &str) -> bool {
    matches!(word,
        "the" | "a" | "an" | "and" | "or" | "but" | "in" | "on" | "at" | "to" | "for" |
        "of" | "with" | "by" | "from" | "up" | "about" | "into" | "through" | "during" |
        "before" | "after" | "above" | "below" | "between" | "among" | "under" | "over" |
        "is" | "are" | "was" | "were" | "be" | "been" | "being" | "have" | "has" | "had" |
        "do" | "does" | "did" | "will" | "would" | "could" | "should" | "may" | "might" |
        "must" | "can" | "shall" | "esp" | "etc" | "vs" | "ie" | "eg"
    )
}

/// Calculate similarity between words based on semantic categories
fn calculate_category_similarity(word1: &str, word2: &str) -> f64 {
    // Define semantic categories with their keywords
    let categories = vec![
        // People and roles
        ("person", vec!["person", "people", "human", "man", "woman", "child", "adult", "baby", "infant", "teacher", "student", "doctor", "expert", "master", "emperor", "king", "queen", "lord", "lady"]),

        // Animals
        ("animal", vec!["animal", "bird", "fish", "mammal", "insect", "duck", "whale", "bear", "mouse", "rat", "squirrel", "dragon", "snake", "horse", "cow", "pig", "dog", "cat"]),

        // Body parts
        ("body", vec!["head", "body", "hand", "foot", "eye", "nose", "mouth", "ear", "hair", "skin", "bone", "blood", "heart", "brain"]),

        // Time
        ("time", vec!["time", "day", "night", "morning", "evening", "hour", "minute", "second", "year", "month", "week", "today", "tomorrow", "yesterday", "when", "future", "past"]),

        // Places
        ("place", vec!["place", "location", "area", "region", "country", "city", "town", "village", "home", "house", "building", "room", "office", "school", "hospital", "temple", "palace"]),

        // Actions
        ("action", vec!["action", "move", "go", "come", "walk", "run", "jump", "fly", "swim", "eat", "drink", "sleep", "work", "play", "study", "teach", "learn", "write", "read", "speak", "listen"]),

        // Objects
        ("object", vec!["thing", "object", "item", "tool", "weapon", "book", "paper", "pen", "car", "boat", "plane", "machine", "computer", "phone", "clothes", "food", "water", "fire", "earth", "air"]),

        // Qualities
        ("quality", vec!["good", "bad", "big", "small", "long", "short", "high", "low", "hot", "cold", "warm", "cool", "fast", "slow", "strong", "weak", "hard", "soft", "heavy", "light"]),

        // Numbers
        ("number", vec!["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "hundred", "thousand", "million", "first", "second", "third"]),

        // Games and sports
        ("game", vec!["game", "play", "sport", "chess", "card", "dice", "ball", "team", "player", "opponent", "turn", "move", "win", "lose", "score"]),

        // Medical
        ("medical", vec!["medical", "health", "disease", "illness", "sick", "healthy", "medicine", "treatment", "doctor", "hospital", "patient", "pain", "cure", "heal"]),

        // Nature
        ("nature", vec!["nature", "tree", "flower", "plant", "grass", "leaf", "forest", "mountain", "river", "sea", "ocean", "lake", "sky", "cloud", "rain", "snow", "wind", "sun", "moon", "star"]),
    ];

    // Find categories for both words
    let mut word1_categories = Vec::new();
    let mut word2_categories = Vec::new();

    for (category, keywords) in &categories {
        if keywords.iter().any(|&kw| word1.contains(kw) || kw.contains(word1)) {
            word1_categories.push(category);
        }
        if keywords.iter().any(|&kw| word2.contains(kw) || kw.contains(word2)) {
            word2_categories.push(category);
        }
    }

    // Calculate category overlap
    let mut category_matches = 0;
    for cat1 in &word1_categories {
        if word2_categories.contains(cat1) {
            category_matches += 1;
        }
    }

    if category_matches > 0 && (!word1_categories.is_empty() || !word2_categories.is_empty()) {
        0.5 // Moderate similarity for same category
    } else {
        0.0 // No similarity
    }
}

/// Apply semantic alignment recommendations to the dictionary
pub async fn apply_semantic_alignment(mut combined_dict: CombinedDictionary) -> Result<CombinedDictionary> {
    println!("🔍 Analyzing semantic alignments...");

    let mut alignment_recommendations = Vec::new();
    let mut total_unified = 0;
    let mut realignments_applied = 0;

    for entry in &combined_dict.entries {
        // Only consider unified entries with multiple Japanese entries
        if !entry.metadata.is_unified {
            continue;
        }

        // Skip entries with only one Japanese entry (already correctly aligned)
        let total_japanese_entries = if entry.japanese_entry.is_some() { 1 } else { 0 }
            + entry.japanese_specific_entries.len();

        if total_japanese_entries <= 1 {
            continue;
        }

        total_unified += 1;

        // Get Chinese meaning for comparison
        let chinese_gloss = entry.chinese_entry.as_ref()
            .and_then(|c| c.gloss.as_ref())
            .map(|s| s.as_str())
            .unwrap_or("");

        if chinese_gloss.is_empty() {
            continue;
        }

        // Collect all Japanese entries with their similarity scores
        let mut japanese_candidates = Vec::new();

        // Add primary Japanese entry
        if let Some(jp_entry) = &entry.japanese_entry {
            let jp_gloss = jp_entry.sense.first()
                .and_then(|s| s.gloss.first())
                .map(|g| g.text.as_str())
                .unwrap_or("");

            let similarity = calculate_semantic_similarity(jp_gloss, chinese_gloss);
            japanese_candidates.push((jp_entry.id.clone(), similarity, true)); // true = currently primary
        }

        // Add alternative Japanese entries
        for jp_entry in &entry.japanese_specific_entries {
            let jp_gloss = jp_entry.sense.first()
                .and_then(|s| s.gloss.first())
                .map(|g| g.text.as_str())
                .unwrap_or("");

            let similarity = calculate_semantic_similarity(jp_gloss, chinese_gloss);
            japanese_candidates.push((jp_entry.id.clone(), similarity, false)); // false = currently alternative
        }

        // Sort by similarity score (highest first)
        japanese_candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Check if the best match is not currently the primary
        if let Some(best_match) = japanese_candidates.first() {
            if !best_match.2 { // If best match is not currently primary
                alignment_recommendations.push((entry.word.clone(), best_match.0.clone()));
            }
        }
    }

    println!("📊 Found {} entries needing realignment out of {} total unified entries with multiple Japanese entries",
        alignment_recommendations.len(), total_unified);

    // Apply the realignments
    println!("🔄 Applying realignments...");

    for entry in &mut combined_dict.entries {
        if let Some((_, recommended_id)) = alignment_recommendations.iter().find(|(word, _)| word == &entry.word) {
            // Find the recommended entry in japanese_specific_entries
            if let Some(pos) = entry.japanese_specific_entries.iter().position(|jp| jp.id == *recommended_id) {
                // Swap: move current primary to alternatives, move recommended to primary
                let new_primary = entry.japanese_specific_entries.remove(pos);

                if let Some(old_primary) = entry.japanese_entry.take() {
                    entry.japanese_specific_entries.push(old_primary);
                }

                entry.japanese_entry = Some(new_primary);
                realignments_applied += 1;

                println!("  ✅ Realigned '{}' to use Japanese entry ID:{}", entry.word, recommended_id);
            }
        }
    }

    println!("🎯 Applied {} semantic realignments", realignments_applied);

    Ok(combined_dict)
}

/// Analyze Chinese dictionary entries that contain "variant of" definitions
pub async fn analyze_variant_definitions(chinese_entries: &[ChineseDictionaryElement]) -> Result<()> {
    println!("🔍 Analyzing Chinese dictionary entries with 'variant of' definitions...");

    let mut variant_entries = Vec::new();
    let mut variant_patterns = std::collections::HashMap::new();
    let mut entries_by_character = std::collections::HashMap::new();

    // First pass: group entries by character to detect multiple pronunciations
    for entry in chinese_entries {
        entries_by_character.entry(entry.trad.clone())
            .or_insert_with(Vec::new)
            .push(entry);
    }

    for entry in chinese_entries {
        let mut has_variant_def = false;
        let mut variant_refs = Vec::new();
        let mut all_definitions = Vec::new();
        let mut variant_items = Vec::new(); // Track which items have variants

        // Check all items for variant definitions
        for (item_idx, item) in entry.items.iter().enumerate() {
            let mut item_has_variant = false;
            let mut item_variant_refs = Vec::new();

            if let Some(definitions) = &item.definitions {
                for def in definitions {
                    all_definitions.push(def.clone());

                    // Check for various variant patterns
                    let def_lower = def.to_lowercase();
                    if def_lower.contains("variant of") ||
                       def_lower.contains("old variant of") ||
                       def_lower.contains("archaic variant of") ||
                       def_lower.contains("obsolete variant of") ||
                       def_lower.contains("ancient variant of") ||
                       def_lower.contains("traditional variant of") ||
                       def_lower.contains("simplified variant of") ||
                       def_lower.contains("japanese variant of") {

                        has_variant_def = true;
                        item_has_variant = true;

                        // Extract the referenced character(s) from the definition
                        // Pattern: "variant of 蟆[má]" or "old variant of 蟆"
                        if let Some(referenced_char) = extract_variant_reference(def) {
                            variant_refs.push(referenced_char.clone());
                            item_variant_refs.push(referenced_char);
                        }

                        // Count pattern types
                        let pattern = if def_lower.contains("old variant of") {
                            "old variant of"
                        } else if def_lower.contains("archaic variant of") {
                            "archaic variant of"
                        } else if def_lower.contains("obsolete variant of") {
                            "obsolete variant of"
                        } else if def_lower.contains("ancient variant of") {
                            "ancient variant of"
                        } else if def_lower.contains("traditional variant of") {
                            "traditional variant of"
                        } else if def_lower.contains("simplified variant of") {
                            "simplified variant of"
                        } else if def_lower.contains("japanese variant of") {
                            "japanese variant of"
                        } else {
                            "variant of"
                        };

                        *variant_patterns.entry(pattern.to_string()).or_insert(0) += 1;
                    }
                }
            }

            if item_has_variant {
                variant_items.push(VariantItem {
                    item_index: item_idx,
                    pinyin: item.pinyin.clone(),
                    variant_refs: item_variant_refs,
                });
            }
        }

        if has_variant_def {
            let definition_count = all_definitions.len();
            variant_entries.push(VariantAnalysis {
                word: entry.trad.clone(),
                simplified: entry.simp.clone(),
                variant_refs,
                all_definitions,
                definition_count,
                variant_items,
            });
        }
    }

    // Sort by number of definitions to understand complexity
    variant_entries.sort_by(|a, b| a.definition_count.cmp(&b.definition_count));

    println!("📊 Variant Analysis Results:");
    println!("  Total Chinese entries: {}", chinese_entries.len());
    println!("  Entries with 'variant of' definitions: {}", variant_entries.len());
    println!("  Percentage with variant definitions: {:.2}%",
             (variant_entries.len() as f64 / chinese_entries.len() as f64) * 100.0);

    println!("\n📋 Variant Pattern Distribution:");
    let mut pattern_vec: Vec<_> = variant_patterns.iter().collect();
    pattern_vec.sort_by(|a, b| b.1.cmp(a.1));
    for (pattern, count) in pattern_vec {
        println!("  {}: {} entries", pattern, count);
    }

    // Analyze definition count distribution
    let only_variant_def = variant_entries.iter().filter(|e| e.definition_count == 1).count();
    let multiple_defs = variant_entries.iter().filter(|e| e.definition_count > 1).count();

    println!("\n📈 Definition Count Analysis:");
    println!("  Entries with ONLY variant definition: {}", only_variant_def);
    println!("  Entries with variant + other definitions: {}", multiple_defs);
    println!("  Percentage with only variant definition: {:.1}%",
             (only_variant_def as f64 / variant_entries.len() as f64) * 100.0);

    // Analyze variant reference patterns
    let single_ref = variant_entries.iter().filter(|e| e.variant_refs.len() == 1).count();
    let multiple_refs = variant_entries.iter().filter(|e| e.variant_refs.len() > 1).count();
    let no_refs = variant_entries.iter().filter(|e| e.variant_refs.is_empty()).count();

    // Analyze multiple pronunciations (multiple items with variants)
    let multiple_pronunciations = variant_entries.iter().filter(|e| e.variant_items.len() > 1).count();
    let single_pronunciation = variant_entries.iter().filter(|e| e.variant_items.len() == 1).count();

    println!("\n🔗 Variant Reference Analysis:");
    println!("  Entries referencing single character: {}", single_ref);
    println!("  Entries referencing multiple characters: {}", multiple_refs);
    println!("  Entries with no extractable references: {}", no_refs);

    if single_ref > 0 {
        println!("  Percentage with single reference: {:.1}%",
                 (single_ref as f64 / variant_entries.len() as f64) * 100.0);
    }

    println!("\n🎵 Multiple Pronunciation Analysis:");
    println!("  Entries with single pronunciation/variant: {}", single_pronunciation);
    println!("  Entries with multiple pronunciations/variants: {}", multiple_pronunciations);
    if multiple_pronunciations > 0 {
        println!("  Percentage with multiple pronunciations: {:.1}%",
                 (multiple_pronunciations as f64 / variant_entries.len() as f64) * 100.0);
    }

    // Show examples
    println!("\n🔍 Examples of variant entries:");

    // Show entries with only variant definitions
    println!("\n  📝 Entries with ONLY variant definitions:");
    for entry in variant_entries.iter().filter(|e| e.definition_count == 1).take(10) {
        println!("    {} ({}): {:?} -> {:?}",
                 entry.word, entry.simplified, entry.all_definitions, entry.variant_refs);
    }

    // Show entries with variant + other definitions
    println!("\n  📝 Entries with variant + other definitions:");
    for entry in variant_entries.iter().filter(|e| e.definition_count > 1).take(10) {
        println!("    {} ({}): {} definitions, refs: {:?}",
                 entry.word, entry.simplified, entry.definition_count, entry.variant_refs);
        for def in &entry.all_definitions {
            println!("      - {}", def);
        }
    }

    // Show entries with multiple variant references
    if multiple_refs > 0 {
        println!("\n  📝 Entries with multiple variant references:");
        for entry in variant_entries.iter().filter(|e| e.variant_refs.len() > 1).take(5) {
            println!("    {} ({}): refs: {:?}",
                     entry.word, entry.simplified, entry.variant_refs);
            for def in &entry.all_definitions {
                println!("      - {}", def);
            }
        }
    }

    // Show entries with multiple pronunciations (the key insight!)
    if multiple_pronunciations > 0 {
        println!("\n  🎵 Entries with multiple pronunciations (CRITICAL for array design):");
        for entry in variant_entries.iter().filter(|e| e.variant_items.len() > 1).take(10) {
            println!("    {} ({}):", entry.word, entry.simplified);
            for item in &entry.variant_items {
                let pinyin = item.pinyin.as_deref().unwrap_or("N/A");
                println!("      - [{}] → {:?}", pinyin, item.variant_refs);
            }
        }
    }

    Ok(())
}

/// Analyze the file size impact of adding variant_refs to Chinese dictionary
pub async fn analyze_variant_file_size_impact(chinese_entries: &[ChineseDictionaryElement]) -> Result<()> {
    println!("📊 Analyzing file size impact of adding variant_refs field...");

    let mut total_items = 0;
    let mut items_with_variants = 0;
    let mut total_variant_refs = 0;
    let mut variant_ref_chars = 0;

    // Analyze current structure
    for entry in chinese_entries {
        for item in &entry.items {
            total_items += 1;

            if let Some(definitions) = &item.definitions {
                let mut item_has_variant = false;
                let mut item_variant_refs = Vec::new();

                for def in definitions {
                    let def_lower = def.to_lowercase();
                    if def_lower.contains("variant of") {
                        item_has_variant = true;

                        if let Some(variant_ref) = extract_variant_reference(def) {
                            item_variant_refs.push(variant_ref.clone());
                            variant_ref_chars += variant_ref.len();
                        }
                    }
                }

                if item_has_variant {
                    items_with_variants += 1;
                    total_variant_refs += item_variant_refs.len();
                }
            }
        }
    }

    // Calculate size estimates
    let items_without_variants = total_items - items_with_variants;

    // JSON overhead calculations
    let null_overhead_per_item = r#","variant_refs":null"#.len(); // 20 bytes
    let array_overhead_per_item = r#","variant_refs":["#.len() + 1; // 18 bytes + ]
    let string_overhead_per_ref = 3; // quotes + comma: "X",

    // Size impact calculations
    let null_field_overhead = items_without_variants * null_overhead_per_item;
    let array_field_overhead = items_with_variants * array_overhead_per_item;
    let string_content_overhead = total_variant_refs * string_overhead_per_ref + variant_ref_chars;

    let total_overhead_bytes = null_field_overhead + array_field_overhead + string_content_overhead;
    let total_overhead_kb = total_overhead_bytes as f64 / 1024.0;
    let total_overhead_mb = total_overhead_kb / 1024.0;

    // Current file size estimate
    let current_chinese_file_size_mb = 70.0; // From README
    let percentage_increase = (total_overhead_mb / current_chinese_file_size_mb) * 100.0;

    println!("\n📈 File Size Impact Analysis:");
    println!("  Total Chinese dictionary items: {}", total_items);
    println!("  Items with variant definitions: {} ({:.1}%)",
             items_with_variants, (items_with_variants as f64 / total_items as f64) * 100.0);
    println!("  Items without variant definitions: {} ({:.1}%)",
             items_without_variants, (items_without_variants as f64 / total_items as f64) * 100.0);
    println!("  Total variant references: {}", total_variant_refs);
    println!("  Average refs per variant item: {:.1}",
             total_variant_refs as f64 / items_with_variants as f64);

    println!("\n💾 Storage Overhead Breakdown:");
    println!("  Null field overhead: {} bytes ({:.1} KB)", null_field_overhead, null_field_overhead as f64 / 1024.0);
    println!("  Array structure overhead: {} bytes ({:.1} KB)", array_field_overhead, array_field_overhead as f64 / 1024.0);
    println!("  String content overhead: {} bytes ({:.1} KB)", string_content_overhead, string_content_overhead as f64 / 1024.0);
    println!("  Total overhead: {} bytes ({:.1} KB, {:.2} MB)",
             total_overhead_bytes, total_overhead_kb, total_overhead_mb);

    println!("\n📊 Impact on Dictionary Files:");
    println!("  Current Chinese dictionary: ~{} MB", current_chinese_file_size_mb);
    println!("  Estimated size with variant_refs: ~{:.2} MB", current_chinese_file_size_mb + total_overhead_mb);
    println!("  Size increase: {:.2} MB ({:.2}%)", total_overhead_mb, percentage_increase);

    // Impact on unified output
    let unified_files_mb = 106.0; // From README
    let unified_impact_mb = total_overhead_mb * 0.15; // Estimate ~15% of Chinese entries make it to unified
    let unified_percentage = (unified_impact_mb / unified_files_mb) * 100.0;

    println!("\n🎯 Impact on Unified Output:");
    println!("  Current unified dictionary: ~{} MB", unified_files_mb);
    println!("  Estimated impact: ~{:.2} MB ({:.2}%)", unified_impact_mb, unified_percentage);

    // Compression estimates
    println!("\n🗜️  Compression Considerations:");
    println!("  JSON is highly compressible (especially repeated null fields)");
    println!("  Gzip compression would reduce actual impact by ~70-80%");
    println!("  Real-world impact likely: ~{:.2} MB uncompressed, ~{:.2} MB compressed",
             total_overhead_mb, total_overhead_mb * 0.25);

    Ok(())
}

/// Analyze the file size impact of resolving variant definitions
pub async fn analyze_variant_resolution_impact(chinese_entries: &[ChineseDictionaryElement]) -> Result<()> {
    println!("📊 Analyzing file size impact of resolving variant definitions...");

    // Build lookup map for variant resolution
    let lookup_map: std::collections::HashMap<String, &ChineseDictionaryElement> = chinese_entries
        .iter()
        .map(|entry| (entry.trad.clone(), entry))
        .collect();

    let mut variant_definitions_count = 0;
    let mut variant_definitions_chars = 0;
    let mut resolved_definitions_count = 0;
    let mut resolved_definitions_chars = 0;
    let mut unresolvable_variants = 0;

    for entry in chinese_entries {
        for item in &entry.items {
            if let Some(definitions) = &item.definitions {
                for def in definitions {
                    let def_lower = def.to_lowercase();
                    if def_lower.contains("variant of") {
                        variant_definitions_count += 1;
                        variant_definitions_chars += def.len();

                        if let Some(variant_ref) = extract_variant_reference(def) {
                            // Try to resolve the variant
                            if let Some(referenced_entry) = lookup_map.get(&variant_ref) {
                                // Count resolved definitions
                                for ref_item in &referenced_entry.items {
                                    if let Some(ref_definitions) = &ref_item.definitions {
                                        for ref_def in ref_definitions {
                                            // Only count non-variant definitions
                                            let ref_def_lower = ref_def.to_lowercase();
                                            if !ref_def_lower.contains("variant of") {
                                                resolved_definitions_count += 1;
                                                resolved_definitions_chars += ref_def.len();
                                            }
                                        }
                                    }
                                }
                            } else {
                                unresolvable_variants += 1;
                            }
                        } else {
                            unresolvable_variants += 1;
                        }
                    }
                }
            }
        }
    }

    // Calculate size impact (CORRECTED: we ADD definitions, don't replace)
    let kept_chars = variant_definitions_chars; // Keep original variant definitions
    let added_chars = resolved_definitions_chars; // Add resolved definitions
    let net_char_change = added_chars as i64; // Total addition, no removal

    // JSON overhead for additional definitions
    let definition_array_overhead = resolved_definitions_count * 3; // quotes + comma
    let metadata_overhead = variant_definitions_count * 50; // Estimate for variant metadata

    let total_overhead_bytes = net_char_change + definition_array_overhead as i64 + metadata_overhead as i64;
    let total_overhead_mb = total_overhead_bytes as f64 / (1024.0 * 1024.0);

    // Current file sizes
    let current_chinese_file_size_mb = 70.0;
    let unified_files_mb = 106.0;

    println!("\n📈 Variant Resolution Impact Analysis:");
    println!("  Variant definitions found: {}", variant_definitions_count);
    println!("  Resolved definitions generated: {}", resolved_definitions_count);
    println!("  Unresolvable variants: {}", unresolvable_variants);
    println!("  Resolution ratio: {:.1}:1 (resolved:variant)",
             resolved_definitions_count as f64 / variant_definitions_count as f64);

    println!("\n💾 Content Size Changes:");
    println!("  Variant definition chars kept: {} ({:.1} KB)",
             kept_chars, kept_chars as f64 / 1024.0);
    println!("  Resolved definition chars added: {} ({:.1} KB)",
             added_chars, added_chars as f64 / 1024.0);
    println!("  Net character addition: {} ({:.1} KB)",
             net_char_change, net_char_change as f64 / 1024.0);

    println!("\n🏗️  Structural Overhead:");
    println!("  Definition array overhead: {} bytes ({:.1} KB)",
             definition_array_overhead, definition_array_overhead as f64 / 1024.0);
    println!("  Metadata overhead: {} bytes ({:.1} KB)",
             metadata_overhead, metadata_overhead as f64 / 1024.0);
    println!("  Total estimated impact: {:.2} MB", total_overhead_mb);

    println!("\n📊 Impact on Dictionary Files:");
    println!("  Current Chinese dictionary: ~{} MB", current_chinese_file_size_mb);
    println!("  Estimated size with resolution: ~{:.2} MB",
             current_chinese_file_size_mb + total_overhead_mb);
    println!("  Size change: {:.2} MB ({:.2}%)",
             total_overhead_mb, (total_overhead_mb / current_chinese_file_size_mb) * 100.0);

    // Impact on unified output (more significant)
    let unified_impact_mb = total_overhead_mb * 0.15; // ~15% of Chinese entries in unified
    println!("\n🎯 Impact on Unified Output:");
    println!("  Current unified dictionary: ~{} MB", unified_files_mb);
    println!("  Estimated impact: ~{:.2} MB ({:.2}%)",
             unified_impact_mb, (unified_impact_mb / unified_files_mb) * 100.0);

    // Quality vs Size tradeoff
    println!("\n⚖️  Quality vs Size Tradeoff:");
    println!("  Variant entries with only variant definitions: ~60.5% (from previous analysis)");
    println!("  These entries become significantly more useful");
    println!("  Cost: ~{:.2} MB for ~3,500 improved definitions", total_overhead_mb);
    println!("  Cost per improved definition: ~{:.0} bytes",
             (total_overhead_mb * 1024.0 * 1024.0) / variant_definitions_count as f64);

    Ok(())
}

/// Compare both approaches: variant_refs vs full resolution
pub async fn compare_variant_approaches(chinese_entries: &[ChineseDictionaryElement]) -> Result<()> {
    println!("⚖️  Comparing variant handling approaches...");

    // Run both analyses
    println!("\n🔗 APPROACH 1: Adding variant_refs field");
    println!("{}", "=".repeat(50));

    // Simplified calculation for variant_refs approach
    let mut items_with_variants = 0;
    let mut items_without_variants = 0;
    let mut total_variant_refs = 0;
    let mut variant_ref_chars = 0;

    for entry in chinese_entries {
        for item in &entry.items {
            let mut item_has_variant = false;

            if let Some(definitions) = &item.definitions {
                for def in definitions {
                    if def.to_lowercase().contains("variant of") {
                        item_has_variant = true;
                        if let Some(variant_ref) = extract_variant_reference(def) {
                            total_variant_refs += 1;
                            variant_ref_chars += variant_ref.len();
                        }
                    }
                }
            }

            if item_has_variant {
                items_with_variants += 1;
            } else {
                items_without_variants += 1;
            }
        }
    }

    let refs_overhead = (items_without_variants * 20) + (items_with_variants * 18) +
                       (total_variant_refs * 3) + variant_ref_chars;
    let refs_overhead_mb = refs_overhead as f64 / (1024.0 * 1024.0);

    println!("  Storage overhead: {:.2} MB", refs_overhead_mb);
    println!("  Benefit: References to other characters");
    println!("  Drawback: Frontend must resolve references");

    println!("\n📚 APPROACH 2: Full definition resolution");
    println!("{}", "=".repeat(50));

    // Full resolution calculation
    let lookup_map: std::collections::HashMap<String, &ChineseDictionaryElement> = chinese_entries
        .iter()
        .map(|entry| (entry.trad.clone(), entry))
        .collect();

    let mut resolved_definitions_chars = 0;
    let mut resolved_definitions_count = 0;

    for entry in chinese_entries {
        for item in &entry.items {
            if let Some(definitions) = &item.definitions {
                for def in definitions {
                    if def.to_lowercase().contains("variant of") {
                        if let Some(variant_ref) = extract_variant_reference(def) {
                            if let Some(referenced_entry) = lookup_map.get(&variant_ref) {
                                for ref_item in &referenced_entry.items {
                                    if let Some(ref_definitions) = &ref_item.definitions {
                                        for ref_def in ref_definitions {
                                            if !ref_def.to_lowercase().contains("variant of") {
                                                resolved_definitions_count += 1;
                                                resolved_definitions_chars += ref_def.len();
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
    }

    let resolution_overhead = resolved_definitions_chars + (resolved_definitions_count * 3) +
                             (items_with_variants * 50); // metadata overhead
    let resolution_overhead_mb = resolution_overhead as f64 / (1024.0 * 1024.0);

    println!("  Storage overhead: {:.2} MB", resolution_overhead_mb);
    println!("  Benefit: Immediate useful definitions");
    println!("  Drawback: Larger file size");

    println!("\n📊 COMPARISON SUMMARY");
    println!("{}", "=".repeat(50));
    println!("  Variant references approach: {:.2} MB overhead", refs_overhead_mb);
    println!("  Full resolution approach:    {:.2} MB overhead", resolution_overhead_mb);
    println!("  Difference:                  {:.2} MB ({:.1}x)",
             resolution_overhead_mb - refs_overhead_mb,
             resolution_overhead_mb / refs_overhead_mb);

    println!("\n🎯 RECOMMENDATION");
    println!("{}", "=".repeat(50));
    if refs_overhead_mb < resolution_overhead_mb {
        println!("  ✅ Variant references approach is more storage-efficient");
        println!("  💡 Use variant_refs field + frontend resolution");
        println!("  📈 Saves {:.2} MB ({:.1}% smaller)",
                 resolution_overhead_mb - refs_overhead_mb,
                 ((resolution_overhead_mb - refs_overhead_mb) / resolution_overhead_mb) * 100.0);
    } else {
        println!("  ✅ Full resolution approach is more storage-efficient");
        println!("  💡 Resolve variants during preprocessing");
    }

    println!("\n🔍 DETAILED BREAKDOWN");
    println!("  Items with variants: {}", items_with_variants);
    println!("  Items without variants: {}", items_without_variants);
    println!("  Total variant references: {}", total_variant_refs);
    println!("  Resolved definitions: {}", resolved_definitions_count);
    println!("  Resolution ratio: {:.1}:1", resolved_definitions_count as f64 / total_variant_refs as f64);

    Ok(())
}

/// Resolve variant definitions by adding the actual definitions from referenced characters
#[allow(dead_code)]
pub async fn resolve_variant_definitions(chinese_entries: &mut [ChineseDictionaryElement]) -> Result<()> {
    println!("🔄 Resolving variant definitions...");

    // Build lookup map of all Chinese entries by traditional character (clone to avoid borrow issues)
    let lookup_map: std::collections::HashMap<String, ChineseDictionaryElement> = chinese_entries
        .iter()
        .map(|entry| (entry.trad.clone(), entry.clone()))
        .collect();

    let mut total_variants_found = 0;
    let mut total_definitions_added = 0;
    let mut unresolvable_variants = 0;

    // Process each entry
    for entry in chinese_entries.iter_mut() {
        for item in &mut entry.items {
            if let Some(definitions) = &mut item.definitions {
                let mut additional_definitions = Vec::new();

                // Check each definition for variant patterns
                for def in definitions.iter() {
                    let def_lower = def.to_lowercase();
                    if def_lower.contains("variant of") {
                        total_variants_found += 1;

                        // Extract the referenced character(s)
                        let variant_refs = extract_variant_references(def);
                        if !variant_refs.is_empty() {
                            let mut resolved = false;

                            // Try each reference until one is found
                            for variant_ref in &variant_refs {
                                if let Some(referenced_entry) = lookup_map.get(variant_ref) {
                                    // Add definitions from the referenced character
                                    for ref_item in &referenced_entry.items {
                                        if let Some(ref_definitions) = &ref_item.definitions {
                                            for ref_def in ref_definitions {
                                                // Only add non-variant definitions to avoid infinite loops
                                                let ref_def_lower = ref_def.to_lowercase();
                                                if !ref_def_lower.contains("variant of") {
                                                    additional_definitions.push(ref_def.clone());
                                                    total_definitions_added += 1;
                                                }
                                            }
                                        }
                                    }
                                    resolved = true;
                                    break; // Found a match, stop trying other references
                                }
                            }

                            if !resolved {
                                unresolvable_variants += 1;
                                let refs_str = variant_refs.join(", ");
                                println!("  ⚠️  Could not resolve variant reference: {} → {}",
                                        entry.trad, refs_str);
                            }
                        } else {
                            unresolvable_variants += 1;
                            println!("  ⚠️  Could not extract variant reference from: {}", def);
                        }
                    }
                }

                // Add the resolved definitions to the existing ones
                definitions.extend(additional_definitions);
            }
        }
    }

    println!("✅ Variant resolution complete:");
    println!("  Variant definitions found: {}", total_variants_found);
    println!("  Additional definitions added: {}", total_definitions_added);
    println!("  Unresolvable variants: {}", unresolvable_variants);
    println!("  Resolution success rate: {:.1}%",
             ((total_variants_found - unresolvable_variants) as f64 / total_variants_found as f64) * 100.0);

    Ok(())
}

#[derive(Debug)]
struct VariantAnalysis {
    word: String,
    simplified: String,
    variant_refs: Vec<String>,
    all_definitions: Vec<String>,
    definition_count: usize,
    variant_items: Vec<VariantItem>,
}

#[derive(Debug)]
struct VariantItem {
    #[allow(dead_code)]
    item_index: usize,
    pinyin: Option<String>,
    variant_refs: Vec<String>,
}

/// Extract the referenced character(s) from a variant definition
/// Examples: "old variant of 蟆[má]" -> ["蟆"], "variant of 罵|骂" -> ["罵", "骂"]
fn extract_variant_references(definition: &str) -> Vec<String> {
    // Look for patterns like "variant of X[...]" or "variant of X"
    let patterns = [
        r"variant of ([^\[\s\)]+)",  // Matches "variant of 蟆[má]" -> captures "蟆"
        r"variant of ([^\s\)]+)",    // Matches "variant of 蟆" -> captures "蟆"
        r"\(.*variant of ([^\[\s\)]+)\)", // Handle parenthetical variants like "(variant of U+53A8 厨)"
    ];

    for pattern in &patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(captures) = re.captures(definition) {
                if let Some(matched) = captures.get(1) {
                    let reference = matched.as_str();

                    // Handle multiple references separated by | or ,
                    let references: Vec<String> = reference
                        .split(&['|', ','][..])
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .filter(|s| {
                            // Filter out common non-character references
                            !s.chars().all(|c| c.is_ascii()) && // Must contain non-ASCII (Chinese chars)
                            s.len() <= 10 && // Reasonable length limit
                            !s.starts_with("U+") // Skip Unicode references like "U+53A8"
                        })
                        .map(|s| s.to_string())
                        .collect();

                    if !references.is_empty() {
                        return references;
                    }
                }
            }
        }
    }

    Vec::new()
}

/// Extract the first resolvable referenced character from a variant definition (backward compatibility)
/// Examples: "old variant of 蟆[má]" -> Some("蟆"), "variant of 罵|骂" -> Some("罵") or Some("骂")
fn extract_variant_reference(definition: &str) -> Option<String> {
    let references = extract_variant_references(definition);
    references.into_iter().next()
}

/// Analyze pinyin-definition coverage in Chinese dictionary
pub async fn analyze_pinyin_definition_coverage(chinese_entries: &[ChineseDictionaryElement]) -> Result<()> {
    println!("🔍 Analyzing pinyin-definition coverage...");

    let mut total_entries = 0;
    let mut entries_with_orphaned_pinyin = 0;
    let mut total_items = 0;
    let mut items_with_pinyin_no_definitions = 0;
    let mut total_pinyin_readings = 0;
    let mut orphaned_pinyin_readings = 0;
    let mut pinyin_duplication_stats = std::collections::HashMap::new();

    // Track character+pinyin combinations and whether they have definitions from ANY source
    let mut pinyin_coverage = std::collections::HashMap::new();

    for entry in chinese_entries {
        total_entries += 1;

        // First pass: collect all pinyin+definition coverage for this character
        for item in &entry.items {
            total_items += 1;

            if let Some(pinyin) = &item.pinyin {
                total_pinyin_readings += 1;

                // Track pinyin duplication by character
                let key = format!("{}:{}", entry.trad, pinyin);
                *pinyin_duplication_stats.entry(key.clone()).or_insert(0) += 1;

                // Check if this item has definitions
                let has_definitions = item.definitions.as_ref()
                    .map(|defs| !defs.is_empty())
                    .unwrap_or(false);

                if !has_definitions {
                    items_with_pinyin_no_definitions += 1;
                }

                // Track whether this character+pinyin combination has definitions from ANY source
                let coverage_entry = pinyin_coverage.entry(key).or_insert(false);
                if has_definitions {
                    *coverage_entry = true;
                }
            }
        }
    }

    // Second pass: identify truly orphaned pinyin (no definitions from ANY source)
    let mut truly_orphaned_examples = Vec::new();
    for (key, has_definitions) in &pinyin_coverage {
        if !has_definitions {
            orphaned_pinyin_readings += 1;
            if truly_orphaned_examples.len() < 30 {
                let parts: Vec<&str> = key.split(':').collect();
                if parts.len() == 2 {
                    truly_orphaned_examples.push(format!("{} [{}]", parts[0], parts[1]));
                }
            }
        }
    }

    // Count entries with truly orphaned pinyin
    for entry in chinese_entries {
        let mut entry_has_orphaned_pinyin = false;

        // Collect all pinyin for this entry
        let mut entry_pinyin = std::collections::HashSet::new();
        for item in &entry.items {
            if let Some(pinyin) = &item.pinyin {
                entry_pinyin.insert(pinyin.clone());
            }
        }

        // Check if any pinyin for this entry is truly orphaned
        for pinyin in entry_pinyin {
            let key = format!("{}:{}", entry.trad, pinyin);
            if let Some(false) = pinyin_coverage.get(&key) {
                entry_has_orphaned_pinyin = true;
                break;
            }
        }

        if entry_has_orphaned_pinyin {
            entries_with_orphaned_pinyin += 1;
        }
    }

    // Show examples of truly orphaned pinyin
    for example in &truly_orphaned_examples {
        println!("  📍 Truly orphaned pinyin: {} (no definitions from any source)", example);
    }

    // Analyze duplication
    let mut duplicated_pinyin_count = 0;
    let mut total_duplications = 0;

    for (key, count) in &pinyin_duplication_stats {
        if *count > 1 {
            duplicated_pinyin_count += 1;
            total_duplications += count - 1; // Extra occurrences beyond the first

            if duplicated_pinyin_count <= 10 { // Show first 10 examples
                println!("  🔄 Duplicated: {} appears {} times", key, count);
            }
        }
    }

    println!("\n📊 Pinyin-Definition Coverage Analysis Results:");
    println!("  Total entries: {}", total_entries);
    println!("  Total items: {}", total_items);
    println!("  Total pinyin readings: {}", total_pinyin_readings);
    println!("  Unique character+pinyin combinations: {}", pinyin_coverage.len());
    println!("  Truly orphaned pinyin combinations (no definitions from ANY source): {} ({:.1}%)",
             orphaned_pinyin_readings,
             (orphaned_pinyin_readings as f64 / pinyin_coverage.len() as f64) * 100.0);
    println!("  Items with pinyin but no definitions: {} ({:.1}%)",
             items_with_pinyin_no_definitions,
             (items_with_pinyin_no_definitions as f64 / total_items as f64) * 100.0);
    println!("  Entries with truly orphaned pinyin: {} ({:.1}%)",
             entries_with_orphaned_pinyin,
             (entries_with_orphaned_pinyin as f64 / total_entries as f64) * 100.0);
    println!("  Duplicated pinyin readings: {} ({:.1}%)",
             duplicated_pinyin_count,
             (duplicated_pinyin_count as f64 / pinyin_duplication_stats.len() as f64) * 100.0);
    println!("  Total duplicate occurrences: {}", total_duplications);

    if duplicated_pinyin_count > 10 {
        println!("  (showing first 10 duplicated examples, {} more exist)", duplicated_pinyin_count - 10);
    }

    if orphaned_pinyin_readings > 30 {
        println!("  (showing first 30 truly orphaned examples, {} more exist)", orphaned_pinyin_readings - 30);
    }

    Ok(())
}

/// Analyze Unicode source items for definition coverage
pub async fn analyze_unicode_source_coverage(chinese_entries: &[ChineseDictionaryElement]) -> Result<()> {
    println!("🔍 Analyzing Unicode source definition coverage...");

    let mut total_unicode_items = 0;
    let mut unicode_items_with_definitions = 0;
    let mut unicode_items_without_definitions = 0;
    let mut total_non_unicode_items = 0;
    let mut non_unicode_items_with_definitions = 0;
    let mut non_unicode_items_without_definitions = 0;

    let mut unicode_with_definitions_examples = Vec::new();
    let mut unicode_without_definitions_examples = Vec::new();

    for entry in chinese_entries {
        for item in &entry.items {
            let is_unicode = item.source.as_ref()
                .map(|s| matches!(s, crate::chinese_types::Source::Unicode))
                .unwrap_or(false);

            let has_definitions = item.definitions.as_ref()
                .map(|defs| !defs.is_empty())
                .unwrap_or(false);

            if is_unicode {
                total_unicode_items += 1;
                if has_definitions {
                    unicode_items_with_definitions += 1;
                    if unicode_with_definitions_examples.len() < 10 {
                        let pinyin_str = item.pinyin.as_ref().map(|s| s.as_str()).unwrap_or("?");
                        let def_count = item.definitions.as_ref().map(|d| d.len()).unwrap_or(0);
                        let first_def = item.definitions.as_ref()
                            .and_then(|defs| defs.first())
                            .map(|s| s.as_str())
                            .unwrap_or("");
                        unicode_with_definitions_examples.push(format!(
                            "{} [{}] - {} definitions (e.g., \"{}\")",
                            entry.trad, pinyin_str, def_count, first_def
                        ));
                    }
                } else {
                    unicode_items_without_definitions += 1;
                    if unicode_without_definitions_examples.len() < 10 {
                        let pinyin_str = item.pinyin.as_ref().map(|s| s.as_str()).unwrap_or("?");
                        unicode_without_definitions_examples.push(format!(
                            "{} [{}] - no definitions",
                            entry.trad, pinyin_str
                        ));
                    }
                }
            } else {
                total_non_unicode_items += 1;
                if has_definitions {
                    non_unicode_items_with_definitions += 1;
                } else {
                    non_unicode_items_without_definitions += 1;
                }
            }
        }
    }

    println!("\n📊 Unicode Source Analysis Results:");
    println!("  Total Unicode source items: {}", total_unicode_items);
    println!("  Unicode items WITH definitions: {} ({:.1}%)",
             unicode_items_with_definitions,
             (unicode_items_with_definitions as f64 / total_unicode_items as f64) * 100.0);
    println!("  Unicode items WITHOUT definitions: {} ({:.1}%)",
             unicode_items_without_definitions,
             (unicode_items_without_definitions as f64 / total_unicode_items as f64) * 100.0);

    println!("\n  Total non-Unicode source items: {}", total_non_unicode_items);
    println!("  Non-Unicode items WITH definitions: {} ({:.1}%)",
             non_unicode_items_with_definitions,
             (non_unicode_items_with_definitions as f64 / total_non_unicode_items as f64) * 100.0);
    println!("  Non-Unicode items WITHOUT definitions: {} ({:.1}%)",
             non_unicode_items_without_definitions,
             (non_unicode_items_without_definitions as f64 / total_non_unicode_items as f64) * 100.0);

    if !unicode_with_definitions_examples.is_empty() {
        println!("\n🎯 Examples of Unicode items WITH definitions:");
        for example in &unicode_with_definitions_examples {
            println!("  ✅ {}", example);
        }
    }

    if !unicode_without_definitions_examples.is_empty() {
        println!("\n❌ Examples of Unicode items WITHOUT definitions:");
        for example in &unicode_without_definitions_examples {
            println!("  ❌ {}", example);
        }
    }

    // Conclusion
    if unicode_items_with_definitions == 0 {
        println!("\n🚨 CONCLUSION: NO Unicode source items have definitions!");
        println!("   💡 Recommendation: Filter out ALL Unicode source items during processing");
        println!("   📈 This would eliminate {} items ({:.1}% of all items)",
                 total_unicode_items,
                 (total_unicode_items as f64 / (total_unicode_items + total_non_unicode_items) as f64) * 100.0);
    } else {
        println!("\n✅ CONCLUSION: Some Unicode source items DO have definitions");
        println!("   💡 Recommendation: Keep Unicode items but filter out those without definitions");
    }

    Ok(())
}

/// Analyze characters with multiple readings in both Chinese and Japanese (like 的)
pub async fn analyze_multi_reading_overlap(
    chinese_entries: &[ChineseDictionaryElement],
    japanese_entries: &[crate::japanese_types::Word]
) -> Result<()> {
    println!("🔍 Analyzing multi-reading overlap patterns...");

    // Build maps for efficient lookup
    let mut chinese_multi_reading: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    let mut japanese_multi_reading: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();

    // Collect Chinese characters with multiple pinyin readings
    for entry in chinese_entries {
        let mut pinyin_set = std::collections::HashSet::new();

        for item in &entry.items {
            if let Some(pinyin) = &item.pinyin {
                // Only include pinyin that have definitions
                let has_definitions = item.definitions.as_ref()
                    .map(|defs| !defs.is_empty())
                    .unwrap_or(false);

                if has_definitions {
                    pinyin_set.insert(pinyin.clone());
                }
            }
        }

        if pinyin_set.len() > 1 {
            let mut pinyin_vec: Vec<String> = pinyin_set.into_iter().collect();
            pinyin_vec.sort();
            chinese_multi_reading.insert(entry.trad.clone(), pinyin_vec);
        }
    }

    // Collect Japanese characters with multiple readings
    for word in japanese_entries {
        for kanji_variant in &word.kanji {
            let kanji_text = &kanji_variant.text;

            // Skip if not a single character
            if kanji_text.chars().count() != 1 {
                continue;
            }

            let mut reading_set = std::collections::HashSet::new();

            for kana_variant in &word.kana {
                reading_set.insert(kana_variant.text.clone());
            }

            if reading_set.len() > 1 {
                let mut reading_vec: Vec<String> = reading_set.into_iter().collect();
                reading_vec.sort();
                japanese_multi_reading.insert(kanji_text.clone(), reading_vec);
            }
        }
    }

    // Find overlapping characters (exist in both languages with multiple readings)
    let mut overlapping_chars = Vec::new();

    for (chinese_char, chinese_readings) in &chinese_multi_reading {
        if let Some(japanese_readings) = japanese_multi_reading.get(chinese_char) {
            overlapping_chars.push((
                chinese_char.clone(),
                chinese_readings.clone(),
                japanese_readings.clone(),
            ));
        }
    }

    // Sort by number of total readings (most complex first)
    overlapping_chars.sort_by(|a, b| {
        let total_a = a.1.len() + a.2.len();
        let total_b = b.1.len() + b.2.len();
        total_b.cmp(&total_a)
    });

    println!("\n📊 Multi-Reading Overlap Analysis Results:");
    println!("  Chinese characters with multiple readings: {}", chinese_multi_reading.len());
    println!("  Japanese characters with multiple readings: {}", japanese_multi_reading.len());
    println!("  Characters with multiple readings in BOTH languages: {}", overlapping_chars.len());

    println!("\n🎯 Top 30 Characters with Multiple Readings in Both Languages:");
    println!("  (Sorted by total complexity - most readings first)");

    for (i, (character, chinese_readings, japanese_readings)) in overlapping_chars.iter().take(30).enumerate() {
        let total_readings = chinese_readings.len() + japanese_readings.len();
        println!("  {}. {} - {} total readings", i + 1, character, total_readings);
        println!("     Chinese: {} readings [{}]", chinese_readings.len(), chinese_readings.join(", "));
        println!("     Japanese: {} readings [{}]", japanese_readings.len(), japanese_readings.join(", "));

        // Look for potential semantic overlaps by checking if any readings are similar
        let mut potential_overlaps = Vec::new();
        for chinese_reading in chinese_readings {
            for japanese_reading in japanese_readings {
                // Simple heuristic: if readings sound similar or have semantic connection
                if readings_potentially_related(chinese_reading, japanese_reading) {
                    potential_overlaps.push(format!("{} ≈ {}", chinese_reading, japanese_reading));
                }
            }
        }

        if !potential_overlaps.is_empty() {
            println!("     Potential connections: {}", potential_overlaps.join(", "));
        }

        println!();
    }

    // Statistics by complexity level
    let mut complexity_stats = std::collections::HashMap::new();
    for (_, chinese_readings, japanese_readings) in &overlapping_chars {
        let total = chinese_readings.len() + japanese_readings.len();
        *complexity_stats.entry(total).or_insert(0) += 1;
    }

    println!("📈 Complexity Distribution:");
    let mut complexity_levels: Vec<_> = complexity_stats.into_iter().collect();
    complexity_levels.sort_by(|a, b| b.0.cmp(&a.0));

    for (total_readings, count) in complexity_levels {
        println!("  {} total readings: {} characters", total_readings, count);
    }

    // Find characters similar to 的 (multiple Chinese readings, multiple Japanese readings, with semantic connections)
    println!("\n🔍 Characters Most Similar to 的 Pattern:");
    let de_like_chars: Vec<_> = overlapping_chars.iter()
        .filter(|(_, chinese_readings, japanese_readings)| {
            chinese_readings.len() >= 3 && japanese_readings.len() >= 2
        })
        .take(10)
        .collect();

    for (character, chinese_readings, japanese_readings) in de_like_chars {
        println!("  {} - Chinese: {} readings, Japanese: {} readings",
                 character, chinese_readings.len(), japanese_readings.len());
    }

    Ok(())
}

/// Simple heuristic to detect potentially related readings
fn readings_potentially_related(chinese_reading: &str, japanese_reading: &str) -> bool {
    // This is a very basic heuristic - could be improved with phonetic analysis

    // Check for similar sounds (very basic)
    if chinese_reading.chars().count() >= 2 && japanese_reading.chars().count() >= 2 {
        let chinese_start = chinese_reading.chars().next().unwrap().to_string();
        let japanese_start = japanese_reading.chars().next().unwrap().to_string();

        // Some basic sound correspondences
        match (chinese_start.as_str(), japanese_start.as_str()) {
            ("d", "t") | ("t", "d") => true,  // de/teki pattern
            ("b", "h") | ("h", "b") => true,  // common sound shift
            ("g", "k") | ("k", "g") => true,  // voicing differences
            _ => chinese_start == japanese_start,
        }
    } else {
        false
    }
}

/// Analyze complexity tiers for multi-reading characters to determine which need bespoke treatment
pub async fn analyze_complexity_tiers(chinese_entries: &[ChineseDictionaryElement], japanese_words: &[Word]) -> Result<()> {
    println!("🔍 Analyzing complexity tiers for multi-reading characters...");

    // Find characters with multiple readings in both languages
    let mut multi_reading_chars = Vec::new();

    for entry in chinese_entries {
        // Skip multi-character words
        if entry.trad.chars().count() != 1 {
            continue;
        }

        // Check if Chinese has multiple readings
        let chinese_readings: std::collections::HashSet<String> = entry.items.iter()
            .filter_map(|item| item.pinyin.as_ref())
            .cloned()
            .collect();

        if chinese_readings.len() < 2 {
            continue;
        }

        // Check if Japanese has multiple readings for this character
        let japanese_entries: Vec<_> = japanese_words.iter()
            .filter(|word| word.kanji.iter().any(|k| k.text == entry.trad))
            .collect();

        if japanese_entries.is_empty() {
            continue;
        }

        let mut japanese_readings = std::collections::HashSet::new();
        for jp_word in &japanese_entries {
            for kana in &jp_word.kana {
                japanese_readings.insert(kana.text.clone());
            }
        }

        if japanese_readings.len() < 2 {
            continue;
        }

        // Analyze complexity for this character
        let complexity = analyze_character_complexity(&entry.trad, entry, &japanese_entries);
        multi_reading_chars.push((entry.trad.clone(), complexity));
    }

    // Sort by complexity score (highest first)
    multi_reading_chars.sort_by(|a, b| b.1.total_score().partial_cmp(&a.1.total_score()).unwrap());

    println!("\n📊 Complexity Tier Analysis Results:");
    println!("  Total multi-reading characters: {}", multi_reading_chars.len());

    // Categorize into tiers
    let mut tier1_bespoke = Vec::new();
    let mut tier2_enhanced = Vec::new();
    let mut tier3_basic = Vec::new();

    for (character, complexity) in &multi_reading_chars {
        let score = complexity.total_score();
        if score >= 6.0 {  // Lowered from 8.0
            tier1_bespoke.push((character, complexity));
        } else if score >= 4.0 {  // Lowered from 5.0
            tier2_enhanced.push((character, complexity));
        } else {
            tier3_basic.push((character, complexity));
        }
    }

    println!("\n🎯 TIER 1: BESPOKE TREATMENT NEEDED ({} characters)", tier1_bespoke.len());
    println!("  High grammatical complexity, POS mismatches, or functional differences");
    for (i, (character, complexity)) in tier1_bespoke.iter().take(20).enumerate() {
        println!("  {}. {} - Score: {:.1} - {}",
            i + 1, character, complexity.total_score(), complexity.primary_issue());
    }

    println!("\n🔧 TIER 2: ENHANCED PROGRAMMATIC ({} characters)", tier2_enhanced.len());
    println!("  Semantic clustering works but needs refinement");
    for (i, (character, complexity)) in tier2_enhanced.iter().take(10).enumerate() {
        println!("  {}. {} - Score: {:.1} - {}",
            i + 1, character, complexity.total_score(), complexity.primary_issue());
    }

    println!("\n⚙️  TIER 3: BASIC PROGRAMMATIC ({} characters)", tier3_basic.len());
    println!("  Clear semantic overlap, similar POS, direct mappings");
    for (i, (character, complexity)) in tier3_basic.iter().take(10).enumerate() {
        println!("  {}. {} - Score: {:.1} - {}",
            i + 1, character, complexity.total_score(), complexity.primary_issue());
    }

    // Detailed analysis for Tier 1 characters
    if !tier1_bespoke.is_empty() {
        println!("\n🔍 DETAILED ANALYSIS FOR TIER 1 CHARACTERS:");
        println!("{}", "=".repeat(60));

        for (i, (character, complexity)) in tier1_bespoke.iter().take(15).enumerate() {
            println!("\n{}. CHARACTER: {} (Score: {:.1})", i + 1, character, complexity.total_score());
            println!("   Primary Issue: {}", complexity.primary_issue());
            println!("   Complexity Factors:");

            if complexity.pos_mismatch_score > 0.0 {
                println!("     • POS Mismatch: {:.1}/4.0 - {}", complexity.pos_mismatch_score, complexity.pos_mismatch_details);
            }
            if complexity.grammatical_function_score > 0.0 {
                println!("     • Grammatical Function: {:.1}/3.0 - {}", complexity.grammatical_function_score, complexity.grammatical_function_details);
            }
            if complexity.semantic_distance_score > 0.0 {
                println!("     • Semantic Distance: {:.1}/2.0 - {}", complexity.semantic_distance_score, complexity.semantic_distance_details);
            }
            if complexity.frequency_mismatch_score > 0.0 {
                println!("     • Frequency Mismatch: {:.1}/1.0 - {}", complexity.frequency_mismatch_score, complexity.frequency_mismatch_details);
            }
            if complexity.reading_complexity_score > 0.0 {
                println!("     • Reading Complexity: {:.1}/1.0 - {}", complexity.reading_complexity_score, complexity.reading_complexity_details);
            }

            println!("   Recommendation: {}", complexity.recommendation());
        }
    }

    // Summary statistics
    println!("\n📈 SUMMARY STATISTICS:");
    println!("  Total characters analyzed: {}", multi_reading_chars.len());
    println!("  Tier 1 (Bespoke): {} ({:.1}%)", tier1_bespoke.len(),
        (tier1_bespoke.len() as f64 / multi_reading_chars.len() as f64) * 100.0);
    println!("  Tier 2 (Enhanced): {} ({:.1}%)", tier2_enhanced.len(),
        (tier2_enhanced.len() as f64 / multi_reading_chars.len() as f64) * 100.0);
    println!("  Tier 3 (Basic): {} ({:.1}%)", tier3_basic.len(),
        (tier3_basic.len() as f64 / multi_reading_chars.len() as f64) * 100.0);

    println!("\n🎯 ACTIONABLE INSIGHTS:");
    println!("  • Focus manual effort on {} Tier 1 characters", tier1_bespoke.len());
    println!("  • Enhance programmatic rules for {} Tier 2 characters", tier2_enhanced.len());
    println!("  • Use standard semantic clustering for {} Tier 3 characters", tier3_basic.len());

    if !tier1_bespoke.is_empty() {
        println!("\n💡 TIER 1 CHARACTER LIST (for ChatGPT bespoke treatment):");
        let tier1_chars: Vec<String> = tier1_bespoke.iter().take(30).map(|(c, _)| c.to_string()).collect();
        println!("  {}", tier1_chars.join(", "));
    }

    Ok(())
}

#[derive(Debug, Clone)]
struct CharacterComplexity {
    // POS mismatch (0-3): particle vs noun, verb vs adjective, etc.
    pos_mismatch_score: f64,
    pos_mismatch_details: String,

    // Grammatical function differences (0-3): functional vs content words
    grammatical_function_score: f64,
    grammatical_function_details: String,

    // Semantic distance (0-2): how different the meanings are
    semantic_distance_score: f64,
    semantic_distance_details: String,

    // Frequency/register mismatch (0-1): formal vs colloquial, etc.
    frequency_mismatch_score: f64,
    frequency_mismatch_details: String,

    // Reading complexity (0-1): number of readings, pronunciation difficulty
    reading_complexity_score: f64,
    reading_complexity_details: String,
}

impl CharacterComplexity {
    fn total_score(&self) -> f64 {
        self.pos_mismatch_score +
        self.grammatical_function_score +
        self.semantic_distance_score +
        self.frequency_mismatch_score +
        self.reading_complexity_score
    }

    fn primary_issue(&self) -> &str {
        let scores = vec![
            (self.pos_mismatch_score, "POS Mismatch"),
            (self.grammatical_function_score, "Grammatical Function"),
            (self.semantic_distance_score, "Semantic Distance"),
            (self.frequency_mismatch_score, "Frequency Mismatch"),
            (self.reading_complexity_score, "Reading Complexity"),
        ];

        scores.iter()
            .max_by(|a, b| a.0.partial_cmp(&b.0).unwrap())
            .map(|(_, issue)| *issue)
            .unwrap_or("Unknown")
    }

    fn recommendation(&self) -> &str {
        let score = self.total_score();
        if score >= 8.0 {
            "BESPOKE: Manual ChatGPT treatment with linguistic expertise"
        } else if score >= 5.0 {
            "ENHANCED: Programmatic with manual review and refinement"
        } else {
            "BASIC: Standard programmatic semantic clustering"
        }
    }
}

fn analyze_character_complexity(character: &str, chinese_entry: &ChineseDictionaryElement, japanese_entries: &[&Word]) -> CharacterComplexity {
    let mut complexity = CharacterComplexity {
        pos_mismatch_score: 0.0,
        pos_mismatch_details: String::new(),
        grammatical_function_score: 0.0,
        grammatical_function_details: String::new(),
        semantic_distance_score: 0.0,
        semantic_distance_details: String::new(),
        frequency_mismatch_score: 0.0,
        frequency_mismatch_details: String::new(),
        reading_complexity_score: 0.0,
        reading_complexity_details: String::new(),
    };

    // Analyze POS mismatches
    analyze_pos_mismatches(character, chinese_entry, japanese_entries, &mut complexity);

    // Analyze grammatical function differences
    analyze_grammatical_functions(character, chinese_entry, japanese_entries, &mut complexity);

    // Analyze semantic distance
    analyze_semantic_distance(character, chinese_entry, japanese_entries, &mut complexity);

    // Analyze frequency/register mismatches
    analyze_frequency_mismatches(character, chinese_entry, japanese_entries, &mut complexity);

    // Analyze reading complexity
    analyze_reading_complexity(character, chinese_entry, japanese_entries, &mut complexity);

    complexity
}

fn analyze_pos_mismatches(_character: &str, chinese_entry: &ChineseDictionaryElement, japanese_entries: &[&Word], complexity: &mut CharacterComplexity) {
    // Extract Chinese definitions to infer POS
    let mut chinese_definitions = Vec::new();
    for item in &chinese_entry.items {
        if let Some(definitions) = &item.definitions {
            chinese_definitions.extend(definitions.iter().cloned());
        }
    }

    // Extract Japanese POS tags
    let mut japanese_pos_tags = std::collections::HashSet::new();
    for jp_word in japanese_entries {
        for sense in &jp_word.sense {
            for pos in &sense.part_of_speech {
                japanese_pos_tags.insert(format!("{:?}", pos));
            }
        }
    }

    // Detect major POS mismatches
    let chinese_text = chinese_definitions.join(" ").to_lowercase();
    let japanese_pos_text = japanese_pos_tags.iter().cloned().collect::<Vec<_>>().join(" ").to_lowercase();

    // High-impact mismatches - be more aggressive in detecting them
    if (chinese_text.contains("particle") || chinese_text.contains("possessive") || chinese_text.contains("'s")) &&
       (japanese_pos_text.contains("noun") || japanese_pos_text.contains("suffix") || japanese_pos_text.contains("adj")) {
        complexity.pos_mismatch_score = 4.0;  // Increased from 3.0
        complexity.pos_mismatch_details = "Chinese particle vs Japanese noun/suffix/adjective".to_string();
    } else if (chinese_text.contains("preposition") || chinese_text.contains("conjunction")) &&
              (japanese_pos_text.contains("noun") || japanese_pos_text.contains("adj")) {
        complexity.pos_mismatch_score = 3.5;  // Increased from 2.5
        complexity.pos_mismatch_details = "Chinese preposition/conjunction vs Japanese noun/adjective".to_string();
    } else if chinese_text.contains("adjectival") && japanese_pos_text.contains("noun") {
        complexity.pos_mismatch_score = 3.0;
        complexity.pos_mismatch_details = "Chinese adjectival vs Japanese noun".to_string();
    } else if chinese_text.contains("verb") && japanese_pos_text.contains("adjective") {
        complexity.pos_mismatch_score = 2.5;  // Increased from 1.5
        complexity.pos_mismatch_details = "Chinese verb vs Japanese adjective".to_string();
    }

    // Special cases for known problematic characters
    match _character {
        "的" => {
            complexity.pos_mismatch_score = 4.5;
            complexity.pos_mismatch_details = "的: Chinese particle vs Japanese suffix/noun - classic example".to_string();
        },
        "和" => {
            complexity.pos_mismatch_score = 3.5;
            complexity.pos_mismatch_details = "和: Chinese conjunction vs Japanese noun/prefix".to_string();
        },
        "所" => {
            complexity.pos_mismatch_score = 4.0;
            complexity.pos_mismatch_details = "所: Chinese particle vs Japanese noun".to_string();
        },
        "為" | "为" => {
            complexity.pos_mismatch_score = 3.5;
            complexity.pos_mismatch_details = "為: Chinese preposition vs Japanese verb".to_string();
        },
        _ => {}
    }
}

fn analyze_grammatical_functions(_character: &str, chinese_entry: &ChineseDictionaryElement, japanese_entries: &[&Word], complexity: &mut CharacterComplexity) {
    // Extract Chinese definitions
    let mut chinese_definitions = Vec::new();
    for item in &chinese_entry.items {
        if let Some(definitions) = &item.definitions {
            chinese_definitions.extend(definitions.iter().cloned());
        }
    }

    let chinese_text = chinese_definitions.join(" ").to_lowercase();

    // Check for grammatical function words
    let grammatical_keywords = vec![
        "particle", "possessive", "attributive", "nominalizer", "modal",
        "auxiliary", "conjunction", "preposition", "suffix", "prefix"
    ];

    let chinese_is_grammatical = grammatical_keywords.iter().any(|&keyword| chinese_text.contains(keyword));

    // Check Japanese for grammatical functions
    let mut japanese_is_grammatical = false;
    for jp_word in japanese_entries {
        for sense in &jp_word.sense {
            for pos in &sense.part_of_speech {
                match pos {
                    crate::japanese_types::PartOfSpeech::Aux |
                    crate::japanese_types::PartOfSpeech::AuxV |
                    crate::japanese_types::PartOfSpeech::AuxAdj |
                    crate::japanese_types::PartOfSpeech::Conj |
                    crate::japanese_types::PartOfSpeech::Prt => {
                        japanese_is_grammatical = true;
                        break;
                    }
                    _ => {}
                }
            }
        }
    }

    // Score based on grammatical function mismatch
    if chinese_is_grammatical && !japanese_is_grammatical {
        complexity.grammatical_function_score = 3.0;
        complexity.grammatical_function_details = "Chinese grammatical function vs Japanese content word".to_string();
    } else if !chinese_is_grammatical && japanese_is_grammatical {
        complexity.grammatical_function_score = 2.5;
        complexity.grammatical_function_details = "Chinese content word vs Japanese grammatical function".to_string();
    }
}

fn analyze_semantic_distance(_character: &str, chinese_entry: &ChineseDictionaryElement, japanese_entries: &[&Word], complexity: &mut CharacterComplexity) {
    // Extract Chinese definitions
    let mut chinese_definitions = Vec::new();
    for item in &chinese_entry.items {
        if let Some(definitions) = &item.definitions {
            chinese_definitions.extend(definitions.iter().cloned());
        }
    }

    // Extract Japanese definitions
    let mut japanese_definitions = Vec::new();
    for jp_word in japanese_entries {
        for sense in &jp_word.sense {
            for gloss in &sense.gloss {
                japanese_definitions.push(gloss.text.clone());
            }
        }
    }

    // Calculate semantic overlap
    let chinese_text = chinese_definitions.join(" ").to_lowercase();
    let japanese_text = japanese_definitions.join(" ").to_lowercase();

    // Check for semantic overlap
    let chinese_words: Vec<&str> = chinese_text.split_whitespace().collect();
    let japanese_words: Vec<&str> = japanese_text.split_whitespace().collect();

    let mut overlap_count = 0;
    let mut total_comparisons = 0;

    for c_word in &chinese_words {
        for j_word in &japanese_words {
            total_comparisons += 1;
            if c_word == j_word || c_word.contains(j_word) || j_word.contains(c_word) {
                overlap_count += 1;
            }
        }
    }

    let overlap_ratio = if total_comparisons > 0 {
        overlap_count as f64 / total_comparisons as f64
    } else {
        0.0
    };

    // Score based on semantic distance
    if overlap_ratio < 0.1 {
        complexity.semantic_distance_score = 2.0;
        complexity.semantic_distance_details = "Very low semantic overlap".to_string();
    } else if overlap_ratio < 0.3 {
        complexity.semantic_distance_score = 1.5;
        complexity.semantic_distance_details = "Low semantic overlap".to_string();
    } else if overlap_ratio < 0.5 {
        complexity.semantic_distance_score = 1.0;
        complexity.semantic_distance_details = "Moderate semantic overlap".to_string();
    }
}

fn analyze_frequency_mismatches(_character: &str, chinese_entry: &ChineseDictionaryElement, _japanese_entries: &[&Word], complexity: &mut CharacterComplexity) {
    // Check for frequency/register indicators in Chinese definitions
    let mut chinese_definitions = Vec::new();
    for item in &chinese_entry.items {
        if let Some(definitions) = &item.definitions {
            chinese_definitions.extend(definitions.iter().cloned());
        }
    }

    let chinese_text = chinese_definitions.join(" ").to_lowercase();

    // Check for register mismatches
    if chinese_text.contains("literary") || chinese_text.contains("classical") || chinese_text.contains("archaic") {
        complexity.frequency_mismatch_score = 1.0;
        complexity.frequency_mismatch_details = "Chinese literary vs Japanese common usage".to_string();
    } else if chinese_text.contains("colloquial") || chinese_text.contains("slang") {
        complexity.frequency_mismatch_score = 0.5;
        complexity.frequency_mismatch_details = "Register mismatch detected".to_string();
    }
}

fn analyze_reading_complexity(_character: &str, chinese_entry: &ChineseDictionaryElement, japanese_entries: &[&Word], complexity: &mut CharacterComplexity) {
    // Count Chinese readings
    let chinese_readings: std::collections::HashSet<String> = chinese_entry.items.iter()
        .filter_map(|item| item.pinyin.as_ref())
        .cloned()
        .collect();

    // Count Japanese readings
    let mut japanese_readings = std::collections::HashSet::new();
    for jp_word in japanese_entries {
        for kana in &jp_word.kana {
            japanese_readings.insert(kana.text.clone());
        }
    }

    let total_readings = chinese_readings.len() + japanese_readings.len();

    // Score based on reading complexity
    if total_readings >= 8 {
        complexity.reading_complexity_score = 1.0;
        complexity.reading_complexity_details = format!("Very high reading complexity: {} total readings", total_readings);
    } else if total_readings >= 6 {
        complexity.reading_complexity_score = 0.7;
        complexity.reading_complexity_details = format!("High reading complexity: {} total readings", total_readings);
    } else if total_readings >= 4 {
        complexity.reading_complexity_score = 0.3;
        complexity.reading_complexity_details = format!("Moderate reading complexity: {} total readings", total_readings);
    }
}
