/// Jyutping normalization module
/// Normalizes Cantonese romanization (Jyutping) for searchable text
/// Jyutping uses tone numbers 1-6 (e.g., "jat1 gin6 waan4")
/// This module strips tone numbers and normalizes spacing

/// Strip tone numbers from Jyutping, converting to plain ASCII
/// e.g., "jat1 gin6 waan4 jat1 gin6" → "jat gin waan jat gin"
pub fn normalize_jyutping(jyutping: &str) -> String {
    jyutping.chars()
        .filter(|c| {
            // Filter out tone numbers 1-6 and other numeric digits
            !c.is_ascii_digit()
        })
        .collect::<String>()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Process a jyutping_search_string field which may contain multiple readings
/// Returns a deduplicated, space-separated list of normalized readings
#[allow(dead_code)]
pub fn normalize_jyutping_search_string(search_string: &str) -> String {
    if search_string.is_empty() {
        return String::new();
    }
    
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();
    
    for part in search_string.split_whitespace() {
        // Normalize the jyutping (remove tone numbers)
        let clean: String = part.chars()
            .filter(|c| !c.is_ascii_digit())
            .collect::<String>()
            .to_lowercase();
        
        if !clean.is_empty() && !seen.contains(&clean) {
            seen.insert(clean.clone());
            result.push(clean);
        }
    }
    
    result.join(" ")
}

/// Parse Jyutping syllables from a string
/// Returns individual syllables with tone numbers preserved
/// e.g., "jat1 gin6" → ["jat1", "gin6"]
#[allow(dead_code)]
pub fn parse_jyutping_syllables(jyutping: &str) -> Vec<String> {
    jyutping
        .split_whitespace()
        .map(|s| s.to_lowercase())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_jyutping() {
        assert_eq!(normalize_jyutping("jat1 gin6 waan4"), "jat gin waan");
        assert_eq!(normalize_jyutping("din6 nou5"), "din nou");
        assert_eq!(normalize_jyutping("jau1"), "jau");
        assert_eq!(normalize_jyutping("ng5"), "ng");
    }

    #[test]
    fn test_normalize_jyutping_search_string() {
        assert_eq!(normalize_jyutping_search_string("jat1 jat1 gin6"), "jat gin");
        assert_eq!(normalize_jyutping_search_string(""), "");
    }

    #[test]
    fn test_parse_jyutping_syllables() {
        let syllables = parse_jyutping_syllables("jat1 gin6 waan4");
        assert_eq!(syllables, vec!["jat1", "gin6", "waan4"]);
    }

    #[test]
    fn test_multiple_syllables() {
        assert_eq!(normalize_jyutping("din6 si6 gik6"), "din si gik");
    }

    #[test]
    fn test_case_normalization() {
        assert_eq!(normalize_jyutping("JAT1 GIN6"), "jat gin");
    }
}

