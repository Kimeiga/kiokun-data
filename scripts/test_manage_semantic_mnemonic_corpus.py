import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import manage_semantic_mnemonic_corpus as corpus


def fixture_artifact() -> dict:
    return {
        "count": 4,
        "created_at": "fixture",
        "mnemonics": [
            {
                "character": "一",
                "meaning": "one",
                "equation": "Visual form: 一 one",
                "mnemonic": "One line marks 一 one.",
                "components": [{"character": "一", "gloss": "one"}],
                "visual_components": [{"character": "一", "gloss": "one"}],
                "quality_score": 99,
                "review": {"status": "approved"},
            },
            {
                "character": "二",
                "meaning": "two",
                "equation": "一 one + 一 one = 二 two",
                "mnemonic": "Two 一 one lines make 二 two.",
                "components": [
                    {"character": "一", "gloss": "one"},
                    {"character": "一", "gloss": "one"},
                ],
                "visual_components": [
                    {"character": "一", "gloss": "one"},
                    {"character": "一", "gloss": "one"},
                ],
                "quality_score": 98,
            },
            {
                "character": "三",
                "meaning": "three",
                "equation": "二 two + 一 one = 三 three",
                "mnemonic": "Add 一 one line to 二 two and count 三 three.",
                "components": [
                    {"character": "二", "gloss": "two"},
                    {"character": "一", "gloss": "one"},
                ],
                "visual_components": [
                    {"character": "二", "gloss": "two"},
                    {"character": "一", "gloss": "one"},
                ],
                "quality_score": 97,
            },
            {
                "character": "伀",
                "meaning": "agitated",
                "equation": "亻 person + 公 public = 伀 agitated",
                "mnemonic": "A 亻 person speaking in 公 public feels 伀 agitated.",
                "components": [
                    {"character": "亻", "gloss": "person"},
                    {"character": "公", "gloss": "public"},
                ],
                "visual_components": [
                    {"character": "亻", "gloss": "person"},
                    {"character": "公", "gloss": "public"},
                ],
                "quality_score": 96,
            },
        ],
        "release": {"status": "fixture"},
    }


class ManageSemanticMnemonicCorpusTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.artifact_path = self.root / "legacy.json"
        self.corpus_dir = self.root / "corpus"
        self.artifact = fixture_artifact()
        self.artifact_path.write_bytes(corpus.canonical_json_bytes(self.artifact))

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def pack(self) -> dict:
        return corpus.pack_corpus(
            artifact_path=self.artifact_path,
            corpus_dir=self.corpus_dir,
            bootstrap=True,
        )

    def test_pack_preserves_source_without_committing_runtime_projection(self) -> None:
        result = self.pack()

        self.assertEqual(result["card_count"], 4)
        self.assertEqual(result["bucket_count"], 256)
        self.assertEqual(result["artifact"], self.artifact)
        self.assertEqual(
            corpus.canonical_json_bytes(result["artifact"]),
            self.artifact_path.read_bytes(),
        )
        self.assertFalse((self.corpus_dir / "runtime").exists())
        self.assertFalse((self.corpus_dir / "source").exists())

        first_bucket = self.corpus_dir / "cards" / "00.jsonl"
        lines = first_bucket.read_bytes().splitlines()
        self.assertEqual(len(lines), 2)
        first = json.loads(lines[0])
        self.assertEqual(first["character"], "一")
        self.assertIn("quality_score", first)
        self.assertIn("review", first)

    def test_bucket_algorithm_matches_published_character_subdirectories(self) -> None:
        self.assertEqual(corpus.bucket_for_character("一"), "00")
        self.assertEqual(corpus.bucket_for_character("伀"), "00")
        self.assertEqual(corpus.bucket_for_character("二"), "8c")
        self.assertEqual(corpus.bucket_for_character("喬"), "ac")

    def test_edit_repack_changes_only_the_characters_stable_bucket(self) -> None:
        self.pack()
        before = {
            path.name: path.read_bytes()
            for path in (self.corpus_dir / "cards").glob("*.jsonl")
        }
        corpus.dematerialize_corpus(
            manifest_path=self.corpus_dir / "manifest.json",
            artifact_path=self.artifact_path,
        )
        corpus.materialize_corpus(
            manifest_path=self.corpus_dir / "manifest.json",
            artifact_path=self.artifact_path,
        )

        edited = json.loads(self.artifact_path.read_text())
        edited["mnemonics"][1]["meaning"] = "pair"
        edited["mnemonics"][1]["equation"] = "一 one + 一 one = 二 pair"
        edited["mnemonics"][1]["mnemonic"] = "Two 一 one lines form a 二 pair."
        self.artifact_path.write_bytes(corpus.canonical_json_bytes(edited))

        result = corpus.pack_corpus(
            artifact_path=self.artifact_path,
            corpus_dir=self.corpus_dir,
        )
        after = {
            path.name: path.read_bytes()
            for path in (self.corpus_dir / "cards").glob("*.jsonl")
        }
        changed = {name for name in before if before[name] != after[name]}
        self.assertEqual(changed, {"8c.jsonl"})
        self.assertEqual(result["artifact"]["mnemonics"][1]["meaning"], "pair")

    def test_verify_rejects_tampered_card_bucket(self) -> None:
        self.pack()
        bucket_path = self.corpus_dir / "cards" / "00.jsonl"
        bucket_path.write_bytes(bucket_path.read_bytes().replace(b'"one"', b'"tampered"', 1))

        with self.assertRaisesRegex(corpus.CorpusError, "hash mismatch"):
            corpus.verify_corpus(manifest_path=self.corpus_dir / "manifest.json")

    def test_verify_rejects_card_in_wrong_bucket_even_with_updated_hash(self) -> None:
        self.pack()
        source = self.corpus_dir / "cards" / "8c.jsonl"
        destination = self.corpus_dir / "cards" / "8d.jsonl"
        moved = source.read_bytes()
        source.write_bytes(b"")
        destination.write_bytes(destination.read_bytes() + moved)

        manifest_path = self.corpus_dir / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        for reference in manifest["card_buckets"]:
            path = self.corpus_dir / reference["path"]
            encoded = path.read_bytes()
            reference["sha256"] = corpus.sha256_bytes(encoded)
            reference["byte_count"] = len(encoded)
            values = corpus.load_jsonl_values(encoded, path=path)
            reference["count"] = len(values)
            reference["first_character"] = (
                values[0]["character"] if values else None
            )
            reference["last_character"] = (
                values[-1]["character"] if values else None
            )
        manifest_path.write_bytes(corpus.pretty_json_bytes(manifest))

        with self.assertRaisesRegex(corpus.CorpusError, "wrong bucket"):
            corpus.verify_corpus(manifest_path=manifest_path)

    def test_pack_refuses_unbased_materialization(self) -> None:
        self.pack()
        corpus.materialization_state_path(self.artifact_path).unlink()

        with self.assertRaisesRegex(corpus.CorpusError, "materialization state"):
            corpus.pack_corpus(
                artifact_path=self.artifact_path,
                corpus_dir=self.corpus_dir,
            )


if __name__ == "__main__":
    unittest.main()
