#!/usr/bin/env python3
"""
Generate frequency_list.json from source data files.

This creates a static JSON file with the top 1000 most common Japanese, Chinese, and Korean words.
- Japanese: Uses JPDB frequency data
- Chinese: Uses movie subtitle frequency from chinese_dictionary_word
- Korean: Uses subtitle frequency data from korean_frequency_50k.txt + KRDICT definitions

Output: sveltekit-app/static/frequency_list.json
"""

import json
import csv
import re
from pathlib import Path

# Paths
JPDB_FILE = Path("data/jpdb_v2.2_freq_list_2024-10-13.csv")
CHINESE_DICT_FILE = Path("data/chinese_dictionary_word_2025-06-25.jsonl")
KOREAN_FREQ_FILE = Path("data/korean_frequency_50k.txt")
KRDICT_DIR = Path("data/krdict-en")
OUTPUT_FILE = Path("sveltekit-app/static/frequency_list.json")


def load_japanese_frequency():
    """Load top 1000 Japanese words from JPDB frequency list."""
    print("📚 Loading Japanese frequency data...")
    words = []
    
    if not JPDB_FILE.exists():
        print(f"  ❌ JPDB file not found: {JPDB_FILE}")
        return words
    
    with open(JPDB_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter='\t')
        for row in reader:
            rank = int(row['frequency'])
            if rank > 1000:
                break
            
            words.append({
                "rank": rank,
                "word": row['term'],
                "reading": row['reading'],
                "definition": "",  # JPDB doesn't include definitions
                "common": True  # Top 1000 words are common
            })
    
    print(f"  ✅ Loaded {len(words)} Japanese words")
    return words


def load_chinese_frequency():
    """Load top 1000 Chinese words by movie subtitle frequency."""
    print("📚 Loading Chinese frequency data...")
    words = []
    
    if not CHINESE_DICT_FILE.exists():
        print(f"  ❌ Chinese dict file not found: {CHINESE_DICT_FILE}")
        return words
    
    # First pass: collect all words with frequency data
    entries = []
    with open(CHINESE_DICT_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                entry = json.loads(line)
                stats = entry.get('statistics', {})
                rank = stats.get('movieWordRank') or stats.get('bookWordRank')
                if rank:
                    # Get first definition and pinyin
                    items = entry.get('items', [])
                    pinyin = items[0].get('pinyin', '') if items else ''
                    definition = ''
                    if items and items[0].get('definitions'):
                        definition = items[0]['definitions'][0]
                    
                    entries.append({
                        "rank": rank,
                        "word": entry.get('simp', entry.get('trad', '')),
                        "reading": pinyin,
                        "definition": definition,
                        "common": False
                    })
            except json.JSONDecodeError:
                continue
    
    # Sort by rank and take top 1000
    entries.sort(key=lambda x: x['rank'])
    words = entries[:1000]
    
    print(f"  ✅ Loaded {len(words)} Chinese words")
    return words


def is_korean_word(word):
    """Check if word contains Korean characters (Hangul)."""
    for char in word:
        if '\uAC00' <= char <= '\uD7AF' or '\u1100' <= char <= '\u11FF':
            return True
    return False


def extract_definition_from_krdict(structured_content):
    """Extract English definition from KRDICT structured content."""
    if not structured_content:
        return ""

    for item in structured_content:
        if item.get("type") == "structured-content":
            content = item.get("content", [])
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("tag") == "div":
                        div_content = block.get("content", [])
                        if isinstance(div_content, list):
                            for child in div_content:
                                if isinstance(child, dict) and child.get("tag") == "div":
                                    inner = child.get("content", [])
                                    if isinstance(inner, list):
                                        for item2 in inner:
                                            if isinstance(item2, dict):
                                                if item2.get("tag") == "span" and item2.get("lang") == "en":
                                                    return item2.get("content", "")
                                    elif isinstance(inner, str):
                                        return inner
    return ""


def load_krdict_definitions():
    """Load Korean word definitions from KRDICT term banks."""
    print("📚 Loading KRDICT definitions...")
    definitions = {}

    if not KRDICT_DIR.exists():
        print(f"  ❌ KRDICT directory not found: {KRDICT_DIR}")
        return definitions

    term_banks = sorted(KRDICT_DIR.glob("term_bank_*.json"))
    for term_bank in term_banks:
        with open(term_bank, 'r', encoding='utf-8') as f:
            entries = json.load(f)
            for entry in entries:
                # Entry format: [word, reading, pos, short_pos, score, definitions_array, ...]
                if len(entry) >= 6:
                    word = entry[0]
                    pos = entry[2] if len(entry) > 2 else ""
                    structured_content = entry[5] if len(entry) > 5 else []

                    # Skip if already have definition or not Hangul
                    if word in definitions or not is_korean_word(word):
                        continue

                    # Extract English definition
                    definition = extract_definition_from_krdict(structured_content)
                    if definition:
                        definitions[word] = {
                            "definition": definition,
                            "pos": pos
                        }

    print(f"  ✅ Loaded {len(definitions)} KRDICT definitions")
    return definitions


def load_korean_frequency():
    """Load top 1000 Korean words from frequency list with KRDICT definitions."""
    print("📚 Loading Korean frequency data...")
    words = []

    if not KOREAN_FREQ_FILE.exists():
        print(f"  ❌ Korean frequency file not found: {KOREAN_FREQ_FILE}")
        return words

    # Load KRDICT definitions first
    krdict_defs = load_krdict_definitions()

    # Read frequency data
    rank = 0
    with open(KOREAN_FREQ_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 2:
                continue

            word = parts[0]

            # Skip non-Korean words (ASCII, English words)
            if word.isascii() or not is_korean_word(word):
                continue

            rank += 1

            # Get definition from KRDICT if available
            definition = ""
            if word in krdict_defs:
                definition = krdict_defs[word]["definition"]

            words.append({
                "rank": rank,
                "word": word,
                "reading": "",  # Korean doesn't need separate reading
                "definition": definition,
                "common": rank <= 1000
            })

            if rank >= 1000:
                break

    print(f"  ✅ Loaded {len(words)} Korean words")
    return words


def main():
    print("📊 Generating frequency_list.json...\n")

    japanese = load_japanese_frequency()
    chinese = load_chinese_frequency()
    korean = load_korean_frequency()

    frequency_list = {
        "japanese": japanese,
        "chinese": chinese,
        "korean": korean
    }

    # Ensure output directory exists
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Write output
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(frequency_list, f, ensure_ascii=False)

    print(f"\n✅ Generated frequency list: {len(japanese)} Japanese, {len(chinese)} Chinese, {len(korean)} Korean words")
    print(f"📁 Saved to: {OUTPUT_FILE}")


if __name__ == '__main__':
    main()

