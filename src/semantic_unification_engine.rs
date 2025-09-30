use crate::improved_unified_types::*;
use crate::combined_types::CombinedEntry;
use std::collections::HashMap;

/// Engine for creating semantically unified entries
pub struct SemanticUnificationEngine {
    semantic_keywords: HashMap<String, SemanticCategory>,
}

impl SemanticUnificationEngine {
    pub fn new() -> Self {
        let mut semantic_keywords = HashMap::new();
        
        // Grammatical modifier keywords
        semantic_keywords.insert("possessive".to_string(), SemanticCategory::GrammaticalModifier);
        semantic_keywords.insert("particle".to_string(), SemanticCategory::GrammaticalModifier);
        semantic_keywords.insert("suffix".to_string(), SemanticCategory::GrammaticalModifier);
        semantic_keywords.insert("adjectival".to_string(), SemanticCategory::GrammaticalModifier);
        semantic_keywords.insert("-ical".to_string(), SemanticCategory::GrammaticalModifier);
        semantic_keywords.insert("-ive".to_string(), SemanticCategory::GrammaticalModifier);
        semantic_keywords.insert("-al".to_string(), SemanticCategory::GrammaticalModifier);
        
        // Target/goal keywords
        semantic_keywords.insert("target".to_string(), SemanticCategory::TargetGoal);
        semantic_keywords.insert("mark".to_string(), SemanticCategory::TargetGoal);
        semantic_keywords.insert("aim".to_string(), SemanticCategory::TargetGoal);
        semantic_keywords.insert("objective".to_string(), SemanticCategory::TargetGoal);
        semantic_keywords.insert("goal".to_string(), SemanticCategory::TargetGoal);
        
        // Transportation keywords
        semantic_keywords.insert("taxi".to_string(), SemanticCategory::Transportation);
        semantic_keywords.insert("cab".to_string(), SemanticCategory::Transportation);
        
        // Intensifier keywords
        semantic_keywords.insert("really".to_string(), SemanticCategory::Intensifier);
        semantic_keywords.insert("truly".to_string(), SemanticCategory::Intensifier);
        semantic_keywords.insert("very".to_string(), SemanticCategory::Intensifier);
        
        // Emptiness keywords
        semantic_keywords.insert("empty".to_string(), SemanticCategory::EmptinessVoid);
        semantic_keywords.insert("hollow".to_string(), SemanticCategory::EmptinessVoid);
        semantic_keywords.insert("void".to_string(), SemanticCategory::EmptinessVoid);
        semantic_keywords.insert("vacant".to_string(), SemanticCategory::EmptinessVoid);
        
        // Conflict keywords
        semantic_keywords.insert("enemy".to_string(), SemanticCategory::ConflictOpposition);
        semantic_keywords.insert("rival".to_string(), SemanticCategory::ConflictOpposition);
        semantic_keywords.insert("hate".to_string(), SemanticCategory::ConflictOpposition);
        semantic_keywords.insert("hatred".to_string(), SemanticCategory::ConflictOpposition);
        
        // Comparison keywords
        semantic_keywords.insert("compare".to_string(), SemanticCategory::Comparison);
        semantic_keywords.insert("ratio".to_string(), SemanticCategory::Comparison);
        semantic_keywords.insert("proportion".to_string(), SemanticCategory::Comparison);
        
        // Harmony keywords
        semantic_keywords.insert("harmony".to_string(), SemanticCategory::Harmony);
        semantic_keywords.insert("peace".to_string(), SemanticCategory::Harmony);
        semantic_keywords.insert("calm".to_string(), SemanticCategory::Harmony);
        
        Self { semantic_keywords }
    }
    
    /// Create a semantically unified entry from a combined entry
    pub fn create_semantic_unified_entry(&self, combined: &CombinedEntry) -> SemanticUnifiedData {
        // Extract Chinese and Japanese definitions
        let chinese_definitions = self.extract_chinese_definitions(combined);
        let japanese_definitions = self.extract_japanese_definitions(combined);
        
        // Create semantic clusters
        let semantic_clusters = self.create_semantic_clusters(&chinese_definitions, &japanese_definitions);
        
        // Generate unified meanings from clusters
        let unified_meanings = self.generate_unified_meanings(&semantic_clusters);
        
        // Extract language-specific meanings
        let chinese_only = self.extract_chinese_only_meanings(&chinese_definitions, &unified_meanings);
        let japanese_only = self.extract_japanese_only_meanings(&japanese_definitions, &unified_meanings);
        
        // Create other components (reuse existing logic)
        let representations = self.create_representations(combined);
        let statistics = self.create_statistics(combined);
        let examples = self.create_examples(combined);
        let linguistic_info = self.create_linguistic_info(combined);
        
        SemanticUnifiedData {
            representations,
            unified_meanings,
            chinese_only_meanings: chinese_only,
            japanese_only_meanings: japanese_only,
            statistics,
            examples,
            linguistic_info,
        }
    }
    
    fn extract_chinese_definitions(&self, combined: &CombinedEntry) -> Vec<ChineseDefinition> {
        let mut definitions = Vec::new();
        
        if let Some(chinese_entry) = &combined.chinese_entry {
            for item in &chinese_entry.items {
                if let Some(item_definitions) = &item.definitions {
                    for def in item_definitions {
                        definitions.push(ChineseDefinition {
                            text: def.clone(),
                            pinyin: item.pinyin.clone().unwrap_or_default(),
                            semantic_category: self.classify_semantic_category(def),
                        });
                    }
                }
            }
        }
        
        definitions
    }
    
    fn extract_japanese_definitions(&self, combined: &CombinedEntry) -> Vec<JapaneseDefinition> {
        let mut definitions = Vec::new();
        
        // From main Japanese entry
        if let Some(japanese_entry) = &combined.japanese_entry {
            for sense in &japanese_entry.sense {
                for gloss in &sense.gloss {
                    let reading = japanese_entry.kana.first()
                        .map(|k| k.text.clone())
                        .unwrap_or_default();

                    definitions.push(JapaneseDefinition {
                        text: gloss.text.clone(),
                        reading,
                        semantic_category: self.classify_semantic_category(&gloss.text),
                    });
                }
            }
        }

        // From specific Japanese entries
        for japanese_entry in &combined.japanese_specific_entries {
            for sense in &japanese_entry.sense {
                for gloss in &sense.gloss {
                    let reading = japanese_entry.kana.first()
                        .map(|k| k.text.clone())
                        .unwrap_or_default();

                    definitions.push(JapaneseDefinition {
                        text: gloss.text.clone(),
                        reading,
                        semantic_category: self.classify_semantic_category(&gloss.text),
                    });
                }
            }
        }
        
        definitions
    }
    
    fn classify_semantic_category(&self, definition: &str) -> SemanticCategory {
        let definition_lower = definition.to_lowercase();
        
        for (keyword, category) in &self.semantic_keywords {
            if definition_lower.contains(keyword) {
                return category.clone();
            }
        }
        
        SemanticCategory::General
    }
    
    fn create_semantic_clusters(&self, chinese_defs: &[ChineseDefinition], japanese_defs: &[JapaneseDefinition]) -> Vec<SemanticCluster> {
        let mut clusters = Vec::new();
        let mut used_chinese = vec![false; chinese_defs.len()];
        let mut used_japanese = vec![false; japanese_defs.len()];
        
        // Find exact semantic matches
        for (i, chinese_def) in chinese_defs.iter().enumerate() {
            if used_chinese[i] { continue; }
            
            for (j, japanese_def) in japanese_defs.iter().enumerate() {
                if used_japanese[j] { continue; }
                
                if chinese_def.semantic_category == japanese_def.semantic_category 
                   && chinese_def.semantic_category != SemanticCategory::General {
                    
                    clusters.push(SemanticCluster {
                        semantic_category: chinese_def.semantic_category.clone(),
                        chinese_definitions: vec![chinese_def.clone()],
                        japanese_definitions: vec![japanese_def.clone()],
                        match_type: MatchType::ExactSemantic,
                        confidence: 0.9,
                    });
                    
                    used_chinese[i] = true;
                    used_japanese[j] = true;
                    break;
                }
            }
        }
        
        // Handle functional similarities (like possessive + adjectival suffix)
        self.find_functional_similarities(chinese_defs, japanese_defs, &mut clusters, &mut used_chinese, &mut used_japanese);
        
        clusters
    }
    
    fn find_functional_similarities(
        &self,
        chinese_defs: &[ChineseDefinition],
        japanese_defs: &[JapaneseDefinition],
        clusters: &mut Vec<SemanticCluster>,
        used_chinese: &mut [bool],
        used_japanese: &mut [bool],
    ) {
        // Special case: Chinese possessive + Japanese adjectival suffix
        for (i, chinese_def) in chinese_defs.iter().enumerate() {
            if used_chinese[i] { continue; }
            
            if chinese_def.text.to_lowercase().contains("possessive") {
                for (j, japanese_def) in japanese_defs.iter().enumerate() {
                    if used_japanese[j] { continue; }
                    
                    if japanese_def.text.to_lowercase().contains("suffix") || 
                       japanese_def.text.to_lowercase().contains("-ical") {
                        
                        clusters.push(SemanticCluster {
                            semantic_category: SemanticCategory::GrammaticalModifier,
                            chinese_definitions: vec![chinese_def.clone()],
                            japanese_definitions: vec![japanese_def.clone()],
                            match_type: MatchType::FunctionalSimilarity,
                            confidence: 0.8,
                        });
                        
                        used_chinese[i] = true;
                        used_japanese[j] = true;
                        break;
                    }
                }
            }
        }
    }
    
    fn generate_unified_meanings(&self, clusters: &[SemanticCluster]) -> Vec<UnifiedMeaning> {
        let mut unified_meanings = Vec::new();
        
        for (index, cluster) in clusters.iter().enumerate() {
            let unified_meaning = self.create_unified_meaning_from_cluster(cluster, index == 0);
            unified_meanings.push(unified_meaning);
        }
        
        // Sort by confidence and primary status
        unified_meanings.sort_by(|a, b| {
            b.is_primary.cmp(&a.is_primary)
                .then(b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal))
        });
        
        unified_meanings
    }
    
    fn extract_chinese_only_meanings(&self, chinese_defs: &[ChineseDefinition], unified_meanings: &[UnifiedMeaning]) -> Vec<LanguageSpecificMeaning> {
        let mut chinese_only = Vec::new();

        // Find Chinese definitions that weren't used in unified meanings
        for chinese_def in chinese_defs {
            let used_in_unified = unified_meanings.iter().any(|unified| {
                unified.chinese_aspect.as_ref()
                    .map(|aspect| aspect.readings.contains(&chinese_def.pinyin))
                    .unwrap_or(false)
            });

            if !used_in_unified {
                chinese_only.push(LanguageSpecificMeaning {
                    reading: chinese_def.pinyin.clone(),
                    definition: chinese_def.text.clone(),
                    examples: vec![],
                    frequency_level: FrequencyLevel::Medium, // TODO: Calculate properly
                    semantic_category: chinese_def.semantic_category.clone(),
                });
            }
        }

        chinese_only
    }

    fn extract_japanese_only_meanings(&self, japanese_defs: &[JapaneseDefinition], unified_meanings: &[UnifiedMeaning]) -> Vec<LanguageSpecificMeaning> {
        let mut japanese_only = Vec::new();

        // Find Japanese definitions that weren't used in unified meanings
        for japanese_def in japanese_defs {
            let used_in_unified = unified_meanings.iter().any(|unified| {
                unified.japanese_aspect.as_ref()
                    .map(|aspect| aspect.readings.contains(&japanese_def.reading))
                    .unwrap_or(false)
            });

            if !used_in_unified {
                japanese_only.push(LanguageSpecificMeaning {
                    reading: japanese_def.reading.clone(),
                    definition: japanese_def.text.clone(),
                    examples: vec![],
                    frequency_level: FrequencyLevel::Medium, // TODO: Calculate properly
                    semantic_category: japanese_def.semantic_category.clone(),
                });
            }
        }

        japanese_only
    }

    fn create_representations(&self, combined: &CombinedEntry) -> CharacterRepresentations {
        // Reuse existing logic from improved_unification_engine.rs
        let mut chinese_pinyin = Vec::new();
        let mut japanese_kana = Vec::new();

        if let Some(chinese_entry) = &combined.chinese_entry {
            for item in &chinese_entry.items {
                if let Some(pinyin) = &item.pinyin {
                    chinese_pinyin.push(pinyin.clone());
                }
            }
        }

        if let Some(japanese_entry) = &combined.japanese_entry {
            for kana in &japanese_entry.kana {
                japanese_kana.push(KanaVariant {
                    text: kana.text.clone(),
                    common: kana.common,
                    tags: vec![],
                    applies_to_kanji: vec![],
                });
            }
        }

        CharacterRepresentations {
            traditional: combined.word.clone(),
            simplified: combined.word.clone(), // TODO: Get actual simplified
            chinese_pinyin,
            japanese_kanji: vec![KanjiVariant {
                text: combined.word.clone(),
                common: true,
                tags: vec![],
            }],
            japanese_kana,
        }
    }

    fn create_statistics(&self, combined: &CombinedEntry) -> UnifiedStatistics {
        // Reuse existing logic
        let chinese_stats = if let Some(chinese_entry) = &combined.chinese_entry {
            Some(ChineseStats {
                hsk_level: None, // TODO: Extract HSK level from items
                movie_word_count: None,
                movie_word_count_percent: None,
                movie_word_rank: None,
                movie_word_contexts: None,
                movie_word_contexts_percent: None,
                movie_char_count: None,
                movie_char_count_percent: None,
                movie_char_rank: None,
                movie_char_contexts: None,
                movie_char_contexts_percent: None,
                book_word_count: None,
                book_word_count_percent: None,
                book_word_rank: None,
                pinyin_frequency: None,
                top_words: None,
                book_char_count: None,
                book_char_count_percent: None,
                book_char_rank: None,
            })
        } else {
            None
        };

        let japanese_stats = if combined.japanese_entry.is_some() || !combined.japanese_specific_entries.is_empty() {
            Some(JapaneseStats {
                common: false, // TODO: Extract from Japanese entry
                jlpt_level: None,
            })
        } else {
            None
        };

        UnifiedStatistics {
            chinese: chinese_stats,
            japanese: japanese_stats,
            combined_frequency_score: 0.0, // TODO: Calculate combined score
        }
    }

    fn create_examples(&self, _combined: &CombinedEntry) -> Vec<Example> {
        // TODO: Extract examples from the combined entry
        vec![]
    }

    fn create_linguistic_info(&self, _combined: &CombinedEntry) -> LinguisticInfo {
        // TODO: Extract linguistic information
        LinguisticInfo {
            parts_of_speech: vec![],
            fields: vec![],
            usage_notes: vec![],
            related_words: vec![],
            antonyms: vec![],
        }
    }

    fn create_unified_meaning_from_cluster(&self, cluster: &SemanticCluster, is_primary: bool) -> UnifiedMeaning {
        let semantic_id = format!("{:?}", cluster.semantic_category).to_lowercase();
        
        let unified_explanation = match cluster.semantic_category {
            SemanticCategory::GrammaticalModifier => {
                "Creates relationships between words - functions as a grammatical connector".to_string()
            },
            SemanticCategory::TargetGoal => {
                "Refers to a target, mark, or objective to aim for".to_string()
            },
            SemanticCategory::EmptinessVoid => {
                "Relates to emptiness, void, or absence of content".to_string()
            },
            SemanticCategory::ConflictOpposition => {
                "Indicates conflict, opposition, or adversarial relationship".to_string()
            },
            _ => {
                format!("Shared meaning related to {:?}", cluster.semantic_category)
            }
        };
        
        let chinese_aspect = if !cluster.chinese_definitions.is_empty() {
            let chinese_def = &cluster.chinese_definitions[0];
            Some(LanguageAspect {
                readings: vec![chinese_def.pinyin.clone()],
                specific_function: chinese_def.text.clone(),
                examples: vec![], // TODO: Add examples
                frequency_level: FrequencyLevel::High, // TODO: Calculate from statistics
            })
        } else {
            None
        };
        
        let japanese_aspect = if !cluster.japanese_definitions.is_empty() {
            let japanese_def = &cluster.japanese_definitions[0];
            Some(LanguageAspect {
                readings: vec![japanese_def.reading.clone()],
                specific_function: japanese_def.text.clone(),
                examples: vec![], // TODO: Add examples
                frequency_level: FrequencyLevel::High, // TODO: Calculate from statistics
            })
        } else {
            None
        };
        
        let cross_linguistic_note = match cluster.match_type {
            MatchType::ExactSemantic => Some("Both languages preserve the same core meaning".to_string()),
            MatchType::FunctionalSimilarity => Some("Similar grammatical function with language-specific variations".to_string()),
            _ => None,
        };
        
        UnifiedMeaning {
            semantic_id,
            unified_explanation,
            semantic_category: cluster.semantic_category.clone(),
            chinese_aspect,
            japanese_aspect,
            cross_linguistic_note,
            confidence: cluster.confidence,
            is_primary,
        }
    }
}

// Helper structures for internal processing
#[derive(Debug, Clone)]
struct ChineseDefinition {
    text: String,
    pinyin: String,
    semantic_category: SemanticCategory,
}

#[derive(Debug, Clone)]
struct JapaneseDefinition {
    text: String,
    reading: String,
    semantic_category: SemanticCategory,
}

#[derive(Debug, Clone)]
struct SemanticCluster {
    semantic_category: SemanticCategory,
    chinese_definitions: Vec<ChineseDefinition>,
    japanese_definitions: Vec<JapaneseDefinition>,
    match_type: MatchType,
    confidence: f64,
}

#[derive(Debug, Clone)]
enum MatchType {
    ExactSemantic,
    FunctionalSimilarity,
    NoMatch,
}
