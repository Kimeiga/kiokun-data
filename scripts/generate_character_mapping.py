#!/usr/bin/env python3
"""
Generate Japanese kanji to Traditional Chinese character mapping
using OpenCC for all characters in KANJIDIC2.

This extends the existing j2c_mapping.json with character-level mappings.
"""

import json
import subprocess
import sys
from pathlib import Path

def extract_unique_kanji_from_kanjidic(kanjidic_path):
    """Extract all unique kanji characters from KANJIDIC2."""
    print("📚 Loading KANJIDIC2 dictionary...")
    
    with open(kanjidic_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    unique_kanji = set()
    
    print(f"📝 Processing {len(data['characters'])} kanji characters...")
    
    for char_entry in data['characters']:
        if 'literal' in char_entry:
            kanji_char = char_entry['literal']
            if kanji_char:  # Skip empty strings
                unique_kanji.add(kanji_char)
    
    print(f"✅ Found {len(unique_kanji)} unique kanji characters")
    return sorted(unique_kanji)

def generate_mapping_batch(unique_kanji):
    """Generate mapping from Japanese kanji to Traditional Chinese using batch processing."""
    print("🔄 Converting kanji to Traditional Chinese using OpenCC (batch mode)...")

    # Create a single input string with all kanji, separated by newlines
    batch_input = '\n'.join(unique_kanji)

    print(f"  📦 Processing {len(unique_kanji)} characters in single batch...")

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

        print(f"✅ Generated {conversions_made} conversions out of {len(unique_kanji)} unique kanji characters")
        return mapping

    except subprocess.CalledProcessError as e:
        print(f"❌ Batch OpenCC conversion failed: {e}")
        print(f"   Error output: {e.stderr}")
        return {}
    except FileNotFoundError:
        print("❌ OpenCC not found. Please install OpenCC:")
        print("   macOS: brew install opencc")
        print("   Linux: sudo apt-get install opencc")
        return {}

def load_existing_j2c_mapping(j2c_path):
    """Load existing j2c_mapping.json if it exists."""
    if j2c_path.exists():
        print(f"📖 Loading existing j2c_mapping from {j2c_path}...")
        with open(j2c_path, 'r', encoding='utf-8') as f:
            mapping = json.load(f)
        print(f"  ✅ Loaded {len(mapping)} existing word-level mappings")
        return mapping
    else:
        print(f"⚠️  No existing j2c_mapping found at {j2c_path}")
        return {}

def merge_mappings(existing_mapping, character_mapping):
    """Merge character-level mappings into existing word-level mappings."""
    print("🔀 Merging character-level mappings with existing word-level mappings...")
    
    merged = existing_mapping.copy()
    new_entries = 0
    
    for kanji, chinese in character_mapping.items():
        if kanji not in merged:
            merged[kanji] = chinese
            new_entries += 1
    
    print(f"  ✅ Added {new_entries} new character-level mappings")
    print(f"  📊 Total mappings: {len(merged)} (was {len(existing_mapping)})")
    
    return merged

def save_mapping_as_json(mapping, output_path):
    """Save the mapping as JSON."""
    print(f"💾 Saving merged mapping to {output_path}...")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2, sort_keys=True)
    
    print(f"✅ Saved {len(mapping)} total mappings to {output_path}")

def analyze_coverage(character_mapping, kanjidic_path, chinese_char_path):
    """Analyze how many characters from both dictionaries are covered."""
    print("\n📊 Analyzing coverage...")
    
    # Load KANJIDIC2
    with open(kanjidic_path, 'r', encoding='utf-8') as f:
        kanjidic = json.load(f)
    kanjidic_chars = {char['literal'] for char in kanjidic['characters']}
    
    # Load Chinese character dictionary
    chinese_chars = set()
    with open(chinese_char_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                try:
                    entry = json.loads(line)
                    chinese_chars.add(entry['char'])
                except:
                    continue
    
    # Check coverage
    mapped_kanji = set(character_mapping.keys())
    mapped_chinese = set(character_mapping.values())
    
    kanji_in_chinese = mapped_kanji & chinese_chars
    chinese_from_kanji = mapped_chinese & chinese_chars
    
    print(f"\n  KANJIDIC2 characters: {len(kanjidic_chars)}")
    print(f"  Chinese dictionary characters: {len(chinese_chars)}")
    print(f"  Characters with mapping: {len(character_mapping)}")
    print(f"  Kanji that map to Chinese dict: {len(kanji_in_chinese)} ({len(kanji_in_chinese)/len(kanjidic_chars)*100:.1f}%)")
    print(f"  Chinese chars from Kanji: {len(chinese_from_kanji)} ({len(chinese_from_kanji)/len(chinese_chars)*100:.1f}%)")

def main():
    # Paths
    kanjidic_path = Path("data/kanjidic2-en-3.6.1.json")
    chinese_char_path = Path("data/chinese_dictionary_char_2025-06-25.jsonl")
    j2c_mapping_path = Path("output/j2c_mapping.json")
    
    # Ensure output directory exists
    j2c_mapping_path.parent.mkdir(exist_ok=True)
    
    if not kanjidic_path.exists():
        print(f"❌ KANJIDIC2 file not found: {kanjidic_path}")
        sys.exit(1)
    
    if not chinese_char_path.exists():
        print(f"❌ Chinese character dictionary not found: {chinese_char_path}")
        sys.exit(1)
    
    # Extract unique kanji characters
    unique_kanji = extract_unique_kanji_from_kanjidic(kanjidic_path)
    
    # Generate character-level mapping using OpenCC (batch mode)
    character_mapping = generate_mapping_batch(unique_kanji)
    
    if not character_mapping:
        print("❌ No character mappings generated. Exiting.")
        sys.exit(1)
    
    # Load existing j2c_mapping
    existing_mapping = load_existing_j2c_mapping(j2c_mapping_path)
    
    # Merge mappings
    merged_mapping = merge_mappings(existing_mapping, character_mapping)
    
    # Save merged mapping
    save_mapping_as_json(merged_mapping, j2c_mapping_path)
    
    # Analyze coverage
    analyze_coverage(character_mapping, kanjidic_path, chinese_char_path)
    
    print("\n🎉 Character mapping generation complete!")
    print(f"📊 Statistics:")
    print(f"  - Total unique kanji characters: {len(unique_kanji)}")
    print(f"  - Character conversions generated: {len(character_mapping)}")
    print(f"  - Character conversion rate: {len(character_mapping)/len(unique_kanji)*100:.1f}%")
    print(f"  - Previous total mappings: {len(existing_mapping)}")
    print(f"  - New total mappings: {len(merged_mapping)}")
    print(f"📁 Updated file:")
    print(f"  - {j2c_mapping_path}")

if __name__ == "__main__":
    main()

