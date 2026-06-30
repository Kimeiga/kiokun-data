#!/usr/bin/env python3
"""Generate compact cross-script aliases for the web search API.

The rich dictionary build already canonicalizes Japanese shinjitai,
Chinese simplified forms, and Korean Hanja relationships into shared
entries/redirects. The D1 search index is intentionally flatter, so the
web app uses this generated map to search equivalent written forms and
route display forms to canonical dictionary pages.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "sveltekit-app/src/lib/generated/search-aliases.json"


def char_count(value: str) -> int:
    return len(value)


def add_alias(aliases: dict[str, set[str]], source: str, target: str) -> None:
    source = source.strip()
    target = target.strip()
    if source and target and source != target:
        aliases[source].add(target)


def add_char_variants(variants: dict[str, set[str]], first: str, second: str) -> None:
    if char_count(first) == 1 and char_count(second) == 1:
        add_alias(variants, first, second)
        add_alias(variants, second, first)


def load_japanese_to_canonical(aliases: dict[str, set[str]], variants: dict[str, set[str]]) -> dict[str, str]:
    path = ROOT / "output/j2c_mapping.json"
    with path.open(encoding="utf-8") as handle:
        mapping = json.load(handle)

    for japanese, canonical in mapping.items():
        add_alias(aliases, japanese, canonical)
        add_alias(aliases, canonical, japanese)
        add_char_variants(variants, japanese, canonical)

    return mapping


def load_chinese_aliases(aliases: dict[str, set[str]], variants: dict[str, set[str]]) -> None:
    path = ROOT / "data/chinese_dictionary_word_2025-06-25.jsonl"
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            entry = json.loads(line)
            simplified = entry.get("simp", "")
            traditional = entry.get("trad", "")
            if simplified and traditional and simplified != traditional:
                add_char_variants(variants, simplified, traditional)


def sorted_dict(value: dict[str, set[str]]) -> dict[str, list[str]]:
    return {
        key: sorted(values)
        for key, values in sorted(value.items())
        if values
    }


def main() -> None:
    aliases: dict[str, set[str]] = defaultdict(set)
    variants: dict[str, set[str]] = defaultdict(set)

    japanese_to_canonical = load_japanese_to_canonical(aliases, variants)
    load_chinese_aliases(aliases, variants)

    payload = {
        "japaneseToCanonical": dict(sorted(japanese_to_canonical.items())),
        "aliases": sorted_dict(aliases),
        "characterVariants": sorted_dict(variants),
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")

    print(f"Wrote {OUTPUT.relative_to(ROOT)}")
    print(f"  Japanese canonical targets: {len(payload['japaneseToCanonical'])}")
    print(f"  Query aliases: {len(payload['aliases'])}")
    print(f"  Character variant keys: {len(payload['characterVariants'])}")


if __name__ == "__main__":
    main()
