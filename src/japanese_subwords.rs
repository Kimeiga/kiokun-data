use crate::japanese_types::{PartOfSpeech, Sense, Word};
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JapaneseSubwordForm {
    pub surface: String,
    pub reading: Option<String>,
}

/// Build dictionary-backed Japanese surface forms that can occur as meaningful
/// subwords but are not themselves JMdict headwords. The most important case is
/// the continuative (連用形) form used as a noun or compound component:
/// 延ばす → 延ばし.
pub fn continuative_subword_forms(word: &Word) -> Vec<JapaneseSubwordForm> {
    let mut forms = Vec::new();
    let mut seen = HashSet::new();

    for kanji in &word.kanji {
        let Some(surface) = continuative_form_for_spelling(word, &kanji.text, true) else {
            continue;
        };

        let reading = word
            .kana
            .iter()
            .filter(|kana| applies_to_kanji(kana.applies_to_kanji.as_ref(), &kanji.text))
            .find_map(|kana| continuative_form_for_spelling(word, &kana.text, false));

        if seen.insert((surface.clone(), reading.clone())) {
            forms.push(JapaneseSubwordForm { surface, reading });
        }
    }

    for kana in &word.kana {
        let Some(surface) = continuative_form_for_spelling(word, &kana.text, false) else {
            continue;
        };

        if seen.insert((surface.clone(), Some(surface.clone()))) {
            forms.push(JapaneseSubwordForm {
                reading: Some(surface.clone()),
                surface,
            });
        }
    }

    forms
}

fn continuative_form_for_spelling(word: &Word, spelling: &str, is_kanji: bool) -> Option<String> {
    word.sense
        .iter()
        .filter(|sense| sense_applies_to_spelling(sense, spelling, is_kanji))
        .find_map(|sense| continuative_form(spelling, &sense.part_of_speech))
}

fn sense_applies_to_spelling(sense: &Sense, spelling: &str, is_kanji: bool) -> bool {
    let applies_to = if is_kanji {
        &sense.applies_to_kanji
    } else {
        &sense.applies_to_kana
    };

    applies_to.is_empty()
        || applies_to
            .iter()
            .any(|value| value == "*" || value == spelling)
}

fn applies_to_kanji(applies_to: Option<&Vec<String>>, spelling: &str) -> bool {
    applies_to.is_none_or(|values| {
        values.is_empty() || values.iter().any(|value| value == "*" || value == spelling)
    })
}

pub fn continuative_form(text: &str, part_of_speech: &[PartOfSpeech]) -> Option<String> {
    use PartOfSpeech::*;

    if part_of_speech.iter().any(|pos| matches!(pos, V1 | V1S)) {
        return replace_suffix(text, "る", "");
    }

    if part_of_speech
        .iter()
        .any(|pos| matches!(pos, Vs | VsC | VsI | VsS))
    {
        return replace_suffix(text, "する", "し");
    }

    if part_of_speech.iter().any(|pos| matches!(pos, Vk)) {
        if text == "くる" {
            return Some("き".to_string());
        }
        if text == "クル" {
            return Some("キ".to_string());
        }
        return replace_suffix(text, "る", "");
    }

    if part_of_speech.iter().any(|pos| matches!(pos, Vz)) {
        return replace_suffix(text, "ずる", "じ");
    }

    let ending = if part_of_speech.iter().any(|pos| matches!(pos, V5U | V5US)) {
        Some(("う", "い"))
    } else if part_of_speech.iter().any(|pos| matches!(pos, V5K | V5KS)) {
        Some(("く", "き"))
    } else if part_of_speech.iter().any(|pos| matches!(pos, V5G)) {
        Some(("ぐ", "ぎ"))
    } else if part_of_speech.iter().any(|pos| matches!(pos, V5S)) {
        Some(("す", "し"))
    } else if part_of_speech.iter().any(|pos| matches!(pos, V5T)) {
        Some(("つ", "ち"))
    } else if part_of_speech.iter().any(|pos| matches!(pos, V5N)) {
        Some(("ぬ", "に"))
    } else if part_of_speech.iter().any(|pos| matches!(pos, V5B)) {
        Some(("ぶ", "び"))
    } else if part_of_speech.iter().any(|pos| matches!(pos, V5M)) {
        Some(("む", "み"))
    } else if part_of_speech
        .iter()
        .any(|pos| matches!(pos, V5Aru | V5R | V5RI))
    {
        Some(("る", "り"))
    } else {
        None
    };

    ending.and_then(|(suffix, replacement)| replace_suffix(text, suffix, replacement))
}

fn replace_suffix(text: &str, suffix: &str, replacement: &str) -> Option<String> {
    let stem = text.strip_suffix(suffix)?;
    if stem.is_empty() {
        return None;
    }
    Some(format!("{stem}{replacement}"))
}

#[cfg(test)]
mod tests {
    use super::continuative_form;
    use crate::japanese_types::PartOfSpeech;

    #[test]
    fn derives_the_nobashi_subword() {
        assert_eq!(
            continuative_form("延ばす", &[PartOfSpeech::V5S]),
            Some("延ばし".to_string())
        );
        assert_eq!(
            continuative_form("のばす", &[PartOfSpeech::V5S]),
            Some("のばし".to_string())
        );
    }

    #[test]
    fn supports_modern_verb_classes_without_treating_nouns_as_verbs() {
        assert_eq!(
            continuative_form("書く", &[PartOfSpeech::V5K]),
            Some("書き".to_string())
        );
        assert_eq!(
            continuative_form("食べる", &[PartOfSpeech::V1]),
            Some("食べ".to_string())
        );
        assert_eq!(
            continuative_form("勉強する", &[PartOfSpeech::VsI]),
            Some("勉強し".to_string())
        );
        assert_eq!(continuative_form("延ばす", &[PartOfSpeech::N]), None);
    }
}
