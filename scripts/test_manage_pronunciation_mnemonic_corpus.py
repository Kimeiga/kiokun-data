import copy
import importlib.util
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))
SPEC = importlib.util.spec_from_file_location(
    "manage_pronunciation_mnemonic_corpus",
    SCRIPTS / "manage_pronunciation_mnemonic_corpus.py",
)
assert SPEC and SPEC.loader
corpus = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = corpus
SPEC.loader.exec_module(corpus)


def valid_card():
    return {
        "character": "妈",
        "variants": ["妈", "媽"],
        "language": "zh",
        "review_status": "reviewed",
        "memory_bridge": "One scene connects the readings.",
        "confidence": "high",
        "sources": [{"path": "fixture", "supports": ["reading"]}],
        "readings": [
            {
                "reading_type": "mandarin",
                "display_reading": "mā",
                "normalized_reading": "ma1",
                "status": "core",
                "usage_gloss": "mother",
                "editorial_reason": "foundational word",
                "strategy": "word_anchor",
                "overlay": "Mama stays high and level.",
                "tone": 1,
                "sound_cue": {"syllable": "ma", "tone_behavior": "high_level"},
                "anchors": [
                    {
                        "word": "妈妈",
                        "reading": "mā ma",
                        "character_reading": "mā",
                        "gloss": "mother",
                        "frequency": {"source": "fixture", "field": "rank", "rank": 1},
                    }
                ],
            }
        ],
    }


class PronunciationCorpusTests(unittest.TestCase):
    def test_normalizes_tone_marked_and_neutral_pinyin(self):
        self.assertEqual(corpus.normalize_pinyin_syllable("xíng"), "xing2")
        self.assertEqual(corpus.normalize_pinyin_syllable("lǜ"), "lv4")
        self.assertEqual(corpus.normalize_pinyin_syllable("ma"), "ma5")

    def test_accepts_well_formed_fixture(self):
        self.assertEqual(corpus.validate_card(valid_card())["character"], "妈")

    def test_rejects_empty_memory_bridge(self):
        card = valid_card()
        card["memory_bridge"] = "  "
        with self.assertRaisesRegex(corpus.CorpusError, "memory_bridge"):
            corpus.validate_card(card)

    def test_rejects_core_reading_without_anchor(self):
        card = valid_card()
        card["readings"][0]["anchors"] = []
        with self.assertRaisesRegex(corpus.CorpusError, "core reading needs an anchor"):
            corpus.validate_card(card)

    def test_rejects_bad_tone_metadata(self):
        card = valid_card()
        card["readings"][0]["tone"] = 4
        with self.assertRaisesRegex(corpus.CorpusError, "pinyin and tone disagree"):
            corpus.validate_card(card)

    def test_rejects_duplicate_reading_cards(self):
        card = valid_card()
        card["readings"].append(copy.deepcopy(card["readings"][0]))
        with self.assertRaisesRegex(corpus.CorpusError, "duplicate pronunciation card"):
            corpus.validate_card(card)

    def test_rejects_unrelated_anchor(self):
        card = valid_card()
        card["readings"][0]["anchors"][0]["word"] = "父亲"
        with self.assertRaisesRegex(corpus.CorpusError, "anchor does not contain"):
            corpus.validate_card(card)

    def test_bucket_uses_language_and_character_identity(self):
        self.assertNotEqual(corpus.bucket_for_key("zh:行"), corpus.bucket_for_key("ja:行"))

    def test_publish_rejects_stale_manifest(self):
        cards = corpus.verify_corpus(deep=False)["cards"]
        with self.assertRaisesRegex(corpus.CorpusError, "changed since it was loaded"):
            corpus.publish_cards(cards, expected_manifest_sha256="sha256:stale")

    def test_post_install_verification_failure_rolls_back(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "corpus"
            shutil.copytree(corpus.DEFAULT_CORPUS_DIR, target)
            before = (target / "manifest.json").read_bytes()
            loaded = corpus.verify_corpus(target, deep=False)
            real_verify = corpus.verify_corpus

            def fail_installed(path=corpus.DEFAULT_CORPUS_DIR, *, deep=True):
                if Path(path) == target and deep:
                    raise corpus.CorpusError("synthetic installed failure")
                return real_verify(path, deep=deep)

            with mock.patch.object(corpus, "verify_corpus", side_effect=fail_installed):
                with self.assertRaisesRegex(corpus.CorpusError, "synthetic installed failure"):
                    corpus.publish_cards(
                        loaded["cards"],
                        target,
                        expected_manifest_sha256=loaded["manifest_sha256"],
                    )
            self.assertEqual((target / "manifest.json").read_bytes(), before)

    def test_published_regression_cards(self):
        result = corpus.verify_corpus(deep=False)
        by_id = {corpus.card_id(card): card for card in result["cards"]}
        self.assertEqual(
            [reading["display_reading"] for reading in by_id["zh:行"]["readings"]],
            ["xíng", "háng"],
        )
        self.assertTrue(by_id["ja:行"].get("memory_bridge"))
        self.assertEqual(len(by_id["ja:行"]["readings"]), 4)
        self.assertEqual(
            [reading["display_reading"] for reading in by_id["ja:図"]["readings"]],
            ["ズ", "ト", "はかる"],
        )
        self.assertEqual(len(by_id["ja:生"]["readings"]), 5)
        self.assertTrue(
            any(
                reading["display_reading"] == "たべる"
                and reading["anchors"][0]["word"] == "食べる"
                for reading in by_id["ja:食"]["readings"]
            )
        )
        self.assertTrue(
            all(reading["reading_type"] == "on" for reading in by_id["ja:議"]["readings"])
        )


if __name__ == "__main__":
    unittest.main()
