#!/usr/bin/env python3

from __future__ import annotations

import copy
import re
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import manage_semantic_mnemonic_corpus as corpus_store
import repair_semantic_mnemonic_random_audit as repair


class RandomAuditRepairTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.policy = repair.load_policy()
        cls.artifact = corpus_store.load_corpus()

    def test_audit_is_broad_and_reproducible(self) -> None:
        audit = self.policy["audit"]
        self.assertEqual(audit["seed"], 20260728)
        self.assertEqual(sum(audit["character_strata"].values()), 591)
        self.assertEqual(sum(audit["word_page_strata"].values()), 150)
        self.assertGreaterEqual(len(self.policy["repairs"]), 8)

    def test_repairs_apply_in_memory_and_satisfy_policy(self) -> None:
        artifact = copy.deepcopy(self.artifact)
        for card in artifact["mnemonics"]:
            if card["character"] in self.policy["repairs"]:
                card.pop("random_quality_audit_repair", None)
        changed = repair.apply_repairs(artifact, self.policy)
        self.assertEqual(set(changed), set(self.policy["repairs"]))
        self.assertEqual(repair.card_errors(artifact, self.policy), [])

    def test_repair_is_idempotent(self) -> None:
        artifact = copy.deepcopy(self.artifact)
        repair.apply_repairs(artifact, self.policy)
        self.assertEqual(repair.apply_repairs(artifact, self.policy), [])

    def test_required_pairs_are_present(self) -> None:
        artifact = copy.deepcopy(self.artifact)
        repair.apply_repairs(artifact, self.policy)
        by_character = {
            card["character"]: card for card in artifact["mnemonics"]
        }
        for character, policy_repair in self.policy["repairs"].items():
            card = by_character[character]
            for component in policy_repair["components"]:
                pair = f"{component['character']} {component['gloss']}"
                self.assertIn(pair, card["equation"])
                prose_gloss = re.sub(
                    r"\s+\((?:side|top|bottom|left|right|drops|alt)\)",
                    "",
                    component["gloss"],
                    flags=re.IGNORECASE,
                )
                self.assertIn(
                    f"{component['character']} {prose_gloss}",
                    card["mnemonic"],
                )
            final_pair = f"{character} {card['meaning']}"
            self.assertIn(final_pair, card["equation"])
            self.assertIn(final_pair, card["mnemonic"])


if __name__ == "__main__":
    unittest.main()
