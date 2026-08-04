#!/usr/bin/env python3
"""Read, edit, audit, pack, and verify pronunciation mnemonic buckets."""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import os
from pathlib import Path
import random
import shutil
import tempfile
import unicodedata
from typing import Any, Iterable

from bucket_native_corpus import (
    BUCKET_ALGORITHM,
    BUCKET_COUNT,
    TransactionError,
    atomic_exchange_directories,
    bucket_for_key,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CORPUS_DIR = ROOT / "data" / "pronunciation_mnemonic_corpus"
CHINESE_CHAR_SOURCE = ROOT / "data" / "chinese_dictionary_char_2025-06-25.jsonl"
CHINESE_WORD_SOURCE = ROOT / "data" / "chinese_dictionary_word_2025-06-25.jsonl"
JAPANESE_CHAR_SOURCE = ROOT / "data" / "kanjidic2-en-3.6.1.json"
JAPANESE_WORD_SOURCE = ROOT / "data" / "jmdict-examples-eng-3.6.1.json"
JPDB_SOURCE = ROOT / "data" / "jpdb_v2.2_freq_list_2024-10-13.csv"
SCHEMA_VERSION = 1
LANGUAGES = {"zh", "ja"}
READING_TYPES = {"mandarin", "on", "kun"}
READING_STATUSES = {"core", "secondary"}
STRATEGIES = {"phonetic_component", "integrated_sound_cue", "word_anchor"}
REVIEW_STATUSES = {"reviewed", "needs_review"}
TONE_BEHAVIORS = {
    1: "high_level",
    2: "rising",
    3: "dip_then_rise",
    4: "falling",
    5: "light_neutral",
}


class CorpusError(RuntimeError):
    pass


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode(
        "utf-8"
    )


def pretty_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def jsonl_bytes(values: Iterable[Any]) -> bytes:
    return b"".join(canonical_bytes(value) + b"\n" for value in values)


def sha256_bytes(value: bytes) -> str:
    return "sha256:" + hashlib.sha256(value).hexdigest()


def file_reference(path: str, encoded: bytes, **extra: Any) -> dict[str, Any]:
    return {
        "path": path,
        "sha256": sha256_bytes(encoded),
        "byte_count": len(encoded),
        **extra,
    }


def card_id(card: dict[str, Any]) -> str:
    return f"{card.get('language')}:{card.get('character')}"


def normalize_pinyin_syllable(value: str) -> str:
    value = value.strip().lower().replace("u:", "ü")
    if not value:
        return value
    explicit_tone = value[-1] if value[-1:] in "12345" else None
    if explicit_tone:
        value = value[:-1]
    tone = int(explicit_tone) if explicit_tone else 5
    output: list[str] = []
    for character in unicodedata.normalize("NFD", value):
        if unicodedata.combining(character):
            if character == "\u0308" and output and output[-1] == "u":
                output[-1] = "v"
                continue
            tone = {
                "\u0304": 1,
                "\u0301": 2,
                "\u030c": 3,
                "\u0300": 4,
            }.get(character, tone)
        else:
            output.append("v" if character == "ü" else character)
    return "".join(output) + str(tone)


def normalize_pinyin_phrase(value: str) -> str:
    value = value.replace("\u200b", " ").replace("'", " ").replace("’", " ")
    return " ".join(normalize_pinyin_syllable(part) for part in value.split())


def katakana_to_hiragana(value: str) -> str:
    result = []
    for character in value:
        codepoint = ord(character)
        if 0x30A1 <= codepoint <= 0x30F6:
            result.append(chr(codepoint - 0x60))
        else:
            result.append(character)
    return "".join(result)


def normalize_japanese_reading(value: str) -> str:
    return katakana_to_hiragana(value).replace(".", "").replace("-", "").strip()


def _load_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise CorpusError(f"cannot read {label} {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise CorpusError(f"{label} must be a JSON object: {path}")
    return value


class Evidence:
    """Lazy indexes over the repository's authoritative dictionary inputs."""

    def __init__(self, root: Path = ROOT):
        self.root = root
        self._chinese_chars: dict[str, set[str]] | None = None
        self._chinese_words: dict[tuple[str, str], dict[str, Any]] | None = None
        self._japanese_chars: dict[str, dict[str, set[str]]] | None = None
        self._japanese_words: dict[tuple[str, str], str] | None = None

    @property
    def chinese_chars(self) -> dict[str, set[str]]:
        if self._chinese_chars is None:
            result: dict[str, set[str]] = defaultdict(set)
            path = self.root / CHINESE_CHAR_SOURCE.relative_to(ROOT)
            with path.open(encoding="utf-8") as handle:
                for line in handle:
                    row = json.loads(line)
                    for frequency in row.get("pinyinFrequencies") or []:
                        result[row["char"]].add(normalize_pinyin_syllable(frequency["pinyin"]))
            # Character-word entries are more complete than pinyinFrequencies.
            word_path = self.root / CHINESE_WORD_SOURCE.relative_to(ROOT)
            with word_path.open(encoding="utf-8") as handle:
                for line in handle:
                    row = json.loads(line)
                    if len(row["simp"]) == 1 or len(row["trad"]) == 1:
                        for item in row.get("items") or []:
                            pinyin = item.get("pinyin")
                            if pinyin:
                                normalized = normalize_pinyin_phrase(pinyin)
                                if " " not in normalized:
                                    result[row["simp"]].add(normalized)
                                    result[row["trad"]].add(normalized)
            self._chinese_chars = dict(result)
        return self._chinese_chars

    @property
    def chinese_words(self) -> dict[tuple[str, str], dict[str, Any]]:
        if self._chinese_words is None:
            result: dict[tuple[str, str], dict[str, Any]] = {}
            path = self.root / CHINESE_WORD_SOURCE.relative_to(ROOT)
            with path.open(encoding="utf-8") as handle:
                for line in handle:
                    row = json.loads(line)
                    for item in row.get("items") or []:
                        pinyin = item.get("pinyin")
                        if not pinyin:
                            continue
                        normalized = normalize_pinyin_phrase(pinyin)
                        for word in {row["simp"], row["trad"]}:
                            result[(word, normalized)] = row
            self._chinese_words = result
        return self._chinese_words

    @property
    def japanese_chars(self) -> dict[str, dict[str, set[str]]]:
        if self._japanese_chars is None:
            source = _load_json(
                self.root / JAPANESE_CHAR_SOURCE.relative_to(ROOT), "KANJIDIC source"
            )
            result: dict[str, dict[str, set[str]]] = {}
            for character in source["characters"]:
                readings: dict[str, set[str]] = {"on": set(), "kun": set()}
                for group in (character.get("readingMeaning") or {}).get("groups", []):
                    for reading in group["readings"]:
                        if reading["type"] == "ja_on":
                            readings["on"].add(normalize_japanese_reading(reading["value"]))
                        elif reading["type"] == "ja_kun":
                            readings["kun"].add(normalize_japanese_reading(reading["value"]))
                result[character["literal"]] = readings
            self._japanese_chars = result
        return self._japanese_chars

    @property
    def japanese_words(self) -> dict[tuple[str, str], str]:
        if self._japanese_words is None:
            source = _load_json(
                self.root / JAPANESE_WORD_SOURCE.relative_to(ROOT), "JMdict source"
            )
            result: dict[tuple[str, str], str] = {}
            for row in source["words"]:
                kanji_forms = [form["text"] for form in row["kanji"]]
                for kana in row["kana"]:
                    reading = normalize_japanese_reading(kana["text"])
                    applicable = kana.get("appliesToKanji") or ["*"]
                    for word in kanji_forms:
                        if applicable == ["*"] or word in applicable:
                            gloss = next(
                                (
                                    gloss["text"]
                                    for sense in row["sense"]
                                    if sense.get("appliesToKanji") == ["*"]
                                    or word in (sense.get("appliesToKanji") or [])
                                    for gloss in sense["gloss"]
                                    if gloss["lang"] == "eng"
                                ),
                                "",
                            )
                            result[(word, reading)] = gloss
            self._japanese_words = result
        return self._japanese_words


def validate_card(card: Any, *, evidence: Evidence | None = None) -> dict[str, Any]:
    if not isinstance(card, dict):
        raise CorpusError("card must be an object")
    identity = card_id(card)
    language = card.get("language")
    character = card.get("character")
    if language not in LANGUAGES:
        raise CorpusError(f"{identity}: unsupported language")
    if not isinstance(character, str) or len(character) != 1:
        raise CorpusError(f"{identity}: character must be one Unicode scalar")
    variants = card.get("variants")
    if not isinstance(variants, list) or character not in variants or not all(
        isinstance(value, str) and len(value) == 1 for value in variants
    ):
        raise CorpusError(f"{identity}: variants must contain the one-character identity")
    if len(set(variants)) != len(variants):
        raise CorpusError(f"{identity}: duplicate variant")
    if card.get("review_status") not in REVIEW_STATUSES:
        raise CorpusError(f"{identity}: invalid review_status")
    if card.get("confidence") not in {"high", "medium", "low"}:
        raise CorpusError(f"{identity}: invalid confidence")
    if not isinstance(card.get("sources"), list) or not card["sources"]:
        raise CorpusError(f"{identity}: source metadata is required")
    readings = card.get("readings")
    if not isinstance(readings, list) or not readings:
        raise CorpusError(f"{identity}: at least one reading is required")

    seen: set[tuple[str, str, str]] = set()
    for index, reading in enumerate(readings):
        label = f"{identity}.readings[{index}]"
        reading_type = reading.get("reading_type")
        if reading_type not in READING_TYPES:
            raise CorpusError(f"{label}: invalid reading_type")
        if language == "zh" and reading_type != "mandarin":
            raise CorpusError(f"{label}: Chinese card must use mandarin")
        if language == "ja" and reading_type == "mandarin":
            raise CorpusError(f"{label}: Japanese card must use on or kun")
        display = reading.get("display_reading")
        normalized = reading.get("normalized_reading")
        if not isinstance(display, str) or not display or not isinstance(normalized, str):
            raise CorpusError(f"{label}: display and normalized readings are required")
        expected_normalized = (
            normalize_pinyin_syllable(display)
            if language == "zh"
            else normalize_japanese_reading(display)
        )
        if normalized != expected_normalized:
            raise CorpusError(
                f"{label}: normalized_reading must be {expected_normalized!r}, got {normalized!r}"
            )
        status = reading.get("status")
        if status not in READING_STATUSES:
            raise CorpusError(f"{label}: invalid status")
        duplicate_key = (reading_type, normalized, status)
        if duplicate_key in seen:
            raise CorpusError(f"{label}: duplicate pronunciation card")
        seen.add(duplicate_key)
        for field in ("editorial_reason", "usage_gloss", "overlay"):
            if not isinstance(reading.get(field), str) or not reading[field].strip():
                raise CorpusError(f"{label}: {field} is required")
        strategy = reading.get("strategy")
        if strategy not in STRATEGIES:
            raise CorpusError(f"{label}: invalid mnemonic strategy")
        if strategy == "phonetic_component" and not isinstance(
            reading.get("phonetic_component"), dict
        ):
            raise CorpusError(f"{label}: phonetic-component evidence is required")
        anchors = reading.get("anchors")
        if status == "core" and (not isinstance(anchors, list) or not anchors):
            raise CorpusError(f"{label}: every core reading needs an anchor word")
        for anchor_index, anchor in enumerate(anchors or []):
            anchor_label = f"{label}.anchors[{anchor_index}]"
            for field in ("word", "reading", "character_reading", "gloss"):
                if not isinstance(anchor.get(field), str) or not anchor[field].strip():
                    raise CorpusError(f"{anchor_label}: {field} is required")
            if character not in anchor["word"] and not anchor.get("exceptional_relationship"):
                raise CorpusError(f"{anchor_label}: anchor does not contain {character}")
            frequency = anchor.get("frequency")
            if not isinstance(frequency, dict) or not frequency.get("source"):
                raise CorpusError(f"{anchor_label}: usefulness/frequency evidence is required")

        if language == "zh":
            tone = reading.get("tone")
            if tone not in TONE_BEHAVIORS:
                raise CorpusError(f"{label}: tone must be 1-5")
            if not normalized.endswith(str(tone)):
                raise CorpusError(f"{label}: normalized pinyin and tone disagree")
            cue = reading.get("sound_cue")
            if cue and cue.get("tone_behavior") != TONE_BEHAVIORS[tone]:
                raise CorpusError(f"{label}: inconsistent Mandarin tone behavior")
            if evidence is not None:
                if not any(normalized in evidence.chinese_chars.get(form, set()) for form in variants):
                    raise CorpusError(f"{label}: reading is absent from repository Chinese data")
                for anchor in anchors or []:
                    key = (anchor["word"], normalize_pinyin_phrase(anchor["reading"]))
                    if key not in evidence.chinese_words:
                        raise CorpusError(
                            f"{label}: anchor {anchor['word']} {anchor['reading']} is absent from repository Chinese data"
                        )
        elif evidence is not None:
            source_reading = reading.get("source_reading", display)
            known = evidence.japanese_chars.get(character, {}).get(reading_type, set())
            if normalize_japanese_reading(source_reading) not in known and not reading.get(
                "reviewed_reading_override"
            ):
                raise CorpusError(f"{label}: reading is absent from KANJIDIC")
            for anchor in anchors or []:
                key = (anchor["word"], normalize_japanese_reading(anchor["reading"]))
                if key not in evidence.japanese_words and not anchor.get("exceptional_relationship"):
                    raise CorpusError(
                        f"{label}: anchor {anchor['word']}（{anchor['reading']}） is absent from JMdict"
                    )
            if reading_type == "kun" and "." in source_reading:
                complete = normalize_japanese_reading(source_reading)
                if normalized != complete:
                    raise CorpusError(f"{label}: kun display must preserve the complete lexeme")
    return card


def runtime_card(card: dict[str, Any]) -> dict[str, Any]:
    return {
        "character": card["character"],
        "variants": card["variants"],
        "language": card["language"],
        "review_status": card["review_status"],
        "readings": [
            {
                key: reading[key]
                for key in (
                    "reading_type",
                    "display_reading",
                    "normalized_reading",
                    "status",
                    "usage_gloss",
                    "editorial_reason",
                    "strategy",
                    "overlay",
                    "sound_cue",
                    "phonetic_component",
                    "anchors",
                    "tone",
                    "source_reading",
                )
                if key in reading
            }
            for reading in card["readings"]
        ],
    }


def load_targets(corpus_dir: Path) -> dict[str, dict[str, Any]]:
    return {
        language: _load_json(corpus_dir / "targets" / f"{language}.json", f"{language} target")
        for language in LANGUAGES
    }


def _read_cards(corpus_dir: Path) -> list[dict[str, Any]]:
    cards: list[dict[str, Any]] = []
    for index in range(BUCKET_COUNT):
        path = corpus_dir / "cards" / f"{index:02x}.jsonl"
        if not path.exists():
            raise CorpusError(f"missing card bucket: {path}")
        with path.open(encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, 1):
                if not line.strip():
                    continue
                try:
                    card = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise CorpusError(f"invalid JSON at {path}:{line_number}: {exc}") from exc
                if canonical_bytes(card) + b"\n" != line.encode("utf-8"):
                    raise CorpusError(f"non-canonical JSONL at {path}:{line_number}")
                cards.append(card)
    return cards


def _validate_collection(
    cards: list[dict[str, Any]], targets: dict[str, dict[str, Any]], evidence: Evidence | None
) -> dict[str, Any]:
    seen_ids: set[str] = set()
    claimed_variants: set[tuple[str, str]] = set()
    by_language_character: dict[tuple[str, str], dict[str, Any]] = {}
    for card in cards:
        validate_card(card, evidence=evidence)
        identity = card_id(card)
        if identity in seen_ids:
            raise CorpusError(f"duplicate card identity {identity}")
        seen_ids.add(identity)
        by_language_character[(card["language"], card["character"])] = card
        expected_bucket = bucket_for_key(identity)
        if card.get("bucket") not in (None, expected_bucket):
            raise CorpusError(f"{identity}: stale embedded bucket")
        for variant in card["variants"]:
            key = (card["language"], variant)
            if key in claimed_variants:
                raise CorpusError(f"duplicate variant projection {key}")
            claimed_variants.add(key)

    for language, target in targets.items():
        if target.get("count") != 100 or len(target.get("entries", [])) != 100:
            raise CorpusError(f"{language} target manifest must contain exactly 100 entries")
        identities = [entry["identity"] for entry in target["entries"]]
        if len(set(identities)) != 100:
            raise CorpusError(f"{language} target manifest contains duplicates")
        missing = [
            identity
            for identity in identities
            if (language, identity) not in by_language_character
            or by_language_character[(language, identity)]["review_status"] != "reviewed"
        ]
        if missing:
            raise CorpusError(f"{language} target lacks reviewed coverage: {missing}")

    reading_counts = Counter(
        reading["reading_type"]
        for card in cards
        for reading in card["readings"]
        if reading["status"] == "core"
    )
    strategy_counts = Counter(
        reading["strategy"]
        for card in cards
        for reading in card["readings"]
        if reading["status"] == "core"
    )
    return {
        "card_count": len(cards),
        "unique_character_count": len({card["character"] for card in cards}),
        "core_reading_counts": dict(sorted(reading_counts.items())),
        "strategy_counts": dict(sorted(strategy_counts.items())),
    }


def _write_tree(
    staging: Path, cards: list[dict[str, Any]], targets: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    cards = sorted(cards, key=card_id)
    stats = _validate_collection(cards, targets, Evidence())
    buckets: dict[str, list[dict[str, Any]]] = {f"{index:02x}": [] for index in range(256)}
    for card in cards:
        buckets[bucket_for_key(card_id(card))].append(card)

    card_refs = []
    packed_refs = []
    for bucket, bucket_cards in buckets.items():
        source_encoded = jsonl_bytes(bucket_cards)
        source_path = staging / "cards" / f"{bucket}.jsonl"
        source_path.parent.mkdir(parents=True, exist_ok=True)
        source_path.write_bytes(source_encoded)
        card_refs.append(
            file_reference(
                f"cards/{bucket}.jsonl", source_encoded, bucket=bucket, count=len(bucket_cards)
            )
        )
        packed_encoded = canonical_bytes([runtime_card(card) for card in bucket_cards]) + b"\n"
        packed_path = staging / "packed" / f"{bucket}.json"
        packed_path.parent.mkdir(parents=True, exist_ok=True)
        packed_path.write_bytes(packed_encoded)
        packed_refs.append(
            file_reference(
                f"packed/{bucket}.json", packed_encoded, bucket=bucket, count=len(bucket_cards)
            )
        )

    target_refs = {}
    for language in sorted(targets):
        encoded = pretty_bytes(targets[language])
        path = staging / "targets" / f"{language}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(encoded)
        target_refs[language] = file_reference(
            f"targets/{language}.json", encoded, count=targets[language]["count"]
        )

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "kind": "pronunciation_mnemonic_bucketed_corpus",
        "bucket_algorithm": BUCKET_ALGORITHM,
        "bucket_count": BUCKET_COUNT,
        **stats,
        "targets": target_refs,
        "card_buckets": card_refs,
        "packed_buckets": packed_refs,
    }
    (staging / "manifest.json").write_bytes(pretty_bytes(manifest))
    return manifest


def verify_corpus(corpus_dir: Path = DEFAULT_CORPUS_DIR, *, deep: bool = True) -> dict[str, Any]:
    manifest = _load_json(corpus_dir / "manifest.json", "pronunciation corpus manifest")
    if manifest.get("bucket_algorithm") != BUCKET_ALGORITHM or manifest.get(
        "bucket_count"
    ) != BUCKET_COUNT:
        raise CorpusError("unsupported bucket layout")
    targets = load_targets(corpus_dir)
    for section in ("card_buckets", "packed_buckets"):
        references = manifest.get(section)
        if not isinstance(references, list) or len(references) != BUCKET_COUNT:
            raise CorpusError(f"manifest {section} must bind all 256 buckets")
        for reference in references:
            path = corpus_dir / reference["path"]
            encoded = path.read_bytes()
            if len(encoded) != reference["byte_count"] or sha256_bytes(encoded) != reference["sha256"]:
                raise CorpusError(f"manifest mismatch for {reference['path']}")
    for language, reference in manifest["targets"].items():
        encoded = (corpus_dir / reference["path"]).read_bytes()
        if sha256_bytes(encoded) != reference["sha256"]:
            raise CorpusError(f"manifest mismatch for {reference['path']}")
    cards = _read_cards(corpus_dir)
    stats = _validate_collection(cards, targets, Evidence() if deep else None)
    for key, value in stats.items():
        if manifest.get(key) != value:
            raise CorpusError(f"manifest {key} is stale")
    for reference in manifest["packed_buckets"]:
        bucket = reference["bucket"]
        actual = json.loads((corpus_dir / reference["path"]).read_text(encoding="utf-8"))
        expected = [runtime_card(card) for card in cards if bucket_for_key(card_id(card)) == bucket]
        if actual != expected:
            raise CorpusError(f"packed projection is stale for bucket {bucket}")
    return {"manifest": manifest, "cards": cards, **stats}


def publish_cards(cards: list[dict[str, Any]], corpus_dir: Path = DEFAULT_CORPUS_DIR) -> dict[str, Any]:
    targets = load_targets(corpus_dir)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{corpus_dir.name}.pack-", dir=corpus_dir.parent)
    )
    exchanged = False
    try:
        _write_tree(staging, cards, targets)
        if (corpus_dir / "README.md").exists():
            shutil.copy2(corpus_dir / "README.md", staging / "README.md")
        verify_corpus(staging, deep=False)
        atomic_exchange_directories(staging, corpus_dir)
        exchanged = True
        result = verify_corpus(corpus_dir, deep=True)
        shutil.rmtree(staging)
        return result
    except (OSError, TransactionError) as exc:
        if exchanged:
            try:
                atomic_exchange_directories(staging, corpus_dir)
            except Exception as rollback_exc:  # pragma: no cover - catastrophic path
                raise CorpusError(f"publication failed and rollback failed: {rollback_exc}") from exc
        raise CorpusError(str(exc)) from exc
    finally:
        if staging.exists() and not exchanged:
            shutil.rmtree(staging)


def audit_cards(
    cards: list[dict[str, Any]], *, seed: int, sample_per_language: int
) -> dict[str, Any]:
    rng = random.Random(seed)
    selected: set[str] = set()
    reasons: dict[str, set[str]] = defaultdict(set)
    for language in sorted(LANGUAGES):
        candidates = [card for card in cards if card["language"] == language]
        for card in rng.sample(candidates, min(sample_per_language, len(candidates))):
            selected.add(card_id(card))
            reasons[card_id(card)].add("seeded_random_sample")
    for card in cards:
        identity = card_id(card)
        core = [reading for reading in card["readings"] if reading["status"] == "core"]
        if len(core) > 1:
            selected.add(identity)
            reasons[identity].add("multiple_core_readings")
        if any(reading["strategy"] == "phonetic_component" for reading in core):
            selected.add(identity)
            reasons[identity].add("phonetic_component")
        if len(card["variants"]) > 1:
            selected.add(identity)
            reasons[identity].add("variant_or_alias")
        if any(
            anchor.get("exceptional_relationship")
            for reading in core
            for anchor in reading.get("anchors", [])
        ):
            selected.add(identity)
            reasons[identity].add("irregular_anchor")
        if any(
            anchor.get("phonological_note")
            for reading in core
            for anchor in reading.get("anchors", [])
        ):
            selected.add(identity)
            reasons[identity].add("phonological_alternation")
    rows = []
    by_id = {card_id(card): card for card in cards}
    for identity in sorted(selected):
        card = by_id[identity]
        rows.append(
            {
                "id": identity,
                "reasons": sorted(reasons[identity]),
                "reading_count": len(card["readings"]),
                "review_status": card["review_status"],
            }
        )
    return {
        "schema_version": 1,
        "seed": seed,
        "sample_per_language": sample_per_language,
        "selected_count": len(rows),
        "selected": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus-dir", type=Path, default=DEFAULT_CORPUS_DIR)
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("verify")
    subparsers.add_parser("pack")
    stats_parser = subparsers.add_parser("stats")
    stats_parser.add_argument("--json", action="store_true")
    get_parser = subparsers.add_parser("get")
    get_parser.add_argument("--language", choices=sorted(LANGUAGES), required=True)
    get_parser.add_argument("--character", required=True)
    upsert_parser = subparsers.add_parser("upsert")
    upsert_parser.add_argument("record", type=Path)
    delete_parser = subparsers.add_parser("delete")
    delete_parser.add_argument("--language", choices=sorted(LANGUAGES), required=True)
    delete_parser.add_argument("--character", required=True)
    project_parser = subparsers.add_parser("project")
    project_parser.add_argument("--character", required=True)
    audit_parser = subparsers.add_parser("audit")
    audit_parser.add_argument("--seed", type=int, default=20260803)
    audit_parser.add_argument("--sample-per-language", type=int, default=30)
    audit_parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    if args.command == "verify":
        result = verify_corpus(args.corpus_dir, deep=True)
        print(json.dumps({key: result[key] for key in ("card_count", "unique_character_count", "core_reading_counts", "strategy_counts")}, ensure_ascii=False, indent=2))
        return
    result = verify_corpus(args.corpus_dir, deep=False)
    cards = result["cards"]
    if args.command == "pack":
        published = publish_cards(cards, args.corpus_dir)
        print(json.dumps({"card_count": published["card_count"], "status": "packed"}, indent=2))
    elif args.command == "stats":
        stats = {key: result[key] for key in ("card_count", "unique_character_count", "core_reading_counts", "strategy_counts")}
        print(json.dumps(stats, ensure_ascii=False, indent=2) if args.json else stats)
    elif args.command == "get":
        match = next((card for card in cards if card["language"] == args.language and card["character"] == args.character), None)
        if match is None:
            raise SystemExit(1)
        print(json.dumps(match, ensure_ascii=False, indent=2))
    elif args.command == "upsert":
        record = _load_json(args.record, "pronunciation card")
        validate_card(record, evidence=Evidence())
        identity = card_id(record)
        updated = [card for card in cards if card_id(card) != identity] + [record]
        publish_cards(updated, args.corpus_dir)
        print(f"upserted {identity}")
    elif args.command == "delete":
        identity = f"{args.language}:{args.character}"
        updated = [card for card in cards if card_id(card) != identity]
        if len(updated) == len(cards):
            raise CorpusError(f"card not found: {identity}")
        publish_cards(updated, args.corpus_dir)
        print(f"deleted {identity}")
    elif args.command == "project":
        projections = [
            runtime_card(card)
            for card in cards
            if args.character in card["variants"]
        ]
        print(json.dumps(projections, ensure_ascii=False, indent=2))
    elif args.command == "audit":
        report = audit_cards(
            cards, seed=args.seed, sample_per_language=args.sample_per_language
        )
        encoded = pretty_bytes(report)
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            temporary = args.output.with_name(f".{args.output.name}.tmp-{os.getpid()}")
            temporary.write_bytes(encoded)
            temporary.replace(args.output)
        print(encoded.decode("utf-8"), end="")


if __name__ == "__main__":
    main()
