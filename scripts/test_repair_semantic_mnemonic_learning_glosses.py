#!/usr/bin/env python3
"""Tests for targeted learning-gloss and mnemonic repairs."""

from __future__ import annotations

import copy
import importlib.util
from pathlib import Path
import unittest


SCRIPT = Path(__file__).with_name("repair_semantic_mnemonic_learning_glosses.py")
SPEC = importlib.util.spec_from_file_location(
    "repair_semantic_mnemonic_learning_glosses",
    SCRIPT,
)
assert SPEC and SPEC.loader
repairs = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(repairs)


class LearningGlossRepairTests(unittest.TestCase):
    def test_repairs_badger_card_without_changing_components(self) -> None:
        components = [
            {"character": "犭", "gloss": "dog (side)"},
            {"character": "各", "gloss": "each"},
        ]
        artifact = {
            "mnemonics": [
                {
                    "character": "狢",
                    "meaning": "animal name",
                    "source_meaning": "animal name",
                    "equation": "犭 dog (side) + 各 each = 狢 animal name",
                    "mnemonic": "An abstract animal-name mnemonic.",
                    "components": copy.deepcopy(components),
                    "visual_components": copy.deepcopy(components),
                }
            ]
        }

        repairs.repair_badger_card(artifact)

        card = artifact["mnemonics"][0]
        for field, expected in repairs.BADGER_CARD_FIELDS.items():
            self.assertEqual(card[field], expected)
        self.assertEqual(card["components"], components)
        self.assertEqual(card["visual_components"], components)
        self.assertEqual(card["quality_provenance"], "hand_reviewed")
        self.assertNotIn("animal name", card["mnemonic"])


if __name__ == "__main__":
    unittest.main()
