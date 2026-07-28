#!/usr/bin/env python3
"""Verify Korean homonyms, redirects, and aliases in published dictionary shards."""

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

import smoke_semantic_mnemonic_deployment as published  # noqa: E402


def korean_words(entry: dict[str, Any]) -> list[dict[str, Any]]:
    words = entry.get("korean_words")
    if not isinstance(words, list):
        return []
    return [word for word in words if isinstance(word, dict)]


def require_hanja(entry: dict[str, Any], expected_hanja: str, expected_gloss: str) -> None:
    matches = [
        word for word in korean_words(entry) if word.get("hanja") == expected_hanja
    ]
    if len(matches) != 1:
        raise RuntimeError(
            f"{entry.get('key')}: expected one Korean {expected_hanja} entry, "
            f"found {len(matches)}"
        )
    definitions = matches[0].get("definitions") or []
    definition_text = " ".join(
        str(definition.get("text") or "")
        for definition in definitions
        if isinstance(definition, dict)
    ).lower()
    if expected_gloss.lower() not in definition_text:
        raise RuntimeError(
            f"{entry.get('key')}: Korean {expected_hanja} lacks {expected_gloss!r}"
        )


def validate_published_entries(*, cache_key: str, timeout: float) -> dict[str, Any]:
    entries = {
        key: published.fetch_entry(key, cache_key=cache_key, timeout=timeout)
        for key in ("은행", "銀行", "銀杏", "저금리", "正말")
    }

    ambiguous = entries["은행"]
    if ambiguous.get("redirect") is not None:
        raise RuntimeError("은행: ambiguous Hangul homonym must not redirect to one Hanja")
    require_hanja(ambiguous, "銀行", "bank")
    require_hanja(ambiguous, "銀杏", "gingko")
    ids = [word.get("id") for word in korean_words(ambiguous)]
    if len(ids) != len(set(ids)):
        raise RuntimeError("은행: published Korean homonyms do not have unique IDs")

    require_hanja(entries["銀行"], "銀行", "bank")
    require_hanja(entries["銀杏"], "銀杏", "gingko")

    if entries["저금리"].get("redirect") != "低金利":
        raise RuntimeError("저금리: unambiguous Hangul form should redirect to 低金利")
    if entries["正말"].get("redirect") != "정말":
        raise RuntimeError("正말: safe KRDICT Hanja alias should redirect to 정말")

    return {
        "ambiguous_hangul": {
            "key": "은행",
            "hanja": ["銀行", "銀杏"],
            "url": published.published_url("은행", cache_key=cache_key),
        },
        "unambiguous_redirect": {
            "key": "저금리",
            "target": "低金利",
            "url": published.published_url("저금리", cache_key=cache_key),
        },
        "hanja_alias": {
            "key": "正말",
            "target": "정말",
            "url": published.published_url("正말", cache_key=cache_key),
        },
    }


def run_smoke(*, attempts: int, delay: float, timeout: float) -> dict[str, Any]:
    run_key = os.environ.get("GITHUB_RUN_ID", "local")
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return validate_published_entries(
                cache_key=f"{run_key}-{attempt}",
                timeout=timeout,
            )
        except Exception as exc:
            last_error = exc
            if attempt < attempts:
                print(
                    f"attempt {attempt}/{attempts} failed: {exc}; retrying in {delay}s",
                    file=sys.stderr,
                )
                time.sleep(delay)
    raise RuntimeError(f"deployment smoke test failed after {attempts} attempts: {last_error}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--attempts", type=int, default=1)
    parser.add_argument("--delay", type=float, default=0)
    parser.add_argument("--timeout", type=float, default=20)
    args = parser.parse_args()
    if args.attempts < 1 or args.delay < 0 or args.timeout <= 0:
        parser.error("attempts and timeout must be positive; delay cannot be negative")
    try:
        result = run_smoke(
            attempts=args.attempts,
            delay=args.delay,
            timeout=args.timeout,
        )
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"status": "pass", "entries": result}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
