#!/usr/bin/env python3
"""
Copy game data files from chinese-word-game to kiokun's static folder,
and create a simplified taxonomy lookup file.
"""

import json
import shutil
from pathlib import Path

# Paths
GAME_DATA_DIR = Path("chinese-word-game/web-app/static/game_data")
KIOKUN_STATIC_DIR = Path("sveltekit-app/static")
KIOKUN_GAME_DATA_DIR = KIOKUN_STATIC_DIR / "game_data"

def copy_files():
    """Copy necessary files from game to kiokun."""
    # Ensure destination directory exists
    KIOKUN_GAME_DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    files_to_copy = [
        "component_glosses.json",  # char -> unique gloss
        "hanzi_semantic_graph.json",  # full taxonomy tree
        "kanji_details.json",  # Japanese kanji meanings
    ]
    
    for filename in files_to_copy:
        src = GAME_DATA_DIR / filename
        dst = KIOKUN_GAME_DATA_DIR / filename
        if src.exists():
            shutil.copy(src, dst)
            print(f"✅ Copied {filename}")
        else:
            print(f"⚠️  {filename} not found at {src}")


def build_taxonomy_lookup():
    """
    Build a simplified char -> taxonomy lookup from the semantic graph.
    Output: { "白": ["Abstract", "Colors"], "龍": ["Nature", "Animals", "Mythical"], ... }
    """
    graph_path = GAME_DATA_DIR / "hanzi_semantic_graph.json"
    if not graph_path.exists():
        print(f"❌ {graph_path} not found")
        return
    
    print("📖 Loading semantic graph...")
    with open(graph_path, 'r', encoding='utf-8') as f:
        graph = json.load(f)
    
    taxonomy = {}
    
    def walk(node, path):
        # If this is a character node
        if 'char' in node:
            char = node['char']
            taxonomy[char] = path.copy()
            # Also add simplified variant
            simp = node.get('simp')
            if simp and simp != char:
                taxonomy[simp] = path.copy()
        
        # If this is a category node with children
        if 'children' in node:
            name = node.get('name', '')
            new_path = path + [name] if name and name != 'Hanzi Universe' else path
            for child in node['children']:
                walk(child, new_path)
    
    walk(graph, [])
    
    # Save taxonomy lookup
    output_path = KIOKUN_GAME_DATA_DIR / "char_taxonomy.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(taxonomy, f, ensure_ascii=False)
    
    print(f"✅ Created char_taxonomy.json with {len(taxonomy)} entries")


def main():
    print("🚀 Copying game data to kiokun...")
    copy_files()
    print("\n🔧 Building taxonomy lookup...")
    build_taxonomy_lookup()
    print("\n✅ Done!")


if __name__ == '__main__':
    main()

