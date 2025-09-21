use anyhow::Result;
use crate::combined_types::CombinedDictionary;
use crate::japanese_types::Word;

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

    if let Some((top_word, top_kanji, top_kana, top_total)) = candidates.first() {
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
