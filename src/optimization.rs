use crate::optimized_output_types::OptimizedOutput;
use crate::simple_output_types::SimpleOutput;

/// Convert SimpleOutput to OptimizedOutput with field name compression
/// This is a simplified version that skips complex type transformations
pub fn optimize_output(simple: SimpleOutput) -> OptimizedOutput {
    OptimizedOutput {
        key: simple.key,
        redirect: simple.redirect,
        // For now, use empty vectors for complex types that need transformation
        chinese_words: vec![],
        chinese_char: None,
        japanese_words: vec![],
        japanese_char: None,
        // Simple fields that can be copied directly
        related_japanese_words: simple.related_japanese_words,
        japanese_names: simple.japanese_names,
        contains: simple.contains,
        contained_in_chinese: simple.contained_in_chinese,
        contained_in_japanese: simple.contained_in_japanese,
    }
}
