#!/usr/bin/env python3
"""Compare deployed language-specific sound layers with packed projections."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
import time
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import manage_pronunciation_mnemonic_corpus as pronunciation_store  # noqa: E402
from smoke_semantic_mnemonic_deployment import fetch_entry, published_url  # noqa: E402


SMOKE_CASES = {
    "normal_chinese": ("我", "zh", "我"),
    "simplified_traditional_variant": ("說", "zh", "说"),
    "polyphonic_mandarin": ("行", "zh", "行"),
    "normal_japanese": ("国", "ja", "国"),
    "japanese_on_and_kun": ("見", "ja", "見"),
    "japanese_multiple_core": ("生", "ja", "生"),
}


def validate_case(
    label: str,
    page_character: str,
    language: str,
    identity: str,
    *,
    expected: dict[str, Any],
    cache_key: str,
    timeout: float,
) -> dict[str, Any]:
    entry = fetch_entry(page_character, cache_key=cache_key, timeout=timeout)
    semantic = entry.get("semantic_mnemonic") or {}
    projections = semantic.get("pronunciation_mnemonics") or []
    actual = next(
        (
            card
            for card in projections
            if card.get("language") == language and card.get("character") == identity
        ),
        None,
    )
    if actual != expected:
        raise RuntimeError(
            f"{label} {page_character}: deployed pronunciation projection is stale or absent"
        )
    if label == "polyphonic_mandarin" and len(actual["readings"]) < 2:
        raise RuntimeError("polyphonic Mandarin smoke case lost a core reading")
    if label == "japanese_on_and_kun" and {
        reading["reading_type"] for reading in actual["readings"]
    } != {"on", "kun"}:
        raise RuntimeError("Japanese on/kun smoke case no longer contains both groups")
    if label == "japanese_multiple_core" and len(actual["readings"]) < 4:
        raise RuntimeError("Japanese multi-reading smoke case lost core coverage")
    return {
        "case": label,
        "character": page_character,
        "language": language,
        "url": published_url(page_character, cache_key=cache_key),
        "reading_count": len(actual["readings"]),
    }


def run_smoke(*, attempts: int, delay: float, timeout: float) -> list[dict[str, Any]]:
    result = pronunciation_store.verify_corpus(deep=False)
    expected_cards = {
        (card["language"], card["character"]): pronunciation_store.runtime_card(card)
        for card in result["cards"]
    }
    run_key = os.environ.get("GITHUB_RUN_ID", "local")
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return [
                validate_case(
                    label,
                    page_character,
                    language,
                    identity,
                    expected=expected_cards[(language, identity)],
                    cache_key=f"pronunciation-{run_key}-{attempt}",
                    timeout=timeout,
                )
                for label, (page_character, language, identity) in SMOKE_CASES.items()
            ]
        except Exception as exc:
            last_error = exc
            if attempt < attempts:
                print(
                    f"attempt {attempt}/{attempts} failed: {exc}; retrying in {delay}s",
                    file=sys.stderr,
                )
                time.sleep(delay)
    raise RuntimeError(
        f"pronunciation deployment smoke failed after {attempts} attempts: {last_error}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--attempts", type=int, default=1)
    parser.add_argument("--delay", type=float, default=0)
    parser.add_argument("--timeout", type=float, default=20)
    args = parser.parse_args()
    if args.attempts < 1 or args.delay < 0 or args.timeout <= 0:
        parser.error("attempts and timeout must be positive; delay cannot be negative")
    try:
        entries = run_smoke(
            attempts=args.attempts, delay=args.delay, timeout=args.timeout
        )
    except (RuntimeError, pronunciation_store.CorpusError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"status": "pass", "entries": entries}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
