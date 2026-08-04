#!/usr/bin/env python3
"""Derive the deterministic pronunciation-mnemonic top-100 manifests.

Chinese uses the repository character corpus' ``statistics.movieCharRank``.
Rows sharing a rank are graphical variants of one measured underlying entry.
The projection character is the modern simplified form when the source links
one to traditional forms; all linked simplified/traditional forms are retained.

Japanese uses KANJIDIC2's ``misc.frequency`` (not JLPT). Ties are resolved by
Unicode code-point order.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CHINESE_SOURCE = ROOT / "data" / "chinese_dictionary_char_2025-06-25.jsonl"
JAPANESE_SOURCE = ROOT / "data" / "kanjidic2-en-3.6.1.json"
TARGET_DIR = ROOT / "data" / "pronunciation_mnemonic_corpus" / "targets"
CHINESE_TARGET = TARGET_DIR / "zh.json"
JAPANESE_TARGET = TARGET_DIR / "ja.json"


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as handle:
        return [json.loads(line) for line in handle if line.strip()]


def _linked_forms(chosen: dict[str, Any], rows: list[dict[str, Any]]) -> list[str]:
    """Return the source-linked simplified/traditional closure only."""

    by_char = {row["char"]: row for row in rows}
    pending = [chosen["char"]]
    linked: set[str] = set()
    while pending:
        character = pending.pop()
        if character in linked:
            continue
        linked.add(character)
        row = by_char.get(character, {})
        for field in ("simpVariants", "tradVariants"):
            for variant in row.get(field) or []:
                if variant in by_char and variant not in linked:
                    pending.append(variant)
        # Some modern simplified rows point to the traditional record through
        # variantOf instead of listing simpVariants on the traditional row.
        variant_of = row.get("variantOf")
        if variant_of in by_char and (row.get("tradVariants") or []):
            pending.append(variant_of)
    return sorted(linked, key=lambda value: tuple(ord(char) for char in value))


def derive_chinese() -> dict[str, Any]:
    ranked: dict[int, list[dict[str, Any]]] = {}
    for row in _read_jsonl(CHINESE_SOURCE):
        rank = (row.get("statistics") or {}).get("movieCharRank")
        if isinstance(rank, int) and 1 <= rank <= 100:
            ranked.setdefault(rank, []).append(row)

    if set(ranked) != set(range(1, 101)):
        missing = sorted(set(range(1, 101)) - set(ranked))
        raise ValueError(f"Chinese movieCharRank is not contiguous through 100: {missing}")

    entries: list[dict[str, Any]] = []
    for rank in range(1, 101):
        rows = ranked[rank]
        # A modern simplified record explicitly links traditional forms. When
        # there is no simplified/traditional pair, prefer the non-variant row.
        chosen = min(
            rows,
            key=lambda row: (
                0 if row.get("tradVariants") else 1,
                0 if not row.get("variantOf") else 1,
                tuple(ord(char) for char in row["char"]),
            ),
        )
        stats = chosen["statistics"]
        entries.append(
            {
                "identity": chosen["char"],
                "rank": rank,
                "variants": _linked_forms(chosen, rows),
                "movie_char_count": stats["movieCharCount"],
                "movie_char_count_percent": stats["movieCharCountPercent"],
            }
        )

    return {
        "schema_version": 1,
        "language": "zh",
        "count": len(entries),
        "selection": {
            "source": str(CHINESE_SOURCE.relative_to(ROOT)),
            "field": "statistics.movieCharRank",
            "rule": "Ranks 1-100; group equal-rank linked graphical variants; prefer the source-linked modern simplified projection, then a non-variant row, then Unicode order.",
        },
        "entries": entries,
    }


def derive_japanese() -> dict[str, Any]:
    with JAPANESE_SOURCE.open(encoding="utf-8") as handle:
        source = json.load(handle)
    rows = [
        (character["misc"].get("frequency"), character["literal"])
        for character in source["characters"]
        if isinstance(character["misc"].get("frequency"), int)
    ]
    rows.sort(key=lambda row: (row[0], tuple(ord(char) for char in row[1])))
    selected = rows[:100]
    if len(selected) != 100:
        raise ValueError(f"Expected at least 100 frequency-ranked kanji, got {len(selected)}")
    entries = [
        {"identity": literal, "rank": frequency, "variants": [literal]}
        for frequency, literal in selected
    ]
    return {
        "schema_version": 1,
        "language": "ja",
        "count": len(entries),
        "selection": {
            "source": str(JAPANESE_SOURCE.relative_to(ROOT)),
            "field": "characters[].misc.frequency",
            "rule": "Lowest 100 KANJIDIC usage-frequency values; ties resolve by Unicode code-point order. JLPT level is not used.",
        },
        "entries": entries,
    }


def _canonical_bytes(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def write_or_check(*, check: bool) -> None:
    outputs = ((CHINESE_TARGET, derive_chinese()), (JAPANESE_TARGET, derive_japanese()))
    if not check:
        TARGET_DIR.mkdir(parents=True, exist_ok=True)
    stale: list[str] = []
    for path, value in outputs:
        expected = _canonical_bytes(value)
        if check:
            if not path.exists() or path.read_bytes() != expected:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.write_bytes(expected)
    if stale:
        raise SystemExit("Stale pronunciation target manifest(s): " + ", ".join(stale))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail unless tracked manifests are current")
    args = parser.parse_args()
    write_or_check(check=args.check)


if __name__ == "__main__":
    main()
