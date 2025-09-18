use crate::combined_types::CombinedEntry;
use crate::unified_types::*;
use crate::chinese_types::ChineseDictionaryElement;
use crate::japanese_types::Word;

/// Convert a CombinedEntry to a UnifiedEntry
pub fn unify_entry(combined: &CombinedEntry) -> UnifiedEntry {
    let representations = extract_representations(combined);
    let pronunciations = extract_pronunciations(combined);
    let definitions = extract_definitions(combined);
    let linguistic_info = extract_linguistic_info(combined);
    let statistics = extract_statistics(combined);
    let examples = extract_examples(combined);
    let metadata = create_unified_metadata(combined);
    let chinese_metadata = extract_chinese_metadata(combined);

    UnifiedEntry {
        word: combined.word.clone(),
        representations,
        pronunciations,
        chinese_metadata,
        definitions,
        linguistic_info,
        statistics,
        examples,
        metadata,
    }
}

fn extract_representations(combined: &CombinedEntry) -> CharacterRepresentations {
    let (traditional, simplified) = if let Some(chinese) = &combined.chinese_entry {
        (chinese.trad.clone(), chinese.simp.clone())
    } else {
        // If no Chinese entry, use the word as traditional (it should be traditional Chinese)
        (combined.word.clone(), String::new())
    };

    let mut japanese_kanji = Vec::new();
    let mut japanese_kana = Vec::new();

    // Extract from main Japanese entry
    if let Some(japanese) = &combined.japanese_entry {
        for kanji in &japanese.kanji {
            japanese_kanji.push(KanjiVariant {
                text: kanji.text.clone(),
                common: kanji.common,
                tags: kanji.tags.iter().map(|t| format!("{:?}", t)).collect(),
            });
        }

        for kana in &japanese.kana {
            japanese_kana.push(KanaVariant {
                text: kana.text.clone(),
                common: kana.common,
                tags: kana.tags.iter().map(|t| format!("{:?}", t)).collect(),
                applies_to_kanji: kana.applies_to_kanji.clone().unwrap_or_default(),
            });
        }
    }

    // Extract from additional Japanese entries
    for japanese in &combined.japanese_specific_entries {
        for kanji in &japanese.kanji {
            japanese_kanji.push(KanjiVariant {
                text: kanji.text.clone(),
                common: kanji.common,
                tags: kanji.tags.iter().map(|t| format!("{:?}", t)).collect(),
            });
        }

        for kana in &japanese.kana {
            japanese_kana.push(KanaVariant {
                text: kana.text.clone(),
                common: kana.common,
                tags: kana.tags.iter().map(|t| format!("{:?}", t)).collect(),
                applies_to_kanji: kana.applies_to_kanji.clone().unwrap_or_default(),
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

fn extract_pronunciations(combined: &CombinedEntry) -> Pronunciations {
    let mut pinyin = Vec::new();
    let mut japanese = Vec::new();

    // Extract Chinese pinyin
    if let Some(chinese) = &combined.chinese_entry {
        for item in &chinese.items {
            if let Some(pinyin_str) = &item.pinyin {
                pinyin.push(PinyinReading {
                    reading: pinyin_str.clone(),
                    source: item.source.as_ref().map(|s| format!("{:?}", s)).unwrap_or_default(),
                });
            }
        }
    }

    // Extract Japanese readings
    if let Some(japanese_entry) = &combined.japanese_entry {
        for kana in &japanese_entry.kana {
            japanese.push(JapaneseReading {
                reading: kana.text.clone(),
                reading_type: classify_reading(&kana.text),
                common: kana.common,
            });
        }
    }

    // Extract from additional Japanese entries
    for japanese_entry in &combined.japanese_specific_entries {
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

fn classify_reading(text: &str) -> ReadingType {
    let has_hiragana = text.chars().any(|c| (c >= 'あ' && c <= 'ん'));
    let has_katakana = text.chars().any(|c| (c >= 'ア' && c <= 'ン'));
    
    match (has_hiragana, has_katakana) {
        (true, false) => ReadingType::Hiragana,
        (false, true) => ReadingType::Katakana,
        _ => ReadingType::Mixed,
    }
}

fn extract_definitions(combined: &CombinedEntry) -> Definitions {
    let mut chinese = Vec::new();
    let mut japanese = Vec::new();

    // Extract Chinese definitions
    if let Some(chinese_entry) = &combined.chinese_entry {
        for item in &chinese_entry.items {
            if let Some(definitions) = &item.definitions {
                for definition in definitions {
                    chinese.push(ChineseDefinition {
                        text: definition.clone(),
                        source: item.source.as_ref().map(|s| format!("{:?}", s)).unwrap_or_default(),
                        context: None, // Could extract measure words from definitions
                        pinyin: item.pinyin.clone(),
                        simp_trad: item.simp_trad.as_ref().map(|st| format!("{:?}", st)),
                        tang: item.tang.clone(),
                    });
                }
            }
        }
    }

    // Extract Japanese definitions
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

    // Extract from additional Japanese entries
    for japanese_entry in &combined.japanese_specific_entries {
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

    Definitions {
        chinese,
        japanese,
        unified: None, // Will be populated by deduplication engine
    }
}

fn extract_linguistic_info(combined: &CombinedEntry) -> LinguisticInfo {
    let mut parts_of_speech = Vec::new();
    let mut fields = Vec::new();
    let mut usage_notes = Vec::new();
    let mut related_words = Vec::new();
    let mut antonyms = Vec::new();

    // Collect from main Japanese entry
    if let Some(japanese) = &combined.japanese_entry {
        for sense in &japanese.sense {
            parts_of_speech.extend(sense.part_of_speech.iter().map(|p| format!("{:?}", p)));
            fields.extend(sense.field.iter().map(|f| format!("{:?}", f)));
            usage_notes.extend(sense.info.clone());
            related_words.extend(sense.related.iter().flatten().map(|r| format!("{:?}", r)));
            antonyms.extend(sense.antonym.iter().flatten().map(|a| format!("{:?}", a)));
        }
    }

    // Collect from additional Japanese entries
    for japanese in &combined.japanese_specific_entries {
        for sense in &japanese.sense {
            parts_of_speech.extend(sense.part_of_speech.iter().map(|p| format!("{:?}", p)));
            fields.extend(sense.field.iter().map(|f| format!("{:?}", f)));
            usage_notes.extend(sense.info.clone());
            related_words.extend(sense.related.iter().flatten().map(|r| format!("{:?}", r)));
            antonyms.extend(sense.antonym.iter().flatten().map(|a| format!("{:?}", a)));
        }
    }

    // Deduplicate
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

fn extract_statistics(combined: &CombinedEntry) -> UnifiedStatistics {
    let chinese = combined.chinese_entry.as_ref().map(|c| ChineseStats {
        hsk_level: c.statistics.as_ref().map(|s| s.hsk_level as i32),
        movie_word_count: c.statistics.as_ref().and_then(|s| s.movie_word_count.map(|v| v as i32)),
        movie_word_count_percent: c.statistics.as_ref().and_then(|s| s.movie_word_count_percent),
        movie_word_rank: c.statistics.as_ref().and_then(|s| s.movie_word_rank.map(|v| v as i32)),
        movie_word_contexts: c.statistics.as_ref().and_then(|s| s.movie_word_contexts.map(|v| v as i32)),
        movie_word_contexts_percent: c.statistics.as_ref().and_then(|s| s.movie_word_contexts_percent),
        book_word_count: c.statistics.as_ref().and_then(|s| s.book_word_count.map(|v| v as i32)),
        book_word_count_percent: c.statistics.as_ref().and_then(|s| s.book_word_count_percent),
        book_word_rank: c.statistics.as_ref().and_then(|s| s.book_word_rank.map(|v| v as i32)),
        movie_char_count: c.statistics.as_ref().and_then(|s| s.movie_char_count.map(|v| v as i32)),
        movie_char_count_percent: c.statistics.as_ref().and_then(|s| s.movie_char_count_percent),
        movie_char_rank: c.statistics.as_ref().and_then(|s| s.movie_char_rank.map(|v| v as i32)),
        movie_char_contexts: c.statistics.as_ref().and_then(|s| s.movie_char_contexts.map(|v| v as i32)),
        movie_char_contexts_percent: c.statistics.as_ref().and_then(|s| s.movie_char_contexts_percent),
        book_char_count: c.statistics.as_ref().and_then(|s| s.book_char_count.map(|v| v as i32)),
        book_char_count_percent: c.statistics.as_ref().and_then(|s| s.book_char_count_percent),
        book_char_rank: c.statistics.as_ref().and_then(|s| s.book_char_rank.map(|v| v as i32)),
        pinyin_frequency: c.statistics.as_ref().and_then(|s| s.pinyin_frequency.map(|v| v as i32)),
        top_words: c.statistics.as_ref().and_then(|s| s.top_words.as_ref().map(|tw|
            tw.iter().map(|w| TopWord {
                word: w.word.clone(),
                share: w.share,
                trad: w.trad.clone(),
                gloss: w.gloss.clone(),
            }).collect()
        )),
    });

    let japanese = combined.japanese_entry.as_ref().map(|j| JapaneseStats {
        common: j.kanji.first().map(|k| k.common).unwrap_or(false),
        jlpt_level: None, // Not available in current data
    });

    // Calculate combined frequency score (simple heuristic for now)
    let combined_frequency_score = calculate_combined_frequency(&chinese, &japanese);

    UnifiedStatistics {
        chinese,
        japanese,
        combined_frequency_score,
    }
}

fn calculate_combined_frequency(chinese: &Option<ChineseStats>, japanese: &Option<JapaneseStats>) -> Option<f32> {
    // Simple scoring algorithm - can be improved
    let mut score = 0.0;
    
    if let Some(c) = chinese {
        // HSK level contributes (lower level = higher frequency)
        if let Some(hsk) = c.hsk_level {
            score += (7 - hsk.min(6)) as f32 * 10.0; // HSK 1 = 60 points, HSK 6 = 10 points
        }
        
        // Movie rank contributes (lower rank = higher frequency)
        if let Some(rank) = c.movie_word_rank {
            score += (10000.0 - rank.min(10000) as f32) / 100.0; // Max 100 points
        }
    }
    
    if let Some(j) = japanese {
        if j.common {
            score += 20.0; // Common words get bonus
        }
    }
    
    if score > 0.0 { Some(score) } else { None }
}

fn extract_examples(combined: &CombinedEntry) -> Vec<Example> {
    let mut examples = Vec::new();

    // Extract Japanese examples
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
                                .map(|s| s.text.clone()),
                            source: ExampleSource {
                                source_type: format!("{:?}", example.source.source_type),
                                id: Some(example.source.value.clone()),
                            },
                            source_entry_id: Some(japanese.id.clone()),
                        });
                    }
                }
            }
        }
    }

    // Extract from additional Japanese entries
    for japanese_entry in &combined.japanese_specific_entries {
        for sense in &japanese_entry.sense {
            for example in &sense.examples {
                for sentence in &example.sentences {
                    if format!("{:?}", sentence.land) == "Jpn" {
                        examples.push(Example {
                            source_language: "japanese".to_string(),
                            text: sentence.text.clone(),
                            translation: example.sentences.iter()
                                .find(|s| format!("{:?}", s.land) == "Eng")
                                .map(|s| s.text.clone()),
                            source: ExampleSource {
                                source_type: format!("{:?}", example.source.source_type),
                                id: Some(example.source.value.clone()),
                            },
                            source_entry_id: Some(japanese_entry.id.clone()),
                        });
                    }
                }
            }
        }
    }

    examples
}

fn create_unified_metadata(combined: &CombinedEntry) -> UnifiedMetadata {
    UnifiedMetadata {
        created_at: chrono::Utc::now().to_string(),
        merger_version: "2.0-unified".to_string(),
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

fn calculate_unification_confidence(combined: &CombinedEntry) -> f32 {
    let mut confidence: f32 = 0.5; // Base confidence

    // Higher confidence if we have both Chinese and Japanese
    if combined.chinese_entry.is_some() && combined.japanese_entry.is_some() {
        confidence += 0.3;
    }

    // Higher confidence if meanings overlap (simple heuristic)
    if let (Some(chinese), Some(japanese)) = (&combined.chinese_entry, &combined.japanese_entry) {
        let chinese_defs: Vec<String> = chinese.items.iter()
            .filter_map(|item| item.definitions.as_ref())
            .flatten()
            .cloned()
            .collect();
        let japanese_defs: Vec<&str> = japanese.sense.iter()
            .flat_map(|sense| sense.gloss.iter().map(|g| g.text.as_str()))
            .collect();

        // Check for overlapping words in definitions
        let overlap = chinese_defs.iter().any(|c_def|
            japanese_defs.iter().any(|j_def|
                c_def.to_lowercase().contains(&j_def.to_lowercase()) ||
                j_def.to_lowercase().contains(&c_def.to_lowercase())
            )
        );

        if overlap {
            confidence += 0.2;
        }
    }

    confidence.min(1.0)
}

fn extract_chinese_metadata(combined: &CombinedEntry) -> Option<ChineseMetadata> {
    combined.chinese_entry.as_ref().map(|chinese| ChineseMetadata {
        gloss: chinese.gloss.clone(),
        pinyin_search_string: chinese.pinyin_search_string.clone(),
    })
}
