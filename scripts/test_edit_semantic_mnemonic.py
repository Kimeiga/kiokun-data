from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, "scripts")

import edit_semantic_mnemonic as editor


class EditorialMnemonicToolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.fixture = {
            "character": "処",
            "meaning": "location",
            "equation": "夂 walk + 几 small table = 処 location",
            "mnemonic": "After a 夂 walk, the 几 small table marks your resting 処 location.",
            "components": [
                {"character": "夂", "gloss": "walk"},
                {"character": "几", "gloss": "small table"},
            ],
            "visual_components": [
                {"character": "夂", "gloss": "walk"},
                {"character": "几", "gloss": "small table"},
            ],
            "component_source": "resolved_ids_forward",
            "hero_image_prompt": "A walker rests by a small table beside a trail.",
        }
        editor.complete.refresh_validation(cls.fixture, copy.deepcopy(cls.fixture))

    def base_card(self) -> dict:
        return copy.deepcopy(self.fixture)

    def override(self) -> dict:
        base = self.base_card()
        return {
            "character": "処",
            "status": "approved",
            "base_card_hash": editor.sha256_value(base),
            "expected": editor.card_signature(base),
            "mnemonic": "After a 夂 walk, you rest at a 几 small table; that resting spot is your 処 location.",
            "confidence": 0.93,
            "recorded_at": "2026-07-19",
            "rationale": "fixture",
            "source": "test",
        }

    def test_override_is_pinned_to_the_exact_pre_edit_card(self) -> None:
        override = self.override()
        self.assertEqual(editor.sha256_value(self.base_card()), override["base_card_hash"])

    def test_override_preserves_decomposition_and_formal_validity(self) -> None:
        override = self.override()
        updated, outcome = editor.apply_override(self.base_card(), override)
        self.assertEqual(outcome, "applied")
        self.assertEqual(updated["mnemonic"], override["mnemonic"])
        self.assertEqual(updated["components"], self.fixture["components"])
        self.assertEqual(updated["visual_components"], self.fixture["visual_components"])
        self.assertTrue(updated["validation"]["valid"])

    def test_stale_card_is_rejected_before_writing(self) -> None:
        stale = self.base_card()
        stale["mnemonic"] = "A different editorial change happened first."
        with self.assertRaisesRegex(editor.EditorialOverrideError, "stale base_card_hash"):
            editor.apply_override(stale, self.override())

    def test_existing_live_edit_is_idempotent(self) -> None:
        original = self.base_card()
        override = self.override()
        live, _ = editor.apply_override(original, override)
        updated, outcome = editor.apply_override(live, override)
        self.assertEqual(outcome, "already_applied")
        self.assertEqual(updated, live)

    def test_matching_text_without_ledger_provenance_is_not_silently_accepted(self) -> None:
        override = self.override()
        untracked, _ = editor.apply_override(self.base_card(), override)
        untracked.pop("editorial_override")
        with self.assertRaisesRegex(editor.EditorialOverrideError, "does not carry"):
            editor.apply_override(untracked, override)

    def test_superseded_history_does_not_block_the_next_active_override(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            ledger_path = Path(temporary) / "overrides.json"
            ledger_path.write_text(json.dumps({
                "schema_version": 1,
                "overrides": [
                    {"character": "処", "status": "superseded"},
                    self.override(),
                ],
            }, ensure_ascii=False))
            loaded = editor.load_overrides(ledger_path)
        self.assertEqual([entry["character"] for entry in loaded], ["処"])

    def test_published_ledger_replays_without_changes(self) -> None:
        result = editor.check_or_apply(character=None, write=False)
        self.assertEqual(result["formal_validation"]["invalid_count"], 0)
        self.assertFalse(result["changed"])


if __name__ == "__main__":
    unittest.main()
