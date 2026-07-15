#!/usr/bin/env python3
"""Focused regression tests for formal validity versus learning quality."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent))

import audit_semantic_mnemonics as audit  # noqa: E402
import semantic_mnemonics as sm  # noqa: E402


class SemanticMnemonicQualityTests(unittest.TestCase):
    def card(self, *, mnemonic: str, components: list[dict[str, str]], meaning: str = "cotton") -> dict:
        return {
            "character": "綿",
            "meaning": meaning,
            "components": components,
            "equation": " + ".join(f"{c['character']} {c['gloss']}" for c in components) + f" = 綿 {meaning}",
            "mnemonic": mnemonic,
            "hero_image_prompt": "A labeled textile scene.",
        }

    def test_formally_valid_filler_is_still_a_quality_failure(self) -> None:
        components = [{"character": "糸", "gloss": "thread"}, {"character": "帛", "gloss": "white cloth"}]
        card = self.card(
            mnemonic="A 糸 thread joined with 帛 white cloth gives shape to 綿 cotton.",
            components=components,
        )
        self.assertTrue(sm.validate_card(card, card)["valid"])
        self.assertIn("generic_filler", {flag["code"] for flag in audit.quality_flags(card)})

    def test_concrete_causal_image_avoids_generic_flag(self) -> None:
        components = [{"character": "糸", "gloss": "thread"}, {"character": "帛", "gloss": "white cloth"}]
        card = self.card(
            mnemonic="Pull a 糸 thread from 帛 white cloth and its soft fiber reveals 綿 cotton.",
            components=components,
        )
        self.assertNotIn("generic_filler", {flag["code"] for flag in audit.quality_flags(card)})

    def test_plural_component_glosses_are_detected_as_duplicates(self) -> None:
        card = self.card(
            mnemonic="A 糸 silk strand crosses 帛 silks before 綿 cotton appears.",
            components=[{"character": "糸", "gloss": "silk"}, {"character": "帛", "gloss": "silks"}],
        )
        self.assertIn("duplicated_component_meaning", {flag["code"] for flag in audit.quality_flags(card)})

    def test_tautological_self_form_gets_its_own_flag(self) -> None:
        card = {
            "character": "川",
            "meaning": "river",
            "components": [{"character": "川", "gloss": "river"}],
            "mnemonic": "The written shape of 川 river is the memory image.",
        }
        codes = {flag["code"] for flag in audit.quality_flags(card)}
        self.assertIn("generic_filler", codes)
        self.assertIn("tautological_self_form", codes)

    def test_frequency_increases_review_priority(self) -> None:
        self.assertGreater(audit.review_priority(6, 10), audit.review_priority(6, None))

    def test_coverage_fallback_cannot_evade_audit_by_rewording(self) -> None:
        card = self.card(
            mnemonic="A 糸 thread winds across 帛 white cloth until 綿 cotton appears.",
            components=[{"character": "糸", "gloss": "thread"}, {"character": "帛", "gloss": "white cloth"}],
        )
        card["quality_provenance"] = "coverage_fallback_needs_review"
        self.assertIn("generic_filler", {flag["code"] for flag in audit.quality_flags(card)})


if __name__ == "__main__":
    unittest.main()
