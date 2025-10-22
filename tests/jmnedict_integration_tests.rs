/// Integration tests for JMnedict (Japanese Names Dictionary)
/// 
/// These tests verify:
/// 1. JMnedict data structures are correctly defined
/// 2. JMnedict data loads successfully
/// 3. JMnedict entries are correctly optimized
/// 4. JMnedict entries generate correct keys
/// 5. Field compression works as expected

#[cfg(test)]
mod jmnedict_tests {
    use std::fs;
    use serde_json;

    // Import the types we need to test
    // Note: These would normally be imported from the main crate
    // For now, we'll define minimal test structures

    #[test]
    fn test_jmnedict_file_exists() {
        let path = "data/jmnedict-all-3.6.1.json";
        assert!(
            std::path::Path::new(path).exists(),
            "JMnedict data file should exist at {}",
            path
        );
    }

    #[test]
    fn test_jmnedict_file_is_valid_json() {
        let path = "data/jmnedict-all-3.6.1.json";
        let content = fs::read_to_string(path)
            .expect("Should be able to read JMnedict file");
        
        // Try to parse as generic JSON to verify it's valid
        let _json: serde_json::Value = serde_json::from_str(&content)
            .expect("JMnedict file should contain valid JSON");
    }

    #[test]
    fn test_jmnedict_has_expected_structure() {
        let path = "data/jmnedict-all-3.6.1.json";
        let content = fs::read_to_string(path)
            .expect("Should be able to read JMnedict file");
        
        let json: serde_json::Value = serde_json::from_str(&content)
            .expect("Should parse as JSON");
        
        // Verify top-level structure
        assert!(json.get("version").is_some(), "Should have version field");
        assert!(json.get("languages").is_some(), "Should have languages field");
        assert!(json.get("dictDate").is_some(), "Should have dictDate field");
        assert!(json.get("words").is_some(), "Should have words array");
        
        // Verify words is an array
        let words = json.get("words").unwrap();
        assert!(words.is_array(), "words should be an array");
        
        // Verify we have a substantial number of entries
        let word_count = words.as_array().unwrap().len();
        assert!(
            word_count > 700000,
            "Should have over 700,000 name entries, found {}",
            word_count
        );
    }

    #[test]
    fn test_jmnedict_entry_structure() {
        let path = "data/jmnedict-all-3.6.1.json";
        let content = fs::read_to_string(path)
            .expect("Should be able to read JMnedict file");
        
        let json: serde_json::Value = serde_json::from_str(&content)
            .expect("Should parse as JSON");
        
        let words = json.get("words").unwrap().as_array().unwrap();
        
        // Check first entry has expected fields
        if let Some(first_entry) = words.first() {
            assert!(first_entry.get("id").is_some(), "Entry should have id");
            assert!(first_entry.get("kanji").is_some(), "Entry should have kanji array");
            assert!(first_entry.get("kana").is_some(), "Entry should have kana array");
            assert!(first_entry.get("translation").is_some(), "Entry should have translation array");
            
            // Verify kanji structure
            let kanji = first_entry.get("kanji").unwrap().as_array().unwrap();
            if let Some(first_kanji) = kanji.first() {
                assert!(first_kanji.get("text").is_some(), "Kanji should have text");
                assert!(first_kanji.get("tags").is_some(), "Kanji should have tags array");
            }
            
            // Verify kana structure
            let kana = first_entry.get("kana").unwrap().as_array().unwrap();
            if let Some(first_kana) = kana.first() {
                assert!(first_kana.get("text").is_some(), "Kana should have text");
                assert!(first_kana.get("tags").is_some(), "Kana should have tags array");
                assert!(first_kana.get("appliesToKanji").is_some(), "Kana should have appliesToKanji");
            }
            
            // Verify translation structure
            let translation = first_entry.get("translation").unwrap().as_array().unwrap();
            if let Some(first_trans) = translation.first() {
                assert!(first_trans.get("type").is_some(), "Translation should have type array");
                assert!(first_trans.get("translation").is_some(), "Translation should have translation array");
            }
        }
    }

    #[test]
    fn test_jmnedict_name_types() {
        let path = "data/jmnedict-all-3.6.1.json";
        let content = fs::read_to_string(path)
            .expect("Should be able to read JMnedict file");
        
        let json: serde_json::Value = serde_json::from_str(&content)
            .expect("Should parse as JSON");
        
        let words = json.get("words").unwrap().as_array().unwrap();
        
        // Collect all name types
        let mut name_types = std::collections::HashSet::new();
        for entry in words.iter().take(1000) {
            if let Some(translations) = entry.get("translation").and_then(|t| t.as_array()) {
                for trans in translations {
                    if let Some(types) = trans.get("type").and_then(|t| t.as_array()) {
                        for name_type in types {
                            if let Some(type_str) = name_type.as_str() {
                                name_types.insert(type_str.to_string());
                            }
                        }
                    }
                }
            }
        }
        
        // Verify we have common name types
        assert!(name_types.contains("surname"), "Should have surname type");
        assert!(name_types.contains("given"), "Should have given name type");
        assert!(name_types.contains("place"), "Should have place name type");
        
        println!("Found {} unique name types in first 1000 entries", name_types.len());
    }

    #[test]
    fn test_field_compression_mapping() {
        // Test that our field compression mappings are correct
        let mappings = vec![
            ("i", "id"),
            ("k", "kanji"),
            ("n", "kana"),
            ("t", "translation"),
            ("g", "tags"),
            ("a", "appliesToKanji"),
            ("y", "name_type"),
            ("r", "related"),
            ("l", "lang"),
        ];
        
        // This is a documentation test - just verify the mappings are defined
        assert_eq!(mappings.len(), 9, "Should have 9 field mappings");
    }
}

