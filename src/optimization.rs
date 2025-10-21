// Conversion functions from SimpleOutput to OptimizedOutput
// Removes unused fields and shortens field names for size reduction

use crate::simple_output_types::SimpleOutput;
use crate::optimized_output_types::*;
use crate::chinese_char_types::ChineseCharacter;
use crate::japanese_char_types::KanjiCharacter;
use crate::chinese_types::ChineseDictionaryElement;
use crate::japanese_types::Word;

/// Convert SimpleOutput to OptimizedOutput
pub fn optimize_output(simple: SimpleOutput) -> OptimizedOutput {
    OptimizedOutput {
        key: simple.key,
        redirect: simple.redirect,
        chinese_words: simple.chinese_words.into_iter().map(optimize_chinese_word).collect(),
        chinese_char: simple.chinese_char.map(optimize_chinese_char),
        japanese_words: simple.japanese_words.into_iter().map(optimize_japanese_word).collect(),
        japanese_char: simple.japanese_char.map(optimize_japanese_char),
        related_japanese_words: simple.related_japanese_words,
        japanese_names: vec![],
        contains: simple.contains,
        contained_in_chinese: simple.contained_in_chinese,
        contained_in_japanese: simple.contained_in_japanese,
    }
}

// ============================================================================
// CHINESE CHARACTER OPTIMIZATION
// ============================================================================

fn optimize_chinese_char(char: ChineseCharacter) -> OptimizedChineseChar {
    OptimizedChineseChar {
        stroke_count: Some(char.stroke_count),
        pinyin_frequencies: char.pinyin_frequencies.map(|pfs| {
            pfs.into_iter().map(|pf| OptimizedPinyinFrequency {
                pinyin: pf.pinyin,
                count: pf.count,
            }).collect()
        }),
        gloss: char.gloss,
        hint: char.hint,
        components: char.components.map(|comps| {
            comps.into_iter().map(|c| OptimizedComponent {
                character: c.character,
                component_type: c.component_type,
                hint: c.hint,
            }).collect()
        }),
        images: char.images.map(|imgs| {
            imgs.into_iter().map(optimize_image).collect()
        }),
        statistics: char.statistics.map(optimize_statistics),
        variants: char.variants.map(|vars| {
            vars.into_iter().map(|v| OptimizedVariant {
                char: v.char,
                parts: v.parts,
                source: v.source,
            }).collect()
        }),
        comments: char.comments.map(|coms| {
            coms.into_iter().map(|c| OptimizedComment {
                source: c.source,
                text: c.text,
            }).collect()
        }),
        ids: char.ids,
        ids_apparent: char.ids_apparent,
    }
}

fn optimize_image(img: crate::chinese_char_types::Image) -> OptimizedImage {
    // Extract path from URL
    // URLs are like: https://data.dong-chinese.com/img/sinica/%E5%A5%BD_0.png
    // We only store the filename part: %E5%A5%BD_0.png
    let path = if let Some(url) = &img.url {
        url.split('/').last().unwrap_or(url).to_string()
    } else {
        String::new()
    };

    OptimizedImage {
        path,
        source: Some(img.source),
        description: img.description,
        image_type: img.image_type,
        era: img.era,
        data: img.data,
    }
}

fn optimize_statistics(stats: crate::chinese_char_types::Statistics) -> OptimizedStatistics {
    OptimizedStatistics {
        hsk_level: stats.hsk_level,
        top_words: stats.top_words.map(|words| {
            words.into_iter().map(|w| OptimizedTopWord {
                word: w.word,
                share: w.share,
                trad: w.trad,
                gloss: w.gloss,
            }).collect()
        }),
        movie_word_count: stats.movie_word_count,
        movie_word_count_percent: stats.movie_word_count_percent,
        movie_word_rank: stats.movie_word_rank,
        movie_word_contexts: stats.movie_word_contexts,
        movie_word_contexts_percent: stats.movie_word_contexts_percent,
        book_word_count: stats.book_word_count,
        book_word_count_percent: stats.book_word_count_percent,
        book_word_rank: stats.book_word_rank,
        movie_char_count: stats.movie_char_count,
        movie_char_count_percent: stats.movie_char_count_percent,
        movie_char_rank: stats.movie_char_rank,
        movie_char_contexts: stats.movie_char_contexts,
        movie_char_contexts_percent: stats.movie_char_contexts_percent,
        book_char_count: stats.book_char_count,
        book_char_count_percent: stats.book_char_count_percent,
        book_char_rank: stats.book_char_rank,
        pinyin_frequency: stats.pinyin_frequency,
    }
}

// ============================================================================
// JAPANESE CHARACTER OPTIMIZATION
// ============================================================================

fn optimize_japanese_char(char: KanjiCharacter) -> OptimizedJapaneseChar {
    OptimizedJapaneseChar {
        literal: char.literal,
        reading_meaning: char.reading_meaning.map(|rm| {
            // Flatten groups into single reading/meaning lists
            let mut all_readings = Vec::new();
            let mut all_meanings = Vec::new();

            for group in rm.groups {
                for reading in group.readings {
                    all_readings.push(OptimizedReading {
                        reading_type: reading.reading_type,
                        on_type: reading.on_type,
                        status: reading.status,
                        value: reading.value,
                    });
                }

                for meaning in group.meanings {
                    // Only keep English meanings
                    if meaning.lang == "en" {
                        all_meanings.push(meaning.value);
                    }
                }
            }

            OptimizedReadingMeaning {
                readings: all_readings,
                meanings: all_meanings,
                nanori: rm.nanori,
            }
        }),
        misc: {
            let m = char.misc;
            // Convert Codepoint variants to serde_json::Value
            let variants_json: Vec<serde_json::Value> = m.variants
                .into_iter()
                .map(|v| serde_json::json!({
                    "type": v.codepoint_type,
                    "value": v.value
                }))
                .collect();

            Some(OptimizedMisc {
                grade: m.grade,
                // Only keep first stroke count (they're usually the same)
                stroke_count: m.stroke_counts.first().copied().unwrap_or(0),
                variants: variants_json,
                frequency: m.frequency,
                radical_names: m.radical_names,
                jlpt_level: m.jlpt_level,
            })
        },
    }
}

// ============================================================================
// CHINESE WORD OPTIMIZATION
// ============================================================================

fn optimize_chinese_word(word: ChineseDictionaryElement) -> OptimizedChineseWord {
    OptimizedChineseWord {
        items: word.items.into_iter().map(|item| OptimizedChineseItem {
            pinyin: item.pinyin.unwrap_or_default(),
            definitions: item.definitions.unwrap_or_default(),
        }).collect(),
    }
}

// ============================================================================
// JAPANESE WORD OPTIMIZATION
// ============================================================================

fn optimize_japanese_word(word: Word) -> OptimizedJapaneseWord {
    OptimizedJapaneseWord {
        kanji: word.kanji.into_iter().map(|k| OptimizedKanji {
            common: k.common,
            text: k.text,
            tags: k.tags.into_iter().map(tag_to_string).collect(),
        }).collect(),
        kana: word.kana.into_iter().map(|k| OptimizedKana {
            common: k.common,
            text: k.text,
            tags: k.tags.into_iter().map(tag_to_string).collect(),
            applies_to_kanji: k.applies_to_kanji.unwrap_or_default(),
            pitch_accents: k.pitch_accents.map(|pa| {
                pa.into_iter().map(|p| serde_json::json!(p)).collect()
            }).unwrap_or_default(),
        }).collect(),
        sense: word.sense.into_iter().map(optimize_sense).collect(),
    }
}

fn tag_to_string(tag: crate::japanese_types::Tag) -> String {
    use crate::japanese_types::Tag;
    match tag {
        Tag::Ateji => "ateji".to_string(),
        Tag::Gikun => "gikun".to_string(),
        Tag::IK => "iK".to_string(),
        Tag::Ik => "ik".to_string(),
        Tag::Io => "io".to_string(),
        Tag::OK => "oK".to_string(),
        Tag::Ok => "ok".to_string(),
        Tag::RK => "rK".to_string(),
        Tag::Rk => "rk".to_string(),
        Tag::SK => "sK".to_string(),
        Tag::Sk => "sk".to_string(),
    }
}

fn optimize_sense(sense: crate::japanese_types::Sense) -> OptimizedSense {
    use crate::japanese_types::{Antonym, SourceType, Lan};

    // Convert part of speech enums to strings
    let pos_strings: Vec<String> = sense.part_of_speech.into_iter()
        .map(|pos| serde_json::to_string(&pos).unwrap_or_default().trim_matches('"').to_string())
        .collect();

    // Convert misc enums to strings
    let misc_strings: Vec<String> = sense.misc.into_iter()
        .map(|m| serde_json::to_string(&m).unwrap_or_default().trim_matches('"').to_string())
        .collect();

    // Convert related (Vec<Vec<Antonym>>) to Vec<Vec<String>>
    let related_strings: Vec<Vec<String>> = sense.related.into_iter()
        .map(|group| group.into_iter().map(|ant| match ant {
            Antonym::String(s) => s,
            Antonym::Integer(i) => i.to_string(),
        }).collect())
        .collect();

    OptimizedSense {
        part_of_speech: pos_strings,
        misc: misc_strings,
        gloss: sense.gloss.into_iter().map(|g| g.text).collect(),
        related: related_strings,
        examples: sense.examples.into_iter().map(|ex| {
            let source_type_str = match ex.source.source_type {
                SourceType::Tatoeba => "tatoeba".to_string(),
            };

            OptimizedExample {
                source: OptimizedExampleSource {
                    source_type: source_type_str,
                    value: ex.source.value,
                },
                text: ex.text,
                sentences: ex.sentences.into_iter().map(|s| {
                    let lang_str = match s.land {
                        Lan::Eng => "eng".to_string(),
                        Lan::Jpn => "jpn".to_string(),
                    };

                    OptimizedExampleSentence {
                        lang: lang_str,
                        text: s.text,
                    }
                }).collect(),
            }
        }).collect(),
    }
}

