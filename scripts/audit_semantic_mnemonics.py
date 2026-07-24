#!/usr/bin/env python3
"""Rank formally valid semantic mnemonics that still need human review.

Formal validation answers whether a card obeys the artifact contract.  This
auditor answers a different question: whether the card gives a learner a
concrete, causal memory image.  Its flags are deliberately review signals,
not build failures, because several useful cards have abstract meanings or
rare components even when their prose is excellent.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import manage_semantic_mnemonic_corpus as corpus_store  # noqa: E402


RESEARCH_DIR = ROOT / "sveltekit-app" / "static" / "research" / "mnemonics"
DEFAULT_OUTPUT = RESEARCH_DIR / "semantic_mnemonics_all_best_available_quality_audit.json"
KANJI_DETAILS_PATH = ROOT / "sveltekit-app" / "static" / "game_data" / "kanji_details.json"


# A durable failure taxonomy.  Severity is the amount contributed to the raw
# review score; descriptions are included in the JSON report for reviewers.
QUALITY_TAXONOMY: dict[str, dict[str, Any]] = {
    "generic_filler": {
        "severity": 6.0,
        "description": "Template prose names the pieces but supplies no character-specific causal image.",
    },
    "tautological_self_form": {
        "severity": 5.0,
        "description": "A self-form card restates its gloss without describing a memorable visible feature.",
    },
    "duplicated_component_meaning": {
        "severity": 4.0,
        "description": "Two components have the same or near-identical learner-facing gloss.",
    },
    "opaque_component_gloss": {
        "severity": 4.0,
        "description": "A component gloss is metadata or a placeholder rather than a visual memory object.",
    },
    "abstract_final_meaning": {
        "severity": 1.5,
        "description": "The final meaning is abstract, so the causal image needs especially careful review.",
    },
    "unhelpful_final_gloss": {
        "severity": 4.0,
        "description": "The final English gloss is grammatical or dictionary-derived but poor for a first-time learner.",
    },
    "variant_form_needs_review": {
        "severity": 2.5,
        "description": "An aliased simplified, traditional, Japanese, or compatibility form may need its own visual story.",
    },
    "historical_decomposition_dominates": {
        "severity": 4.0,
        "description": "Mnemonic prose foregrounds historical components that are not the main visible decomposition.",
    },
    "weak_causal_link": {
        "severity": 3.0,
        "description": "The sentence is grammatical but does not make the final meaning follow from the components.",
    },
    "learner_facing_weirdness": {
        "severity": 3.0,
        "description": "Awkward articles, filler adjectives, or unnatural wording interfere with recall.",
    },
}


GENERIC_FILLER_RE = re.compile(
    r"\b(?:joined with|gives? shape to|takes? shape as|supplies the image for|"
    r"the visible form of|the written shape of|comes? together as|points? toward|"
    r"in one (?:visual )?image|marks? the site of|marks? time as|stands as)\b",
    re.IGNORECASE,
)

TAUTOLOGICAL_SELF_RE = re.compile(
    r"\b(?:is the (?:whole )?memory image|shape supplies the image|"
    r"visible form .* carries its meaning directly|written shape .* memory image)\b",
    re.IGNORECASE,
)

OPAQUE_GLOSS_RE = re.compile(
    r"^(?:form|old form|related form|alternate form|shape mark|reading mark|"
    r"rank mark|unknown|component|radical|variant)$|"
    r"\b(?:kangxi|non-classical|obscure component|unknown component)\b",
    re.IGNORECASE,
)

ABSTRACT_MEANING_RE = re.compile(
    r"\b(?:be|exist|act|ability|condition|concept|continuous|correct|degree|"
    r"different|difficult|easy|effect|even|feeling|idea|kind|meaning|method|"
    r"must|not|only|other|proper|quality|reason|relation|same|state|system|"
    r"thing|true|way|whole|why|question particle|suggestion particle|"
    r"follow-up particle|exclamation)\b",
    re.IGNORECASE,
)

UNHELPFUL_FINAL_GLOSS_RE = re.compile(
    r"^(?:don't|final|make|profound|race|cash|eyelet|woolen cloth|aah|bar)$|"
    r"^(?:form|related form|alternate form|same)$",
    re.IGNORECASE,
)

WEIRDNESS_RE = re.compile(
    r"\b(?:proudly|magical|mystical|glowing|dim-witted|natural instinct|"
    r"perfect|hardworking|wise|brave|lazy|properly|exactly|society|polite)\b|"
    r"\ba\s+[^,.!?]{0,30}\b(?:silks|legs|plates|words|hands)\b",
    re.IGNORECASE,
)

CAUSAL_VERB_RE = re.compile(
    r"\b(?:binds?|blocks?|breaks?|builds?|carries?|catches?|closes?|cuts?|"
    r"drives?|fills?|flows?|frames?|gathers?|grips?|grows?|holds?|hooks?|"
    r"keeps?|lights?|locks?|opens?|presses?|protects?|pulls?|pushes?|reaches?|"
    r"rises?|seals?|shelters?|spreads?|stacks?|stretches?|strikes?|surrounds?|"
    r"ties?|turns?|warms?|wraps?)\b",
    re.IGNORECASE,
)

WEAK_CAUSAL_RE = re.compile(
    r"\b(?:becomes?|creates?|forms?|gives?|makes?|shows?|reveals?|identifies?)\b",
    re.IGNORECASE,
)


def strip_required_pairs(card: dict[str, Any]) -> str:
    """Remove contract strings so generic connective prose is easy to detect."""
    text = str(card.get("mnemonic") or "")
    pairs = [
        f"{component.get('character')} {component.get('gloss')}"
        for component in card.get("components") or []
    ]
    pairs.append(f"{card.get('character')} {card.get('meaning')}")
    for pair in sorted(pairs, key=len, reverse=True):
        text = text.replace(pair, " ")
    return re.sub(r"\s+", " ", text).strip()


def normalize_gloss(gloss: str) -> str:
    value = re.sub(r"\s+\((?:side|top|bottom|left|right|drops|alt)\)", "", gloss, flags=re.I)
    value = re.sub(r"[^a-z0-9 ]+", " ", value.lower())
    words = value.split()
    normalized: list[str] = []
    for word in words:
        if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
            word = word[:-1]
        normalized.append(word)
    return " ".join(normalized)


def component_glosses_overlap(components: list[dict[str, Any]]) -> list[list[str]]:
    by_gloss: dict[str, list[str]] = {}
    for component in components:
        normalized = normalize_gloss(str(component.get("gloss") or ""))
        if normalized:
            by_gloss.setdefault(normalized, []).append(str(component.get("character") or ""))
    return [chars for chars in by_gloss.values() if len(chars) > 1]


def historical_pairs(card: dict[str, Any]) -> list[str]:
    visual_chars = {str(component.get("character") or "") for component in card.get("components") or []}
    return [
        f"{component.get('character')} {component.get('gloss')}"
        for component in card.get("historical_components") or []
        if str(component.get("character") or "") not in visual_chars
    ]


def quality_flags(card: dict[str, Any]) -> list[dict[str, Any]]:
    mnemonic = str(card.get("mnemonic") or "")
    stripped = strip_required_pairs(card)
    components = card.get("components") or []
    flags: list[dict[str, Any]] = []

    def add(code: str, evidence: Any) -> None:
        flags.append({
            "code": code,
            "severity": QUALITY_TAXONOMY[code]["severity"],
            "evidence": evidence,
        })

    generic_match = GENERIC_FILLER_RE.search(stripped)
    is_coverage_draft = card.get("quality_provenance") == "coverage_fallback_needs_review"
    if generic_match:
        add("generic_filler", generic_match.group(0))
    elif is_coverage_draft:
        # Do not let future template wording accidentally promote an unreviewed
        # deterministic completion merely by evading a phrase regex.
        add("generic_filler", "unreviewed deterministic coverage fallback")

    is_self = len(components) == 1 and str(components[0].get("character") or "") == str(card.get("character") or "")
    tautology_match = TAUTOLOGICAL_SELF_RE.search(mnemonic) if is_self else None
    if tautology_match:
        add("tautological_self_form", tautology_match.group(0))
    elif is_self and is_coverage_draft:
        add("tautological_self_form", "unreviewed self-form fallback")

    duplicate_groups = component_glosses_overlap(components)
    if duplicate_groups:
        add("duplicated_component_meaning", duplicate_groups)

    opaque = [
        f"{component.get('character')} {component.get('gloss')}"
        for component in components
        if OPAQUE_GLOSS_RE.search(str(component.get("gloss") or "").strip())
    ]
    if opaque:
        add("opaque_component_gloss", opaque)

    meaning = str(card.get("meaning") or "").strip()
    if ABSTRACT_MEANING_RE.search(meaning):
        add("abstract_final_meaning", meaning)
    if UNHELPFUL_FINAL_GLOSS_RE.search(meaning):
        add("unhelpful_final_gloss", meaning)

    component_source = str(card.get("component_source") or "")
    if component_source.startswith("variant_alias:") or card.get("alias_of"):
        add("variant_form_needs_review", card.get("alias_of") or component_source)

    mentioned_historical = [pair for pair in historical_pairs(card) if pair in mnemonic]
    if mentioned_historical:
        add("historical_decomposition_dominates", mentioned_historical)

    if not generic_match and WEAK_CAUSAL_RE.search(stripped) and not CAUSAL_VERB_RE.search(stripped):
        add("weak_causal_link", stripped)

    weird_match = WEIRDNESS_RE.search(mnemonic)
    if weird_match:
        add("learner_facing_weirdness", weird_match.group(0))

    return flags


def load_frequency_ranks(path: Path = KANJI_DETAILS_PATH) -> dict[str, int]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    ranks: dict[str, int] = {}
    for char, details in data.items():
        rank = details.get("frequency") if isinstance(details, dict) else None
        if isinstance(rank, int) and rank > 0:
            ranks[str(char)] = rank
    return ranks


def review_priority(raw_score: float, frequency_rank: int | None) -> float:
    if not frequency_rank:
        return round(raw_score, 3)
    # Common characters get up to a 4.5x multiplier, tapering smoothly by rank.
    # This keeps common learner-facing failures above severe but unattested
    # extension-glyph placeholders in the first review batch.
    multiplier = 1.0 + 3.5 / (1.0 + math.log10(max(1, frequency_rank)))
    return round(raw_score * multiplier, 3)


def analyze_cards(
    cards: list[dict[str, Any]],
    *,
    limit: int = 1000,
    frequency_ranks: dict[str, int] | None = None,
) -> dict[str, Any]:
    frequency_ranks = frequency_ranks if frequency_ranks is not None else load_frequency_ranks()
    ranked: list[dict[str, Any]] = []
    flag_counts: Counter[str] = Counter()
    status_counts: Counter[str] = Counter()

    for card in cards:
        flags = quality_flags(card)
        raw_score = round(sum(float(flag["severity"]) for flag in flags), 3)
        if raw_score >= 6:
            status = "rewrite"
        elif raw_score > 0:
            status = "review"
        else:
            status = "pass"
        status_counts[status] += 1
        flag_counts.update(flag["code"] for flag in flags)
        if not flags:
            continue
        char = str(card.get("character") or "")
        frequency_rank = frequency_ranks.get(char)
        ranked.append({
            "character": char,
            "meaning": card.get("meaning"),
            "frequency_rank": frequency_rank,
            "quality_status": status,
            "quality_score": raw_score,
            "review_priority": review_priority(raw_score, frequency_rank),
            "flags": flags,
            "equation": card.get("equation"),
            "mnemonic": card.get("mnemonic"),
            "components": card.get("components") or [],
            "component_source": card.get("component_source"),
            "generation_source": card.get("generation_source"),
        })

    ranked.sort(key=lambda item: (
        -float(item["review_priority"]),
        item["frequency_rank"] if item["frequency_rank"] is not None else 10**9,
        ord(item["character"]) if len(item["character"]) == 1 else 10**9,
    ))
    return {
        "count": len(cards),
        "quality_status_counts": dict(sorted(status_counts.items())),
        "flag_counts": dict(flag_counts.most_common()),
        "flagged_count": len(ranked),
        "ranked_count": min(limit, len(ranked)),
        "ranked": ranked[:limit],
    }


def build_report(artifact: dict[str, Any], *, limit: int = 1000) -> dict[str, Any]:
    analysis = analyze_cards(artifact.get("mnemonics") or [], limit=limit)
    return {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "artifact_created_at": artifact.get("created_at"),
        "methodology": (
            "Formal validity and learning quality are separate. Flags are deterministic review signals; "
            "abstract meanings and variant forms are not automatically bad, while generic filler is a rewrite signal."
        ),
        "taxonomy": QUALITY_TAXONOMY,
        **analysis,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--artifact",
        type=Path,
        help="audit an explicit legacy JSON artifact instead of the canonical buckets",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--limit", type=int, default=1000, help="Maximum ranked cards to include")
    args = parser.parse_args()

    artifact = (
        json.loads(args.artifact.read_text())
        if args.artifact
        else corpus_store.load_corpus()
    )
    report = build_report(artifact, limit=max(0, args.limit))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({
        "output": str(args.output),
        "count": report["count"],
        "flagged_count": report["flagged_count"],
        "quality_status_counts": report["quality_status_counts"],
        "flag_counts": report["flag_counts"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
