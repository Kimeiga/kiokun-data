/// Korean Romanization module
/// Converts Hangul to Revised Romanization of Korean for searchable text
/// Based on the official Revised Romanization system (국어의 로마자 표기법)

use std::collections::HashMap;
use once_cell::sync::Lazy;

/// Initial consonants (초성) - 19 jamo
static INITIALS: Lazy<HashMap<u32, &'static str>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert(0, "g");   // ㄱ
    map.insert(1, "kk");  // ㄲ
    map.insert(2, "n");   // ㄴ
    map.insert(3, "d");   // ㄷ
    map.insert(4, "tt");  // ㄸ
    map.insert(5, "r");   // ㄹ (initial = r)
    map.insert(6, "m");   // ㅁ
    map.insert(7, "b");   // ㅂ
    map.insert(8, "pp");  // ㅃ
    map.insert(9, "s");   // ㅅ
    map.insert(10, "ss"); // ㅆ
    map.insert(11, "");   // ㅇ (silent initial)
    map.insert(12, "j");  // ㅈ
    map.insert(13, "jj"); // ㅉ
    map.insert(14, "ch"); // ㅊ
    map.insert(15, "k");  // ㅋ
    map.insert(16, "t");  // ㅌ
    map.insert(17, "p");  // ㅍ
    map.insert(18, "h");  // ㅎ
    map
});

/// Medial vowels (중성) - 21 jamo
static MEDIALS: Lazy<HashMap<u32, &'static str>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert(0, "a");    // ㅏ
    map.insert(1, "ae");   // ㅐ
    map.insert(2, "ya");   // ㅑ
    map.insert(3, "yae");  // ㅒ
    map.insert(4, "eo");   // ㅓ
    map.insert(5, "e");    // ㅔ
    map.insert(6, "yeo");  // ㅕ
    map.insert(7, "ye");   // ㅖ
    map.insert(8, "o");    // ㅗ
    map.insert(9, "wa");   // ㅘ
    map.insert(10, "wae"); // ㅙ
    map.insert(11, "oe");  // ㅚ
    map.insert(12, "yo");  // ㅛ
    map.insert(13, "u");   // ㅜ
    map.insert(14, "wo");  // ㅝ
    map.insert(15, "we");  // ㅞ
    map.insert(16, "wi");  // ㅟ
    map.insert(17, "yu");  // ㅠ
    map.insert(18, "eu");  // ㅡ
    map.insert(19, "ui");  // ㅢ
    map.insert(20, "i");   // ㅣ
    map
});

/// Final consonants (종성) - 28 jamo (including none)
static FINALS: Lazy<HashMap<u32, &'static str>> = Lazy::new(|| {
    let mut map = HashMap::new();
    map.insert(0, "");     // (none)
    map.insert(1, "k");    // ㄱ
    map.insert(2, "k");    // ㄲ
    map.insert(3, "k");    // ㄳ
    map.insert(4, "n");    // ㄴ
    map.insert(5, "n");    // ㄵ
    map.insert(6, "n");    // ㄶ
    map.insert(7, "t");    // ㄷ
    map.insert(8, "l");    // ㄹ (final = l)
    map.insert(9, "k");    // ㄺ
    map.insert(10, "m");   // ㄻ
    map.insert(11, "p");   // ㄼ
    map.insert(12, "l");   // ㄽ
    map.insert(13, "l");   // ㄾ
    map.insert(14, "l");   // ㄿ
    map.insert(15, "p");   // ㅀ
    map.insert(16, "m");   // ㅁ
    map.insert(17, "p");   // ㅂ
    map.insert(18, "p");   // ㅄ
    map.insert(19, "t");   // ㅅ
    map.insert(20, "t");   // ㅆ
    map.insert(21, "ng");  // ㅇ
    map.insert(22, "t");   // ㅈ
    map.insert(23, "t");   // ㅊ
    map.insert(24, "k");   // ㅋ
    map.insert(25, "t");   // ㅌ
    map.insert(26, "p");   // ㅍ
    map.insert(27, "t");   // ㅎ
    map
});

/// Check if a character is a Hangul syllable (가-힣)
fn is_hangul_syllable(c: char) -> bool {
    let code = c as u32;
    code >= 0xAC00 && code <= 0xD7A3
}

/// Decompose a Hangul syllable into initial, medial, final indices
fn decompose_syllable(c: char) -> Option<(u32, u32, u32)> {
    if !is_hangul_syllable(c) {
        return None;
    }
    
    let code = c as u32 - 0xAC00;
    let initial = code / (21 * 28);
    let medial = (code % (21 * 28)) / 28;
    let final_c = code % 28;
    
    Some((initial, medial, final_c))
}

/// Convert Hangul text to Revised Romanization
pub fn hangul_to_romanization(text: &str) -> String {
    let mut result = String::new();
    
    for c in text.chars() {
        if let Some((initial, medial, final_c)) = decompose_syllable(c) {
            if let Some(init) = INITIALS.get(&initial) {
                result.push_str(init);
            }
            if let Some(med) = MEDIALS.get(&medial) {
                result.push_str(med);
            }
            if let Some(fin) = FINALS.get(&final_c) {
                result.push_str(fin);
            }
        } else {
            // Non-Hangul character, keep as-is or skip
            if c.is_ascii_alphanumeric() || c == ' ' {
                result.push(c);
            }
        }
    }
    
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_basic_words() {
        assert_eq!(hangul_to_romanization("한국"), "hanguk");
        assert_eq!(hangul_to_romanization("서울"), "seoul");
        assert_eq!(hangul_to_romanization("안녕"), "annyeong");
    }
    
    #[test]
    fn test_common_words() {
        assert_eq!(hangul_to_romanization("친구"), "chingu");
        assert_eq!(hangul_to_romanization("사랑"), "sarang");
        assert_eq!(hangul_to_romanization("감사"), "gamsa");
    }
    
    #[test]
    fn test_verbs() {
        assert_eq!(hangul_to_romanization("하다"), "hada");
        assert_eq!(hangul_to_romanization("먹다"), "meokda");
        assert_eq!(hangul_to_romanization("가다"), "gada");
    }
}

