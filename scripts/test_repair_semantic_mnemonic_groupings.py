from pathlib import Path
import sys
import unittest


sys.path.insert(0, str(Path(__file__).resolve().parent))

import repair_semantic_mnemonic_groupings as grouping


class SemanticMnemonicGroupingTests(unittest.TestCase):
    def test_candidate_rule_finds_fragmented_historical_alternative(self) -> None:
        inputs = {
            "cards": [
                {
                    "character": "延",
                    "components": [
                        {"character": "廴", "gloss": "long stride"},
                        {"character": "丿", "gloss": "slash"},
                        {"character": "止", "gloss": "foot"},
                    ],
                    "historical_components": [
                        {"character": "廴", "gloss": "long stride"},
                        {"character": "正", "gloss": "straight"},
                    ],
                },
                {
                    "character": "明",
                    "components": [
                        {"character": "日", "gloss": "sun"},
                        {"character": "月", "gloss": "moon"},
                    ],
                    "historical_components": [],
                },
            ]
        }
        self.assertEqual(grouping.discover_candidates(inputs), {"延"})

    def test_policy_requires_a_decision_for_every_candidate(self) -> None:
        inputs = {
            "cards": [
                {
                    "character": "延",
                    "components": [{"character": "丿", "gloss": "slash"}],
                    "historical_components": [
                        {"character": "正", "gloss": "straight"}
                    ],
                }
            ]
        }
        policy = {
            "schema_version": 1,
            "policy_version": "fixture",
            "reviewed_retain": [],
            "repairs": {},
        }
        self.assertEqual(
            grouping.policy_coverage_errors(policy, inputs),
            ["unreviewed grouping candidates: 延"],
        )

    def test_apply_repairs_is_idempotent(self) -> None:
        policy = {
            "schema_version": 1,
            "policy_version": "fixture",
            "reviewed_retain": [],
            "repairs": {
                "延": {
                    "components": [
                        {"character": "廴", "gloss": "long stride"},
                        {"character": "正", "gloss": "straight"},
                    ],
                    "equation": "Visual comparison: 廴 long stride + 正 straight = 延 prolong",
                    "mnemonic": "Keep going 正 straight with a 廴 long stride to 延 prolong the trip.",
                    "hero_image_prompt": "A long straight path, no text.",
                    "rationale": "fixture",
                }
            },
        }
        artifact = {
            "mnemonics": [
                {
                    "character": "延",
                    "meaning": "prolong",
                    "components": [{"character": "丿", "gloss": "slash"}],
                    "visual_components": [
                        {"character": "丿", "gloss": "slash"}
                    ],
                    "component_source": "resolved_ids_forward",
                    "equation": "丿 slash = 延 prolong",
                    "mnemonic": "Old.",
                    "hero_image_prompt": "Old.",
                }
            ]
        }

        self.assertEqual(grouping.apply_repairs(artifact, policy), ["延"])
        self.assertEqual(grouping.apply_repairs(artifact, policy), [])
        card = artifact["mnemonics"][0]
        self.assertEqual(card["components"], policy["repairs"]["延"]["components"])
        self.assertIn(
            grouping.POLICY_MARKER,
            card["component_source"].split("+"),
        )


if __name__ == "__main__":
    unittest.main()
