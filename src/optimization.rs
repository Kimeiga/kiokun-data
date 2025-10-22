use crate::optimized_output_types::OptimizedOutput;
use crate::simple_output_types::SimpleOutput;

/// Convert SimpleOutput to OptimizedOutput with field name compression
pub fn optimize_output(simple: SimpleOutput) -> OptimizedOutput {
    OptimizedOutput {
        key: simple.key,
        redirect: simple.redirect,
        chinese_words: simple.chinese_words,
        chinese_char: simple.chinese_char,
        japanese_words: simple.japanese_words,
        japanese_char: simple.japanese_char,
        related_japanese_words: simple.related_japanese_words,
        japanese_names: simple.japanese_names,
        contains: simple.contains,
        contained_in_chinese: simple.contained_in_chinese,
        contained_in_japanese: simple.contained_in_japanese,
    }
}
