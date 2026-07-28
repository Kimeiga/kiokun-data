#!/usr/bin/env python3
"""Verify representative mnemonic projections in the published dictionary."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
import time
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen
import zlib


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import manage_semantic_mnemonic_corpus as corpus_store  # noqa: E402


SMOKE_CASES = {
    "normal": "喬",
    "semantic_layers": "弋",
    "alias": "豈",
    "mnemonic_only": "𢼸",
    "supplementary_plane": "𠀀",
}


def is_han_character(character: str) -> bool:
    codepoint = ord(character)
    return (
        0x3400 <= codepoint <= 0x4DBF
        or 0x4E00 <= codepoint <= 0x9FFF
        or 0xF900 <= codepoint <= 0xFAFF
        or 0x20000 <= codepoint <= 0x2EE5F
        or 0x2F800 <= codepoint <= 0x323AF
    )


def simple_hash(value: str) -> int:
    result = 0
    for character in value:
        result = (result * 31 + ord(character)) & 0xFFFFFFFF
    return result


def published_url(character: str, *, cache_key: str) -> str:
    hash_value = simple_hash(character)
    han_count = sum(is_han_character(value) for value in character)
    if han_count == 0:
        shard = f"non-han-{hash_value % 4 + 1}"
    elif han_count == 1:
        shard = f"han-1char-{hash_value % 8 + 1}"
    elif han_count == 2:
        shard = f"han-2char-{hash_value % 8 + 1}"
    else:
        shard = f"han-3plus-{hash_value % 8 + 1}"
    subdirectory = f"{hash_value & 0xFF:02x}"
    encoded = quote(character, safe="")
    return (
        f"https://raw.githubusercontent.com/Kimeiga/kiokun2-dict-{shard}"
        f"/main/{subdirectory}/{encoded}.json.deflate?smoke={quote(cache_key)}"
    )


def fetch_entry(character: str, *, cache_key: str, timeout: float) -> dict[str, Any]:
    request = Request(
        published_url(character, cache_key=cache_key),
        headers={
            "Accept": "application/octet-stream",
            "Cache-Control": "no-cache",
            "User-Agent": "kiokun-semantic-mnemonic-smoke-test",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        compressed = response.read()
    try:
        payload = zlib.decompress(compressed, -zlib.MAX_WBITS)
        entry = json.loads(payload)
    except (zlib.error, UnicodeError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"invalid published entry for {character}: {exc}") from exc
    if not isinstance(entry, dict):
        raise RuntimeError(f"published entry for {character} is not an object")
    return entry


def validate_case(
    label: str,
    character: str,
    *,
    expected_card: dict[str, Any],
    cache_key: str,
    timeout: float,
) -> dict[str, Any]:
    entry = fetch_entry(character, cache_key=cache_key, timeout=timeout)
    actual_card = entry.get("semantic_mnemonic")
    expected_projection = corpus_store.runtime_card(expected_card)
    if actual_card != expected_projection:
        raise RuntimeError(
            f"{label} {character}: published mnemonic projection is stale or incorrect"
        )
    if label == "normal" and expected_card.get("alias_of"):
        raise RuntimeError(f"{label} {character}: expected a non-alias card")
    if label == "semantic_layers":
        required = {"lexical_gloss", "mnemonic_keyword", "keyword_kind"}
        missing = required - set(actual_card or {})
        if missing:
            raise RuntimeError(
                f"{label} {character}: published card lacks {sorted(missing)}"
            )
    if label == "alias" and not expected_card.get("alias_of"):
        raise RuntimeError(f"{label} {character}: expected alias metadata")
    if label == "mnemonic_only":
        unexpected = set(entry) - {"key", "semantic_mnemonic"}
        if unexpected:
            raise RuntimeError(
                f"{label} {character}: expected a mnemonic-only entry, "
                f"found {sorted(unexpected)}"
            )
    if label == "supplementary_plane" and ord(character) <= 0xFFFF:
        raise RuntimeError(f"{label} {character}: expected a supplementary code point")
    return {
        "case": label,
        "character": character,
        "url": published_url(character, cache_key=cache_key),
        "projection": expected_projection,
    }


def run_smoke(*, attempts: int, delay: float, timeout: float) -> list[dict[str, Any]]:
    artifact = corpus_store.load_corpus()
    cards = {
        card["character"]: card
        for card in artifact["mnemonics"]
    }
    missing = set(SMOKE_CASES.values()) - set(cards)
    if missing:
        raise RuntimeError(
            "smoke characters are absent from the canonical corpus: "
            + "".join(sorted(missing))
        )

    run_key = os.environ.get("GITHUB_RUN_ID", "local")
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return [
                validate_case(
                    label,
                    character,
                    expected_card=cards[character],
                    cache_key=f"{run_key}-{attempt}",
                    timeout=timeout,
                )
                for label, character in SMOKE_CASES.items()
            ]
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
        results = run_smoke(
            attempts=args.attempts,
            delay=args.delay,
            timeout=args.timeout,
        )
    except (RuntimeError, corpus_store.CorpusError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"status": "pass", "entries": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
