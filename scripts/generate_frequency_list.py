#!/usr/bin/env python3
"""
Generate frequency_list.json from source data files.

This creates a static JSON file with the top 1000 most common Japanese and Chinese words.
- Japanese: Uses JPDB frequency data
- Chinese: Uses movie subtitle frequency from chinese_dictionary_word

Output: sveltekit-app/static/frequency_list.json
"""

import json
import csv
from pathlib import Path

# Paths
JPDB_FILE = Path("data/jpdb_v2.2_freq_list_2024-10-13.csv")
CHINESE_DICT_FILE = Path("data/chinese_dictionary_word_2025-06-25.jsonl")
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


def main():
    print("📊 Generating frequency_list.json...\n")
    
    japanese = load_japanese_frequency()
    chinese = load_chinese_frequency()
    
    frequency_list = {
        "japanese": japanese,
        "chinese": chinese
    }
    
    # Ensure output directory exists
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # Write output
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(frequency_list, f, ensure_ascii=False)
    
    print(f"\n✅ Generated frequency list: {len(japanese)} Japanese, {len(chinese)} Chinese words")
    print(f"📁 Saved to: {OUTPUT_FILE}")


if __name__ == '__main__':
    main()

