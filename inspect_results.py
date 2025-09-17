#!/usr/bin/env python3

import json
import sys

def inspect_unified_entries():
    print("🔍 Loading combined dictionary...")
    
    try:
        with open('output/combined_dictionary.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ Error loading file: {e}")
        return
    
    print(f"📊 Dictionary loaded: {len(data['entries'])} total entries")
    print(f"📈 Statistics: {data['statistics']}")
    
    # Find unified entries
    unified_entries = [entry for entry in data['entries'] if entry['metadata']['is_unified']]
    
    print(f"\n🔍 Found {len(unified_entries)} unified entries")
    print("\n📋 Sample unified entries for quality inspection:\n")
    
    for i, entry in enumerate(unified_entries[:10]):
        print(f"{i+1}. Word: {entry['word']}")
        
        if entry.get('chinese_entry'):
            chinese = entry['chinese_entry']
            print(f"   🇨🇳 Chinese:")
            print(f"      Simplified: {chinese['simp']}")
            print(f"      Traditional: {chinese['trad']}")
            if chinese.get('gloss'):
                print(f"      Meaning: {chinese['gloss']}")
            if chinese.get('items') and len(chinese['items']) > 0:
                item = chinese['items'][0]
                if item.get('pinyin'):
                    print(f"      Pinyin: {item['pinyin']}")
                if item.get('definitions') and len(item['definitions']) > 0:
                    print(f"      Definition: {item['definitions'][0]}")
        
        if entry.get('japanese_entry'):
            japanese = entry['japanese_entry']
            print(f"   🇯🇵 Japanese:")
            print(f"      ID: {japanese['id']}")
            if japanese.get('kanji') and len(japanese['kanji']) > 0:
                print(f"      Kanji: {japanese['kanji'][0]['text']}")
            if japanese.get('kana') and len(japanese['kana']) > 0:
                print(f"      Kana: {japanese['kana'][0]['text']}")
            if japanese.get('sense') and len(japanese['sense']) > 0:
                sense = japanese['sense'][0]
                if sense.get('gloss') and len(sense['gloss']) > 0:
                    print(f"      Meaning: {sense['gloss'][0]['text']}")
        
        print(f"   📈 Metadata:")
        print(f"      Chinese entries: {entry['metadata']['chinese_count']}")
        print(f"      Japanese entries: {entry['metadata']['japanese_count']}")
        print()

if __name__ == "__main__":
    inspect_unified_entries()
