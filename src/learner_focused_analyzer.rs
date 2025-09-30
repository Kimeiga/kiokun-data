use crate::improved_unified_types::*;
use crate::combined_types::CombinedEntry;
use std::collections::HashMap;

/// Analyzes unified entries to create learner-focused structures for complex characters
pub struct LearnerFocusedAnalyzer {
    semantic_keywords: HashMap<String, String>,
}

impl LearnerFocusedAnalyzer {
    pub fn new() -> Self {
        let mut semantic_keywords = HashMap::new();
        
        // Grammatical function keywords
        semantic_keywords.insert("possessive".to_string(), "grammatical_function".to_string());
        semantic_keywords.insert("particle".to_string(), "grammatical_function".to_string());
        semantic_keywords.insert("suffix".to_string(), "grammatical_function".to_string());
        semantic_keywords.insert("adjectival".to_string(), "grammatical_function".to_string());
        
        // Target/goal keywords
        semantic_keywords.insert("target".to_string(), "target_goal".to_string());
        semantic_keywords.insert("mark".to_string(), "target_goal".to_string());
        semantic_keywords.insert("bull".to_string(), "target_goal".to_string());
        semantic_keywords.insert("aim".to_string(), "target_goal".to_string());
        semantic_keywords.insert("objective".to_string(), "target_goal".to_string());
        
        // Transportation keywords
        semantic_keywords.insert("taxi".to_string(), "transportation".to_string());
        semantic_keywords.insert("cab".to_string(), "transportation".to_string());
        
        // Intensifier keywords
        semantic_keywords.insert("really".to_string(), "intensifier".to_string());
        semantic_keywords.insert("truly".to_string(), "intensifier".to_string());
        semantic_keywords.insert("very".to_string(), "intensifier".to_string());
        
        Self { semantic_keywords }
    }
    
    /// Determines if a character needs learner-focused treatment
    pub fn needs_learner_focus(&self, unified_entry: &UnifiedData) -> bool {
        let chinese_readings = self.count_chinese_readings(unified_entry);
        let japanese_readings = self.count_japanese_readings(unified_entry);

        // Criteria: Multiple readings in both languages (like 的)
        chinese_readings >= 2 && japanese_readings >= 2
    }

    /// Determines if a character needs learner-focused treatment (full entry version)
    pub fn needs_learner_focus_full(&self, improved_entry: &ImprovedUnifiedEntry) -> bool {
        let chinese_readings = self.count_chinese_readings(&improved_entry.unified);
        let japanese_readings = self.count_japanese_readings_full(improved_entry);

        // Criteria: Multiple readings in both languages (like 的)
        chinese_readings >= 2 && japanese_readings >= 2
    }
    
    /// Creates a learner-focused entry for complex characters
    pub fn create_learner_focused_entry(&self, unified_entry: &UnifiedData) -> LearnerFocusedEntry {
        let character = unified_entry.representations.traditional.clone();
        let is_multi_reading = self.needs_learner_focus(unified_entry);
        
        let chinese_section = self.create_chinese_section(unified_entry);
        let japanese_section = self.create_japanese_section(unified_entry);
        let insights = self.generate_cross_linguistic_insights(unified_entry);
        let complexity_score = self.calculate_complexity_score(unified_entry);
        
        LearnerFocusedEntry {
            character,
            is_multi_reading_overlap: is_multi_reading,
            chinese_section,
            japanese_section,
            cross_linguistic_insights: insights,
            complexity_score,
        }
    }
    
    fn count_chinese_readings(&self, unified_entry: &UnifiedData) -> usize {
        unified_entry.representations.chinese_pinyin.len()
    }
    
    fn count_japanese_readings(&self, unified_entry: &UnifiedData) -> usize {
        // Count readings from main unified entry
        let main_readings = unified_entry.representations.japanese_kana.len();

        // Count additional readings from japanese_specific_entries (if available)
        // Note: This requires access to the full ImprovedUnifiedEntry, not just UnifiedData
        // For now, we'll estimate based on the number of Japanese definitions with different readings
        let mut japanese_readings_set = std::collections::HashSet::new();

        for def in &unified_entry.definitions {
            if def.source_language == "japanese" {
                if let Some(japanese_fields) = &def.japanese_fields {
                    // Try to infer reading from the definition context
                    // This is a simplified approach - in a full implementation we'd need access to the complete entry
                    japanese_readings_set.insert("inferred_reading");
                }
            }
        }

        // Use the larger of the two counts
        std::cmp::max(main_readings, japanese_readings_set.len())
    }

    fn count_japanese_readings_full(&self, improved_entry: &ImprovedUnifiedEntry) -> usize {
        let mut all_readings = std::collections::HashSet::new();

        // Count readings from main unified entry
        for kana in &improved_entry.unified.representations.japanese_kana {
            all_readings.insert(kana.text.clone());
        }

        // Count readings from japanese_specific_entries
        for japanese_entry in &improved_entry.japanese_specific_entries {
            for kana in &japanese_entry.kana {
                all_readings.insert(kana.text.clone());
            }
        }

        all_readings.len()
    }
    
    fn create_chinese_section(&self, unified_entry: &UnifiedData) -> Option<LanguageSection> {
        let chinese_definitions: Vec<_> = unified_entry.definitions.iter()
            .filter(|def| def.source_language == "chinese")
            .collect();
            
        if chinese_definitions.is_empty() {
            return None;
        }
        
        // Group definitions by pinyin and semantic category
        let mut reading_groups: HashMap<String, Vec<&UnifiedDefinition>> = HashMap::new();
        for def in &chinese_definitions {
            if let Some(chinese_fields) = &def.chinese_fields {
                if let Some(pinyin) = &chinese_fields.pinyin {
                    reading_groups.entry(pinyin.clone()).or_default().push(def);
                }
            }
        }
        
        // Find primary meaning (most frequent/important)
        let primary_meaning = self.find_primary_chinese_meaning(&reading_groups, unified_entry);
        
        // Create secondary meanings
        let secondary_meanings = self.create_secondary_chinese_meanings(&reading_groups, &primary_meaning);
        
        Some(LanguageSection {
            primary_meaning,
            secondary_meanings,
            total_readings: reading_groups.len(),
        })
    }
    
    fn create_japanese_section(&self, unified_entry: &UnifiedData) -> Option<LanguageSection> {
        let japanese_definitions: Vec<_> = unified_entry.definitions.iter()
            .filter(|def| def.source_language == "japanese")
            .collect();
            
        if japanese_definitions.is_empty() {
            return None;
        }
        
        // Group by reading (kana)
        let mut reading_groups: HashMap<String, Vec<&UnifiedDefinition>> = HashMap::new();
        
        // For Japanese, we need to map definitions to their kana readings
        for kana_variant in &unified_entry.representations.japanese_kana {
            let kana_reading = &kana_variant.text;
            let matching_defs: Vec<_> = japanese_definitions.iter()
                .filter(|def| {
                    // This is a simplified matching - in reality we'd need more sophisticated logic
                    def.japanese_fields.is_some()
                })
                .cloned()
                .collect();
            
            if !matching_defs.is_empty() {
                reading_groups.insert(kana_reading.clone(), matching_defs);
            }
        }
        
        if reading_groups.is_empty() {
            return None;
        }
        
        let primary_meaning = self.find_primary_japanese_meaning(&reading_groups, unified_entry);
        let secondary_meanings = self.create_secondary_japanese_meanings(&reading_groups, &primary_meaning);
        
        Some(LanguageSection {
            primary_meaning,
            secondary_meanings,
            total_readings: reading_groups.len(),
        })
    }
    
    fn find_primary_chinese_meaning(
        &self, 
        reading_groups: &HashMap<String, Vec<&UnifiedDefinition>>,
        unified_entry: &UnifiedData
    ) -> PrimaryMeaning {
        // Priority: HSK level, frequency, definition count
        let mut best_reading = String::new();
        let mut best_score = 0.0;
        
        for (reading, definitions) in reading_groups {
            let mut score = definitions.len() as f64; // More definitions = higher priority
            
            // Boost score based on frequency indicators
            if let Some(stats) = &unified_entry.statistics.chinese {
                if let Some(hsk_level) = stats.hsk_level {
                    if hsk_level <= 2 {
                        score += 10.0; // HSK 1-2 gets priority
                    }
                }
                score += (stats.movie_word_count.unwrap_or(0) as f64).log10();
            }
            
            if score > best_score {
                best_score = score;
                best_reading = reading.clone();
            }
        }
        
        let definitions = reading_groups.get(&best_reading).unwrap();
        let primary_def = definitions.first().unwrap();
        
        PrimaryMeaning {
            reading: best_reading,
            definition: primary_def.text.clone(),
            examples: vec![], // TODO: Extract from examples
            frequency_level: self.determine_frequency_level(unified_entry),
            proficiency_level: self.determine_proficiency_level(unified_entry),
            semantic_category: self.classify_semantic_category(&primary_def.text),
        }
    }
    
    fn find_primary_japanese_meaning(
        &self,
        reading_groups: &HashMap<String, Vec<&UnifiedDefinition>>,
        unified_entry: &UnifiedData
    ) -> PrimaryMeaning {
        // For Japanese, prioritize by commonality and JLPT level
        let mut best_reading = String::new();
        let mut best_score = 0.0;
        
        for (reading, definitions) in reading_groups {
            let mut score = definitions.len() as f64;
            
            // Check if this reading is marked as common
            for kana_variant in &unified_entry.representations.japanese_kana {
                if kana_variant.text == *reading && kana_variant.common {
                    score += 5.0;
                }
            }
            
            if score > best_score {
                best_score = score;
                best_reading = reading.clone();
            }
        }
        
        let definitions = reading_groups.get(&best_reading).unwrap();
        let primary_def = definitions.first().unwrap();
        
        PrimaryMeaning {
            reading: best_reading,
            definition: primary_def.text.clone(),
            examples: vec![],
            frequency_level: "medium".to_string(), // TODO: Implement Japanese frequency
            proficiency_level: None, // TODO: Add JLPT level detection
            semantic_category: self.classify_semantic_category(&primary_def.text),
        }
    }
    
    fn create_secondary_chinese_meanings(
        &self,
        reading_groups: &HashMap<String, Vec<&UnifiedDefinition>>,
        primary: &PrimaryMeaning
    ) -> Vec<SecondaryMeaning> {
        let mut secondary = Vec::new();
        
        for (reading, definitions) in reading_groups {
            if *reading != primary.reading {
                let def = definitions.first().unwrap();
                secondary.push(SecondaryMeaning {
                    reading: reading.clone(),
                    definition: def.text.clone(),
                    frequency_level: "low".to_string(), // Simplified
                    semantic_category: self.classify_semantic_category(&def.text),
                });
            }
        }
        
        secondary
    }
    
    fn create_secondary_japanese_meanings(
        &self,
        reading_groups: &HashMap<String, Vec<&UnifiedDefinition>>,
        primary: &PrimaryMeaning
    ) -> Vec<SecondaryMeaning> {
        let mut secondary = Vec::new();
        
        for (reading, definitions) in reading_groups {
            if *reading != primary.reading {
                let def = definitions.first().unwrap();
                secondary.push(SecondaryMeaning {
                    reading: reading.clone(),
                    definition: def.text.clone(),
                    frequency_level: "medium".to_string(),
                    semantic_category: self.classify_semantic_category(&def.text),
                });
            }
        }
        
        secondary
    }
    
    fn classify_semantic_category(&self, definition: &str) -> String {
        let definition_lower = definition.to_lowercase();
        
        for (keyword, category) in &self.semantic_keywords {
            if definition_lower.contains(keyword) {
                return category.clone();
            }
        }
        
        "general".to_string()
    }
    
    fn determine_frequency_level(&self, unified_entry: &UnifiedData) -> String {
        if let Some(stats) = &unified_entry.statistics.chinese {
            if let Some(hsk_level) = stats.hsk_level {
                if hsk_level <= 2 {
                    "very_high".to_string()
                } else if hsk_level <= 4 {
                    "high".to_string()
                } else {
                    "medium".to_string()
                }
            } else {
                "unknown".to_string()
            }
        } else {
            "unknown".to_string()
        }
    }

    fn determine_proficiency_level(&self, unified_entry: &UnifiedData) -> Option<String> {
        if let Some(stats) = &unified_entry.statistics.chinese {
            if let Some(hsk_level) = stats.hsk_level {
                Some(format!("HSK {}", hsk_level))
            } else {
                None
            }
        } else {
            None
        }
    }
    
    fn generate_cross_linguistic_insights(&self, unified_entry: &UnifiedData) -> Vec<CrossLinguisticInsight> {
        let mut insights = Vec::new();
        
        // Find semantic matches between Chinese and Japanese definitions
        let chinese_defs: Vec<_> = unified_entry.definitions.iter()
            .filter(|def| def.source_language == "chinese")
            .collect();
        let japanese_defs: Vec<_> = unified_entry.definitions.iter()
            .filter(|def| def.source_language == "japanese")
            .collect();
        
        for chinese_def in &chinese_defs {
            for japanese_def in &japanese_defs {
                let chinese_category = self.classify_semantic_category(&chinese_def.text);
                let japanese_category = self.classify_semantic_category(&japanese_def.text);
                
                if chinese_category == japanese_category && chinese_category != "general" {
                    insights.push(CrossLinguisticInsight {
                        insight_type: if self.definitions_semantically_identical(&chinese_def.text, &japanese_def.text) {
                            InsightType::ExactSemanticMatch
                        } else {
                            InsightType::FunctionalSimilarity
                        },
                        description: format!(
                            "Both languages use this character for {} functions",
                            chinese_category
                        ),
                        confidence: 0.8,
                    });
                    break; // Only add one insight per category
                }
            }
        }
        
        // Add language-specific insights
        if chinese_defs.len() > japanese_defs.len() {
            insights.push(CrossLinguisticInsight {
                insight_type: InsightType::LanguageSpecific,
                description: "This character has additional meanings specific to Chinese".to_string(),
                confidence: 0.9,
            });
        }
        
        insights
    }
    
    fn definitions_semantically_identical(&self, chinese_def: &str, japanese_def: &str) -> bool {
        // Simple heuristic - could be improved with NLP
        let chinese_words: Vec<&str> = chinese_def.split_whitespace().collect();
        let japanese_words: Vec<&str> = japanese_def.split_whitespace().collect();
        
        // Check for common words
        let common_words = ["target", "mark", "aim", "goal", "objective"];
        let chinese_has_common = chinese_words.iter().any(|w| common_words.contains(&w.to_lowercase().as_str()));
        let japanese_has_common = japanese_words.iter().any(|w| common_words.contains(&w.to_lowercase().as_str()));
        
        chinese_has_common && japanese_has_common
    }
    
    fn calculate_complexity_score(&self, unified_entry: &UnifiedData) -> f64 {
        let chinese_readings = self.count_chinese_readings(unified_entry) as f64;
        let japanese_readings = self.count_japanese_readings(unified_entry) as f64;
        let total_definitions = unified_entry.definitions.len() as f64;
        
        // Complexity = readings * definitions, normalized
        (chinese_readings + japanese_readings) * total_definitions / 10.0
    }
}
