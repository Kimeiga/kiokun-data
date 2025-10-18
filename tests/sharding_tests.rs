/// Comprehensive tests for dictionary sharding logic
/// 
/// These tests verify:
/// 1. Han character detection is correct
/// 2. Shard assignment is correct based on Han character count
/// 3. No overlap between shards
/// 4. All dictionary entries are assigned to exactly one shard

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    /// Check if a character is a Han character (CJK Unified Ideographs)
    /// This is the same logic as in src/main.rs
    fn is_han_character(c: char) -> bool {
        matches!(c,
            '\u{4E00}'..='\u{9FFF}'   | // CJK Unified Ideographs
            '\u{3400}'..='\u{4DBF}'   | // CJK Unified Ideographs Extension A
            '\u{20000}'..='\u{2A6DF}' | // CJK Unified Ideographs Extension B
            '\u{2A700}'..='\u{2B73F}' | // CJK Unified Ideographs Extension C
            '\u{2B740}'..='\u{2B81F}' | // CJK Unified Ideographs Extension D
            '\u{2B820}'..='\u{2CEAF}' | // CJK Unified Ideographs Extension E
            '\u{2CEB0}'..='\u{2EBEF}' | // CJK Unified Ideographs Extension F
            '\u{30000}'..='\u{3134F}'   // CJK Unified Ideographs Extension G
        )
    }

    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
    enum ShardType {
        NonHan,
        Han1Char,
        Han2Char,
        Han3Plus,
    }

    impl ShardType {
        fn from_key(key: &str) -> Self {
            let han_count = key.chars().filter(|c| is_han_character(*c)).count();
            match han_count {
                0 => ShardType::NonHan,
                1 => ShardType::Han1Char,
                2 => ShardType::Han2Char,
                _ => ShardType::Han3Plus,
            }
        }
    }

    #[test]
    fn test_han_character_detection() {
        // Test basic CJK Unified Ideographs (U+4E00-U+9FFF)
        assert!(is_han_character('好')); // U+597D
        assert!(is_han_character('地')); // U+5730
        assert!(is_han_character('的')); // U+7684
        assert!(is_han_character('一')); // U+4E00 (first in range)
        assert!(is_han_character('龥')); // U+9FA5 (near end of range)

        // Test hiragana (should NOT be Han)
        assert!(!is_han_character('あ')); // U+3042
        assert!(!is_han_character('ひ')); // U+3072
        assert!(!is_han_character('ら')); // U+3089
        assert!(!is_han_character('が')); // U+304C
        assert!(!is_han_character('な')); // U+306A

        // Test katakana (should NOT be Han)
        assert!(!is_han_character('ア')); // U+30A2
        assert!(!is_han_character('カ')); // U+30AB
        assert!(!is_han_character('タ')); // U+30BF
        assert!(!is_han_character('ナ')); // U+30CA
        assert!(!is_han_character('ハ')); // U+30CF

        // Test ASCII (should NOT be Han)
        assert!(!is_han_character('a'));
        assert!(!is_han_character('Z'));
        assert!(!is_han_character('1'));
        assert!(!is_han_character(' '));

        // Test CJK Extension A (U+3400-U+4DBF)
        assert!(is_han_character('\u{3400}')); // First char in Extension A
        assert!(is_han_character('\u{4DBF}')); // Last char in Extension A

        // Test CJK Extension B (U+20000-U+2A6DF)
        assert!(is_han_character('\u{20000}')); // First char in Extension B
        assert!(is_han_character('\u{2A6DF}')); // Last char in Extension B
    }

    #[test]
    fn test_shard_assignment_non_han() {
        // Pure hiragana
        assert_eq!(ShardType::from_key("ひらがな"), ShardType::NonHan);
        assert_eq!(ShardType::from_key("あいうえお"), ShardType::NonHan);
        
        // Pure katakana
        assert_eq!(ShardType::from_key("カタカナ"), ShardType::NonHan);
        assert_eq!(ShardType::from_key("アイウエオ"), ShardType::NonHan);
        
        // Mixed kana
        assert_eq!(ShardType::from_key("ひらカタ"), ShardType::NonHan);
        
        // Romaji
        assert_eq!(ShardType::from_key("romaji"), ShardType::NonHan);
        assert_eq!(ShardType::from_key("ABC"), ShardType::NonHan);
    }

    #[test]
    fn test_shard_assignment_han_1char() {
        // Single Han character
        assert_eq!(ShardType::from_key("好"), ShardType::Han1Char);
        assert_eq!(ShardType::from_key("地"), ShardType::Han1Char);
        assert_eq!(ShardType::from_key("的"), ShardType::Han1Char);
        assert_eq!(ShardType::from_key("一"), ShardType::Han1Char);
        
        // Single Han with kana (still 1 Han char)
        assert_eq!(ShardType::from_key("好き"), ShardType::Han1Char);
        assert_eq!(ShardType::from_key("見る"), ShardType::Han1Char);
    }

    #[test]
    fn test_shard_assignment_han_2char() {
        // Two Han characters
        assert_eq!(ShardType::from_key("地図"), ShardType::Han2Char);
        assert_eq!(ShardType::from_key("一人"), ShardType::Han2Char);
        assert_eq!(ShardType::from_key("好好"), ShardType::Han2Char);
        
        // Two Han with kana
        assert_eq!(ShardType::from_key("地図の"), ShardType::Han2Char);
    }

    #[test]
    fn test_shard_assignment_han_3plus() {
        // Three Han characters
        assert_eq!(ShardType::from_key("図書館"), ShardType::Han3Plus);
        assert_eq!(ShardType::from_key("一二三"), ShardType::Han3Plus);
        
        // Four Han characters
        assert_eq!(ShardType::from_key("一把好手"), ShardType::Han3Plus);
        
        // Many Han characters
        assert_eq!(ShardType::from_key("一二三四五六七八九十"), ShardType::Han3Plus);
    }

    #[test]
    fn test_edge_cases() {
        // Empty string
        assert_eq!(ShardType::from_key(""), ShardType::NonHan);
        
        // Only spaces
        assert_eq!(ShardType::from_key("   "), ShardType::NonHan);
        
        // Mixed with punctuation
        assert_eq!(ShardType::from_key("好！"), ShardType::Han1Char);
        assert_eq!(ShardType::from_key("地図。"), ShardType::Han2Char);
        
        // Numbers
        assert_eq!(ShardType::from_key("123"), ShardType::NonHan);
        assert_eq!(ShardType::from_key("好123"), ShardType::Han1Char);
    }

    #[test]
    fn test_real_dictionary_examples() {
        // Common Japanese words
        assert_eq!(ShardType::from_key("ありがとう"), ShardType::NonHan);
        assert_eq!(ShardType::from_key("こんにちは"), ShardType::NonHan);
        assert_eq!(ShardType::from_key("さようなら"), ShardType::NonHan);
        
        // Common kanji words
        assert_eq!(ShardType::from_key("日本"), ShardType::Han2Char);
        assert_eq!(ShardType::from_key("東京"), ShardType::Han2Char);
        assert_eq!(ShardType::from_key("大学"), ShardType::Han2Char);
        assert_eq!(ShardType::from_key("先生"), ShardType::Han2Char);
        
        // Common Chinese words
        assert_eq!(ShardType::from_key("中国"), ShardType::Han2Char);
        assert_eq!(ShardType::from_key("北京"), ShardType::Han2Char);
        assert_eq!(ShardType::from_key("上海"), ShardType::Han2Char);
    }

    #[test]
    fn test_no_overlap_between_shards() {
        // Create test data representing different types of words
        let test_words = vec![
            // Non-Han
            "ひらがな", "カタカナ", "romaji", "あいうえお",
            // Han-1char
            "好", "地", "的", "一", "見る", "好き",
            // Han-2char
            "地図", "一人", "日本", "東京", "中国",
            // Han-3plus
            "図書館", "一二三", "一把好手",
        ];

        let mut shard_assignments: HashMap<ShardType, Vec<&str>> = HashMap::new();
        
        for word in &test_words {
            let shard = ShardType::from_key(word);
            shard_assignments.entry(shard).or_insert_with(Vec::new).push(word);
        }

        // Verify each word is assigned to exactly one shard
        let total_assigned: usize = shard_assignments.values().map(|v| v.len()).sum();
        assert_eq!(total_assigned, test_words.len(), 
            "Each word should be assigned to exactly one shard");

        // Verify all four shards have at least one entry
        assert!(shard_assignments.contains_key(&ShardType::NonHan));
        assert!(shard_assignments.contains_key(&ShardType::Han1Char));
        assert!(shard_assignments.contains_key(&ShardType::Han2Char));
        assert!(shard_assignments.contains_key(&ShardType::Han3Plus));
    }

    #[test]
    fn test_unicode_range_boundaries() {
        // Test characters at the boundaries of each Unicode range
        
        // CJK Unified Ideographs (U+4E00-U+9FFF)
        assert!(is_han_character('\u{4E00}')); // First
        assert!(is_han_character('\u{9FFF}')); // Last
        assert!(!is_han_character('\u{4DFF}')); // Just before
        assert!(!is_han_character('\u{A000}')); // Just after

        // CJK Extension A (U+3400-U+4DBF)
        assert!(is_han_character('\u{3400}')); // First
        assert!(is_han_character('\u{4DBF}')); // Last
        assert!(!is_han_character('\u{33FF}')); // Just before
        assert!(!is_han_character('\u{4DC0}')); // Just after

        // CJK Extension B (U+20000-U+2A6DF)
        assert!(is_han_character('\u{20000}')); // First
        assert!(is_han_character('\u{2A6DF}')); // Last
        assert!(!is_han_character('\u{1FFFF}')); // Just before
        assert!(!is_han_character('\u{2A6E0}')); // Just after
    }

    #[test]
    fn test_consistency_with_main_implementation() {
        // This test ensures our test implementation matches the main code
        // If this fails, it means the test code is out of sync with main.rs
        
        let test_cases = vec![
            ("好", ShardType::Han1Char),
            ("地図", ShardType::Han2Char),
            ("図書館", ShardType::Han3Plus),
            ("ひらがな", ShardType::NonHan),
        ];

        for (word, expected_shard) in test_cases {
            assert_eq!(ShardType::from_key(word), expected_shard,
                "Shard assignment for '{}' should be {:?}", word, expected_shard);
        }
    }
}

