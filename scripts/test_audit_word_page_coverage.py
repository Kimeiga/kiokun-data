#!/usr/bin/env python3
"""Tests for deterministic source-headword page coverage auditing."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("audit_word_page_coverage.py")
SPEC = importlib.util.spec_from_file_location("audit_word_page_coverage", SCRIPT)
assert SPEC and SPEC.loader
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)


class WordPageCoverageAuditTests(unittest.TestCase):
    def test_korean_pool_matches_loader_acceptance_rule(self) -> None:
        rows = [
            ["친구", "", "", "", 0, [], 1],
            ["親舊", "", "", "", 0, [], 1],
            ["親친구", "", "", "", 0, [], 1],
            ["친구", "", "", "", 0, [], 1],
        ]
        self.assertEqual(audit.load_korean_headwords(rows), ["친구"])
        self.assertEqual(
            audit.krdict_index_summary(rows),
            {
                "raw_index_rows": 4,
                "raw_unique_terms": 3,
                "publishable_hangul_rows": 2,
                "publishable_unique_headwords": 1,
                "alternate_index_rows_excluded_by_loader": 2,
                "alternate_unique_index_terms_excluded_by_loader": 2,
            },
        )
        loader = audit.krdict_loader_summary(rows)
        self.assertEqual(loader["accepted_rows"], 2)
        self.assertEqual(loader["exact_duplicate_rows"], 1)
        self.assertEqual(loader["rows_after_exact_deduplication"], 1)
        self.assertEqual(loader["sequence_values"], [1])

    def test_japanese_pool_uses_primary_builder_form(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "jmdict.json"
            path.write_text(
                json.dumps(
                    {
                        "words": [
                            {
                                "kanji": [{"text": "地図"}, {"text": "地圖"}],
                                "kana": [{"text": "ちず"}],
                            },
                            {"kanji": [], "kana": [{"text": "ありがとう"}]},
                        ]
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            self.assertEqual(
                audit.load_japanese_headwords(path),
                ["ありがとう", "地図"],
            )

    def test_sample_is_stable_and_language_scoped(self) -> None:
        values = [f"word-{index}" for index in range(100)]
        first = audit.deterministic_sample(
            values, language="japanese", seed=20260728, sample_size=10
        )
        second = audit.deterministic_sample(
            reversed(values), language="japanese", seed=20260728, sample_size=10
        )
        korean = audit.deterministic_sample(
            values, language="korean", seed=20260728, sample_size=10
        )
        self.assertEqual(first, second)
        self.assertNotEqual(first, korean)


if __name__ == "__main__":
    unittest.main()
