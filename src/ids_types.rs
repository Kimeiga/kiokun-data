use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents a single IDS (Ideographic Description Sequence) entry
/// from the CHISE IDS database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdsEntry {
    /// Unicode codepoint (e.g., "U+4E00")
    pub codepoint: String,
    
    /// The actual character (e.g., "一")
    pub character: String,
    
    /// Ideographic Description Sequence showing character composition
    /// Uses special IDS operators (⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻)
    pub ids: String,
    
    /// Optional apparent structure (alternative decomposition)
    /// Present when the functional and apparent structures differ
    pub apparent_ids: Option<String>,
}

/// Collection of IDS entries indexed by character
pub type IdsDatabase = HashMap<String, IdsEntry>;

impl IdsEntry {
    /// Parse a single line from an IDS file
    /// Format: <CODEPOINT><TAB><CHARACTER><TAB><IDS>(<TAB>@apparent=<IDS>)
    pub fn from_line(line: &str) -> Option<Self> {
        // Skip comment lines
        if line.trim().is_empty() || line.starts_with(";;") {
            return None;
        }
        
        let parts: Vec<&str> = line.split('\t').collect();
        
        if parts.len() < 3 {
            return None;
        }
        
        let codepoint = parts[0].to_string();
        let character = parts[1].to_string();
        let ids = parts[2].to_string();
        
        // Check for optional @apparent field
        let apparent_ids = if parts.len() >= 4 && parts[3].starts_with("@apparent=") {
            Some(parts[3].trim_start_matches("@apparent=").to_string())
        } else {
            None
        };
        
        Some(IdsEntry {
            codepoint,
            character,
            ids,
            apparent_ids,
        })
    }
    
    /// Check if this entry has a decomposition (IDS is different from the character itself)
    pub fn has_decomposition(&self) -> bool {
        self.ids != self.character
    }
    
    /// Get the primary IDS to use (prefers apparent over functional if available)
    pub fn primary_ids(&self) -> &str {
        self.apparent_ids.as_deref().unwrap_or(&self.ids)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_simple_entry() {
        let line = "U+4E00\t一\t一";
        let entry = IdsEntry::from_line(line).unwrap();
        
        assert_eq!(entry.codepoint, "U+4E00");
        assert_eq!(entry.character, "一");
        assert_eq!(entry.ids, "一");
        assert_eq!(entry.apparent_ids, None);
        assert!(!entry.has_decomposition());
    }
    
    #[test]
    fn test_parse_decomposed_entry() {
        let line = "U+4E06\t丆\t⿱一丿";
        let entry = IdsEntry::from_line(line).unwrap();
        
        assert_eq!(entry.codepoint, "U+4E06");
        assert_eq!(entry.character, "丆");
        assert_eq!(entry.ids, "⿱一丿");
        assert!(entry.has_decomposition());
    }
    
    #[test]
    fn test_parse_with_apparent() {
        let line = "U+4E9A\t亚\t亚\t@apparent=⿱一业";
        let entry = IdsEntry::from_line(line).unwrap();
        
        assert_eq!(entry.codepoint, "U+4E9A");
        assert_eq!(entry.character, "亚");
        assert_eq!(entry.ids, "亚");
        assert_eq!(entry.apparent_ids, Some("⿱一业".to_string()));
        assert_eq!(entry.primary_ids(), "⿱一业");
    }
    
    #[test]
    fn test_skip_comment() {
        let line = ";; This is a comment";
        let entry = IdsEntry::from_line(line);
        assert!(entry.is_none());
    }
    
    #[test]
    fn test_skip_empty() {
        let line = "";
        let entry = IdsEntry::from_line(line);
        assert!(entry.is_none());
    }
}

