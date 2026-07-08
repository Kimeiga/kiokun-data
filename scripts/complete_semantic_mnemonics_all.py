#!/usr/bin/env python3
"""Build a complete best-available semantic mnemonic artifact.

This merges:
- the reviewed 1000-card Gemini 3.5 artifact,
- the paid 10k Gemini artifact where it looks clean,
- local deterministic completions for missing or obviously awkward cards.

The local completions are intentionally conservative: they preserve Kiokun's
canonical character/gloss pairs and prioritize validity/coverage over cleverness.
"""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import semantic_mnemonics as sm


ROOT = Path(__file__).resolve().parents[1]
RESEARCH_DIR = ROOT / "sveltekit-app" / "static" / "research" / "mnemonics"
GAME_DATA_DIR = ROOT / "sveltekit-app" / "static" / "game_data"

PAID_10K_PATH = RESEARCH_DIR / "semantic_mnemonics_10000.json"
REVIEWED_1000_PATH = RESEARCH_DIR / "semantic_mnemonics_1000_refined_pairs_gemini35.json"
OUTPUT_PATH = RESEARCH_DIR / "semantic_mnemonics_all_best_available.json"
EVAL_PATH = RESEARCH_DIR / "semantic_mnemonics_all_best_available_eval.json"


AWKWARD_RE = re.compile(
    r"\b(?:"
    r"the character combines|this character|component|radical|represents|depicts|"
    r"perfect|hardworking|wise|brave|lazy|properly|exactly|sacred|mysterious|"
    r"magical|ghostly|terrifying|creepy|spies|spy|criminal|prisoner|slave|"
    r"butcher|battlefield|enemy|warrior|commander|soldier|"
    r"gouge out an eye|gasp as if|dim-witted traveler|natural instinct|"
    r"gold starts to lose its luster|"
    r"</?b>|<[^>]+>"
    r")\b",
    re.IGNORECASE,
)

BAD_STYLE_RE = re.compile(
    r"\b(?:serves as|symbolizes|teaches us|reminds us|society|polite|poor|"
    r"absolute|supreme|fierce|sneaky|corrupt|malicious)\b",
    re.IGNORECASE,
)

LOCAL_GLOSS_OVERRIDES = {
    "訁": "speech",
    "髟": "long hair",
    "女": "woman",
    "𥩲": "raise",
}


def is_han_codepoint(code: int) -> bool:
    return (
        0x2E80 <= code <= 0x2EFF
        or 0x2F00 <= code <= 0x2FDF
        or 0x3400 <= code <= 0x4DBF
        or 0x4E00 <= code <= 0x9FFF
        or 0xF900 <= code <= 0xFAFF
        or 0x20000 <= code <= 0x2A6DF
        or 0x2A700 <= code <= 0x2B73F
        or 0x2B740 <= code <= 0x2B81F
        or 0x2B820 <= code <= 0x2CEAF
        or 0x2CEB0 <= code <= 0x2EBEF
        or 0x2EBF0 <= code <= 0x2EE5F
        or 0x2F800 <= code <= 0x2FA1F
        or 0x30000 <= code <= 0x3134F
        or 0x31350 <= code <= 0x323AF
    )


def is_han_string(ch: str) -> bool:
    return len(ch) == 1 and is_han_codepoint(ord(ch))


def all_target_characters() -> list[str]:
    chars: set[str] = set()
    for path in (GAME_DATA_DIR / "component_glosses.json", GAME_DATA_DIR / "char_taxonomy.json"):
        data = json.loads(path.read_text())
        chars.update(ch for ch in data if is_han_string(ch))
    return sorted(chars, key=lambda ch: (ord(ch), ch))


def load_artifact(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    data = json.loads(path.read_text())
    return {card["character"]: card for card in data.get("mnemonics", [])}


def strip_required_pairs(card: dict[str, Any]) -> str:
    text = str(card.get("mnemonic") or "")
    for component in card.get("components") or []:
        text = text.replace(f"{component.get('character')} {component.get('gloss')}", "")
    text = text.replace(f"{card.get('character')} {card.get('meaning')}", "")
    return text


def card_is_clean(card: dict[str, Any]) -> bool:
    mnemonic = str(card.get("mnemonic") or "")
    if not mnemonic:
        return False
    if len(mnemonic) > 190:
        return False
    if len([part for part in re.split(r"[.!?。！？]+", mnemonic) if part.strip()]) > 1:
        return False
    stripped = strip_required_pairs(card)
    if AWKWARD_RE.search(stripped) or BAD_STYLE_RE.search(stripped):
        return False
    validation = card.get("validation") or {}
    if validation.get("valid") is False:
        return False
    return True


def safe_gloss(char: str, gloss: str, *, component_mode: bool = False) -> str:
    if char in LOCAL_GLOSS_OVERRIDES:
        return LOCAL_GLOSS_OVERRIDES[char]
    if component_mode and char in sm.MANUAL_COMPONENT_GLOSS_OVERRIDES:
        return sm.MANUAL_COMPONENT_GLOSS_OVERRIDES[char]

    cleaned = sm.clean_gloss(gloss) or ""
    lowered = cleaned.lower()
    if "what?" in lowered or "why?" in lowered or "where?" in lowered:
        return "question"

    regex_replacements = [
        (r"\bnon[- ]?classical\b", ""),
        (r"\bnon[- ]?standard\b", ""),
        (r"\bkangxi\s+radical\b", "shape mark"),
        (r"\bobscure\s+component\b", "form"),
        (r"\bold\s+component\b", "old form"),
        (r"\bcomponent\s+form\b", "form"),
        (r"\bcomponent\b", "form"),
        (r"\bradical\b", "shape mark"),
        (r"\bvariant\s+of\b", "alternate form"),
        (r"\bvariant\b", "alternate form"),
        (r"\bsame\s+as\b", "related form"),
        (r"\bsame\s+a\b", "related form"),
        (r"\bsame\b", "related form"),
        (r"\barchaic\s+a\b", "old form"),
        (r"\barchaic\b", ""),
        (r"\brare\b", ""),
        (r"\bobscure\b", ""),
        (r"\bunknown\b", ""),
        (r"\bfig\b", ""),
        (r"\binsincere\s+and\s+cunning\b", "cunning"),
        (r"\bslave\s+girls\b", "attendants"),
        (r"\bslave\b", "attendant"),
        (r"\bcriminal\b", "offender"),
        (r"\bprisoner\b", "confined person"),
        (r"\bbutcher\b", "cutter"),
        (r"\bfierce\b", "strong"),
        (r"\bmalicious\b", "harmful"),
        (r"\bevil\b", "harmful"),
        (r"\bugly\s+woman\b", "appearance"),
        (r"\bbeautiful\s+face\b", "face"),
        (r"\blady\s+officer\b", "officer"),
        (r"\binstrument\s+of\s+torture\b", "instrument"),
        (r"\bcut\s+off\s+the\s+nose\b", "cut mark"),
        (r"\bworship\s+of\s+god\b", "worship"),
        (r"\bgoddess'?s\s+name\b", "name"),
        (r"\bname\s+of\s+a\s+god\b", "name"),
        (r"\bname\s+of\s+a\s+person\b", "name"),
        (r"\bused\s+in\s+(?:girl|boy)'?s\s+name\b", "name"),
        (r"\bused\s+in\s+.*?\s+name\b", "name"),
        (r"\bname\s+a\s+name\s+of\b", "name"),
        (r"\bname\s+of\b", "name"),
        (r"\bdo\s+not\s+fear\s+to\b", "fearless"),
        (r"\btorture\s+used\s+in\b", "tool"),
        (r"\bgoblin\b", "spirit"),
        (r"\bgod\s+of\s+cereals\b", "grain altar"),
        (r"\braise\s+god\b", "raise"),
        (r"\bloquacious\b", "talkative"),
        (r"\bkangxi\b", "form"),
        (r"\bgirl\b", "woman"),
    ]
    for pattern, replacement in regex_replacements:
        cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bA\b", "", cleaned)
    cleaned = re.sub(r"^an?\s+kind\s+of\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^type\s+of\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^an?\s+", "", cleaned, flags=re.IGNORECASE)
    if re.search(r"\b(?:name|girl|boy)\b", cleaned, flags=re.IGNORECASE) and len(cleaned.split()) > 2:
        cleaned = "name"
    if cleaned.lower().startswith("related form"):
        cleaned = "related form"
    if cleaned.lower().startswith("alternate form"):
        cleaned = "alternate form"
    if cleaned.lower() in {"name a", "a", "used", "kind"}:
        cleaned = "form" if cleaned.lower() != "name a" else "name"
    if component_mode and cleaned.strip().lower() == "matching mark":
        cleaned = "related form"
    cleaned = re.sub(r"[.!?。！？]+", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" -;:,")
    cleaned = re.sub(r"\b(?:to|of|or|the)$", "", cleaned, flags=re.IGNORECASE).strip(" -;:,")
    return cleaned or "form"


def sanitize_prepared_card(card: dict[str, Any]) -> dict[str, Any]:
    sanitized = dict(card)
    sanitized["meaning"] = safe_gloss(card["character"], str(card.get("meaning") or ""), component_mode=False)

    def clean_component(component: dict[str, Any]) -> dict[str, str]:
        char = str(component.get("character") or component.get("char") or "")
        return {
            "character": char,
            "gloss": safe_gloss(char, str(component.get("gloss") or ""), component_mode=True),
        }

    sanitized["components"] = [clean_component(component) for component in card.get("components") or []]
    sanitized["visual_components"] = [
        clean_component(component)
        for component in (card.get("visual_components") or card.get("components") or [])
    ]
    return sanitized


def fallback_card(char: str) -> dict[str, Any]:
    meaning = safe_gloss(char, sm.canonical_component_gloss(char, sm.GLOSSES.get(char, "")), component_mode=True)
    component = {"character": char, "gloss": meaning}
    return {
        "character": char,
        "meaning": meaning,
        "components": [component],
        "visual_components": [component],
        "component_source": "self_fallback",
        "source_meaning": meaning,
    }


def prepare_card(char: str) -> dict[str, Any]:
    _, card, _ = sm.prepare_one_card(char)
    return sanitize_prepared_card(card) if card else fallback_card(char)


def phrase_components(components: list[dict[str, str]], char: str) -> str:
    pairs = [f"{component['character']} {component['gloss']}" for component in components]
    if len(pairs) == 1:
        return pairs[0]
    if len(pairs) == 2:
        relations = ("beside", "under", "over", "with", "near")
        relation = relations[sm.simple_hash(char) % len(relations)]
        return f"{pairs[0]} {relation} {pairs[1]}"
    return ", ".join(pairs[:-1]) + f", and {pairs[-1]}"


def local_mnemonic(prepared: dict[str, Any]) -> str:
    char = prepared["character"]
    final_pair = f"{char} {prepared['meaning']}"
    components = prepared["components"]
    component_text = phrase_components(components, char)
    if len(components) == 1 and components[0]["character"] == char:
        return f"A {component_text} stands alone as {final_pair}."
    verbs = ("marks", "forms", "reveals", "sets up", "points toward", "gives shape to")
    verb = verbs[sm.simple_hash(char + prepared["meaning"]) % len(verbs)]
    return f"A scene of {component_text} {verb} {final_pair}."


def local_hero_prompt(prepared: dict[str, Any]) -> str:
    labels = ", ".join(f"{component['character']} {component['gloss']}" for component in prepared["components"])
    return (
        f"Square mnemonic illustration for {prepared['character']} {prepared['meaning']}: "
        f"show {labels} in a simple uncluttered scene, labels directly on objects, no app UI."
    )


def local_card(prepared: dict[str, Any], source: str, replaced_reason: str | None = None) -> dict[str, Any]:
    expected_equation = " + ".join(f"{c['character']} {c['gloss']}" for c in prepared["components"])
    expected_equation += f" = {prepared['character']} {prepared['meaning']}"
    output = {
        "character": prepared["character"],
        "meaning": prepared["meaning"],
        "equation": expected_equation,
        "mnemonic": local_mnemonic(prepared),
        "hero_image_prompt": local_hero_prompt(prepared),
    }
    validation = sm.validate_card(output, prepared)
    record = sm.generated_record(output, prepared, validation)
    record["generation_source"] = source
    if replaced_reason:
        record["replaced_reason"] = replaced_reason
    return record


def normalize_existing(card: dict[str, Any], source: str) -> dict[str, Any]:
    record = dict(card)
    record["generation_source"] = source
    return record


def build_prepared_map(chars: list[str], workers: int = 24) -> dict[str, dict[str, Any]]:
    prepared: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(prepare_card, char): char for char in chars}
        for index, future in enumerate(as_completed(futures), start=1):
            char = futures[future]
            try:
                prepared[char] = future.result()
            except Exception:
                prepared[char] = fallback_card(char)
            if index % 1000 == 0:
                print(f"prepared {index}/{len(chars)}", flush=True)
    return prepared


def validate_artifact(cards: list[dict[str, Any]]) -> dict[str, Any]:
    invalid: list[dict[str, Any]] = []
    lengths: list[int] = []
    source_counts: dict[str, int] = {}
    component_sources: dict[str, int] = {}
    for card in cards:
        lengths.append(len(str(card.get("mnemonic") or "")))
        source = str(card.get("generation_source") or "unknown")
        source_counts[source] = source_counts.get(source, 0) + 1
        component_source = str(card.get("component_source") or "unknown")
        component_sources[component_source] = component_sources.get(component_source, 0) + 1
        validation = card.get("validation") or {}
        if not validation.get("valid", False):
            invalid.append({
                "character": card.get("character"),
                "problems": validation.get("problems", ["missing validation"]),
            })
    lengths.sort()

    def q(p: float) -> int:
        if not lengths:
            return 0
        return lengths[int((len(lengths) - 1) * p)]

    return {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "count": len(cards),
        "invalid_count": len(invalid),
        "invalid": invalid[:100],
        "source_counts": source_counts,
        "component_source_counts": component_sources,
        "mnemonic_length": {
            "min": lengths[0] if lengths else 0,
            "p50": q(0.5),
            "p90": q(0.9),
            "p95": q(0.95),
            "max": lengths[-1] if lengths else 0,
        },
    }


def main() -> None:
    targets = all_target_characters()
    paid_10k = load_artifact(PAID_10K_PATH)
    reviewed_1000 = load_artifact(REVIEWED_1000_PATH)
    prepared = build_prepared_map(targets)

    cards: list[dict[str, Any]] = []
    source_counts: dict[str, int] = {}
    for char in targets:
        if char in reviewed_1000:
            card = normalize_existing(reviewed_1000[char], "gemini35_reviewed_1000")
        elif char in paid_10k and card_is_clean(paid_10k[char]):
            card = normalize_existing(paid_10k[char], "gemini35_paid_10000")
        elif char in paid_10k:
            card = local_card(prepared[char], "codex_local_repair", "paid_10k_failed_style_scan")
        else:
            card = local_card(prepared[char], "codex_local_completion")
        source = card["generation_source"]
        source_counts[source] = source_counts.get(source, 0) + 1
        cards.append(card)

    artifact = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model": {
            "name": "best-available-merged-codex-completion",
            "provider": "mixed",
            "id": "gemini35-reviewed+gemini35-paid+codex-local",
        },
        "count": len(cards),
        "coverage_note": (
            "Reviewed Gemini cards are preserved first, clean paid 10k Gemini cards second, "
            "and missing or style-flagged cards are completed locally with conservative "
            "Codex-authored templates using canonical visual component glosses."
        ),
        "card_input_cache_version": sm.CARD_INPUT_CACHE_VERSION,
        "manual_gloss_overrides_used": sm.MANUAL_GLOSS_OVERRIDES,
        "manual_component_gloss_overrides_used": sm.MANUAL_COMPONENT_GLOSS_OVERRIDES,
        "source_counts": source_counts,
        "mnemonics": cards,
    }
    OUTPUT_PATH.write_text(json.dumps(artifact, ensure_ascii=False, indent=2))
    evaluation = validate_artifact(cards)
    EVAL_PATH.write_text(json.dumps(evaluation, ensure_ascii=False, indent=2))
    print(json.dumps({
        "output": str(OUTPUT_PATH),
        "eval": str(EVAL_PATH),
        "count": len(cards),
        "source_counts": source_counts,
        "invalid_count": evaluation["invalid_count"],
        "mnemonic_length": evaluation["mnemonic_length"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
