use crate::improved_unified_types::*;
use crate::combined_types::CombinedEntry;
use chrono::Utc;

/// Convert a CombinedEntry to an ImprovedUnifiedEntry that preserves entry distinctions
pub fn convert_to_improved_unified(combined: &CombinedEntry) -> ImprovedUnifiedEntry {
    let unified_data = create_unified_data(combined);
    let chinese_specific_entries = create_chinese_specific_entries(combined);
    let japanese_specific_entries = create_japanese_specific_entries(combined);
    let metadata = create_unified_metadata(combined);

    ImprovedUnifiedEntry {
        word: combined.word.clone(),
        unified: unified_data,
        chinese_specific_entries,
        japanese_specific_entries,
        metadata,
    }
}

fn create_unified_data(combined: &CombinedEntry) -> UnifiedData {
    // Only use the PRIMARY Chinese and Japanese entries for unified data
    let representations = extract_primary_representations(combined);
    let pronunciations = extract_primary_pronunciations(combined);
    let chinese_metadata = combined.chinese_entry.as_ref().map(|c| ChineseMetadata {
        gloss: c.gloss.clone().unwrap_or_default(),
        pinyin_search_string: c.pinyin_search_string.clone(),
    });
    let definitions = extract_primary_definitions(combined);
    let linguistic_info = extract_primary_linguistic_info(combined);
    let statistics = extract_primary_statistics(combined);
    let examples = extract_primary_examples(combined);

    UnifiedData {
        representations,
        pronunciations,
        chinese_metadata,
        definitions,
        linguistic_info,
        statistics,
        examples,
    }
}

fn extract_primary_representations(combined: &CombinedEntry) -> CharacterRepresentations {
    let traditional = combined.chinese_entry.as_ref()
        .map(|c| c.trad.clone())
        .unwrap_or_else(|| combined.word.clone());
    
    let simplified = combined.chinese_entry.as_ref()
        .map(|c| c.simp.clone())
        .unwrap_or_else(|| combined.word.clone());

    let mut japanese_kanji = Vec::new();
    let mut japanese_kana = Vec::new();

    // Only extract from PRIMARY Japanese entry
    if let Some(japanese_entry) = &combined.japanese_entry {
        for kanji in &japanese_entry.kanji {
            japanese_kanji.push(KanjiVariant {
                text: kanji.text.clone(),
                common: kanji.common,
                tags: kanji.tags.iter().map(|t| format!("{:?}", t)).collect(),
            });
        }

        for kana in &japanese_entry.kana {
            japanese_kana.push(KanaVariant {
                text: kana.text.clone(),
                common: kana.common,
                tags: kana.tags.iter().map(|t| format!("{:?}", t)).collect(),
                applies_to_kanji: kana.applies_to_kanji.clone().unwrap_or_else(|| vec!["*".to_string()]),
            });
        }
    }

    CharacterRepresentations {
        traditional,
        simplified,
        japanese_kanji,
        japanese_kana,
    }
}

fn extract_primary_pronunciations(combined: &CombinedEntry) -> Pronunciations {
    let mut pinyin = Vec::new();
    let mut japanese = Vec::new();

    // Extract Chinese pinyin from primary entry
    if let Some(chinese_entry) = &combined.chinese_entry {
        for item in &chinese_entry.items {
            if let Some(pinyin_str) = &item.pinyin {
                pinyin.push(PinyinReading {
                    reading: pinyin_str.clone(),
                    source: item.source.as_ref().map(|s| format!("{:?}", s)).unwrap_or_default(),
                });
            }
        }
    }

    // Extract Japanese readings from PRIMARY entry only
    if let Some(japanese_entry) = &combined.japanese_entry {
        for kana in &japanese_entry.kana {
            japanese.push(JapaneseReading {
                reading: kana.text.clone(),
                reading_type: classify_reading(&kana.text),
                common: kana.common,
            });
        }
    }

    Pronunciations { pinyin, japanese }
}

fn extract_primary_definitions(combined: &CombinedEntry) -> Vec<UnifiedDefinition> {
    let mut chinese = Vec::new();
    let mut japanese = Vec::new();

    // Extract Chinese definitions from primary entry
    if let Some(chinese_entry) = &combined.chinese_entry {
        for item in &chinese_entry.items {
            if let Some(definitions) = &item.definitions {
                for definition in definitions {
                    chinese.push(ChineseDefinition {
                        text: definition.clone(),
                        source: item.source.as_ref().map(|s| format!("{:?}", s)).unwrap_or_default(),
                        context: None,
                        pinyin: item.pinyin.clone(),
                        simp_trad: item.simp_trad.as_ref().map(|st| format!("{:?}", st)),
                        tang: item.tang.clone(),
                    });
                }
            }
        }
    }

    // Extract Japanese definitions from PRIMARY entry only
    if let Some(japanese_entry) = &combined.japanese_entry {
        for (sense_index, sense) in japanese_entry.sense.iter().enumerate() {
            for gloss in &sense.gloss {
                japanese.push(JapaneseDefinition {
                    text: gloss.text.clone(),
                    part_of_speech: sense.part_of_speech.iter().map(|p| format!("{:?}", p)).collect(),
                    field: sense.field.iter().map(|f| format!("{:?}", f)).collect(),
                    misc: sense.misc.iter().map(|m| format!("{:?}", m)).collect(),
                    info: sense.info.clone(),
                    applies_to_kanji: sense.applies_to_kanji.clone(),
                    applies_to_kana: sense.applies_to_kana.clone(),
                    dialect: sense.dialect.iter().map(|d| format!("{:?}", d)).collect(),
                    language_source: sense.language_source.iter().map(|ls| LanguageSource {
                        lang: format!("{:?}", ls.lang),
                        full: Some(ls.full),
                        wasei: Some(ls.wasei),
                        text: ls.text.clone(),
                    }).collect(),
                    gender: gloss.gender.clone(),
                    gloss_type: gloss.gloss_type.as_ref().map(|gt| format!("{:?}", gt)),
                    source_entry_id: Some(japanese_entry.id.clone()),
                    sense_group_index: Some(sense_index),
                });
            }
        }
    }

    // Create ONLY unified definitions from primary Chinese and Japanese entries
    create_unified_definitions(&chinese, &japanese)
}

fn extract_primary_linguistic_info(combined: &CombinedEntry) -> LinguisticInfo {
    let mut parts_of_speech = Vec::new();
    let mut fields = Vec::new();
    let mut usage_notes = Vec::new();
    let mut related_words = Vec::new();
    let mut antonyms = Vec::new();

    // Extract from PRIMARY Japanese entry only
    if let Some(japanese) = &combined.japanese_entry {
        for sense in &japanese.sense {
            parts_of_speech.extend(sense.part_of_speech.iter().map(|p| format!("{:?}", p)));
            fields.extend(sense.field.iter().map(|f| format!("{:?}", f)));
            usage_notes.extend(sense.info.clone());
            related_words.extend(sense.related.iter().flatten().map(|r| format!("{:?}", r)));
            antonyms.extend(sense.antonym.iter().flatten().map(|a| format!("{:?}", a)));
        }
    }

    // Remove duplicates
    parts_of_speech.sort();
    parts_of_speech.dedup();
    fields.sort();
    fields.dedup();
    usage_notes.sort();
    usage_notes.dedup();
    related_words.sort();
    related_words.dedup();
    antonyms.sort();
    antonyms.dedup();

    LinguisticInfo {
        parts_of_speech,
        fields,
        usage_notes,
        related_words,
        antonyms,
    }
}

fn extract_primary_statistics(combined: &CombinedEntry) -> UnifiedStatistics {
    let chinese = combined.chinese_entry.as_ref().map(|c| ChineseStats {
        hsk_level: c.statistics.as_ref().map(|s| s.hsk_level as u8),
        movie_word_count: c.statistics.as_ref().and_then(|s| s.movie_word_count.map(|v| v as u32)),
        movie_word_count_percent: c.statistics.as_ref().and_then(|s| s.movie_word_count_percent),
        movie_word_rank: c.statistics.as_ref().and_then(|s| s.movie_word_rank.map(|v| v as u32)),
        movie_word_contexts: c.statistics.as_ref().and_then(|s| s.movie_word_contexts.map(|v| v as u32)),
        movie_word_contexts_percent: c.statistics.as_ref().and_then(|s| s.movie_word_contexts_percent),
        book_word_count: c.statistics.as_ref().and_then(|s| s.book_word_count.map(|v| v as u32)),
        book_word_count_percent: c.statistics.as_ref().and_then(|s| s.book_word_count_percent),
        book_word_rank: c.statistics.as_ref().and_then(|s| s.book_word_rank.map(|v| v as u32)),
        movie_char_count: c.statistics.as_ref().and_then(|s| s.movie_char_count.map(|v| v as u32)),
        movie_char_count_percent: c.statistics.as_ref().and_then(|s| s.movie_char_count_percent),
        movie_char_rank: c.statistics.as_ref().and_then(|s| s.movie_char_rank.map(|v| v as u32)),
        movie_char_contexts: c.statistics.as_ref().and_then(|s| s.movie_char_contexts.map(|v| v as u32)),
        movie_char_contexts_percent: c.statistics.as_ref().and_then(|s| s.movie_char_contexts_percent),
        book_char_count: c.statistics.as_ref().and_then(|s| s.book_char_count.map(|v| v as u32)),
        book_char_count_percent: c.statistics.as_ref().and_then(|s| s.book_char_count_percent),
        book_char_rank: c.statistics.as_ref().and_then(|s| s.book_char_rank.map(|v| v as u32)),
        pinyin_frequency: None, // This field is i64 in source but should be HashMap<String, u32>
        top_words: c.statistics.as_ref().and_then(|s| s.top_words.as_ref().map(|tw| 
            tw.iter().map(|w| TopWord {
                word: w.word.clone(),
                share: w.share,
                trad: w.trad.clone(),
                gloss: w.gloss.clone(),
            }).collect()
        )),
    });

    let japanese = combined.japanese_entry.as_ref().map(|_| JapaneseStats {
        common: combined.japanese_entry.as_ref()
            .map(|j| j.kanji.iter().any(|k| k.common) || j.kana.iter().any(|k| k.common))
            .unwrap_or(false),
        jlpt_level: None, // We don't have this data
    });

    let combined_frequency_score = calculate_combined_frequency_score(&chinese, &japanese);

    UnifiedStatistics {
        chinese,
        japanese,
        combined_frequency_score: combined_frequency_score,
    }
}

fn extract_primary_examples(combined: &CombinedEntry) -> Vec<Example> {
    let mut examples = Vec::new();

    // Extract Japanese examples from PRIMARY entry only
    if let Some(japanese) = &combined.japanese_entry {
        for sense in &japanese.sense {
            for example in &sense.examples {
                for sentence in &example.sentences {
                    if format!("{:?}", sentence.land) == "Jpn" {
                        examples.push(Example {
                            source_language: "japanese".to_string(),
                            text: sentence.text.clone(),
                            translation: example.sentences.iter()
                                .find(|s| format!("{:?}", s.land) == "Eng")
                                .map(|s| s.text.clone())
                                .unwrap_or_default(),
                            source: ExampleSource {
                                source_type: format!("{:?}", example.source.source_type),
                                id: example.source.value.clone(),
                            },
                            source_entry_id: japanese.id.clone(),
                        });
                    }
                }
            }
        }
    }

    examples
}

fn create_chinese_specific_entries(_combined: &CombinedEntry) -> Vec<ChineseSpecificEntry> {
    // For now, return empty - we only have one Chinese entry per word
    // This would be populated if we had multiple Chinese entries for the same word
    Vec::new()
}

fn create_japanese_specific_entries(combined: &CombinedEntry) -> Vec<JapaneseSpecificEntry> {
    let mut specific_entries = Vec::new();

    // Add all ADDITIONAL Japanese entries (beyond the first one)
    for japanese_entry in &combined.japanese_specific_entries {
        let mut kanji = Vec::new();
        for k in &japanese_entry.kanji {
            kanji.push(KanjiVariant {
                text: k.text.clone(),
                common: k.common,
                tags: k.tags.iter().map(|t| format!("{:?}", t)).collect(),
            });
        }

        let mut kana = Vec::new();
        for k in &japanese_entry.kana {
            kana.push(KanaVariant {
                text: k.text.clone(),
                common: k.common,
                tags: k.tags.iter().map(|t| format!("{:?}", t)).collect(),
                applies_to_kanji: k.applies_to_kanji.clone().unwrap_or_else(|| vec!["*".to_string()]),
            });
        }

        let mut definitions = Vec::new();
        for (sense_index, sense) in japanese_entry.sense.iter().enumerate() {
            for gloss in &sense.gloss {
                definitions.push(UnifiedDefinition {
                    text: gloss.text.clone(),
                    source_language: "japanese".to_string(),
                    confidence: Some(0.7),
                    source_entry_ids: vec![japanese_entry.id.clone()],
                    chinese_fields: None,
                    japanese_fields: Some(JapaneseDefinitionFields {
                        part_of_speech: sense.part_of_speech.iter().map(|p| format!("{:?}", p)).collect(),
                        field: sense.field.iter().map(|f| format!("{:?}", f)).collect(),
                        misc: sense.misc.iter().map(|m| format!("{:?}", m)).collect(),
                        info: sense.info.clone(),
                        applies_to_kanji: sense.applies_to_kanji.clone(),
                        applies_to_kana: sense.applies_to_kana.clone(),
                        dialect: sense.dialect.iter().map(|d| format!("{:?}", d)).collect(),
                        language_source: sense.language_source.iter().map(|ls| LanguageSource {
                            lang: format!("{:?}", ls.lang),
                            full: Some(ls.full),
                            wasei: Some(ls.wasei),
                            text: ls.text.clone(),
                        }).collect(),
                        gender: gloss.gender.clone(),
                        gloss_type: gloss.gloss_type.as_ref().map(|gt| format!("{:?}", gt)),
                        sense_group_index: Some(sense_index),
                    }),
                });
            }
        }

        let mut examples = Vec::new();
        for sense in &japanese_entry.sense {
            for example in &sense.examples {
                for sentence in &example.sentences {
                    if format!("{:?}", sentence.land) == "Jpn" {
                        examples.push(Example {
                            source_language: "japanese".to_string(),
                            text: sentence.text.clone(),
                            translation: example.sentences.iter()
                                .find(|s| format!("{:?}", s.land) == "Eng")
                                .map(|s| s.text.clone())
                                .unwrap_or_default(),
                            source: ExampleSource {
                                source_type: format!("{:?}", example.source.source_type),
                                id: example.source.value.clone(),
                            },
                            source_entry_id: japanese_entry.id.clone(),
                        });
                    }
                }
            }
        }

        let linguistic_info = extract_linguistic_info_from_entry(japanese_entry);

        specific_entries.push(JapaneseSpecificEntry {
            source_id: japanese_entry.id.clone(),
            kanji,
            kana,
            definitions,
            examples,
            linguistic_info,
        });
    }

    specific_entries
}

// Helper functions
fn classify_reading(text: &str) -> ReadingType {
    if text.chars().all(|c| matches!(c, 'あ'..='ん' | 'ー')) {
        ReadingType::Hiragana
    } else if text.chars().all(|c| matches!(c, 'ア'..='ン' | 'ー')) {
        ReadingType::Katakana
    } else {
        ReadingType::Mixed
    }
}

fn calculate_combined_frequency_score(chinese: &Option<ChineseStats>, japanese: &Option<JapaneseStats>) -> f32 {
    let mut score = 0.0;
    
    if let Some(c) = chinese {
        if let Some(hsk) = c.hsk_level {
            score += match hsk {
                1 => 100.0,
                2 => 80.0,
                3 => 60.0,
                4 => 40.0,
                5 => 20.0,
                6 => 10.0,
                _ => 5.0,
            };
        }
        
        if let Some(rank) = c.book_word_rank {
            score += (10000.0 / (rank as f32 + 1.0)).min(50.0);
        }
    }
    
    if let Some(j) = japanese {
        if j.common {
            score += 20.0;
        }
    }
    
    score
}

fn extract_linguistic_info_from_entry(japanese_entry: &crate::japanese_types::Word) -> LinguisticInfo {
    let mut parts_of_speech = Vec::new();
    let mut fields = Vec::new();
    let mut usage_notes = Vec::new();
    let mut related_words = Vec::new();
    let mut antonyms = Vec::new();

    for sense in &japanese_entry.sense {
        parts_of_speech.extend(sense.part_of_speech.iter().map(|p| format!("{:?}", p)));
        fields.extend(sense.field.iter().map(|f| format!("{:?}", f)));
        usage_notes.extend(sense.info.clone());
        related_words.extend(sense.related.iter().flatten().map(|r| format!("{:?}", r)));
        antonyms.extend(sense.antonym.iter().flatten().map(|a| format!("{:?}", a)));
    }

    // Remove duplicates
    parts_of_speech.sort();
    parts_of_speech.dedup();
    fields.sort();
    fields.dedup();
    usage_notes.sort();
    usage_notes.dedup();
    related_words.sort();
    related_words.dedup();
    antonyms.sort();
    antonyms.dedup();

    LinguisticInfo {
        parts_of_speech,
        fields,
        usage_notes,
        related_words,
        antonyms,
    }
}

fn create_unified_metadata(combined: &CombinedEntry) -> UnifiedMetadata {
    UnifiedMetadata {
        created_at: Utc::now().format("%Y-%m-%d %H:%M:%S%.6f UTC").to_string(),
        merger_version: "3.0-improved-unified".to_string(),
        chinese_source_id: combined.chinese_entry.as_ref().map(|c| c.id.clone()),
        japanese_source_ids: {
            let mut ids = Vec::new();
            if let Some(j) = &combined.japanese_entry {
                ids.push(j.id.clone());
            }
            for j in &combined.japanese_specific_entries {
                ids.push(j.id.clone());
            }
            ids
        },
        unification_confidence: calculate_unification_confidence(combined),
        has_multiple_japanese_entries: !combined.japanese_specific_entries.is_empty(),
    }
}

fn create_unified_definitions(
    chinese: &[ChineseDefinition],
    japanese: &[JapaneseDefinition]
) -> Vec<UnifiedDefinition> {
    let mut unified = Vec::new();

    // Simple deduplication strategy: merge definitions with exact text matches
    let mut processed_chinese = vec![false; chinese.len()];
    let mut processed_japanese = vec![false; japanese.len()];

    // Find exact matches between Chinese and Japanese definitions
    for (c_idx, c_def) in chinese.iter().enumerate() {
        if processed_chinese[c_idx] {
            continue;
        }

        for (j_idx, j_def) in japanese.iter().enumerate() {
            if processed_japanese[j_idx] {
                continue;
            }

            // Check for exact text match (case-insensitive)
            if c_def.text.to_lowercase() == j_def.text.to_lowercase() {
                // Create unified definition
                let unified_def = UnifiedDefinition {
                    text: c_def.text.clone(),
                    source_language: "unified".to_string(),
                    confidence: Some(0.9), // High confidence for exact matches
                    source_entry_ids: vec![
                        format!("chinese:{}", c_def.source),
                        j_def.source_entry_id.clone().unwrap_or_default(),
                    ],
                    chinese_fields: Some(ChineseDefinitionFields {
                        source: c_def.source.clone(),
                        context: c_def.context.clone(),
                        pinyin: c_def.pinyin.clone(),
                        simp_trad: c_def.simp_trad.clone(),
                        tang: c_def.tang.clone(),
                    }),
                    japanese_fields: Some(JapaneseDefinitionFields {
                        part_of_speech: j_def.part_of_speech.clone(),
                        field: j_def.field.clone(),
                        misc: j_def.misc.clone(),
                        info: j_def.info.clone(),
                        applies_to_kanji: j_def.applies_to_kanji.clone(),
                        applies_to_kana: j_def.applies_to_kana.clone(),
                        dialect: j_def.dialect.clone(),
                        language_source: j_def.language_source.iter().map(|ls| LanguageSource {
                            lang: ls.lang.clone(),
                            full: ls.full,
                            wasei: ls.wasei,
                            text: ls.text.clone(),
                        }).collect(),
                        gender: j_def.gender.clone(),
                        gloss_type: j_def.gloss_type.clone(),
                        sense_group_index: j_def.sense_group_index,
                    }),
                };

                unified.push(unified_def);
                processed_chinese[c_idx] = true;
                processed_japanese[j_idx] = true;
                break;
            }
        }
    }

    // Add remaining Chinese definitions as Chinese-only unified definitions
    for (c_idx, c_def) in chinese.iter().enumerate() {
        if !processed_chinese[c_idx] {
            let unified_def = UnifiedDefinition {
                text: c_def.text.clone(),
                source_language: "chinese".to_string(),
                confidence: Some(0.7), // Medium confidence for single-source
                source_entry_ids: vec![format!("chinese:{}", c_def.source)],
                chinese_fields: Some(ChineseDefinitionFields {
                    source: c_def.source.clone(),
                    context: c_def.context.clone(),
                    pinyin: c_def.pinyin.clone(),
                    simp_trad: c_def.simp_trad.clone(),
                    tang: c_def.tang.clone(),
                }),
                japanese_fields: None,
            };
            unified.push(unified_def);
        }
    }

    // Add remaining Japanese definitions as Japanese-only unified definitions
    for (j_idx, j_def) in japanese.iter().enumerate() {
        if !processed_japanese[j_idx] {
            let unified_def = UnifiedDefinition {
                text: j_def.text.clone(),
                source_language: "japanese".to_string(),
                confidence: Some(0.7), // Medium confidence for single-source
                source_entry_ids: vec![j_def.source_entry_id.clone().unwrap_or_default()],
                chinese_fields: None,
                japanese_fields: Some(JapaneseDefinitionFields {
                    part_of_speech: j_def.part_of_speech.clone(),
                    field: j_def.field.clone(),
                    misc: j_def.misc.clone(),
                    info: j_def.info.clone(),
                    applies_to_kanji: j_def.applies_to_kanji.clone(),
                    applies_to_kana: j_def.applies_to_kana.clone(),
                    dialect: j_def.dialect.clone(),
                    language_source: j_def.language_source.iter().map(|ls| LanguageSource {
                        lang: ls.lang.clone(),
                        full: ls.full,
                        wasei: ls.wasei,
                        text: ls.text.clone(),
                    }).collect(),
                    gender: j_def.gender.clone(),
                    gloss_type: j_def.gloss_type.clone(),
                    sense_group_index: j_def.sense_group_index,
                }),
            };
            unified.push(unified_def);
        }
    }

    unified
}

fn calculate_unification_confidence(combined: &CombinedEntry) -> f32 {
    let mut confidence: f32 = 0.5; // Base confidence

    // Higher confidence if we have both Chinese and Japanese data
    if combined.chinese_entry.is_some() && combined.japanese_entry.is_some() {
        confidence += 0.5;
    }

    // Bonus for exact character matches
    if let (Some(chinese), Some(japanese)) = (&combined.chinese_entry, &combined.japanese_entry) {
        for kanji in &japanese.kanji {
            if kanji.text == chinese.trad || kanji.text == chinese.simp {
                confidence += 0.1;
            }
        }
    }

    confidence.min(1.0)
}
