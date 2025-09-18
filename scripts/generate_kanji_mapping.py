#!/usr/bin/env python3
"""
Generate a comprehensive Japanese kanji to Traditional Chinese mapping
using OpenCC for all entries in the JMDict dictionary.
"""

import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

def extract_unique_kanji_from_jmdict(jmdict_path):
    """Extract all unique kanji strings from JMDict entries."""
    print("📚 Loading JMDict dictionary...")
    
    with open(jmdict_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    unique_kanji = set()
    
    print(f"📝 Processing {len(data['words'])} entries...")
    
    for word in data['words']:
        # Extract kanji entries
        if 'kanji' in word and word['kanji']:
            for kanji_entry in word['kanji']:
                if 'text' in kanji_entry:
                    kanji_text = kanji_entry['text']
                    if kanji_text:  # Skip empty strings
                        unique_kanji.add(kanji_text)
    
    print(f"✅ Found {len(unique_kanji)} unique kanji strings")
    return sorted(unique_kanji)

def generate_mapping_batch(unique_kanji):
    """Generate mapping from Japanese kanji to Traditional Chinese using batch processing."""
    print("🔄 Converting kanji to Traditional Chinese using OpenCC (batch mode)...")

    # Create a single input string with all kanji, separated by newlines
    batch_input = '\n'.join(unique_kanji)

    print(f"  📦 Processing {len(unique_kanji)} entries in single batch...")

    try:
        # Single OpenCC call for all entries
        result = subprocess.run(
            ['opencc', '-c', 'jp2t'],
            input=batch_input,
            text=True,
            capture_output=True,
            check=True
        )

        # Split results back into individual conversions
        converted_lines = result.stdout.strip().split('\n')

        if len(converted_lines) != len(unique_kanji):
            print(f"❌ Mismatch: Expected {len(unique_kanji)} results, got {len(converted_lines)}")
            return {}

        # Build mapping
        mapping = {}
        conversions_made = 0

        for original, converted in zip(unique_kanji, converted_lines):
            if converted != original:
                mapping[original] = converted
                conversions_made += 1

        print(f"✅ Generated {conversions_made} conversions out of {len(unique_kanji)} unique kanji strings")
        return mapping

    except subprocess.CalledProcessError as e:
        print(f"❌ Batch OpenCC conversion failed: {e}")
        return {}

def save_mapping_as_rust_code(mapping, output_path):
    """Save the mapping as Rust code."""
    print(f"💾 Saving mapping to {output_path}...")
    
    rust_code = '''use std::collections::HashMap;
use std::sync::LazyLock;

/// Comprehensive mapping from Japanese kanji to Traditional Chinese
/// Generated from JMDict using OpenCC jp2t configuration
pub static KANJI_TO_TRADITIONAL_MAP: LazyLock<HashMap<&'static str, &'static str>> = LazyLock::new(|| {
    let mut map = HashMap::new();
'''
    
    # Add all mappings
    for japanese, traditional in sorted(mapping.items()):
        # Escape quotes in strings
        japanese_escaped = japanese.replace('\\', '\\\\').replace('"', '\\"')
        traditional_escaped = traditional.replace('\\', '\\\\').replace('"', '\\"')
        rust_code += f'    map.insert("{japanese_escaped}", "{traditional_escaped}");\n'
    
    rust_code += '''    map
});

/// Convert Japanese kanji string to Traditional Chinese using the comprehensive mapping
pub fn convert_japanese_to_traditional(japanese: &str) -> String {
    KANJI_TO_TRADITIONAL_MAP.get(japanese)
        .map(|&traditional| traditional.to_string())
        .unwrap_or_else(|| japanese.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_basic_conversions() {
        // Test some common conversions
        assert_eq!(convert_japanese_to_traditional("学生"), "學生");
        assert_eq!(convert_japanese_to_traditional("国家"), "國家");
        assert_eq!(convert_japanese_to_traditional("会社"), "會社");
    }
    
    #[test]
    fn test_unchanged_strings() {
        // Strings that don't need conversion should remain unchanged
        let unchanged = convert_japanese_to_traditional("unchanged_test");
        assert_eq!(unchanged, "unchanged_test");
    }
}
'''
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(rust_code)
    
    print(f"✅ Saved {len(mapping)} mappings to {output_path}")

def save_mapping_as_json(mapping, output_path):
    """Save the mapping as JSON for inspection."""
    print(f"💾 Saving mapping to {output_path} for inspection...")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Saved {len(mapping)} mappings to {output_path}")

def main():
    # Paths
    jmdict_path = Path("data/jmdict-examples-eng-3.6.1.json")
    rust_output_path = Path("src/kanji_mapping_generated.rs")
    json_output_path = Path("output/kanji_mapping.json")
    
    # Ensure output directory exists
    json_output_path.parent.mkdir(exist_ok=True)
    
    if not jmdict_path.exists():
        print(f"❌ JMDict file not found: {jmdict_path}")
        sys.exit(1)
    
    # Extract unique kanji
    unique_kanji = extract_unique_kanji_from_jmdict(jmdict_path)
    
    # Generate mapping using OpenCC (batch mode)
    mapping = generate_mapping_batch(unique_kanji)
    
    # Save as Rust code
    save_mapping_as_rust_code(mapping, rust_output_path)
    
    # Save as JSON for inspection
    save_mapping_as_json(mapping, json_output_path)
    
    print("\n🎉 Kanji mapping generation complete!")
    print(f"📊 Statistics:")
    print(f"  - Total unique kanji strings: {len(unique_kanji)}")
    print(f"  - Conversions generated: {len(mapping)}")
    print(f"  - Conversion rate: {len(mapping)/len(unique_kanji)*100:.1f}%")
    print(f"📁 Files generated:")
    print(f"  - Rust code: {rust_output_path}")
    print(f"  - JSON mapping: {json_output_path}")

if __name__ == "__main__":
    main()
