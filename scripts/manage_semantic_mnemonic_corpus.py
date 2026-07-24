#!/usr/bin/env python3
"""Pack, verify, and materialize Kiokun's sharded mnemonic corpus.

The complete editorial cards contain provenance and audit metadata that the
dictionary builder does not consume.  Keeping all of that data in one tracked
JSON file made every small edit replace a file larger than GitHub's recommended
50 MiB limit.

This tool keeps one authoritative corpus without keeping that monolith in Git:

* ``source/*.json`` preserves every card field and all top-level metadata.
* ``runtime/*.json`` is a deterministic projection containing only fields
  understood by the Rust dictionary builder.
* ``manifest.json`` binds both shard sets by count, range, and SHA-256.
* the former monolith can be reconstructed on demand for legacy editorial
  tools, then packed back into the canonical shards.
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
DEFAULT_SHARD_SIZE = 1000
SCHEMA_VERSION = 1

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


def write_json_atomic(path: Path, value: Any) -> bytes:
    encoded = canonical_json_bytes(value)
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


def safe_relative_path(value: Any, *, label: str) -> PurePosixPath:
    if not isinstance(value, str) or not value:
        raise CorpusError(f"{label} has no path")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or "." in path.parts:
        raise CorpusError(f"{label} path is not safely relative: {value!r}")
    return path


def shard_payload(
    *,
    kind: str,
    shard_index: int,
    start: int,
    cards: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "kind": kind,
        "shard_index": shard_index,
        "start": start,
        "end": start + len(cards),
        "count": len(cards),
        "mnemonics": cards,
    }


def shard_reference(
    *,
    path: str,
    payload: dict[str, Any],
    encoded: bytes,
) -> dict[str, Any]:
    cards = payload["mnemonics"]
    return {
        "path": path,
        "shard_index": payload["shard_index"],
        "start": payload["start"],
        "end": payload["end"],
        "count": payload["count"],
        "first_character": cards[0]["character"],
        "last_character": cards[-1]["character"],
        "sha256": sha256_bytes(encoded),
        "byte_count": len(encoded),
    }


def remove_stale_shards(directory: Path, expected_names: set[str]) -> None:
    if not directory.exists():
        return
    for path in directory.iterdir():
        if (
            path.is_file()
            and path.suffix == ".json"
            and path.stem.isdigit()
            and path.name not in expected_names
        ):
            path.unlink()


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
        raise CorpusError("--bootstrap cannot replace an existing sharded corpus")

    state_path = materialization_state_path(artifact_path)
    state = load_json(state_path, label="materialization state")
    if state.get("source_artifact_sha256") != current_hash:
        raise CorpusError(
            "materialized corpus is not based on the current manifest; "
            "materialize again before editing"
        )


def pack_corpus(
    *,
    artifact_path: Path = DEFAULT_LEGACY_ARTIFACT,
    corpus_dir: Path = DEFAULT_CORPUS_DIR,
    shard_size: int = DEFAULT_SHARD_SIZE,
    bootstrap: bool = False,
) -> dict[str, Any]:
    if shard_size < 1:
        raise CorpusError("shard size must be positive")

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

    source_dir = corpus_dir / "source"
    runtime_dir = corpus_dir / "runtime"
    source_refs: list[dict[str, Any]] = []
    runtime_refs: list[dict[str, Any]] = []
    expected_names: set[str] = set()

    for shard_index, start in enumerate(range(0, len(cards), shard_size)):
        filename = f"{shard_index:03d}.json"
        expected_names.add(filename)
        end = min(start + shard_size, len(cards))

        source_payload = shard_payload(
            kind="semantic_mnemonic_source_shard",
            shard_index=shard_index,
            start=start,
            cards=cards[start:end],
        )
        source_encoded = write_json_atomic(source_dir / filename, source_payload)
        source_refs.append(
            shard_reference(
                path=f"source/{filename}",
                payload=source_payload,
                encoded=source_encoded,
            )
        )

        runtime_payload = shard_payload(
            kind="semantic_mnemonic_runtime_shard",
            shard_index=shard_index,
            start=start,
            cards=runtime_cards[start:end],
        )
        runtime_encoded = write_json_atomic(runtime_dir / filename, runtime_payload)
        runtime_refs.append(
            shard_reference(
                path=f"runtime/{filename}",
                payload=runtime_payload,
                encoded=runtime_encoded,
            )
        )

    remove_stale_shards(source_dir, expected_names)
    remove_stale_shards(runtime_dir, expected_names)

    canonical_artifact = canonical_json_bytes(artifact)
    runtime_projection = canonical_json_bytes({"mnemonics": runtime_cards})
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "kind": "semantic_mnemonic_sharded_corpus",
        "count": len(cards),
        "shard_size": shard_size,
        "shard_count": len(source_refs),
        "top_level_order": top_level_order,
        "artifact_metadata": artifact_metadata,
        "source_artifact_sha256": sha256_bytes(canonical_artifact),
        "source_artifact_byte_count": len(canonical_artifact),
        "runtime_projection_sha256": sha256_bytes(runtime_projection),
        "runtime_projection_byte_count": len(runtime_projection),
        "runtime_card_fields": list(RUNTIME_CARD_FIELDS),
        "source_shards": source_refs,
        "runtime_shards": runtime_refs,
    }
    write_json_atomic(manifest_path, manifest)

    write_json_atomic(
        materialization_state_path(artifact_path),
        {
            "schema_version": SCHEMA_VERSION,
            "manifest": str(manifest_path),
            "source_artifact_sha256": manifest["source_artifact_sha256"],
        },
    )
    return verify_corpus(manifest_path=manifest_path)


def load_shard_set(
    *,
    manifest_path: Path,
    manifest: dict[str, Any],
    reference_field: str,
    expected_kind: str,
) -> list[dict[str, Any]]:
    references = manifest.get(reference_field)
    if not isinstance(references, list) or not references:
        raise CorpusError(f"manifest {reference_field} must be a nonempty array")

    cards: list[dict[str, Any]] = []
    expected_start = 0
    expected_index = 0
    seen: set[str] = set()
    for reference in references:
        if not isinstance(reference, dict):
            raise CorpusError(f"manifest {reference_field} contains a non-object")
        relative = safe_relative_path(
            reference.get("path"),
            label=f"manifest {reference_field}[{expected_index}]",
        )
        shard_path = manifest_path.parent.joinpath(*relative.parts)
        shard = load_json(shard_path, label=f"{reference_field} shard")
        encoded = canonical_json_bytes(shard)

        if reference.get("sha256") != sha256_bytes(encoded):
            raise CorpusError(f"shard hash mismatch: {shard_path}")
        if reference.get("byte_count") != len(encoded):
            raise CorpusError(f"shard byte count mismatch: {shard_path}")
        if shard.get("schema_version") != SCHEMA_VERSION:
            raise CorpusError(f"unsupported shard schema: {shard_path}")
        if shard.get("kind") != expected_kind:
            raise CorpusError(f"unexpected shard kind: {shard_path}")
        if shard.get("shard_index") != expected_index:
            raise CorpusError(f"non-contiguous shard index: {shard_path}")
        if shard.get("start") != expected_start:
            raise CorpusError(f"non-contiguous shard start: {shard_path}")

        shard_cards = validate_cards(
            shard.get("mnemonics"),
            label=f"{shard_path}.mnemonics",
        )
        end = expected_start + len(shard_cards)
        if shard.get("count") != len(shard_cards) or shard.get("end") != end:
            raise CorpusError(f"shard range/count mismatch: {shard_path}")
        for field in ("shard_index", "start", "end", "count"):
            if reference.get(field) != shard.get(field):
                raise CorpusError(f"manifest/shard {field} mismatch: {shard_path}")
        if reference.get("first_character") != shard_cards[0]["character"]:
            raise CorpusError(f"first-character mismatch: {shard_path}")
        if reference.get("last_character") != shard_cards[-1]["character"]:
            raise CorpusError(f"last-character mismatch: {shard_path}")

        for card in shard_cards:
            character = card["character"]
            if character in seen:
                raise CorpusError(
                    f"{reference_field} repeats character {character!r}"
                )
            seen.add(character)
        cards.extend(shard_cards)
        expected_start = end
        expected_index += 1

    if len(cards) != manifest.get("count"):
        raise CorpusError(
            f"{reference_field} covers {len(cards)} cards, "
            f"expected {manifest.get('count')}"
        )
    if len(references) != manifest.get("shard_count"):
        raise CorpusError(f"{reference_field} shard count differs from manifest")
    return cards


def reconstruct_artifact(
    *,
    manifest: dict[str, Any],
    source_cards: list[dict[str, Any]],
) -> dict[str, Any]:
    order = manifest.get("top_level_order")
    metadata = manifest.get("artifact_metadata")
    if not isinstance(order, list) or order.count("mnemonics") != 1:
        raise CorpusError("manifest top_level_order is invalid")
    if not isinstance(metadata, dict):
        raise CorpusError("manifest artifact_metadata must be an object")
    if set(order) != set(metadata) | {"mnemonics"}:
        raise CorpusError("manifest top-level order and metadata keys differ")

    artifact: dict[str, Any] = {}
    for key in order:
        if key == "mnemonics":
            artifact[key] = source_cards
        else:
            artifact[key] = metadata[key]
    validate_artifact(artifact, label="reconstructed artifact")
    return artifact


def verify_corpus(
    *,
    manifest_path: Path = DEFAULT_MANIFEST,
) -> dict[str, Any]:
    manifest = load_json(manifest_path, label="corpus manifest")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise CorpusError("unsupported corpus manifest schema")
    if manifest.get("kind") != "semantic_mnemonic_sharded_corpus":
        raise CorpusError("unexpected corpus manifest kind")

    source_cards = load_shard_set(
        manifest_path=manifest_path,
        manifest=manifest,
        reference_field="source_shards",
        expected_kind="semantic_mnemonic_source_shard",
    )
    runtime_cards = load_shard_set(
        manifest_path=manifest_path,
        manifest=manifest,
        reference_field="runtime_shards",
        expected_kind="semantic_mnemonic_runtime_shard",
    )
    expected_runtime = [runtime_card(card) for card in source_cards]
    if runtime_cards != expected_runtime:
        raise CorpusError("runtime shards are not the exact source-card projection")

    artifact = reconstruct_artifact(manifest=manifest, source_cards=source_cards)
    artifact_bytes = canonical_json_bytes(artifact)
    if manifest.get("source_artifact_sha256") != sha256_bytes(artifact_bytes):
        raise CorpusError("reconstructed source artifact hash differs from manifest")
    if manifest.get("source_artifact_byte_count") != len(artifact_bytes):
        raise CorpusError("reconstructed source artifact byte count differs")

    runtime_projection = canonical_json_bytes({"mnemonics": runtime_cards})
    if manifest.get("runtime_projection_sha256") != sha256_bytes(runtime_projection):
        raise CorpusError("runtime projection hash differs from manifest")
    if manifest.get("runtime_projection_byte_count") != len(runtime_projection):
        raise CorpusError("runtime projection byte count differs")
    if manifest.get("runtime_card_fields") != list(RUNTIME_CARD_FIELDS):
        raise CorpusError("manifest runtime-card field contract differs from code")

    return {
        "status": "pass",
        "manifest": str(manifest_path),
        "card_count": len(source_cards),
        "shard_count": manifest["shard_count"],
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
        help="replace canonical source/runtime shards from an edited materialization",
    )
    pack.add_argument("--artifact", type=Path, default=DEFAULT_LEGACY_ARTIFACT)
    pack.add_argument("--corpus-dir", type=Path, default=DEFAULT_CORPUS_DIR)
    pack.add_argument("--shard-size", type=int, default=DEFAULT_SHARD_SIZE)
    pack.add_argument(
        "--bootstrap",
        action="store_true",
        help="create the initial sharded corpus when no manifest exists",
    )

    verify = subparsers.add_parser(
        "verify",
        help="verify source shards, runtime projections, ranges, and hashes",
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
                shard_size=args.shard_size,
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
