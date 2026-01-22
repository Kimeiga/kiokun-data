#!/usr/bin/env python3
"""
Extract unique glosses and taxonomy from chinese-word-game's hanzi_semantic_graph.json
and output a lookup file for the Rust build process to use.

Output format (char_gloss_taxonomy.json):
{
  "白": {
    "gloss": "white",
    "taxonomy": ["Abstract", "Colors"],
    "study_order": 5
  },
  ...
}
"""

import json
from pathlib import Path

# Paths
SEMANTIC_GRAPH_PATH = Path("chinese-word-game/web-app/static/game_data/hanzi_semantic_graph.json")
KANJI_DETAILS_PATH = Path("chinese-word-game/web-app/static/game_data/kanji_details.json")
OUTPUT_PATH = Path("output/char_gloss_taxonomy.json")


def extract_from_graph(graph: dict) -> dict:
    """
    Recursively walk the semantic graph and extract character -> {gloss, taxonomy} mappings.
    """
    result = {}
    
    def walk(node: dict, path: list[str]):
        # If this node is a character (has 'char' key)
        if 'char' in node:
            char = node['char']
            result[char] = {
                'gloss': node.get('keyword', ''),
                'taxonomy': path.copy(),
                'study_order': node.get('study_order'),
                'meaning': node.get('meaning', ''),
            }
            # Also add simplified variant if different
            simp = node.get('simp')
            if simp and simp != char:
                result[simp] = {
                    'gloss': node.get('keyword', ''),
                    'taxonomy': path.copy(),
                    'study_order': node.get('study_order'),
                    'meaning': node.get('meaning', ''),
                }
        
        # If this is a category node (has 'name' and 'children')
        if 'children' in node:
            category_name = node.get('name', '')
            new_path = path + [category_name] if category_name and category_name != 'Hanzi Universe' else path
            for child in node['children']:
                walk(child, new_path)
    
    walk(graph, [])
    return result


def load_kanji_details() -> dict:
    """Load kanji_details.json for additional Japanese-specific meanings."""
    if not KANJI_DETAILS_PATH.exists():
        print(f"⚠️  kanji_details.json not found at {KANJI_DETAILS_PATH}")
        return {}
    
    with open(KANJI_DETAILS_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def main():
    if not SEMANTIC_GRAPH_PATH.exists():
        print(f"❌ Semantic graph not found at {SEMANTIC_GRAPH_PATH}")
        return
    
    print(f"📖 Loading semantic graph from {SEMANTIC_GRAPH_PATH}...")
    with open(SEMANTIC_GRAPH_PATH, 'r', encoding='utf-8') as f:
        graph = json.load(f)
    
    print("🔍 Extracting glosses and taxonomy...")
    char_data = extract_from_graph(graph)
    
    print(f"📊 Extracted {len(char_data)} character entries")
    
    # Load kanji details for additional data
    kanji_details = load_kanji_details()
    if kanji_details:
        print(f"📖 Loaded {len(kanji_details)} kanji details")
        # Merge kanji details (don't override existing glosses, just add if missing)
        for kanji, details in kanji_details.items():
            if kanji not in char_data:
                char_data[kanji] = {
                    'gloss': details.get('meaning', ''),
                    'taxonomy': [],  # No taxonomy for kanji-only entries
                    'study_order': details.get('frequency'),
                    'meaning': details.get('meaning', ''),
                }
    
    # Ensure output directory exists
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"💾 Saving to {OUTPUT_PATH}...")
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(char_data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Done! Extracted {len(char_data)} total character entries")
    
    # Print some stats
    with_taxonomy = sum(1 for v in char_data.values() if v['taxonomy'])
    print(f"   - With taxonomy: {with_taxonomy}")
    print(f"   - Without taxonomy: {len(char_data) - with_taxonomy}")
    
    # Print a few samples
    print("\n📋 Sample entries:")
    samples = ['白', '龍', '人', '木', '鳥']
    for char in samples:
        if char in char_data:
            entry = char_data[char]
            tax = ' → '.join(entry['taxonomy']) if entry['taxonomy'] else 'N/A'
            print(f"   {char}: \"{entry['gloss']}\" [{tax}]")


if __name__ == '__main__':
    main()

