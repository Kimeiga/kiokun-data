#!/usr/bin/env python3
"""Rank component families that merit human semantic-mnemonic review.

This audit is deliberately narrower than a prose-quality scan.  It looks for
upstream policy mistakes that can make many individually valid cards harder to
learn: lexical/component gloss conflation, variant drift, simplification
collisions, questionable decomposition boundaries, and context contradictions.

The report is diagnostic only.  It never rewrites the materialized corpus.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import manage_semantic_mnemonic_corpus as corpus_store  # noqa: E402


DICTIONARY_PATH = ROOT / "data/chinese_dictionary_char_2025-06-25.jsonl"
IDS_PATH = ROOT / "data/ids/IDS-UCS-Basic.txt"
DEFAULT_OUTPUT = (
    ROOT
    / "reports/semantic-mnemonics/component-family-risk-review-2026-07-21.json"
)

VARIANT_RE = re.compile(
    r"\b(?:archaic|ancient|obsolete|old|variant|alternate|simplified|traditional)\b",
    re.IGNORECASE,
)
PICTOGRAPH_RE = re.compile(r"\bpictograph\b", re.IGNORECASE)
ANATOMY_RE = re.compile(
    r"\b(?:flesh|bone|shinbone|tendon|heel|foot|leg|arm|shoulder|body|meat|"
    r"muscle|organ|stomach|abdomen|breast|chest|skin|fat|marrow|vein)\b",
    re.IGNORECASE,
)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def display_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path.resolve())


def load_dictionary() -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    with DICTIONARY_PATH.open() as lines:
        for line in lines:
            row = json.loads(line)
            char = str(row.get("char") or "")
            if char:
                rows[char] = row
    return rows


def load_apparent_ids() -> dict[str, str]:
    result: dict[str, str] = {}
    with IDS_PATH.open() as lines:
        for line in lines:
            if "@apparent=" not in line:
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 4 or len(fields[1]) != 1:
                continue
            result[fields[1]] = fields[-1].split("@apparent=", 1)[1].strip()
    return result


def normalized_gloss(value: Any) -> str:
    text = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()
    aliases = {
        "steed": "horse",
        "breeze": "wind",
        "observe": "see",
        "convert": "exchange",
        "tanned leather": "tanned hide",
    }
    return aliases.get(text, text)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--limit", type=int, default=150)
    args = parser.parse_args()

    artifact = corpus_store.load_corpus()
    cards = artifact.get("mnemonics") or []
    if len(cards) != 24_037:
        raise SystemExit(f"unexpected corpus size: {len(cards)}")
    by_char = {str(card["character"]): card for card in cards}
    dictionary = load_dictionary()
    apparent_ids = load_apparent_ids()

    uses: Counter[str] = Counter()
    parents: dict[str, list[str]] = defaultdict(list)
    observed_glosses: dict[str, Counter[str]] = defaultdict(Counter)
    for card in cards:
        target = str(card["character"])
        for component in card.get("visual_components") or card.get("components") or []:
            char = str(component.get("character") or "")
            if not char or char == target:
                continue
            uses[char] += 1
            parents[char].append(target)
            observed_glosses[char][str(component.get("gloss") or "")] += 1

    findings: list[dict[str, Any]] = []

    def add(
        family: str,
        kind: str,
        severity: int,
        evidence: dict[str, Any],
        *,
        reach: int | None = None,
    ) -> None:
        downstream = uses[family] if reach is None else reach
        findings.append({
            "family": family,
            "kind": kind,
            "severity": severity,
            "downstream_occurrences": downstream,
            "score": severity * 1000 + min(downstream, 999),
            "evidence": evidence,
        })

    # A target card that disagrees with the exact local character source is a
    # high-value review candidate, especially when that target is reused.
    for char, card in by_char.items():
        source = dictionary.get(char) or {}
        source_gloss = str(source.get("gloss") or "").strip()
        target_gloss = str(card.get("meaning") or "").strip()
        if not source_gloss or not target_gloss:
            continue
        if normalized_gloss(source_gloss) != normalized_gloss(target_gloss) and uses[char] >= 8:
            add(char, "source_target_gloss_drift", 4, {
                "target_gloss": target_gloss,
                "source_gloss": source_gloss,
                "source_hint": source.get("hint"),
                "component_glosses": dict(observed_glosses[char]),
                "sample_parents": sorted(set(parents[char]))[:12],
            })

    # Traditional/simplified forms should normally share a component concept.
    # The report does not auto-merge them because a simplified form can also be
    # an older independent graph (广, 干, 台, 谷, etc.).
    seen_pairs: set[tuple[str, str]] = set()
    for traditional, source in dictionary.items():
        for simplified in source.get("simpVariants") or []:
            pair = (traditional, simplified)
            if pair in seen_pairs or traditional not in by_char or simplified not in by_char:
                continue
            seen_pairs.add(pair)
            left = str(by_char[traditional].get("meaning") or "")
            right = str(by_char[simplified].get("meaning") or "")
            left_component = observed_glosses[traditional].most_common(1)
            right_component = observed_glosses[simplified].most_common(1)
            if normalized_gloss(left) == normalized_gloss(right) and (
                not left_component
                or not right_component
                or normalized_gloss(left_component[0][0]) == normalized_gloss(right_component[0][0])
            ):
                continue
            reach = uses[traditional] + uses[simplified]
            if reach < 8:
                continue
            reverse = dictionary.get(simplified) or {}
            collision = len(reverse.get("tradVariants") or []) > 1 or normalized_gloss(
                reverse.get("gloss")
            ) != normalized_gloss(source.get("gloss"))
            add(traditional, "simplification_collision" if collision else "variant_concept_drift", 5 if collision else 4, {
                "traditional": traditional,
                "simplified": simplified,
                "traditional_target": left,
                "simplified_target": right,
                "source_gloss": source.get("gloss"),
                "simplified_source_gloss": reverse.get("gloss"),
                "simplified_traditional_variants": reverse.get("tradVariants") or [],
                "traditional_component_glosses": dict(observed_glosses[traditional]),
                "simplified_component_glosses": dict(observed_glosses[simplified]),
            }, reach=reach)

    # Rare/variant-only dictionary records deserve review when their chosen
    # gloss is being made into a reusable learning primitive.
    for char, source in dictionary.items():
        if uses[char] < 2:
            continue
        hint = str(source.get("hint") or "")
        gloss = str(source.get("gloss") or "")
        if VARIANT_RE.search(hint) or VARIANT_RE.search(gloss):
            add(char, "variant_or_archaic_primitive", 4, {
                "source_gloss": gloss,
                "source_hint": hint,
                "component_glosses": dict(observed_glosses[char]),
                "sample_parents": sorted(set(parents[char]))[:12],
            })

    # Apparent decompositions are useful shape descriptions but should not
    # silently override stronger historical/lexical component families.
    for char, apparent in apparent_ids.items():
        if char in by_char and uses[char] >= 2:
            card = by_char[char]
            add(char, "apparent_ids_high_impact", 4, {
                "apparent_ids": apparent,
                "active_equation": card.get("equation"),
                "active_components": card.get("visual_components") or card.get("components"),
                "sample_parents": sorted(set(parents[char]))[:12],
            })

    # IDS sometimes emits 月 for a flesh-like shape.  Target semantics provide
    # a high-precision contradiction signal for the residual mistakes.
    for card in cards:
        components = card.get("visual_components") or card.get("components") or []
        if not any(c.get("character") == "月" and c.get("gloss") == "month" for c in components):
            continue
        meaning = str(card.get("meaning") or "")
        if ANATOMY_RE.search(meaning):
            add("月", "context_contradiction_anatomy", 5, {
                "target": card.get("character"),
                "target_gloss": meaning,
                "equation": card.get("equation"),
                "mnemonic": card.get("mnemonic"),
            }, reach=1)

    # Whole-form pictographs should be reviewed before a mechanical IDS split
    # forces unrelated child glosses into their mnemonic.
    for char, source in dictionary.items():
        card = by_char.get(char)
        if not card or not PICTOGRAPH_RE.search(str(source.get("hint") or "")):
            continue
        components = card.get("visual_components") or card.get("components") or []
        if len(components) < 2:
            continue
        add(char, "pictograph_overdecomposed", 3, {
            "source_gloss": source.get("gloss"),
            "source_hint": source.get("hint"),
            "active_equation": card.get("equation"),
            "active_components": components,
            "active_mnemonic": card.get("mnemonic"),
        }, reach=uses[char])

    findings.sort(key=lambda row: (-row["score"], row["kind"], ord(row["family"])))
    output = {
        "schema_version": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_corpus": str(corpus_store.DEFAULT_MANIFEST.relative_to(ROOT)),
        "source_count": len(cards),
        "methodology": {
            "purpose": "Rank upstream component-family policy risks; never auto-apply changes.",
            "signals": [
                "source/target gloss drift on reused primitives",
                "traditional/simplified concept drift and simplification collisions",
                "variant/archaic dictionary evidence on reused primitives",
                "high-impact @apparent IDS boundaries",
                "anatomical targets using 月 month",
                "source-described pictographs split into multiple unrelated components",
            ],
            "human_review_required": True,
        },
        "counts": {
            "all_findings": len(findings),
            "reported_findings": min(len(findings), args.limit),
            "by_kind": dict(sorted(Counter(row["kind"] for row in findings).items())),
        },
        "findings": findings[: args.limit],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({
        "output": display_path(args.output),
        "all_findings": len(findings),
        "reported_findings": min(len(findings), args.limit),
        "by_kind": output["counts"]["by_kind"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
