import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("select_pronunciation_targets.py")
SPEC = importlib.util.spec_from_file_location("select_pronunciation_targets", SCRIPT)
assert SPEC and SPEC.loader
targets = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = targets
SPEC.loader.exec_module(targets)


class PronunciationTargetTests(unittest.TestCase):
    def test_chinese_has_exactly_one_entry_per_rank(self):
        manifest = targets.derive_chinese()
        self.assertEqual(manifest["count"], 100)
        self.assertEqual([entry["rank"] for entry in manifest["entries"]], list(range(1, 101)))

    def test_chinese_variants_do_not_inflate_selection(self):
        manifest = targets.derive_chinese()
        by_identity = {entry["identity"]: entry for entry in manifest["entries"]}
        self.assertEqual(by_identity["说"]["variants"], ["說", "说"])
        self.assertEqual(by_identity["发"]["variants"], ["发", "發", "髮"])
        self.assertNotIn("昰", by_identity)

    def test_japanese_uses_usage_frequency(self):
        manifest = targets.derive_japanese()
        self.assertEqual(manifest["count"], 100)
        self.assertEqual(manifest["entries"][0], {"identity": "日", "rank": 1, "variants": ["日"]})
        self.assertEqual(manifest["entries"][-1], {"identity": "法", "rank": 100, "variants": ["法"]})
        self.assertEqual(manifest["selection"]["field"], "characters[].misc.frequency")


if __name__ == "__main__":
    unittest.main()
