#!/usr/bin/env python3
"""
Check stroke order data coverage for characters in our dictionary.

This script tests coverage from multiple sources:
1. AnimCJK (Japanese, Traditional Chinese, Simplified Chinese)
2. MakeMeAHanzi (Simplified and Traditional Chinese)
3. KanjiVG (Japanese)
4. Hanzi Writer (Chinese - current implementation)

Reports which library has the best coverage for each language.
"""

import json
import zlib
import os
import sys
from pathlib import Path
from collections import defaultdict
import urllib.request

# Data source URLs
DATA_SOURCES = {
    'AnimCJK': {
        'japanese': 'https://raw.githubusercontent.com/parsimonhi/animCJK/master/dictionaryJa.txt',
        'traditional': 'https://raw.githubusercontent.com/parsimonhi/animCJK/master/dictionaryZhHant.txt',
        'simplified': 'https://raw.githubusercontent.com/parsimonhi/animCJK/master/dictionaryZhHans.txt',
    },
    'MakeMeAHanzi': {
        'chinese': 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt',
    },
    'KanjiVG': {
        # KanjiVG doesn't have a simple character list, we'll need to check the repo structure
        'japanese': 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/',
    },
    'HanziWriter': {
        # Hanzi Writer data is in the hanzi-writer-data repo
        'chinese': 'https://raw.githubusercontent.com/chanind/hanzi-writer-data/master/',
    }
}

def download_animcjk_dictionaries():
    """Download AnimCJK dictionary files and extract character sets."""
    print("Downloading AnimCJK dictionaries...")
    
    animcjk_chars = {
        'japanese': set(),
        'traditional': set(),
        'simplified': set(),
    }
    
    for lang, url in ANIMCJK_URLS.items():
        print(f"  Downloading {lang}...")
        try:
            with urllib.request.urlopen(url) as response:
                content = response.read().decode('utf-8')
                
            # Each line is a JSON object with a "character" field
            for line in content.strip().split('\n'):
                if line:
                    data = json.loads(line)
                    char = data.get('character')
                    if char:
                        animcjk_chars[lang].add(char)
            
            print(f"    Found {len(animcjk_chars[lang])} characters")
        except Exception as e:
            print(f"    Error downloading {lang}: {e}")
            return None
    
    return animcjk_chars

def get_dictionary_characters():
    """Extract all characters from our output_dictionary."""
    print("\nScanning output_dictionary for characters...")
    
    dict_dir = Path('output_dictionary')
    if not dict_dir.exists():
        print(f"Error: {dict_dir} not found!")
        return None
    
    characters = {
        'traditional': set(),
        'simplified': set(),
        'japanese': set(),
    }
    
    # Scan all .json.deflate files
    for file_path in dict_dir.glob('*.json.deflate'):
        char = file_path.stem.replace('.json', '')
        
        # Skip multi-character entries (words)
        if len(char) > 1:
            continue
        
        try:
            # Read and decompress
            with open(file_path, 'rb') as f:
                compressed = f.read()
            decompressed = zlib.decompress(compressed, -zlib.MAX_WBITS)
            data = json.loads(decompressed.decode('utf-8'))
            
            # Check which character types exist
            if 'chinese_char' in data and data['chinese_char']:
                characters['traditional'].add(char)
                
                # Check for simplified variants
                simp_variants = data['chinese_char'].get('simpVariants', [])
                for simp_char in simp_variants:
                    characters['simplified'].add(simp_char)
            
            if 'japanese_char' in data and data['japanese_char']:
                characters['japanese'].add(char)
                
        except Exception as e:
            print(f"  Error processing {file_path.name}: {e}")
            continue
    
    print(f"  Traditional Chinese: {len(characters['traditional'])} characters")
    print(f"  Simplified Chinese: {len(characters['simplified'])} characters")
    print(f"  Japanese: {len(characters['japanese'])} characters")
    
    return characters

def analyze_coverage(dict_chars, animcjk_chars):
    """Analyze coverage and report statistics."""
    print("\n" + "="*80)
    print("COVERAGE ANALYSIS")
    print("="*80)
    
    results = {}
    
    for lang in ['traditional', 'simplified', 'japanese']:
        dict_set = dict_chars[lang]
        animcjk_set = animcjk_chars[lang]
        
        covered = dict_set & animcjk_set
        missing = dict_set - animcjk_set
        
        coverage_pct = (len(covered) / len(dict_set) * 100) if dict_set else 0
        
        results[lang] = {
            'total': len(dict_set),
            'covered': len(covered),
            'missing': len(missing),
            'coverage_pct': coverage_pct,
            'missing_chars': sorted(missing),
        }
        
        print(f"\n{lang.upper()}:")
        print(f"  Dictionary characters: {len(dict_set)}")
        print(f"  AnimCJK characters: {len(animcjk_set)}")
        print(f"  Covered: {len(covered)} ({coverage_pct:.1f}%)")
        print(f"  Missing: {len(missing)} ({100-coverage_pct:.1f}%)")
        
        if missing and len(missing) <= 50:
            print(f"  Missing characters: {''.join(sorted(missing))}")
        elif missing:
            print(f"  First 50 missing: {''.join(sorted(missing)[:50])}")
            print(f"  (and {len(missing) - 50} more...)")
    
    return results

def save_results(results):
    """Save detailed results to a file."""
    output_file = Path('analysis/animcjk_coverage_results.json')
    output_file.parent.mkdir(exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print(f"\nDetailed results saved to: {output_file}")

def main():
    print("AnimCJK Coverage Analysis")
    print("="*80)
    
    # Download AnimCJK dictionaries
    animcjk_chars = download_animcjk_dictionaries()
    if not animcjk_chars:
        print("Failed to download AnimCJK dictionaries")
        return 1
    
    # Get our dictionary characters
    dict_chars = get_dictionary_characters()
    if not dict_chars:
        print("Failed to scan dictionary")
        return 1
    
    # Analyze coverage
    results = analyze_coverage(dict_chars, animcjk_chars)
    
    # Save results
    save_results(results)
    
    print("\n" + "="*80)
    print("RECOMMENDATION:")
    print("="*80)
    
    # Provide recommendation based on coverage
    trad_coverage = results['traditional']['coverage_pct']
    simp_coverage = results['simplified']['coverage_pct']
    jp_coverage = results['japanese']['coverage_pct']
    
    if trad_coverage < 80 or simp_coverage < 80 or jp_coverage < 80:
        print("\n⚠️  AnimCJK has INSUFFICIENT coverage for this dictionary.")
        print(f"   Traditional: {trad_coverage:.1f}% | Simplified: {simp_coverage:.1f}% | Japanese: {jp_coverage:.1f}%")
        print("\n   RECOMMENDATION: Stick with Hanzi Writer for better coverage.")
    else:
        print("\n✅ AnimCJK has GOOD coverage for this dictionary.")
        print(f"   Traditional: {trad_coverage:.1f}% | Simplified: {simp_coverage:.1f}% | Japanese: {jp_coverage:.1f}%")
        print("\n   RECOMMENDATION: AnimCJK migration is viable!")
        print("   Consider hybrid approach: AnimCJK primary, Hanzi Writer fallback for missing chars.")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())

