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
import unicodedata
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
    "臤": "firm grip",
    "𰀡": "firm grip",
    "娲": "Nuwa",
    "媧": "Nuwa",
    "叱": "scold",
    "𠮟": "scold",
    "澪": "water route",
    "椙": "Japanese cedar",
    "礒": "rocky shore",
    "笘": "writing slate",
    "鯵": "horse mackerel",
    "鰺": "horse mackerel",
    "鲹": "horse mackerel",
    "梛": "nagi tree",
    "俥": "rickshaw",
    "溂": "lively",
    "鳰": "grebe",
    "﨟": "court rank",
    "欌": "cabinet",
    "慓": "nimble",
    "摋": "strike",
    "蹸": "trample",
    "笒": "bamboo flute",
    "倧": "progenitor",
    "栮": "mushroom",
    "堗": "heated floor",
}


EXTRA_LEARNER_TARGETS: dict[str, dict[str, str]] = {
    "𠮟": {
        "evidence": "Joyo exact glyph and JPDB top 100k word coverage",
        "alias_of": "叱",
        "alias_reason": "Unicode Z-variant of 叱; keep exact glyph for Japanese learner searches",
    },
    "澪": {"evidence": "JPDB top 100k and jinmeiyo/name coverage"},
    "椙": {"evidence": "KANJIDIC frequency-ranked exact glyph coverage"},
    "礒": {
        "evidence": "KANJIDIC frequency-ranked exact glyph coverage",
        "alias_of": "磯",
        "alias_reason": "Japanese place/name spelling near 磯; keep exact glyph because shape differs",
    },
    "笘": {"evidence": "KANJIDIC frequency-ranked exact glyph coverage"},
    "鯵": {
        "evidence": "JPDB top 100k exact glyph coverage",
        "alias_of": "鰺",
        "alias_reason": "Common Japanese spelling variant of 鰺; keep exact glyph for learner searches",
    },
    "梛": {"evidence": "jinmeiyo/name coverage"},
    "俥": {"evidence": "JPDB top 100k exact glyph coverage"},
    "溂": {"evidence": "JPDB top 100k exact glyph coverage, especially 溌溂"},
    "鳰": {"evidence": "JPDB top 100k exact glyph coverage"},
    "欌": {"evidence": "KRDICT Hanja headword coverage, especially 欌籠 and 陳列欌"},
    "慓": {"evidence": "KRDICT Hanja headword coverage in 慓毒 compounds"},
    "摋": {"evidence": "KRDICT Hanja variant coverage in 抹殺/抹摋 compounds"},
    "蹸": {"evidence": "KRDICT Hanja variant coverage in 蹂躪/蹂躙/蹂蹸 compounds"},
    "笒": {"evidence": "KRDICT Hanja headword coverage in 大笒"},
    "倧": {"evidence": "KRDICT Hanja headword coverage in 大倧敎"},
    "栮": {"evidence": "KRDICT Hanja headword coverage in 洋松栮"},
    "堗": {"evidence": "KRDICT Hanja variant coverage in 溫突/溫堗"},
}


VARIANT_ALIAS_TARGETS: dict[str, dict[str, str]] = {
    "﨑": {"alias_of": "崎", "reason": "Japanese compatibility glyph used in names"},
    "﨟": {
        "alias_of": "臘",
        "meaning": "court rank",
        "reason": "Japanese compatibility glyph seen in JPDB words such as 上﨟 and 中﨟",
    },
    "侮": {"alias_of": "侮", "reason": "Japanese compatibility glyph"},
    "勤": {"alias_of": "勤", "reason": "Japanese compatibility glyph"},
    "卑": {"alias_of": "卑", "reason": "Japanese compatibility glyph"},
    "墨": {"alias_of": "墨", "reason": "Japanese compatibility glyph"},
    "層": {"alias_of": "層", "reason": "Japanese compatibility glyph"},
    "悔": {"alias_of": "悔", "reason": "Japanese compatibility glyph"},
    "梅": {"alias_of": "梅", "reason": "Japanese compatibility glyph"},
    "煮": {"alias_of": "煮", "reason": "Japanese compatibility glyph"},
    "琢": {"alias_of": "琢", "reason": "Japanese compatibility glyph"},
    "碑": {"alias_of": "碑", "reason": "Japanese compatibility glyph"},
    "祐": {"alias_of": "祐", "reason": "Japanese compatibility glyph"},
    "祖": {"alias_of": "祖", "reason": "Japanese compatibility glyph"},
    "禍": {"alias_of": "禍", "reason": "Japanese compatibility glyph"},
    "穀": {"alias_of": "穀", "reason": "Japanese compatibility glyph"},
    "練": {"alias_of": "練", "reason": "Japanese compatibility glyph"},
    "署": {"alias_of": "署", "reason": "Japanese compatibility glyph"},
    "者": {"alias_of": "者", "reason": "Japanese compatibility glyph"},
    "臭": {"alias_of": "臭", "reason": "Japanese compatibility glyph"},
    "賓": {"alias_of": "賓", "reason": "Japanese compatibility glyph"},
    "贈": {"alias_of": "贈", "reason": "Japanese compatibility glyph"},
    "響": {"alias_of": "響", "reason": "Japanese compatibility glyph"},
}


AUTO_COMPATIBILITY_ALIAS_RANGES = (
    (0xF900, 0xFAFF),
    (0x2F800, 0x2FA1F),
)


def collapse_repeated_words(text: str) -> str:
    words = text.split()
    if len(words) < 2:
        return text
    output: list[str] = []
    collapsed = False
    for word in words:
        normalized = re.sub(r"^[^\w-]+|[^\w-]+$", "", word.lower())
        previous = re.sub(r"^[^\w-]+|[^\w-]+$", "", output[-1].lower()) if output else ""
        if normalized and normalized == previous:
            collapsed = True
            continue
        output.append(word)
    result = " ".join(output)
    return result.lower() if collapsed else result


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
        (r"\bgod\s+god\b", "deity"),
        (r"\bgoddess\s+goddess\b", "deity"),
        (r"\bgoddess\s+of\s+an?\s+(.+)", r"\1 deity"),
        (r"\bgod\s+of\s+the\s+(.+)", r"\1 deity"),
        (r"\bgod\s+of\s+(.+)", r"\1 deity"),
        (r"\bworship\s+the\s+god\b", "worship"),
        (r"\boffering\s+blood\s+to\s+god\b", "blood offering"),
        (r"\bgoddess\b", "deity"),
        (r"\bgod\b", "deity"),
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
    cleaned = collapse_repeated_words(cleaned)
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
        return f"a {pairs[0]}"
    if len(pairs) == 2:
        relations = ("beside", "under", "over", "with", "near")
        relation = relations[sm.simple_hash(char) % len(relations)]
        return f"a {pairs[0]} {relation} a {pairs[1]}"
    article_pairs = [f"a {pair}" for pair in pairs]
    return ", ".join(article_pairs[:-1]) + f", and {article_pairs[-1]}"


def meaning_style(meaning: str) -> tuple[str, str]:
    lower = meaning.lower()

    def has_keyword(needle: str) -> bool:
        escaped = re.escape(needle)
        return bool(re.search(rf"(?<![a-z]){escaped}(?![a-z])", lower))

    classes = [
        (("water", "river", "sea", "lake", "spring", "tide", "liquid", "rain", "pond", "swamp", "stream"),
         "flowing image",
         "gathers into"),
        (("fire", "heat", "warm", "hot", "burn", "light", "bright", "shine", "sun", "ray", "lamp"),
         "lit image",
         "shines toward"),
        (("say", "speak", "talk", "ask", "call", "read", "write", "word", "sound", "voice", "name", "language"),
         "spoken image",
         "carries words into"),
        (("heart", "feel", "worry", "sad", "anger", "fear", "love", "desire", "wish", "think", "recall"),
         "inner image",
         "presses inward as"),
        (("go", "walk", "run", "move", "enter", "exit", "return", "cross", "reach", "arrive", "advance", "retreat", "follow"),
         "moving image",
         "travels toward"),
        (("protect", "guard", "hide", "cover", "surround", "enclose", "safe", "secure", "keep"),
         "sheltering image",
         "closes around"),
        (("tight", "bind", "bound", "knot", "rope", "thread", "string", "silk"),
         "binding image",
         "pulls tight into"),
        (("grip", "grasp", "hold", "seize", "catch"),
         "holding image",
         "closes around"),
        (("cut", "divide", "break", "split", "sever", "hew", "stab", "strike", "beat", "grind"),
         "sharp image",
         "cuts toward"),
        (("count", "number", "measure", "order", "rank", "line", "list", "record", "copy"),
         "ordered image",
         "lines up as"),
        (("make", "build", "create", "form", "shape", "construct", "establish", "set", "frame"),
         "making image",
         "sets the shape of"),
        (("tree", "grass", "flower", "plant", "grain", "leaf", "root", "branch", "bamboo", "crop"),
         "growing image",
         "grows into"),
        (("bird", "fish", "horse", "dog", "ox", "cow", "sheep", "insect", "animal", "pooch"),
         "living image",
         "takes the body of"),
        (("house", "room", "city", "country", "village", "temple", "store", "gate", "place", "street", "building"),
         "place image",
         "marks the site of"),
        (("person", "woman", "man", "child", "mother", "father", "official", "teacher", "king", "monarch"),
         "human image",
         "identifies"),
    ]
    for needles, subject, verb in classes:
        if any(has_keyword(needle) for needle in needles):
            return subject, verb
    return "visual image", ("reveals" if len(lower) < 14 else "points toward")


def local_mnemonic(prepared: dict[str, Any]) -> str:
    char = prepared["character"]
    final_pair = f"{char} {prepared['meaning']}"
    components = prepared["components"]
    component_text = phrase_components(components, char)
    if component_text.startswith("a "):
        component_text = "A " + component_text[2:]
    if len(components) == 1 and components[0]["character"] == char:
        return f"{component_text} stands alone as {final_pair}."
    subject, verb = meaning_style(prepared["meaning"])
    return f"{component_text} in one {subject} {verb} {final_pair}."


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


def attach_coverage_metadata(record: dict[str, Any], metadata: dict[str, str]) -> dict[str, Any]:
    if metadata.get("evidence"):
        record["coverage_evidence"] = metadata["evidence"]
    if metadata.get("alias_of"):
        record["alias_of"] = metadata["alias_of"]
    if metadata.get("alias_reason"):
        record["alias_reason"] = metadata["alias_reason"]
    return record


def alias_card(alias_char: str, base_record: dict[str, Any], metadata: dict[str, str]) -> dict[str, Any]:
    components = [
        {"character": component["character"], "gloss": component["gloss"]}
        for component in base_record.get("components") or []
    ]
    meaning = safe_gloss(alias_char, metadata.get("meaning") or str(base_record.get("meaning") or "form"))
    if not components:
        components = [{"character": alias_char, "gloss": meaning}]
    prepared = {
        "character": alias_char,
        "meaning": meaning,
        "components": components,
        "visual_components": components,
        "component_source": f"variant_alias:{metadata['alias_of']}",
        "source_meaning": f"alias of {metadata['alias_of']}",
    }
    record = local_card(prepared, metadata.get("generation_source", "codex_local_variant_alias"))
    record["alias_of"] = metadata["alias_of"]
    record["alias_reason"] = metadata.get("reason", "")
    if metadata.get("alias_kind"):
        record["alias_kind"] = metadata["alias_kind"]
    return record


def automatic_nfkc_alias_targets(covered_chars: set[str]) -> dict[str, dict[str, str]]:
    targets: dict[str, dict[str, str]] = {}
    for start, end in AUTO_COMPATIBILITY_ALIAS_RANGES:
        for codepoint in range(start, end + 1):
            alias_char = chr(codepoint)
            normalized = unicodedata.normalize("NFKC", alias_char)
            if alias_char in covered_chars or normalized == alias_char:
                continue
            if len(normalized) != 1 or not is_han_string(normalized):
                continue
            if normalized not in covered_chars:
                continue
            targets[alias_char] = {
                "alias_of": normalized,
                "alias_kind": "nfkc_compatibility",
                "generation_source": "codex_local_nfkc_variant_alias",
                "reason": "Unicode NFKC compatibility ideograph",
            }
    return dict(sorted(targets.items(), key=lambda item: (ord(item[0]), item[0])))


def add_learner_gap_cards(
    cards: list[dict[str, Any]],
    prepared: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    by_char = {card["character"]: card for card in cards}

    for char, metadata in EXTRA_LEARNER_TARGETS.items():
        if char in by_char:
            attach_coverage_metadata(by_char[char], metadata)
            continue
        prepared_card = prepared.get(char) or prepare_card(char)
        record = local_card(prepared_card, "codex_local_learner_gap")
        attach_coverage_metadata(record, metadata)
        by_char[char] = record
        cards.append(record)

    for alias_char, metadata in VARIANT_ALIAS_TARGETS.items():
        if alias_char in by_char:
            by_char[alias_char]["alias_of"] = metadata["alias_of"]
            by_char[alias_char]["alias_reason"] = metadata.get("reason", "")
            continue
        base = by_char.get(metadata["alias_of"])
        if base is None:
            base_prepared = prepared.get(metadata["alias_of"]) or prepare_card(metadata["alias_of"])
            base = local_card(base_prepared, "codex_local_completion")
            by_char[metadata["alias_of"]] = base
            cards.append(base)
        record = alias_card(alias_char, base, metadata)
        by_char[alias_char] = record
        cards.append(record)

    auto_aliases = automatic_nfkc_alias_targets(set(by_char))
    for alias_char, metadata in auto_aliases.items():
        base = by_char.get(metadata["alias_of"])
        if base is None:
            continue
        record = alias_card(alias_char, base, metadata)
        by_char[alias_char] = record
        cards.append(record)

    return sorted(cards, key=lambda card: (ord(card["character"]), card["character"]))


def count_sources(cards: list[dict[str, Any]]) -> dict[str, int]:
    source_counts: dict[str, int] = {}
    for card in cards:
        source = str(card.get("generation_source") or "unknown")
        source_counts[source] = source_counts.get(source, 0) + 1
    return source_counts


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
        elif char in paid_10k:
            reason = None if card_is_clean(paid_10k[char]) else "paid_10k_failed_style_scan"
            card = local_card(prepared[char], "codex_local_reauthor_paid_9000", reason)
        else:
            card = local_card(prepared[char], "codex_local_completion")
        source = card["generation_source"]
        source_counts[source] = source_counts.get(source, 0) + 1
        cards.append(card)

    cards = add_learner_gap_cards(cards, prepared)
    source_counts = count_sources(cards)

    artifact = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model": {
            "name": "codex-authored-complete-semantic-mnemonics",
            "provider": "mixed",
            "id": "reviewed-1000+codex-reauthored-paid-9000+codex-local-completion+learner-gap-aliases",
        },
        "count": len(cards),
        "coverage_note": (
            "The reviewed first 1000 cards are preserved. The other paid 9000 Gemini cards "
            "are re-authored locally, and the remaining characters are completed locally, "
            "using canonical visual component glosses and validation for every card. "
            "Extra learner-gap glyphs and Japanese compatibility forms are added explicitly "
            "when frequency/name/JPDB heuristics showed useful exact glyphs outside the "
            "original component-gloss and taxonomy target set."
        ),
        "card_input_cache_version": sm.CARD_INPUT_CACHE_VERSION,
        "manual_gloss_overrides_used": sm.MANUAL_GLOSS_OVERRIDES,
        "manual_component_gloss_overrides_used": sm.MANUAL_COMPONENT_GLOSS_OVERRIDES,
        "extra_learner_targets_used": EXTRA_LEARNER_TARGETS,
        "variant_alias_targets_used": VARIANT_ALIAS_TARGETS,
        "source_counts": source_counts,
        "mnemonics": cards,
    }
    OUTPUT_PATH.write_text(json.dumps(artifact, ensure_ascii=False, separators=(",", ":")))
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
