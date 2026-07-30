#!/usr/bin/env python3
"""
Generate component_uses.json - reverse lookup of which characters use a given component.

For each component, shows which characters use it and what role it plays:
- mnemonic: used as a visual building block in the curated mnemonic corpus
- meaning: semantic/meaning component (e.g., 水 in 河 indicates water)
- sound: phonetic component (e.g., 工 in 江 provides the sound)
- iconic: pictographic/ideographic element
- simplified: used in simplification
- distinguishing: distinguishes similar characters
- unknown: role not determined
"""

import json
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Set

# Input file - Chinese character data with component information
CHAR_DATA_FILE = Path("data/chinese_dictionary_char_2025-06-25.jsonl")
SEMANTIC_CARDS_DIR = Path("data/semantic_mnemonic_corpus/cards")
# Output file for the SvelteKit app
OUTPUT_FILE = Path("sveltekit-app/static/game_data/component_uses.json")
# Component glosses file for reference
GLOSSES_FILE = Path("sveltekit-app/static/game_data/component_glosses.json")


def load_char_data():
    """Load character data from JSONL file."""
    chars = {}
    with open(CHAR_DATA_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                char = data.get('char')
                if char:
                    chars[char] = data
            except json.JSONDecodeError as e:
                print(f"Warning: Failed to parse line: {e}")
    return chars


def load_semantic_cards() -> List[Dict]:
    """Load the curated semantic-mnemonic card corpus."""
    cards = []
    for path in sorted(SEMANTIC_CARDS_DIR.glob("*.jsonl")):
        with path.open("r", encoding="utf-8") as file:
            for line in file:
                line = line.strip()
                if not line:
                    continue
                try:
                    cards.append(json.loads(line))
                except json.JSONDecodeError as error:
                    print(f"Warning: Failed to parse {path}: {error}")
    return cards


def build_component_uses(
    chars: Dict,
    semantic_cards: Iterable[Dict] = ()
) -> Dict[str, Dict[str, List[str]]]:
    """
    Build reverse lookup: component -> { type -> [characters that use it] }
    
    Returns a dict like:
    {
        "口": {
            "meaning": ["和", "问", "吃", ...],
            "sound": ["句", "扣", ...],
            "iconic": ["去", "台", ...],
            ...
        }
    }
    """
    # component -> type -> set of characters
    uses: Dict[str, Dict[str, Set[str]]] = defaultdict(lambda: defaultdict(set))
    
    # Track verified status
    verified: Dict[str, Dict[str, Set[str]]] = defaultdict(lambda: defaultdict(set))
    
    for char, data in chars.items():
        components = data.get('components', [])
        is_verified = data.get('isVerified', False)
        
        for comp in components:
            if isinstance(comp, dict):
                comp_char = comp.get('character', '')
                comp_types = comp.get('type', ['unknown'])
                
                if not comp_char or not comp_types:
                    continue
                
                for comp_type in comp_types:
                    uses[comp_char][comp_type].add(char)
                    if is_verified:
                        verified[comp_char][comp_type].add(char)

    # The dictionary component roles are intentionally conservative and miss
    # useful visual decompositions such as 幵 in 栞. The reviewed mnemonic corpus
    # supplies that learner-facing relationship without changing the source's
    # historical/phonetic claims.
    for card in semantic_cards:
        target = card.get("character", "")
        components = card.get("visual_components") or card.get("components") or []
        if not target:
            continue
        for component in components:
            if not isinstance(component, dict):
                continue
            component_char = component.get("character", "")
            if not component_char or component_char == target:
                continue
            uses[component_char]["mnemonic"].add(target)
            verified[component_char]["mnemonic"].add(target)
    
    # Convert sets to sorted lists and include counts
    result = {}
    for component, type_dict in uses.items():
        result[component] = {}
        for comp_type, char_set in type_dict.items():
            chars_list = sorted(list(char_set))
            verified_count = len(verified[component][comp_type])
            result[component][comp_type] = {
                "chars": chars_list,
                "count": len(chars_list),
                "verified": verified_count
            }
    
    return result


def main():
    print("📚 Loading character data...")
    chars = load_char_data()
    print(f"   Loaded {len(chars)} characters")

    print("🧠 Loading semantic mnemonic cards...")
    semantic_cards = load_semantic_cards()
    print(f"   Loaded {len(semantic_cards)} mnemonic cards")
    
    print("🔄 Building component usage lookup...")
    component_uses = build_component_uses(chars, semantic_cards)
    print(f"   Found {len(component_uses)} unique components")
    
    # Stats
    type_counts = defaultdict(int)
    for comp, types in component_uses.items():
        for comp_type in types.keys():
            type_counts[comp_type] += 1
    
    print("\n📊 Component type statistics:")
    for comp_type, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f"   {comp_type}: {count} components")
    
    # Ensure output directory exists
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # Write output
    print(f"\n💾 Writing to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(component_uses, f, ensure_ascii=False, separators=(',', ':'))
    
    file_size = OUTPUT_FILE.stat().st_size
    print(f"   Written {file_size:,} bytes")
    
    # Show sample for 口
    if "口" in component_uses:
        print("\n📖 Sample - 口 (mouth):")
        for comp_type, data in component_uses["口"].items():
            chars_sample = data["chars"][:10]
            print(f"   {comp_type}: {data['count']} chars ({data['verified']} verified)")
            print(f"      {' '.join(chars_sample)}{'...' if len(data['chars']) > 10 else ''}")
    
    print("\n✅ Done!")


if __name__ == "__main__":
    main()
