#!/usr/bin/env python3
"""
Comprehensive stroke order library coverage test.

Tests coverage from all major stroke order data sources:
1. AnimCJK - Japanese, Traditional Chinese, Simplified Chinese
2. MakeMeAHanzi - Simplified and Traditional Chinese  
3. KanjiVG - Japanese kanji
4. Hanzi Writer - Chinese characters (current implementation)

Reports which library has the best coverage for each language.
"""

import json
import zlib
import sys
from pathlib import Path
import urllib.request
from collections import defaultdict

def get_dictionary_characters():
    """Extract all characters from our output_dictionary."""
    print("Scanning output_dictionary for characters...")
    
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
            continue
    
    print(f"  Traditional Chinese: {len(characters['traditional'])} characters")
    print(f"  Simplified Chinese: {len(characters['simplified'])} characters")
    print(f"  Japanese: {len(characters['japanese'])} characters")
    
    return characters

def test_animcjk(dict_chars):
    """Test AnimCJK coverage."""
    print("\n" + "="*80)
    print("Testing AnimCJK")
    print("="*80)
    
    urls = {
        'japanese': 'https://raw.githubusercontent.com/parsimonhi/animCJK/master/dictionaryJa.txt',
        'traditional': 'https://raw.githubusercontent.com/parsimonhi/animCJK/master/dictionaryZhHant.txt',
        'simplified': 'https://raw.githubusercontent.com/parsimonhi/animCJK/master/dictionaryZhHans.txt',
    }
    
    results = {}
    
    for lang, url in urls.items():
        print(f"\nDownloading {lang}...")
        try:
            with urllib.request.urlopen(url) as response:
                content = response.read().decode('utf-8')
            
            # Extract characters from JSON lines
            chars = set()
            for line in content.strip().split('\n'):
                if line:
                    data = json.loads(line)
                    char = data.get('character')
                    if char:
                        chars.add(char)
            
            # Calculate coverage
            dict_set = dict_chars[lang]
            covered = dict_set & chars
            missing = dict_set - chars
            coverage_pct = (len(covered) / len(dict_set) * 100) if dict_set else 0
            
            results[lang] = {
                'total': len(dict_set),
                'available': len(chars),
                'covered': len(covered),
                'missing': len(missing),
                'coverage_pct': coverage_pct,
            }
            
            print(f"  Available: {len(chars)} characters")
            print(f"  Coverage: {len(covered)}/{len(dict_set)} ({coverage_pct:.1f}%)")
            
        except Exception as e:
            print(f"  Error: {e}")
            results[lang] = None
    
    return results

def test_makemeahanzi(dict_chars):
    """Test MakeMeAHanzi coverage."""
    print("\n" + "="*80)
    print("Testing MakeMeAHanzi")
    print("="*80)
    
    url = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt'
    
    print("\nDownloading dictionary...")
    try:
        with urllib.request.urlopen(url) as response:
            content = response.read().decode('utf-8')
        
        # Extract characters from JSON lines
        chars = set()
        for line in content.strip().split('\n'):
            if line:
                data = json.loads(line)
                char = data.get('character')
                if char:
                    chars.add(char)
        
        print(f"  Available: {len(chars)} characters")
        
        # Test against both traditional and simplified
        results = {}
        for lang in ['traditional', 'simplified']:
            dict_set = dict_chars[lang]
            covered = dict_set & chars
            missing = dict_set - chars
            coverage_pct = (len(covered) / len(dict_set) * 100) if dict_set else 0
            
            results[lang] = {
                'total': len(dict_set),
                'available': len(chars),
                'covered': len(covered),
                'missing': len(missing),
                'coverage_pct': coverage_pct,
            }
            
            print(f"\n  {lang.capitalize()}:")
            print(f"    Coverage: {len(covered)}/{len(dict_set)} ({coverage_pct:.1f}%)")
        
        return results
        
    except Exception as e:
        print(f"  Error: {e}")
        return None

def test_kanjivg(dict_chars):
    """Test KanjiVG coverage by checking the GitHub repo structure."""
    print("\n" + "="*80)
    print("Testing KanjiVG")
    print("="*80)
    
    # KanjiVG organizes files by Unicode codepoint
    # We'll sample a few characters to estimate coverage
    print("\nNote: KanjiVG doesn't provide a simple character list.")
    print("Sampling characters to estimate coverage...")
    
    dict_set = dict_chars['japanese']
    sample_size = min(100, len(dict_set))
    sample_chars = list(dict_set)[:sample_size]
    
    found = 0
    for char in sample_chars:
        # KanjiVG files are named like: 05b89.svg (Unicode codepoint in hex)
        codepoint = format(ord(char), '05x')
        url = f'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/{codepoint}.svg'
        
        try:
            with urllib.request.urlopen(url) as response:
                if response.status == 200:
                    found += 1
        except:
            pass
    
    # Estimate total coverage based on sample
    estimated_coverage_pct = (found / sample_size * 100) if sample_size > 0 else 0
    estimated_covered = int(len(dict_set) * found / sample_size) if sample_size > 0 else 0
    
    print(f"\n  Sample: {found}/{sample_size} found ({estimated_coverage_pct:.1f}%)")
    print(f"  Estimated coverage: ~{estimated_covered}/{len(dict_set)} ({estimated_coverage_pct:.1f}%)")
    
    return {
        'japanese': {
            'total': len(dict_set),
            'available': 'Unknown (estimated)',
            'covered': estimated_covered,
            'missing': len(dict_set) - estimated_covered,
            'coverage_pct': estimated_coverage_pct,
            'note': 'Estimated from sample',
        }
    }

def test_hanziwriter(dict_chars):
    """Test Hanzi Writer data coverage."""
    print("\n" + "="*80)
    print("Testing Hanzi Writer")
    print("="*80)

    # Hanzi Writer data is organized by character
    # We'll sample to estimate coverage
    print("\nNote: Hanzi Writer data is distributed across many files.")
    print("Sampling characters to estimate coverage...")

    results = {}

    for lang in ['traditional', 'simplified']:
        dict_set = dict_chars[lang]
        sample_size = min(200, len(dict_set))
        sample_chars = list(dict_set)[:sample_size]

        found = 0
        for i, char in enumerate(sample_chars):
            if (i + 1) % 50 == 0:
                print(f"  Tested {i + 1}/{sample_size} characters...")

            # Hanzi Writer data files are named by character
            # Use URL encoding for the character
            import urllib.parse
            encoded_char = urllib.parse.quote(char)
            url = f'https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/{encoded_char}.json'

            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status == 200:
                        found += 1
            except Exception as e:
                pass

        # Estimate total coverage
        estimated_coverage_pct = (found / sample_size * 100) if sample_size > 0 else 0
        estimated_covered = int(len(dict_set) * found / sample_size) if sample_size > 0 else 0

        results[lang] = {
            'total': len(dict_set),
            'available': 'Unknown (estimated)',
            'covered': estimated_covered,
            'missing': len(dict_set) - estimated_covered,
            'coverage_pct': estimated_coverage_pct,
            'note': 'Estimated from sample',
        }

        print(f"\n  {lang.capitalize()}:")
        print(f"    Sample: {found}/{sample_size} found ({estimated_coverage_pct:.1f}%)")
        print(f"    Estimated coverage: ~{estimated_covered}/{len(dict_set)} ({estimated_coverage_pct:.1f}%)")

    return results

def print_summary(all_results, dict_chars):
    """Print summary and recommendations."""
    print("\n" + "="*80)
    print("SUMMARY & RECOMMENDATIONS")
    print("="*80)
    
    # For each language, find the best library
    for lang in ['traditional', 'simplified', 'japanese']:
        print(f"\n{lang.upper()}:")
        print(f"  Total characters in dictionary: {len(dict_chars[lang])}")
        print(f"\n  Coverage by library:")
        
        best_coverage = 0
        best_library = None
        
        for lib_name, results in all_results.items():
            if results and lang in results and results[lang]:
                coverage = results[lang]['coverage_pct']
                note = results[lang].get('note', '')
                note_str = f" ({note})" if note else ""
                print(f"    {lib_name}: {coverage:.1f}%{note_str}")
                
                if coverage > best_coverage:
                    best_coverage = coverage
                    best_library = lib_name
        
        if best_library:
            print(f"\n  ✅ BEST: {best_library} with {best_coverage:.1f}% coverage")
        else:
            print(f"\n  ⚠️  No good coverage found")

def main():
    print("Comprehensive Stroke Order Library Coverage Test")
    print("="*80)
    
    # Get our dictionary characters
    dict_chars = get_dictionary_characters()
    if not dict_chars:
        return 1
    
    # Test all libraries
    all_results = {}
    
    all_results['AnimCJK'] = test_animcjk(dict_chars)
    all_results['MakeMeAHanzi'] = test_makemeahanzi(dict_chars)
    all_results['KanjiVG'] = test_kanjivg(dict_chars)
    all_results['HanziWriter'] = test_hanziwriter(dict_chars)
    
    # Print summary
    print_summary(all_results, dict_chars)
    
    # Save detailed results
    output_file = Path('analysis/stroke_library_coverage.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        # Convert sets to lists for JSON serialization
        serializable_results = {}
        for lib, results in all_results.items():
            if results:
                serializable_results[lib] = {
                    k: {**v, 'missing': len(v.get('missing', [])) if isinstance(v.get('missing'), set) else v.get('missing')}
                    if isinstance(v, dict) else v
                    for k, v in results.items()
                }
        
        json.dump({
            'dictionary_stats': {k: len(v) for k, v in dict_chars.items()},
            'library_results': serializable_results,
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n\nDetailed results saved to: {output_file}")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())

