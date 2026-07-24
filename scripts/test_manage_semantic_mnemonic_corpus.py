import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))

import manage_semantic_mnemonic_corpus as corpus


def fixture_artifact() -> dict:
    return {
        "count": 3,
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
            shard_size=2,
            bootstrap=True,
        )

    def test_pack_preserves_source_and_projects_runtime_fields(self) -> None:
        result = self.pack()

        self.assertEqual(result["card_count"], 3)
        self.assertEqual(result["shard_count"], 2)
        reconstructed = result["artifact"]
        self.assertEqual(reconstructed, self.artifact)
        self.assertEqual(
            corpus.canonical_json_bytes(reconstructed),
            self.artifact_path.read_bytes(),
        )

        runtime_shard = json.loads(
            (self.corpus_dir / "runtime" / "000.json").read_text()
        )
        first = runtime_shard["mnemonics"][0]
        self.assertNotIn("quality_score", first)
        self.assertNotIn("review", first)
        self.assertEqual(
            set(first),
            {
                "character",
                "meaning",
                "equation",
                "mnemonic",
                "components",
                "visual_components",
            },
        )

    def test_materialize_edit_and_repack_updates_both_shard_sets(self) -> None:
        first = self.pack()
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

        second = corpus.pack_corpus(
            artifact_path=self.artifact_path,
            corpus_dir=self.corpus_dir,
            shard_size=2,
        )
        self.assertNotEqual(
            first["source_artifact_sha256"],
            second["source_artifact_sha256"],
        )
        self.assertEqual(second["artifact"]["mnemonics"][1]["meaning"], "pair")
        runtime_shard = json.loads(
            (self.corpus_dir / "runtime" / "000.json").read_text()
        )
        self.assertEqual(runtime_shard["mnemonics"][1]["meaning"], "pair")

    def test_verify_rejects_tampered_runtime_shard(self) -> None:
        self.pack()
        runtime_path = self.corpus_dir / "runtime" / "000.json"
        runtime = json.loads(runtime_path.read_text())
        runtime["mnemonics"][0]["meaning"] = "tampered"
        runtime_path.write_bytes(corpus.canonical_json_bytes(runtime))

        with self.assertRaisesRegex(corpus.CorpusError, "hash mismatch"):
            corpus.verify_corpus(manifest_path=self.corpus_dir / "manifest.json")

    def test_pack_refuses_unbased_materialization(self) -> None:
        self.pack()
        corpus.materialization_state_path(self.artifact_path).unlink()

        with self.assertRaisesRegex(corpus.CorpusError, "materialization state"):
            corpus.pack_corpus(
                artifact_path=self.artifact_path,
                corpus_dir=self.corpus_dir,
                shard_size=2,
            )


if __name__ == "__main__":
    unittest.main()
