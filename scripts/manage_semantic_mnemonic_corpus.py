#!/usr/bin/env python3
"""Pack, verify, and materialize Kiokun's semantic mnemonic corpus.

The canonical representation is optimized for long-term Git maintenance:

* ``cards/00.jsonl`` through ``cards/ff.jsonl`` use the same stable
  character hash buckets as the published dictionary.
* Every JSONL line is one complete editorial card, so ordinary edits produce
  focused diffs.
* ``order.jsonl`` preserves the historical artifact order independently of
  bucket membership.
* ``metadata.json`` preserves all top-level release and provenance metadata.
* ``manifest.json`` binds every file by count, byte size, and SHA-256.

The dictionary builder reads the canonical card lines directly. A compact
runtime projection is verified deterministically but is not duplicated in Git.
The former monolithic artifact can still be reconstructed exactly for legacy
editorial tools.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import sys
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CORPUS_DIR = ROOT / "data" / "semantic_mnemonic_corpus"
DEFAULT_MANIFEST = DEFAULT_CORPUS_DIR / "manifest.json"
DEFAULT_LEGACY_ARTIFACT = (
    ROOT
    / "sveltekit-app"
    / "static"
    / "research"
    / "mnemonics"
    / "semantic_mnemonics_all_best_available.json"
)
SCHEMA_VERSION = 2
BUCKET_COUNT = 256
BUCKET_ALGORITHM = "kiokun_simple_hash_low_byte_v1"

RUNTIME_CARD_FIELDS = (
    "character",
    "meaning",
    "equation",
    "mnemonic",
    "components",
    "visual_components",
    "component_source",
    "historical_components",
    "historical_component_source",
    "alias_of",
    "alias_kind",
    "alias_reason",
)
REQUIRED_RUNTIME_FIELDS = ("character", "meaning", "equation", "mnemonic")


class CorpusError(RuntimeError):
    """The corpus cannot be packed or verified safely."""


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")


def pretty_json_bytes(value: Any) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    ).encode("utf-8")


def jsonl_bytes(values: Iterable[Any]) -> bytes:
    return b"".join(canonical_json_bytes(value) + b"\n" for value in values)


def sha256_bytes(value: bytes) -> str:
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def load_json(path: Path, *, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise CorpusError(f"{label} does not exist: {path}") from exc
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise CorpusError(f"cannot read {label} {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise CorpusError(f"{label} must contain one JSON object: {path}")
    return value


def write_bytes_atomic(path: Path, value: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    try:
        temporary.write_bytes(value)
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def write_json_atomic(path: Path, value: Any, *, pretty: bool = False) -> bytes:
    encoded = pretty_json_bytes(value) if pretty else canonical_json_bytes(value)
    write_bytes_atomic(path, encoded)
    return encoded


def materialization_state_path(artifact_path: Path) -> Path:
    return artifact_path.with_name(f"{artifact_path.name}.materialization.json")


def validate_cards(cards: Any, *, label: str) -> list[dict[str, Any]]:
    if not isinstance(cards, list):
        raise CorpusError(f"{label} must be an array")

    validated: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, card in enumerate(cards):
        if not isinstance(card, dict):
            raise CorpusError(f"{label}[{index}] must be an object")
        character = card.get("character")
        if not isinstance(character, str) or not character:
            raise CorpusError(f"{label}[{index}] has no character")
        if character in seen:
            raise CorpusError(f"{label} contains duplicate character {character!r}")
        for field in REQUIRED_RUNTIME_FIELDS:
            if not isinstance(card.get(field), str) or not card[field]:
                raise CorpusError(
                    f"{label}[{index}] {character!r} has invalid {field!r}"
                )
        seen.add(character)
        validated.append(card)
    return validated


def validate_artifact(artifact: dict[str, Any], *, label: str) -> list[dict[str, Any]]:
    cards = validate_cards(artifact.get("mnemonics"), label=f"{label}.mnemonics")
    declared_count = artifact.get("count")
    if declared_count is not None and declared_count != len(cards):
        raise CorpusError(
            f"{label} declares {declared_count} cards but contains {len(cards)}"
        )
    return cards


def runtime_card(card: dict[str, Any]) -> dict[str, Any]:
    projected: dict[str, Any] = {}
    for field in RUNTIME_CARD_FIELDS:
        if field not in card:
            continue
        value = card[field]
        if value is None or value == "" or value == []:
            continue
        projected[field] = value
    return projected


def bucket_for_character(character: str) -> str:
    """Return the low byte of Kiokun's stable 31x character hash.

    Only the low byte is needed, so this is architecture-independent while
    remaining exactly equivalent to ``ShardType::simple_hash(key) & 0xff``.
    """

    low_byte = 0
    for value in map(ord, character):
        low_byte = (low_byte * 31 + value) & 0xFF
    return f"{low_byte:02x}"


def safe_relative_path(value: Any, *, label: str) -> PurePosixPath:
    if not isinstance(value, str) or not value:
        raise CorpusError(f"{label} has no path")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or "." in path.parts:
        raise CorpusError(f"{label} path is not safely relative: {value!r}")
    return path


def file_reference(
    *,
    path: str,
    encoded: bytes,
    count: int | None = None,
    **fields: Any,
) -> dict[str, Any]:
    reference = {
        "path": path,
        **fields,
        "sha256": sha256_bytes(encoded),
        "byte_count": len(encoded),
    }
    if count is not None:
        reference["count"] = count
    return reference


def current_manifest_source_hash(manifest_path: Path) -> str | None:
    if not manifest_path.exists():
        return None
    manifest = load_json(manifest_path, label="corpus manifest")
    value = manifest.get("source_artifact_sha256")
    if not isinstance(value, str):
        raise CorpusError("existing corpus manifest has no source_artifact_sha256")
    return value


def assert_pack_is_based_on_current_corpus(
    *,
    manifest_path: Path,
    artifact_path: Path,
    bootstrap: bool,
) -> None:
    current_hash = current_manifest_source_hash(manifest_path)
    if current_hash is None:
        if not bootstrap:
            raise CorpusError(
                "no corpus manifest exists; the initial migration requires --bootstrap"
            )
        return
    if bootstrap:
        raise CorpusError("--bootstrap cannot replace an existing canonical corpus")

    state_path = materialization_state_path(artifact_path)
    state = load_json(state_path, label="materialization state")
    if state.get("source_artifact_sha256") != current_hash:
        raise CorpusError(
            "materialized corpus is not based on the current manifest; "
            "materialize again before editing"
        )


def remove_stale_card_buckets(directory: Path, expected_names: set[str]) -> None:
    if not directory.exists():
        return
    for path in directory.iterdir():
        if (
            path.is_file()
            and path.suffix == ".jsonl"
            and len(path.stem) == 2
            and all(character in "0123456789abcdef" for character in path.stem)
            and path.name not in expected_names
        ):
            path.unlink()


def remove_legacy_generated_shards(corpus_dir: Path) -> None:
    """Remove only the known schema-v1 generated shard directories."""

    for directory_name in ("source", "runtime"):
        directory = corpus_dir / directory_name
        if not directory.exists():
            continue
        unexpected = [
            path
            for path in directory.iterdir()
            if not (
                path.is_file()
                and path.suffix == ".json"
                and path.stem.isdigit()
            )
        ]
        if unexpected:
            raise CorpusError(
                f"refusing to remove legacy directory with unexpected content: "
                f"{unexpected[0]}"
            )
        for path in directory.iterdir():
            path.unlink()
        directory.rmdir()


def pack_corpus(
    *,
    artifact_path: Path = DEFAULT_LEGACY_ARTIFACT,
    corpus_dir: Path = DEFAULT_CORPUS_DIR,
    bootstrap: bool = False,
) -> dict[str, Any]:
    manifest_path = corpus_dir / "manifest.json"
    assert_pack_is_based_on_current_corpus(
        manifest_path=manifest_path,
        artifact_path=artifact_path,
        bootstrap=bootstrap,
    )

    artifact = load_json(artifact_path, label="materialized mnemonic artifact")
    cards = validate_artifact(artifact, label="materialized mnemonic artifact")
    runtime_cards = [runtime_card(card) for card in cards]
    validate_cards(runtime_cards, label="runtime projection")

    top_level_order = list(artifact)
    if top_level_order.count("mnemonics") != 1:
        raise CorpusError("materialized artifact must have exactly one mnemonics field")
    artifact_metadata = {
        key: value for key, value in artifact.items() if key != "mnemonics"
    }

    bucket_names = [f"{index:02x}" for index in range(BUCKET_COUNT)]
    buckets: dict[str, list[dict[str, Any]]] = {
        bucket: [] for bucket in bucket_names
    }
    for card in cards:
        buckets[bucket_for_character(card["character"])].append(card)

    cards_dir = corpus_dir / "cards"
    bucket_references: list[dict[str, Any]] = []
    expected_names = {f"{bucket}.jsonl" for bucket in bucket_names}
    for bucket in bucket_names:
        bucket_cards = buckets[bucket]
        filename = f"{bucket}.jsonl"
        encoded = jsonl_bytes(bucket_cards)
        write_bytes_atomic(cards_dir / filename, encoded)
        bucket_references.append(
            file_reference(
                path=f"cards/{filename}",
                encoded=encoded,
                count=len(bucket_cards),
                bucket=bucket,
                first_character=(
                    bucket_cards[0]["character"] if bucket_cards else None
                ),
                last_character=(
                    bucket_cards[-1]["character"] if bucket_cards else None
                ),
            )
        )
    remove_stale_card_buckets(cards_dir, expected_names)

    order_encoded = jsonl_bytes(card["character"] for card in cards)
    write_bytes_atomic(corpus_dir / "order.jsonl", order_encoded)
    order_reference = file_reference(
        path="order.jsonl",
        encoded=order_encoded,
        count=len(cards),
    )

    metadata_document = {
        "schema_version": SCHEMA_VERSION,
        "kind": "semantic_mnemonic_artifact_metadata",
        "top_level_order": top_level_order,
        "artifact_metadata": artifact_metadata,
    }
    metadata_encoded = write_json_atomic(
        corpus_dir / "metadata.json",
        metadata_document,
        pretty=True,
    )
    metadata_reference = file_reference(
        path="metadata.json",
        encoded=metadata_encoded,
    )

    canonical_artifact = canonical_json_bytes(artifact)
    runtime_projection = canonical_json_bytes({"mnemonics": runtime_cards})
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "kind": "semantic_mnemonic_bucketed_corpus",
        "count": len(cards),
        "bucket_algorithm": BUCKET_ALGORITHM,
        "bucket_count": BUCKET_COUNT,
        "source_artifact_sha256": sha256_bytes(canonical_artifact),
        "source_artifact_byte_count": len(canonical_artifact),
        "runtime_projection_sha256": sha256_bytes(runtime_projection),
        "runtime_projection_byte_count": len(runtime_projection),
        "runtime_card_fields": list(RUNTIME_CARD_FIELDS),
        "metadata": metadata_reference,
        "order": order_reference,
        "card_buckets": bucket_references,
    }
    write_json_atomic(manifest_path, manifest, pretty=True)

    remove_legacy_generated_shards(corpus_dir)
    write_json_atomic(
        materialization_state_path(artifact_path),
        {
            "schema_version": SCHEMA_VERSION,
            "manifest": str(manifest_path),
            "source_artifact_sha256": manifest["source_artifact_sha256"],
        },
        pretty=True,
    )
    return verify_corpus(manifest_path=manifest_path)


def load_referenced_bytes(
    *,
    manifest_path: Path,
    reference: Any,
    label: str,
) -> tuple[Path, bytes]:
    if not isinstance(reference, dict):
        raise CorpusError(f"{label} reference must be an object")
    relative = safe_relative_path(reference.get("path"), label=label)
    path = manifest_path.parent.joinpath(*relative.parts)
    try:
        encoded = path.read_bytes()
    except OSError as exc:
        raise CorpusError(f"cannot read {label} {path}: {exc}") from exc
    if reference.get("sha256") != sha256_bytes(encoded):
        raise CorpusError(f"{label} hash mismatch: {path}")
    if reference.get("byte_count") != len(encoded):
        raise CorpusError(f"{label} byte count mismatch: {path}")
    return path, encoded


def load_jsonl_values(encoded: bytes, *, path: Path) -> list[Any]:
    if encoded and not encoded.endswith(b"\n"):
        raise CorpusError(f"JSONL file has no final newline: {path}")

    values: list[Any] = []
    for line_number, raw_line in enumerate(encoded.splitlines(keepends=True), start=1):
        if not raw_line.endswith(b"\n"):
            raise CorpusError(f"unterminated JSONL line {line_number}: {path}")
        payload = raw_line[:-1]
        if not payload:
            raise CorpusError(f"blank JSONL line {line_number}: {path}")
        try:
            value = json.loads(payload)
        except (UnicodeError, json.JSONDecodeError) as exc:
            raise CorpusError(
                f"invalid JSONL line {line_number} in {path}: {exc}"
            ) from exc
        if canonical_json_bytes(value) != payload:
            raise CorpusError(
                f"non-canonical JSONL line {line_number} in {path}"
            )
        values.append(value)
    return values


def load_metadata(
    *,
    manifest_path: Path,
    manifest: dict[str, Any],
) -> tuple[list[str], dict[str, Any]]:
    path, encoded = load_referenced_bytes(
        manifest_path=manifest_path,
        reference=manifest.get("metadata"),
        label="metadata",
    )
    try:
        metadata = json.loads(encoded)
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise CorpusError(f"invalid metadata JSON {path}: {exc}") from exc
    if not isinstance(metadata, dict):
        raise CorpusError("metadata must be an object")
    if metadata.get("schema_version") != SCHEMA_VERSION:
        raise CorpusError("unsupported metadata schema")
    if metadata.get("kind") != "semantic_mnemonic_artifact_metadata":
        raise CorpusError("unexpected metadata kind")

    order = metadata.get("top_level_order")
    artifact_metadata = metadata.get("artifact_metadata")
    if not isinstance(order, list) or order.count("mnemonics") != 1:
        raise CorpusError("metadata top_level_order is invalid")
    if not all(isinstance(key, str) for key in order):
        raise CorpusError("metadata top_level_order contains a non-string")
    if not isinstance(artifact_metadata, dict):
        raise CorpusError("metadata artifact_metadata must be an object")
    if set(order) != set(artifact_metadata) | {"mnemonics"}:
        raise CorpusError("metadata top-level order and metadata keys differ")
    return order, artifact_metadata


def load_character_order(
    *,
    manifest_path: Path,
    manifest: dict[str, Any],
) -> list[str]:
    reference = manifest.get("order")
    path, encoded = load_referenced_bytes(
        manifest_path=manifest_path,
        reference=reference,
        label="character order",
    )
    values = load_jsonl_values(encoded, path=path)
    if not all(isinstance(value, str) and value for value in values):
        raise CorpusError("character order must contain nonempty JSON strings")
    if len(values) != len(set(values)):
        raise CorpusError("character order contains duplicates")
    if not isinstance(reference, dict) or reference.get("count") != len(values):
        raise CorpusError("character-order count differs from manifest")
    return values


def load_card_buckets(
    *,
    manifest_path: Path,
    manifest: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    references = manifest.get("card_buckets")
    if not isinstance(references, list) or len(references) != BUCKET_COUNT:
        raise CorpusError(
            f"manifest card_buckets must contain exactly {BUCKET_COUNT} references"
        )

    cards_by_character: dict[str, dict[str, Any]] = {}
    seen_paths: set[str] = set()
    for bucket_index, reference in enumerate(references):
        bucket = f"{bucket_index:02x}"
        if not isinstance(reference, dict) or reference.get("bucket") != bucket:
            raise CorpusError(f"card-bucket reference {bucket_index} is out of order")
        reference_path = reference.get("path")
        if reference_path in seen_paths:
            raise CorpusError(f"card-bucket path is repeated: {reference_path!r}")
        seen_paths.add(reference_path)

        path, encoded = load_referenced_bytes(
            manifest_path=manifest_path,
            reference=reference,
            label=f"card bucket {bucket}",
        )
        values = load_jsonl_values(encoded, path=path)
        bucket_cards = validate_cards(values, label=f"card bucket {bucket}")
        if reference.get("count") != len(bucket_cards):
            raise CorpusError(f"card-bucket count mismatch: {path}")
        expected_first = bucket_cards[0]["character"] if bucket_cards else None
        expected_last = bucket_cards[-1]["character"] if bucket_cards else None
        if reference.get("first_character") != expected_first:
            raise CorpusError(f"card-bucket first-character mismatch: {path}")
        if reference.get("last_character") != expected_last:
            raise CorpusError(f"card-bucket last-character mismatch: {path}")

        for card in bucket_cards:
            character = card["character"]
            if bucket_for_character(character) != bucket:
                raise CorpusError(
                    f"character {character!r} is stored in the wrong bucket {bucket}"
                )
            if character in cards_by_character:
                raise CorpusError(f"card buckets repeat character {character!r}")
            cards_by_character[character] = card
    return cards_by_character


def reconstruct_artifact(
    *,
    top_level_order: list[str],
    artifact_metadata: dict[str, Any],
    character_order: list[str],
    cards_by_character: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    if set(character_order) != set(cards_by_character):
        missing = set(character_order) - set(cards_by_character)
        extra = set(cards_by_character) - set(character_order)
        raise CorpusError(
            "character order and card buckets differ "
            f"(missing={len(missing)}, extra={len(extra)})"
        )
    cards = [cards_by_character[character] for character in character_order]
    artifact: dict[str, Any] = {}
    for key in top_level_order:
        artifact[key] = cards if key == "mnemonics" else artifact_metadata[key]
    validate_artifact(artifact, label="reconstructed artifact")
    return artifact


def verify_corpus(
    *,
    manifest_path: Path = DEFAULT_MANIFEST,
) -> dict[str, Any]:
    manifest = load_json(manifest_path, label="corpus manifest")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise CorpusError("unsupported corpus manifest schema")
    if manifest.get("kind") != "semantic_mnemonic_bucketed_corpus":
        raise CorpusError("unexpected corpus manifest kind")
    if manifest.get("bucket_algorithm") != BUCKET_ALGORITHM:
        raise CorpusError("unsupported corpus bucket algorithm")
    if manifest.get("bucket_count") != BUCKET_COUNT:
        raise CorpusError("unexpected corpus bucket count")

    top_level_order, artifact_metadata = load_metadata(
        manifest_path=manifest_path,
        manifest=manifest,
    )
    character_order = load_character_order(
        manifest_path=manifest_path,
        manifest=manifest,
    )
    cards_by_character = load_card_buckets(
        manifest_path=manifest_path,
        manifest=manifest,
    )
    if len(cards_by_character) != manifest.get("count"):
        raise CorpusError(
            f"card buckets contain {len(cards_by_character)} cards, "
            f"expected {manifest.get('count')}"
        )
    if len(character_order) != manifest.get("count"):
        raise CorpusError("character-order count differs from corpus manifest")

    artifact = reconstruct_artifact(
        top_level_order=top_level_order,
        artifact_metadata=artifact_metadata,
        character_order=character_order,
        cards_by_character=cards_by_character,
    )
    artifact_bytes = canonical_json_bytes(artifact)
    if manifest.get("source_artifact_sha256") != sha256_bytes(artifact_bytes):
        raise CorpusError("reconstructed source artifact hash differs from manifest")
    if manifest.get("source_artifact_byte_count") != len(artifact_bytes):
        raise CorpusError("reconstructed source artifact byte count differs")

    runtime_cards = [runtime_card(card) for card in artifact["mnemonics"]]
    validate_cards(runtime_cards, label="runtime projection")
    runtime_projection = canonical_json_bytes({"mnemonics": runtime_cards})
    if manifest.get("runtime_projection_sha256") != sha256_bytes(runtime_projection):
        raise CorpusError("runtime projection hash differs from manifest")
    if manifest.get("runtime_projection_byte_count") != len(runtime_projection):
        raise CorpusError("runtime projection byte count differs")
    if manifest.get("runtime_card_fields") != list(RUNTIME_CARD_FIELDS):
        raise CorpusError("manifest runtime-card field contract differs from code")

    bucket_sizes = [
        reference["byte_count"] for reference in manifest["card_buckets"]
    ]
    return {
        "status": "pass",
        "manifest": str(manifest_path),
        "card_count": len(cards_by_character),
        "bucket_count": BUCKET_COUNT,
        "nonempty_bucket_count": sum(
            reference["count"] > 0 for reference in manifest["card_buckets"]
        ),
        "largest_bucket_byte_count": max(bucket_sizes, default=0),
        "source_artifact_sha256": manifest["source_artifact_sha256"],
        "source_artifact_byte_count": len(artifact_bytes),
        "runtime_projection_sha256": manifest["runtime_projection_sha256"],
        "runtime_projection_byte_count": len(runtime_projection),
        "artifact": artifact,
    }


def materialize_corpus(
    *,
    manifest_path: Path = DEFAULT_MANIFEST,
    artifact_path: Path = DEFAULT_LEGACY_ARTIFACT,
    force: bool = False,
) -> dict[str, Any]:
    result = verify_corpus(manifest_path=manifest_path)
    artifact = result["artifact"]
    encoded = canonical_json_bytes(artifact)

    if artifact_path.exists():
        current = artifact_path.read_bytes()
        if current != encoded and not force:
            raise CorpusError(
                f"refusing to overwrite edited materialization {artifact_path}; "
                "pack it first or pass --force"
            )
    write_bytes_atomic(artifact_path, encoded)
    write_json_atomic(
        materialization_state_path(artifact_path),
        {
            "schema_version": SCHEMA_VERSION,
            "manifest": str(manifest_path),
            "source_artifact_sha256": result["source_artifact_sha256"],
        },
        pretty=True,
    )
    return {
        key: value for key, value in result.items() if key != "artifact"
    } | {"materialized_path": str(artifact_path)}


def dematerialize_corpus(
    *,
    manifest_path: Path = DEFAULT_MANIFEST,
    artifact_path: Path = DEFAULT_LEGACY_ARTIFACT,
) -> dict[str, Any]:
    result = verify_corpus(manifest_path=manifest_path)
    expected = canonical_json_bytes(result["artifact"])
    if artifact_path.exists() and artifact_path.read_bytes() != expected:
        raise CorpusError(
            f"refusing to remove edited materialization {artifact_path}; pack it first"
        )
    removed: list[str] = []
    for path in (artifact_path, materialization_state_path(artifact_path)):
        if path.exists():
            path.unlink()
            removed.append(str(path))
    return {
        "status": "pass",
        "removed": removed,
        "source_artifact_sha256": result["source_artifact_sha256"],
    }


def printable_result(result: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in result.items() if key != "artifact"}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    pack = subparsers.add_parser(
        "pack",
        help="replace canonical buckets from an edited materialization",
    )
    pack.add_argument("--artifact", type=Path, default=DEFAULT_LEGACY_ARTIFACT)
    pack.add_argument("--corpus-dir", type=Path, default=DEFAULT_CORPUS_DIR)
    pack.add_argument(
        "--bootstrap",
        action="store_true",
        help="create the initial canonical corpus when no manifest exists",
    )

    verify = subparsers.add_parser(
        "verify",
        help="verify canonical buckets, order, metadata, hashes, and projection",
    )
    verify.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)

    materialize = subparsers.add_parser(
        "materialize",
        help="reconstruct the ignored legacy monolith for editorial tools",
    )
    materialize.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    materialize.add_argument("--artifact", type=Path, default=DEFAULT_LEGACY_ARTIFACT)
    materialize.add_argument("--force", action="store_true")

    dematerialize = subparsers.add_parser(
        "dematerialize",
        help="remove an unchanged generated monolith and its state marker",
    )
    dematerialize.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    dematerialize.add_argument("--artifact", type=Path, default=DEFAULT_LEGACY_ARTIFACT)
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "pack":
            result = pack_corpus(
                artifact_path=args.artifact,
                corpus_dir=args.corpus_dir,
                bootstrap=args.bootstrap,
            )
        elif args.command == "verify":
            result = verify_corpus(manifest_path=args.manifest)
        elif args.command == "materialize":
            result = materialize_corpus(
                manifest_path=args.manifest,
                artifact_path=args.artifact,
                force=args.force,
            )
        elif args.command == "dematerialize":
            result = dematerialize_corpus(
                manifest_path=args.manifest,
                artifact_path=args.artifact,
            )
        else:  # pragma: no cover - argparse prevents this
            raise AssertionError(args.command)
    except CorpusError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(json.dumps(printable_result(result), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
