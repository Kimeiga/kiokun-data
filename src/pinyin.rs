/// Pinyin normalization module
/// Converts pinyin with tone marks to plain ASCII for searchable text
/// e.g., "tiàn" → "tian", "qiū" → "qiu"

use std::collections::HashMap;
use once_cell::sync::Lazy;

/// Map of accented vowels to their base form
static TONE_MAP: Lazy<HashMap<char, char>> = Lazy::new(|| {
    let mut map = HashMap::new();
    
    // First tone (macron) - ā ē ī ō ū ǖ
    map.insert('ā', 'a'); map.insert('ē', 'e'); map.insert('ī', 'i');
    map.insert('ō', 'o'); map.insert('ū', 'u'); map.insert('ǖ', 'v');
    
    // Second tone (acute) - á é í ó ú ǘ
    map.insert('á', 'a'); map.insert('é', 'e'); map.insert('í', 'i');
    map.insert('ó', 'o'); map.insert('ú', 'u'); map.insert('ǘ', 'v');
    
    // Third tone (caron) - ǎ ě ǐ ǒ ǔ ǚ
    map.insert('ǎ', 'a'); map.insert('ě', 'e'); map.insert('ǐ', 'i');
    map.insert('ǒ', 'o'); map.insert('ǔ', 'u'); map.insert('ǚ', 'v');
    
    // Fourth tone (grave) - à è ì ò ù ǜ
    map.insert('à', 'a'); map.insert('è', 'e'); map.insert('ì', 'i');
    map.insert('ò', 'o'); map.insert('ù', 'u'); map.insert('ǜ', 'v');
    
    // Neutral/fifth tone (no mark) - handled by pass-through
    
    // ü without tone mark
    map.insert('ü', 'v');
    
    // Uppercase variants
    map.insert('Ā', 'A'); map.insert('Ē', 'E'); map.insert('Ī', 'I');
    map.insert('Ō', 'O'); map.insert('Ū', 'U'); map.insert('Ǖ', 'V');
    map.insert('Á', 'A'); map.insert('É', 'E'); map.insert('Í', 'I');
    map.insert('Ó', 'O'); map.insert('Ú', 'U'); map.insert('Ǘ', 'V');
    map.insert('Ǎ', 'A'); map.insert('Ě', 'E'); map.insert('Ǐ', 'I');
    map.insert('Ǒ', 'O'); map.insert('Ǔ', 'U'); map.insert('Ǚ', 'V');
    map.insert('À', 'A'); map.insert('È', 'E'); map.insert('Ì', 'I');
    map.insert('Ò', 'O'); map.insert('Ù', 'U'); map.insert('Ǜ', 'V');
    map.insert('Ü', 'V');
    
    map
});

/// Strip tone marks from pinyin, converting to plain ASCII
/// Also handles ü → v conversion (common in computer input)
/// Removes zero-width spaces and other invisible characters
pub fn normalize_pinyin(pinyin: &str) -> String {
    pinyin.chars()
        .filter(|c| {
            // Filter out zero-width space (U+200B) and other invisible characters
            *c != '\u{200B}' && *c != '\u{200C}' && *c != '\u{200D}' && *c != '\u{FEFF}'
        })
        .map(|c| {
            *TONE_MAP.get(&c).unwrap_or(&c)
        })
        .collect::<String>()
        .to_lowercase()
}

/// Process a pinyin_search_string field which may contain multiple readings
/// e.g., "qiū qiu1 qiu" → "qiu"
/// Returns a deduplicated, space-separated list of normalized readings
#[allow(dead_code)]
pub fn normalize_pinyin_search_string(search_string: &str) -> String {
    if search_string.is_empty() {
        return String::new();
    }
    
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();
    
    for part in search_string.split_whitespace() {
        // Normalize the pinyin
        let normalized = normalize_pinyin(part);
        // Remove any trailing numbers (tone numbers like "qiu1")
        let clean: String = normalized.chars()
            .filter(|c| !c.is_ascii_digit())
            .collect();
        
        if !clean.is_empty() && !seen.contains(&clean) {
            seen.insert(clean.clone());
            result.push(clean);
        }
    }
    
    result.join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_pinyin() {
        assert_eq!(normalize_pinyin("tiàn"), "tian");
        assert_eq!(normalize_pinyin("qiū"), "qiu");
        assert_eq!(normalize_pinyin("hǎo"), "hao");
        assert_eq!(normalize_pinyin("nǚ"), "nv");
        assert_eq!(normalize_pinyin("lǜ"), "lv");
    }

    #[test]
    fn test_normalize_pinyin_search_string() {
        assert_eq!(normalize_pinyin_search_string("qiū qiu1 qiu"), "qiu");
        assert_eq!(normalize_pinyin_search_string("tiàn tian4 tian"), "tian");
        assert_eq!(normalize_pinyin_search_string(""), "");
    }

    #[test]
    fn test_multiple_syllables() {
        assert_eq!(normalize_pinyin("běijīng"), "beijing");
        assert_eq!(normalize_pinyin("zhōngguó"), "zhongguo");
    }

    #[test]
    fn test_zero_width_space_removal() {
        // Test that zero-width spaces (U+200B) are removed
        assert_eq!(normalize_pinyin("Běi\u{200B}jīng"), "beijing");
        assert_eq!(normalize_pinyin("Zhōng\u{200B}guó"), "zhongguo");
    }

    #[test]
    fn test_uppercase_to_lowercase() {
        assert_eq!(normalize_pinyin("BEIJING"), "beijing");
        assert_eq!(normalize_pinyin("Tiān"), "tian");
    }
}

