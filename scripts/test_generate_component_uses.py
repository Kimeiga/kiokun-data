#!/usr/bin/env python3

import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("generate_component_uses.py")
SPEC = importlib.util.spec_from_file_location("generate_component_uses", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ComponentUsesTests(unittest.TestCase):
    def test_merges_curated_mnemonic_components(self):
        characters = {
            "河": {
                "isVerified": True,
                "components": [
                    {"character": "水", "type": ["meaning"]},
                ],
            },
        }
        cards = [
            {
                "character": "栞",
                "components": [{"character": "木", "gloss": "tree"}],
                "visual_components": [
                    {"character": "幵", "gloss": "even"},
                    {"character": "木", "gloss": "tree"},
                ],
            },
            {
                "character": "幵",
                "visual_components": [
                    {"character": "干", "gloss": "offend"},
                    {"character": "干", "gloss": "offend"},
                ],
            },
            {
                "character": "干",
                "visual_components": [{"character": "干", "gloss": "offend"}],
            },
        ]

        uses = MODULE.build_component_uses(characters, cards)

        self.assertEqual(uses["幵"]["mnemonic"]["chars"], ["栞"])
        self.assertEqual(uses["干"]["mnemonic"]["chars"], ["幵"])
        self.assertEqual(uses["干"]["mnemonic"]["count"], 1)
        self.assertNotIn("干", uses["干"]["mnemonic"]["chars"])
        self.assertEqual(uses["水"]["meaning"]["verified"], 1)


if __name__ == "__main__":
    unittest.main()
