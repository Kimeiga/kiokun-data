#!/usr/bin/env python3
"""Tests for the published Korean dictionary smoke test."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest
from unittest import mock


SCRIPT = Path(__file__).with_name("smoke_korean_word_deployment.py")
SPEC = importlib.util.spec_from_file_location("smoke_korean_word_deployment", SCRIPT)
assert SPEC and SPEC.loader
smoke = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(smoke)


def word(identifier: str, hanja: str, definition: str) -> dict:
    return {
        "id": identifier,
        "hangul": "은행",
        "hanja": hanja,
        "definitions": [{"text": definition}],
    }


class KoreanDeploymentSmokeTests(unittest.TestCase):
    def test_validates_homonyms_redirect_and_alias(self) -> None:
        entries = {
            "은행": {
                "key": "은행",
                "korean_words": [
                    word("bank", "銀行", "bank"),
                    word("ginkgo", "銀杏", "gingko"),
                ],
            },
            "銀行": {
                "key": "銀行",
                "korean_words": [word("bank", "銀行", "bank")],
            },
            "銀杏": {
                "key": "銀杏",
                "korean_words": [word("ginkgo", "銀杏", "gingko")],
            },
            "저금리": {"key": "저금리", "redirect": "低金利"},
            "正말": {"key": "正말", "redirect": "정말"},
        }
        with mock.patch.object(
            smoke.published,
            "fetch_entry",
            side_effect=lambda key, **_: entries[key],
        ):
            result = smoke.validate_published_entries(cache_key="test", timeout=1)
        self.assertEqual(
            result["ambiguous_hangul"]["hanja"],
            ["銀行", "銀杏"],
        )

    def test_rejects_ambiguous_redirect(self) -> None:
        with mock.patch.object(
            smoke.published,
            "fetch_entry",
            return_value={"key": "은행", "redirect": "銀行"},
        ):
            with self.assertRaisesRegex(RuntimeError, "must not redirect"):
                smoke.validate_published_entries(cache_key="test", timeout=1)


if __name__ == "__main__":
    unittest.main()
