#!/usr/bin/env python3
"""Generate char_taxonomy.json from hanzi_semantic_graph.json"""
import json
from pathlib import Path

GRAPH_PATH = Path("chinese-word-game/web-app/static/game_data/hanzi_semantic_graph.json")
OUTPUT_PATH = Path("sveltekit-app/static/game_data/char_taxonomy.json")

def main():
    if not GRAPH_PATH.exists():
        print(f"❌ Graph not found: {GRAPH_PATH}")
        return
    
    with open(GRAPH_PATH, 'r') as f:
        graph = json.load(f)
    
    taxonomy = {}
    
    def walk(node, path):
        if 'char' in node:
            char = node['char']
            taxonomy[char] = path.copy()
            simp = node.get('simp')
            if simp and simp != char:
                taxonomy[simp] = path.copy()
        if 'children' in node:
            name = node.get('name', '')
            new_path = path + [name] if name and name != 'Hanzi Universe' else path
            for child in node['children']:
                walk(child, new_path)
    
    walk(graph, [])
    
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(taxonomy, f, ensure_ascii=False)
    
    print(f"✅ Created {OUTPUT_PATH} with {len(taxonomy)} entries")

if __name__ == '__main__':
    main()

