use serde::{Deserialize, Serialize};

/// Compact word preview for "Appears In" and "Contains" sections
/// Contains just enough data to display a word card without fetching the full entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordPreview {
    /// The word text (simplified Chinese or Japanese kanji/kana)
    #[serde(rename = "w")]
    pub word: String,

    /// Pronunciation (pinyin for Chinese)
    #[serde(rename = "p", skip_serializing_if = "Option::is_none")]
    pub pronunciation: Option<String>,

    /// Japanese pronunciation (kana reading) - for characters with both Chinese and Japanese readings
    #[serde(rename = "jp", skip_serializing_if = "Option::is_none")]
    pub japanese_pronunciation: Option<String>,

    /// Korean reading (Hangul) - for characters with Korean readings
    #[serde(rename = "kr", skip_serializing_if = "Option::is_none")]
    pub korean_reading: Option<String>,

    /// First definition (short English gloss)
    #[serde(rename = "d", skip_serializing_if = "Option::is_none")]
    pub definition: Option<String>,

    /// Whether this is a common word (Japanese only)
    #[serde(rename = "c", skip_serializing_if = "Option::is_none")]
    pub common: Option<bool>,

    /// JPDB frequency rank (1 = most common) - Japanese words only
    #[serde(rename = "fr", skip_serializing_if = "Option::is_none")]
    pub frequency_rank: Option<u32>,
}

impl WordPreview {
    /// Create a preview from a Chinese dictionary element
    pub fn from_chinese(word: &crate::chinese_types::ChineseDictionaryElement) -> Self {
        let pronunciation = word.items.first()
            .and_then(|item| item.pinyin.clone());

        let definition = word.items.first()
            .and_then(|item| item.definitions.as_ref())
            .and_then(|defs| defs.first())
            .cloned();

        // Get frequency rank from statistics (prefer movie rank as it's more conversational)
        let frequency_rank = word.statistics.as_ref()
            .and_then(|s| s.movie_word_rank.or(s.book_word_rank))
            .map(|r| r as u32);

        WordPreview {
            word: word.simp.clone(),
            pronunciation,
            japanese_pronunciation: None,
            korean_reading: None,
            definition,
            common: None, // Chinese words don't have a common field
            frequency_rank,
        }
    }

    /// Create a preview from a Chinese character (for single-character entries)
    pub fn from_chinese_char(char: &crate::chinese_char_types::ChineseCharacter) -> Self {
        // Get pronunciation from pinyinFrequencies (most common first)
        let pronunciation = char.pinyin_frequencies.as_ref()
            .and_then(|freqs| freqs.first())
            .map(|pf| pf.pinyin.clone());

        // Use the gloss as definition
        let definition = char.gloss.clone();

        WordPreview {
            word: char.char.clone(),
            pronunciation,
            japanese_pronunciation: None,
            korean_reading: None,
            definition,
            common: None,
            frequency_rank: None, // Chinese chars don't have JPDB frequency
        }
    }

    /// Create a preview from a Japanese word
    pub fn from_japanese(word: &crate::japanese_types::Word) -> Self {
        // Get the first kanji or kana as the word text
        let word_text = word.kanji.first()
            .map(|k| k.text.clone())
            .or_else(|| word.kana.first().map(|k| k.text.clone()))
            .unwrap_or_default();

        // Get the first kana as pronunciation (stored in japanese_pronunciation for consistency)
        let japanese_pronunciation = word.kana.first()
            .map(|k| k.text.clone());

        // Get the first gloss as definition
        let definition = word.sense.first()
            .and_then(|s| s.gloss.first())
            .map(|g| g.text.clone());

        // Check if this word is common (any kanji or kana marked as common)
        let is_common = word.kanji.iter().any(|k| k.common) || word.kana.iter().any(|k| k.common);

        WordPreview {
            word: word_text,
            pronunciation: None, // Japanese words don't have pinyin
            japanese_pronunciation,
            korean_reading: None,
            definition,
            common: Some(is_common),
            frequency_rank: word.frequency_rank, // Use JPDB frequency rank
        }
    }

    /// Create a combined preview for multi-character words with both Chinese and Japanese readings
    /// This is used for the Contains section where we want to show both readings
    pub fn from_combined_word(
        chinese_word: Option<&crate::chinese_types::ChineseDictionaryElement>,
        japanese_word: Option<&crate::japanese_types::Word>,
        word_text: &str,
    ) -> Self {
        // Get Chinese pinyin
        let pronunciation = chinese_word.and_then(|w| {
            w.items.first().and_then(|item| item.pinyin.clone())
        });

        // Get Japanese kana reading
        let japanese_pronunciation = japanese_word.and_then(|w| {
            w.kana.first().map(|k| k.text.clone())
        });

        // Get definition - prefer Chinese, fall back to Japanese
        let definition = chinese_word
            .and_then(|w| w.items.first())
            .and_then(|item| item.definitions.as_ref())
            .and_then(|defs| defs.first())
            .cloned()
            .or_else(|| {
                japanese_word
                    .and_then(|w| w.sense.first())
                    .and_then(|s| s.gloss.first())
                    .map(|g| g.text.clone())
            });

        // Check if Japanese word is common
        let common = japanese_word.map(|w| {
            w.kanji.iter().any(|k| k.common) || w.kana.iter().any(|k| k.common)
        });

        // Get frequency rank - prefer Japanese JPDB, fall back to Chinese movie rank
        let frequency_rank = japanese_word
            .and_then(|w| w.frequency_rank)
            .or_else(|| {
                chinese_word
                    .and_then(|w| w.statistics.as_ref())
                    .and_then(|s| s.movie_word_rank.or(s.book_word_rank))
                    .map(|r| r as u32)
            });

        WordPreview {
            word: word_text.to_string(),
            pronunciation,
            japanese_pronunciation,
            korean_reading: None, // Multi-character words don't have Korean readings yet
            definition,
            common,
            frequency_rank,
        }
    }

    /// Create a preview from a Korean word
    pub fn from_korean(word: &crate::korean_types::KoreanWord) -> Self {
        // Use the Hangul as the word text
        let word_text = word.hangul.clone();

        // Use the first English definition as the preview definition
        // The KoreanDefinition has a `text` field and optional `lang` field
        let definition = word.definitions.iter()
            .find(|def| def.lang.as_deref() == Some("en"))
            .or_else(|| word.definitions.first())
            .map(|def| def.text.clone());

        WordPreview {
            word: word_text,
            pronunciation: word.romanization.clone(), // Korean romanization goes in pronunciation field
            japanese_pronunciation: None,
            korean_reading: None, // Korean words already show Hangul as the word text
            definition,
            common: None, // Korean words don't have a common field
            frequency_rank: word.frequency_rank, // Use Korean frequency rank from subtitle corpus
        }
    }

    /// Create a combined preview for characters with Chinese, Japanese, and Korean readings
    /// This is used for the Contains section where we want to show all available readings
    pub fn from_combined_char(
        chinese_char: Option<&crate::chinese_char_types::ChineseCharacter>,
        japanese_char: Option<&crate::japanese_char_types::KanjiCharacter>,
        korean_char: Option<&crate::korean_types::KoreanCharacter>,
        word_text: &str,
    ) -> Self {
        // Get Chinese pinyin
        let pronunciation = chinese_char.and_then(|c| {
            c.pinyin_frequencies.as_ref()
                .and_then(|freqs| freqs.first())
                .map(|pf| pf.pinyin.clone())
        });

        // Get Japanese reading (prefer kun reading, then on reading)
        let japanese_pronunciation = japanese_char.and_then(|jc| {
            jc.reading_meaning.as_ref().and_then(|rm| {
                rm.groups.first().and_then(|g| {
                    // First try kun readings, then on readings
                    g.readings.iter()
                        .find(|r| r.reading_type == "ja_kun")
                        .or_else(|| g.readings.iter().find(|r| r.reading_type == "ja_on"))
                        .map(|r| r.value.clone())
                })
            })
        });

        // Get Korean reading (first Hangul reading)
        let korean_reading = korean_char.and_then(|kc| {
            kc.readings.first().map(|r| r.hangul.clone())
        });

        // Get definition - prefer Chinese gloss if available, otherwise Japanese meaning
        let definition = chinese_char.and_then(|c| c.gloss.clone())
            .or_else(|| {
                japanese_char.and_then(|jc| {
                    jc.reading_meaning.as_ref().and_then(|rm| {
                        rm.groups.first().and_then(|g| {
                            g.meanings.iter()
                                .find(|m| m.lang == "en")
                                .map(|m| m.value.clone())
                        })
                    })
                })
            });

        WordPreview {
            word: word_text.to_string(),
            pronunciation,
            japanese_pronunciation,
            korean_reading,
            definition,
            common: None,
            frequency_rank: None, // Character previews don't have word frequency
        }
    }
}

