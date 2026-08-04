import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest import mock

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))
import assemble_ai_pronunciation_mnemonics as assembly


class AiPronunciationAssemblyTests(unittest.TestCase):
    def test_complete_reviewed_proposals_validate_deterministically(self):
        first = assembly.encoded(assembly.validate_and_assemble())
        second = assembly.encoded(assembly.validate_and_assemble())
        self.assertEqual(first, second)
        self.assertEqual(len(first.splitlines()), 203)

    def _temporary_authoring(self):
        temporary = tempfile.TemporaryDirectory()
        directory = Path(temporary.name) / "ai-authoring"
        shutil.copytree(assembly.PROPOSAL_DIR, directory)
        reviews = {
            filename: directory / "reviews" / filename.replace(".jsonl", "-review.json")
            for filename in assembly.PROPOSAL_FILES
        }
        return temporary, directory, reviews

    def test_changed_proposal_invalidates_review(self):
        temporary, directory, reviews = self._temporary_authoring()
        self.addCleanup(temporary.cleanup)
        path = directory / assembly.PROPOSAL_FILES[0]
        path.write_bytes(path.read_bytes() + b"\n")
        with mock.patch.object(assembly, "PROPOSAL_DIR", directory), mock.patch.object(
            assembly, "REVIEW_FILES", reviews
        ):
            with self.assertRaisesRegex(assembly.AssemblyError, "review is stale"):
                assembly.validate_and_assemble()

    def test_template_bridge_is_rejected_even_with_current_review_hash(self):
        temporary, directory, reviews = self._temporary_authoring()
        self.addCleanup(temporary.cleanup)
        filename = assembly.PROPOSAL_FILES[0]
        path = directory / filename
        records = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
        records[0]["memory_bridge"] = "Reuse the scene for every reading."
        path.write_text(
            "".join(
                json.dumps(record, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
                + "\n"
                for record in records
            ),
            encoding="utf-8",
        )
        review = json.loads(reviews[filename].read_text(encoding="utf-8"))
        review["proposal_sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
        reviews[filename].write_text(json.dumps(review), encoding="utf-8")
        with mock.patch.object(assembly, "PROPOSAL_DIR", directory), mock.patch.object(
            assembly, "REVIEW_FILES", reviews
        ):
            with self.assertRaisesRegex(assembly.AssemblyError, "template-like memory_bridge"):
                assembly.validate_and_assemble()


if __name__ == "__main__":
    unittest.main()
