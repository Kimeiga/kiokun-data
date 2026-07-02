#!/usr/bin/env python3
"""Build candidate CJK glyphs for browser render-missing checks."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "sveltekit-app/static/research/mnemonics/glyph-render-candidates.json"

IDS_DIR = ROOT / "data/ids"
COMPONENT_GLOSSES_PATH = ROOT / "sveltekit-app/static/game_data/component_glosses.json"
COMPONENT_USES_PATH = ROOT / "sveltekit-app/static/game_data/component_uses.json"
CHAR_TAXONOMY_PATH = ROOT / "sveltekit-app/static/game_data/char_taxonomy.json"
KANJI_DETAILS_PATH = ROOT / "sveltekit-app/static/game_data/kanji_details.json"
CARD_INPUTS_PATH = ROOT / "scripts/semantic_mnemonic_card_inputs.json"
MNEMONICS_PATH = ROOT / "sveltekit-app/static/research/mnemonics/semantic_mnemonics_1000.json"
BAKEOFF_PATH = ROOT / "sveltekit-app/static/research/mnemonics/semantic_mnemonic_bakeoff.json"

FONT_STACK = (
    '"Noto Sans", "Noto Sans TC", "Noto Sans SC", "Noto Sans JP", '
    '"Noto Sans KR", "PingFang TC", "PingFang SC", "Hiragino Sans", '
    '"Microsoft YaHei", sans-serif'
)

IDS_OPERATORS = {chr(cp) for cp in range(0x2FF0, 0x3000)}
VARIATION_SELECTORS = set(range(0xFE00, 0xFE10)) | set(range(0xE0100, 0xE01F0))
TOKEN_RE = re.compile(r"&[^;]+;|.")

MANUAL_IDS_OVERRIDES = {
    "\U00031B39": "\u2FF1\u722B\u65E7",  # CHISE Ext-H: 𱬹 = ⿱爫旧
}


def load_json(path: Path):
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def is_scan_char(value: object) -> bool:
    if not isinstance(value, str) or len(value) != 1:
        return False
    cp = ord(value)
    if cp in VARIATION_SELECTORS:
        return False
    if value in IDS_OPERATORS:
        return False
    if value.isspace() or cp < 0x2E80:
        return False
    return True


def codepoint(char: str) -> str:
    return f"U+{ord(char):04X}"


def ids_tokens(ids: str) -> list[str]:
    tokens: list[str] = []
    for token in TOKEN_RE.findall(ids or ""):
        if token.startswith("&"):
            continue
        if is_scan_char(token):
            tokens.append(token)
    return tokens


def load_ids() -> dict[str, str]:
    ids_map: dict[str, str] = dict(MANUAL_IDS_OVERRIDES)
    if not IDS_DIR.exists():
        return ids_map

    for path in sorted(IDS_DIR.glob("IDS-*.txt")):
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith(";;"):
                    continue
                parts = line.split("\t")
                if len(parts) < 3:
                    continue
                char, ids = parts[1], parts[2]
                if is_scan_char(char) and ids and ids != char:
                    ids_map.setdefault(char, ids)
    return ids_map


def add_candidate(
    candidates: dict[str, dict],
    char: str,
    source: str,
    example: str | None = None,
) -> None:
    if not is_scan_char(char):
        return
    entry = candidates.setdefault(char, {"sources": set(), "examples": []})
    entry["sources"].add(source)
    if example and len(entry["examples"]) < 8:
        entry["examples"].append(example)


def add_from_mnemonic_record(candidates: dict[str, dict], record: dict, source_prefix: str) -> None:
    char = record.get("character")
    add_candidate(candidates, char, f"{source_prefix}-target", char)
    for component in record.get("components") or []:
        if isinstance(component, dict):
            add_candidate(
                candidates,
                component.get("character"),
                f"{source_prefix}-component",
                f"{char}: {component.get('character')} {component.get('gloss', '')}".strip(),
            )


def collect_candidates(ids_map: dict[str, str]) -> dict[str, dict]:
    candidates: dict[str, dict] = {}

    component_glosses = load_json(COMPONENT_GLOSSES_PATH) or {}
    for char, gloss in component_glosses.items():
        add_candidate(candidates, char, "component-gloss", f"{char}: {gloss}")

    component_uses = load_json(COMPONENT_USES_PATH) or {}
    for char, buckets in component_uses.items():
        add_candidate(candidates, char, "component-use-key", char)
        if isinstance(buckets, dict):
            for bucket_name, bucket in buckets.items():
                for used_char in (bucket or {}).get("chars") or []:
                    add_candidate(candidates, used_char, "component-use-target", f"{char}/{bucket_name}")

    char_taxonomy = load_json(CHAR_TAXONOMY_PATH) or {}
    for char in char_taxonomy:
        add_candidate(candidates, char, "char-taxonomy", char)

    kanji_details = load_json(KANJI_DETAILS_PATH) or {}
    for char in kanji_details:
        add_candidate(candidates, char, "kanji-details", char)

    card_inputs = load_json(CARD_INPUTS_PATH) or {}
    for record in card_inputs.get("cards") or []:
        add_from_mnemonic_record(candidates, record, "mnemonic-input")

    mnemonics = load_json(MNEMONICS_PATH) or {}
    for record in mnemonics.get("mnemonics") or []:
        add_from_mnemonic_record(candidates, record, "mnemonic-output")

    bakeoff = load_json(BAKEOFF_PATH) or {}
    for result in bakeoff.get("results") or []:
        for record in result.get("outputs") or []:
            add_from_mnemonic_record(candidates, record, "mnemonic-bakeoff")

    for char, ids in ids_map.items():
        add_candidate(candidates, char, "ids-target", f"{char}: {ids}")
        for component in ids_tokens(ids):
            add_candidate(candidates, component, "ids-component", f"{char}: {ids}")

    return candidates


def priority_for(sources: set[str]) -> int:
    if any(source.startswith("mnemonic-") for source in sources):
        return 0
    if "component-gloss" in sources or "component-use-key" in sources:
        return 1
    if "kanji-details" in sources or "char-taxonomy" in sources or "component-use-target" in sources:
        return 2
    return 3


def main() -> None:
    ids_map = load_ids()
    candidates = collect_candidates(ids_map)
    component_glosses = load_json(COMPONENT_GLOSSES_PATH) or {}

    rows = []
    for char, data in candidates.items():
        ids = ids_map.get(char)
        sources = sorted(data["sources"])
        row = {
            "character": char,
            "codepoint": codepoint(char),
            "decimal": ord(char),
            "priority": priority_for(set(sources)),
            "sources": sources,
            "examples": data["examples"],
            "gloss": component_glosses.get(char),
            "ids": ids,
            "ids_components": ids_tokens(ids) if ids else [],
        }
        rows.append(row)

    rows.sort(key=lambda row: (row["priority"], row["decimal"]))

    payload = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "font_stack": FONT_STACK,
        "candidate_count": len(rows),
        "manual_ids_overrides": {
            char: {"codepoint": codepoint(char), "ids": ids}
            for char, ids in sorted(MANUAL_IDS_OVERRIDES.items(), key=lambda item: ord(item[0]))
        },
        "candidates": rows,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"Wrote {len(rows):,} candidates to {OUT_PATH}")


if __name__ == "__main__":
    main()
