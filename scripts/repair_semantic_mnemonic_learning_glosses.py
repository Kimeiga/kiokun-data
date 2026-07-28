#!/usr/bin/env python3
"""Apply and verify curated lexical-versus-mnemonic gloss decisions.

This is intentionally a small, reviewed policy rather than a fuzzy
corpus-wide synonym matcher. It updates the canonical JSONL corpus through the
shared bucket-native API and keeps the website's component-gloss index aligned
with the same learning keywords.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import manage_semantic_mnemonic_corpus as corpus_store  # noqa: E402


GLOSSES_PATH = (
    ROOT / "sveltekit-app" / "static" / "game_data" / "component_glosses.json"
)

GLOSS_REPAIRS = {
    "圖": "map (trad)",
    "图": "map (simp)",
    "図": "map (jp)",
    "于": "at (simp)",
    "於": "at (trad)",
    "弋": "bladeless halberd",
    "訁": "speech (trad)",
    "讠": "speech (simp)",
    "釒": "metal (trad)",
    "钅": "metal (simp)",
    "飠": "food (trad)",
    "饣": "food (simp)",
    "髟": "long hair",
    "囗": "enclosure",
    "𧾷": "foot",
    "魚": "fish (trad/jp)",
    "鱼": "fish (simp)",
    "賣": "sell (trad)",
    "卖": "sell (simp)",
    "壽": "longevity (trad)",
    "寿": "longevity (simp)",
    "巴": "cling",
    "甬": "path",
    "雚": "stork",
    "喬": "lofty (trad)",
    "乔": "lofty (simp)",
    "刀": "knife",
    "斯": "this",
    "䒑": "grass top",
    "丷": "split horns",
}

YI_KEYWORD = "bladeless halberd"
YI_LEXICAL_GLOSS = (
    "wooden stake; tethered hunting arrow; shoot with a tethered arrow"
)

YI_MNEMONICS = {
    "㚤": "A 女 woman carrying a 弋 bladeless halberd as a badge of authority serves as a 㚤 officer.",
    "㢥": "The 同 same 㢥 big piece of wood is cut in the hooked shape of a 弋 bladeless halberd.",
    "㢦": "A 哥 older brother plants a 弋 bladeless halberd upright as a 㢦 tethering post.",
    "䄩": "A 弋 bladeless halberd cannot cut 禾 standing grain; it only knocks loose the 䄩 bran.",
    "䘝": "The hook of a 弋 bladeless halberd snags the 衤 clothing of a 䘝 shirt.",
    "䞖": "A child bearing the 䞖 personal-name character can 走 walk while carrying a ceremonial 弋 bladeless halberd.",
    "䣧": "A 弋 bladeless halberd casts its silhouette across the 酉 wine jar until the wine looks 䣧 black.",
    "䬥": "A forgotten 弋 bladeless halberd lies beside 食 food gone fuzzy as 䬥 moldy cooked food.",
    "䴬": "Use the broad back of a 弋 bladeless halberd to sweep 䴬 crumbs of barley beside the 麥 wheat.",
    "代": "A 亻 person inherits a 弋 bladeless halberd from the previous 代 generation.",
    "弋": "Picture 戈 halberd with its 丿 blade removed: the result is a 弋 bladeless halberd.",
    "弌": "A single 弋 bladeless halberd rests on 一 one line: 弌 one.",
    "弍": "A 弋 bladeless halberd above 二 two lines records 弍 number two.",
    "弎": "A 弋 bladeless halberd above 三 three lines records 弎 three.",
    "式": "A craftsperson's 工 work turns a 弋 bladeless halberd into a ceremonial 式 style.",
    "忒": "Clutching a 弋 bladeless halberd to the 心 heart at all times is 忒 excessive.",
    "杙": "Carve a 木 tree into the hooked shape of a 弋 bladeless halberd to make a 杙 tiny wooden post.",
    "武": "Plant 一 one 止 foot and raise a 弋 bladeless halberd in a 武 military stance.",
    "甙": "A confectioner uses a clean 弋 bladeless halberd as a paddle for 甘 sweet syrup, producing a 甙 sugar product.",
    "貮": "A 弋 bladeless halberd points to 一 one 貝 shell beside another, totaling 貮 number two.",
    "鳶": "An 鳥 bird perches on a 弋 bladeless halberd, its long wings identifying the 鳶 milvus.",
    "鸢": "A 鸟 bird perches on a 弋 bladeless halberd, its long wings identifying the 鸢 kite.",
    "黓": "A 黑 black 弋 bladeless halberd disappears against a 黓 black wall.",
}


def load_glosses() -> dict[str, str]:
    value = json.loads(GLOSSES_PATH.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"{GLOSSES_PATH} must contain a JSON object")
    return value


def write_glosses(glosses: dict[str, str]) -> None:
    encoded = json.dumps(
        glosses,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    temporary = GLOSSES_PATH.with_name(f".{GLOSSES_PATH.name}.tmp-{os.getpid()}")
    try:
        temporary.write_bytes(encoded)
        temporary.replace(GLOSSES_PATH)
    finally:
        if temporary.exists():
            temporary.unlink()


def repair_yi_family(artifact: dict[str, Any]) -> None:
    cards = {
        card["character"]: card
        for card in artifact["mnemonics"]
    }
    missing = set(YI_MNEMONICS) - set(cards)
    if missing:
        raise RuntimeError(f"canonical corpus lacks 弋-family cards: {sorted(missing)}")

    for character, mnemonic in YI_MNEMONICS.items():
        card = cards[character]
        for field in ("components", "visual_components", "historical_components"):
            for component in card.get(field, []):
                if component.get("character") == "弋":
                    component["gloss"] = YI_KEYWORD
        card["equation"] = card["equation"].replace("弋 catch", f"弋 {YI_KEYWORD}")
        card["mnemonic"] = mnemonic

    yi = cards["弋"]
    yi["meaning"] = YI_KEYWORD
    yi["lexical_gloss"] = YI_LEXICAL_GLOSS
    yi["mnemonic_keyword"] = YI_KEYWORD
    yi["keyword_kind"] = "visual_comparison"
    yi["equation"] = "戈 halberd − 丿 blade = 弋 bladeless halberd"


def policy_errors(
    artifact: dict[str, Any],
    glosses: dict[str, str],
) -> list[str]:
    errors = [
        f"{character}: component gloss is {glosses.get(character)!r}, "
        f"expected {expected!r}"
        for character, expected in GLOSS_REPAIRS.items()
        if glosses.get(character) != expected
    ]
    cards = {
        card["character"]: card
        for card in artifact["mnemonics"]
    }
    yi = cards.get("弋", {})
    expected_yi_fields = {
        "meaning": YI_KEYWORD,
        "lexical_gloss": YI_LEXICAL_GLOSS,
        "mnemonic_keyword": YI_KEYWORD,
        "keyword_kind": "visual_comparison",
        "equation": "戈 halberd − 丿 blade = 弋 bladeless halberd",
        "mnemonic": YI_MNEMONICS["弋"],
    }
    for field, expected in expected_yi_fields.items():
        if yi.get(field) != expected:
            errors.append(
                f"弋: {field} is {yi.get(field)!r}, expected {expected!r}"
            )

    for character, expected_mnemonic in YI_MNEMONICS.items():
        card = cards.get(character)
        if card is None:
            errors.append(f"{character}: missing 弋-family card")
            continue
        if card.get("mnemonic") != expected_mnemonic:
            errors.append(f"{character}: 弋-family mnemonic is out of policy")
        if "弋 catch" in card.get("equation", "") or "弋 catch" in card.get(
            "mnemonic", ""
        ):
            errors.append(f"{character}: runtime prose still teaches 弋 as catch")
        for field in ("components", "visual_components", "historical_components"):
            for component in card.get(field, []):
                if (
                    component.get("character") == "弋"
                    and component.get("gloss") != YI_KEYWORD
                ):
                    errors.append(
                        f"{character}: {field} gives 弋 gloss "
                        f"{component.get('gloss')!r}"
                    )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    try:
        artifact = corpus_store.load_corpus()
        glosses = load_glosses()
        if args.apply:
            source_hash = corpus_store.current_manifest_source_hash(
                corpus_store.DEFAULT_MANIFEST
            )
            repair_yi_family(artifact)
            glosses.update(GLOSS_REPAIRS)
            corpus_store.publish_corpus(
                artifact,
                expected_source_hash=source_hash,
            )
            write_glosses(glosses)
            artifact = corpus_store.load_corpus()
            glosses = load_glosses()

        errors = policy_errors(artifact, glosses)
    except (RuntimeError, OSError, UnicodeError, json.JSONDecodeError,
            corpus_store.CorpusError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1
    print(
        f"semantic learning-gloss policy passed "
        f"({len(GLOSS_REPAIRS)} glosses, {len(YI_MNEMONICS)} 弋-family cards)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
