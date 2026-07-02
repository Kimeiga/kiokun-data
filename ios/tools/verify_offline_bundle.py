#!/usr/bin/env python3
"""Verify the iOS offline SQLite bundle can serve core native flows."""

from __future__ import annotations

import argparse
import json
import random
import sqlite3
import zlib
from pathlib import Path


REQUIRED_STATIC = [
    "game_unified/manifest.json",
    "game_unified/distractors.json",
    "game_unified/chunks/0.json",
    "homophones_ja_words.json",
    "homophones_zh_words.json",
    "homophones_kr_words.json",
    "frequency_list.json",
    "zh_sentences/0.json",
    "kr_sentences/0.json",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    return parser.parse_args()


def inflate(blob: bytes) -> bytes:
    return zlib.decompress(blob, -zlib.MAX_WBITS)


def load_asset(connection: sqlite3.Connection, path: str):
    row = connection.execute(
        "SELECT compressedData FROM static_assets WHERE path = ?",
        (path,),
    ).fetchone()
    if not row:
        raise AssertionError(f"missing static asset: {path}")
    return json.loads(inflate(row[0]))


def valid_token(token: str) -> bool:
    punctuation = set("。，、；：？！…—·「」『』（）【】《》〈〉.,;:?!()[]\"'-–— \t\n")
    stripped = token.strip()
    return bool(stripped) and not all(ch in punctuation for ch in stripped)


def verify_game(connection: sqlite3.Connection) -> None:
    manifest = load_asset(connection, "game_unified/manifest.json")
    distractors = load_asset(connection, "game_unified/distractors.json")
    chunk = load_asset(connection, "game_unified/chunks/0.json")
    assert manifest["total"] >= len(chunk)
    assert {"ja", "zh", "ko", "tr"}.issubset(distractors)

    sentence = next(item for item in chunk if item.get("translations", {}).get("ja"))
    translation = sentence["translations"]["ja"]
    correct = [token for token in translation["tokens"] if valid_token(token)]
    wrong_pool = [token for token in distractors["ja"] if token not in correct and valid_token(token)]
    tiles = correct + random.sample(wrong_pool, min(max(3, len(correct) // 2), 8))
    random.shuffle(tiles)
    assert correct
    assert set(correct).issubset(set(tiles))


def main() -> None:
    args = parse_args()
    connection = sqlite3.connect(args.bundle)
    try:
        dictionary_count = connection.execute("SELECT count(*) FROM dictionary_entries").fetchone()[0]
        search_count = connection.execute("SELECT count(*) FROM dictionary_search").fetchone()[0]
        static_count = connection.execute("SELECT count(*) FROM static_assets").fetchone()[0]
        assert dictionary_count > 0, "dictionary_entries is empty"
        assert search_count > 0, "dictionary_search is empty"
        assert static_count >= len(REQUIRED_STATIC), "static_assets is incomplete"

        key, blob = connection.execute(
            "SELECT key, compressedData FROM dictionary_entries WHERE compressedData IS NOT NULL LIMIT 1"
        ).fetchone()
        dictionary_json = json.loads(inflate(blob))
        assert dictionary_json["key"] == key

        for path in REQUIRED_STATIC:
            asset = load_asset(connection, path)
            assert asset is not None

        frequency = load_asset(connection, "frequency_list.json")
        assert frequency["japanese"], "frequency Japanese list is empty"

        zh_sentences = load_asset(connection, "zh_sentences/0.json")
        kr_sentences = load_asset(connection, "kr_sentences/0.json")
        assert zh_sentences and len(zh_sentences[0]) >= 4
        assert kr_sentences and len(kr_sentences[0]) >= 2

        verify_game(connection)
    finally:
        connection.close()

    print(
        f"Verified {args.bundle}: {dictionary_count:,} dictionary entries, "
        f"{search_count:,} search rows, {static_count:,} static assets."
    )


if __name__ == "__main__":
    main()
