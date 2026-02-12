/// Romaji conversion module
/// Converts Japanese kana (hiragana/katakana) to romaji for searchable text
/// Based on modified Hepburn romanization

use std::collections::HashMap;
use once_cell::sync::Lazy;

/// Map of kana to romaji - uses hiragana as the canonical form
static ROMAJI_MAP: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    let mut map = HashMap::new();
    
    // Basic hiragana
    map.insert("あ", "a"); map.insert("い", "i"); map.insert("う", "u");
    map.insert("え", "e"); map.insert("お", "o");
    map.insert("か", "ka"); map.insert("き", "ki"); map.insert("く", "ku");
    map.insert("け", "ke"); map.insert("こ", "ko");
    map.insert("きゃ", "kya"); map.insert("きゅ", "kyu"); map.insert("きょ", "kyo");
    map.insert("さ", "sa"); map.insert("し", "shi"); map.insert("す", "su");
    map.insert("せ", "se"); map.insert("そ", "so");
    map.insert("しゃ", "sha"); map.insert("しゅ", "shu"); map.insert("しょ", "sho");
    map.insert("た", "ta"); map.insert("ち", "chi"); map.insert("つ", "tsu");
    map.insert("て", "te"); map.insert("と", "to");
    map.insert("ちゃ", "cha"); map.insert("ちゅ", "chu"); map.insert("ちょ", "cho");
    map.insert("な", "na"); map.insert("に", "ni"); map.insert("ぬ", "nu");
    map.insert("ね", "ne"); map.insert("の", "no");
    map.insert("にゃ", "nya"); map.insert("にゅ", "nyu"); map.insert("にょ", "nyo");
    map.insert("は", "ha"); map.insert("ひ", "hi"); map.insert("ふ", "fu");
    map.insert("へ", "he"); map.insert("ほ", "ho");
    map.insert("ひゃ", "hya"); map.insert("ひゅ", "hyu"); map.insert("ひょ", "hyo");
    map.insert("ま", "ma"); map.insert("み", "mi"); map.insert("む", "mu");
    map.insert("め", "me"); map.insert("も", "mo");
    map.insert("みゃ", "mya"); map.insert("みゅ", "myu"); map.insert("みょ", "myo");
    map.insert("や", "ya"); map.insert("ゆ", "yu"); map.insert("よ", "yo");
    map.insert("ら", "ra"); map.insert("り", "ri"); map.insert("る", "ru");
    map.insert("れ", "re"); map.insert("ろ", "ro");
    map.insert("りゃ", "rya"); map.insert("りゅ", "ryu"); map.insert("りょ", "ryo");
    map.insert("わ", "wa"); map.insert("ゐ", "i"); map.insert("ゑ", "e");
    map.insert("を", "o"); map.insert("ん", "n");
    
    // Voiced consonants (dakuten)
    map.insert("が", "ga"); map.insert("ぎ", "gi"); map.insert("ぐ", "gu");
    map.insert("げ", "ge"); map.insert("ご", "go");
    map.insert("ぎゃ", "gya"); map.insert("ぎゅ", "gyu"); map.insert("ぎょ", "gyo");
    map.insert("ざ", "za"); map.insert("じ", "ji"); map.insert("ず", "zu");
    map.insert("ぜ", "ze"); map.insert("ぞ", "zo");
    map.insert("じゃ", "ja"); map.insert("じゅ", "ju"); map.insert("じょ", "jo");
    map.insert("だ", "da"); map.insert("ぢ", "ji"); map.insert("づ", "zu");
    map.insert("で", "de"); map.insert("ど", "do");
    map.insert("ぢゃ", "ja"); map.insert("ぢゅ", "ju"); map.insert("ぢょ", "jo");
    map.insert("ば", "ba"); map.insert("び", "bi"); map.insert("ぶ", "bu");
    map.insert("べ", "be"); map.insert("ぼ", "bo");
    map.insert("びゃ", "bya"); map.insert("びゅ", "byu"); map.insert("びょ", "byo");
    map.insert("ぱ", "pa"); map.insert("ぴ", "pi"); map.insert("ぷ", "pu");
    map.insert("ぺ", "pe"); map.insert("ぽ", "po");
    map.insert("ぴゃ", "pya"); map.insert("ぴゅ", "pyu"); map.insert("ぴょ", "pyo");
    
    // Extended kana (commonly katakana but handle as hiragana)
    map.insert("ふぁ", "fa"); map.insert("ふぃ", "fi"); map.insert("ふぇ", "fe");
    map.insert("ふぉ", "fo"); map.insert("ふゅ", "fyu");
    map.insert("てぃ", "ti"); map.insert("でぃ", "di");
    map.insert("とぅ", "tu"); map.insert("どぅ", "du");
    map.insert("うぃ", "wi"); map.insert("うぇ", "we"); map.insert("うぉ", "wo");
    map.insert("ゔぁ", "va"); map.insert("ゔぃ", "vi"); map.insert("ゔ", "vu");
    map.insert("ゔぇ", "ve"); map.insert("ゔぉ", "vo");
    map.insert("しぇ", "she"); map.insert("じぇ", "je"); map.insert("ちぇ", "che");
    map.insert("つぁ", "tsa"); map.insert("つぃ", "tsi"); map.insert("つぇ", "tse");
    map.insert("つぉ", "tso");
    
    // Long vowel mark
    map.insert("ー", "-");
    
    map
});

/// Convert katakana to hiragana
fn katakana_to_hiragana(text: &str) -> String {
    text.chars().map(|c| {
        let code = c as u32;
        // Katakana range: U+30A0 to U+30FF
        // Hiragana range: U+3040 to U+309F
        // Offset is 0x60
        if code >= 0x30A1 && code <= 0x30F6 {
            char::from_u32(code - 0x60).unwrap_or(c)
        } else {
            c
        }
    }).collect()
}

/// Convert kana (hiragana or katakana) to romaji
pub fn kana_to_romaji(kana: &str) -> String {
    let hiragana = katakana_to_hiragana(kana);
    let mut result = String::new();
    let chars: Vec<char> = hiragana.chars().collect();
    let mut i = 0;
    
    while i < chars.len() {
        // Handle small tsu (っ) - doubles the next consonant
        if chars[i] == 'っ' {
            i += 1;
            // Look ahead for next consonant
            if i < chars.len() {
                let next_substr = chars[i..].iter().take(3).collect::<String>();
                for len in (1..=3.min(next_substr.len())).rev() {
                    if let Some(romaji) = ROMAJI_MAP.get(&next_substr[..len]) {
                        if let Some(first_char) = romaji.chars().next() {
                            let double_char = if first_char == 'c' { 't' } else { first_char };
                            result.push(double_char);
                        }
                        break;
                    }
                }
            }
            continue;
        }
        
        // Try to match multi-character sequences first (up to 3 chars)
        let mut matched = false;
        for len in (1..=3.min(chars.len() - i)).rev() {
            let substr: String = chars[i..i+len].iter().collect();
            if let Some(romaji) = ROMAJI_MAP.get(substr.as_str()) {
                result.push_str(romaji);
                i += len;
                matched = true;
                break;
            }
        }
        
        // If no match, append the character as-is
        if !matched {
            result.push(chars[i]);
            i += 1;
        }
    }
    
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_basic_hiragana() {
        assert_eq!(kana_to_romaji("あいうえお"), "aiueo");
        assert_eq!(kana_to_romaji("かきくけこ"), "kakikukeko");
    }
    
    #[test]
    fn test_katakana() {
        assert_eq!(kana_to_romaji("アイウエオ"), "aiueo");
        assert_eq!(kana_to_romaji("カキクケコ"), "kakikukeko");
    }
    
    #[test]
    fn test_youon() {
        assert_eq!(kana_to_romaji("きゃきゅきょ"), "kyakyukyo");
        assert_eq!(kana_to_romaji("しゃしゅしょ"), "shashusho");
    }
    
    #[test]
    fn test_sokuon() {
        assert_eq!(kana_to_romaji("かった"), "katta");
        assert_eq!(kana_to_romaji("にっぽん"), "nippon");
    }
    
    #[test]
    fn test_zenkoku() {
        assert_eq!(kana_to_romaji("ぜんこく"), "zenkoku");
    }
}

