#!/usr/bin/env python3
"""Safely inspect and apply small editorial mnemonic corrections.

The 24k-card corpus is intentionally a materialized release artifact, not an
authoring input.  Do not use the older completion pipeline for a wording fix:
it rebuilds cards from legacy inputs.  Instead, put a narrowly scoped,
reviewed edit in ``data/semantic_mnemonic_editorial_overrides.json`` and use
this command to validate and publish the derived release artifacts together.

Examples:

    python3 scripts/edit_semantic_mnemonic.py --character 処
    python3 scripts/edit_semantic_mnemonic.py --component 夂
    python3 scripts/edit_semantic_mnemonic.py --character 処 --apply
    python3 scripts/edit_semantic_mnemonic.py --check

``--apply`` only changes local artifacts.  Committing the resulting corpus
continues to use the existing shard deployment workflow; a learner never
downloads the full source corpus to view a mnemonic.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import audit_semantic_mnemonics as quality_audit  # noqa: E402
import complete_semantic_mnemonics_all as complete  # noqa: E402
import promote_gpt56_expedited_release as expedited  # noqa: E402


EXPECTED_CARD_COUNT = 24_037
CORPUS_PATH = complete.OUTPUT_PATH
EVAL_PATH = complete.EVAL_PATH
AUDIT_PATH = complete.QUALITY_AUDIT_PATH
COMPONENT_INDEX_PATH = complete.MNEMONIC_COMPONENT_USES_PATH
RECEIPT_PATH = complete.RESEARCH_DIR / "semantic_mnemonics_all_best_available_expedited_release.json"
LEDGER_PATH = ROOT / "data" / "semantic_mnemonic_editorial_overrides.json"
DICTIONARY_PATH = ROOT / "data" / "chinese_dictionary_char_2025-06-25.jsonl"


class EditorialOverrideError(RuntimeError):
    """An override is stale, malformed, or would make the corpus unsafe."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def canonical_json_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def sha256_value(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def sha256_path(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def repo_path(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT))
    except ValueError:
        return str(path.resolve())


def load_object(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise EditorialOverrideError(f"cannot read {label} {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise EditorialOverrideError(f"{label} must be a JSON object: {path}")
    return value


def one_codepoint(value: Any, label: str) -> str:
    character = str(value or "")
    if len(character) != 1:
        raise EditorialOverrideError(f"{label} must be one Unicode character: {character!r}")
    return character


def normal_components(value: Any, label: str) -> list[dict[str, str]]:
    if not isinstance(value, list) or not value:
        raise EditorialOverrideError(f"{label} must be a nonempty component list")
    components: list[dict[str, str]] = []
    for index, component in enumerate(value, start=1):
        if not isinstance(component, dict):
            raise EditorialOverrideError(f"{label}[{index}] must be an object")
        character = one_codepoint(component.get("character"), f"{label}[{index}].character")
        gloss = str(component.get("gloss") or "").strip()
        if not gloss:
            raise EditorialOverrideError(f"{label}[{index}].gloss is required")
        components.append({"character": character, "gloss": gloss})
    return components


def card_signature(card: dict[str, Any]) -> dict[str, Any]:
    """Fields an editorial sentence is allowed to rely on but not change."""

    return {
        "meaning": str(card.get("meaning") or ""),
        "equation": str(card.get("equation") or ""),
        "components": normal_components(card.get("components"), "card.components"),
        "visual_components": normal_components(
            card.get("visual_components") or card.get("components"),
            "card.visual_components",
        ),
    }


def card_by_character(cards: Iterable[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for card in cards:
        if not isinstance(card, dict):
            raise EditorialOverrideError("corpus contains a non-object card")
        character = one_codepoint(card.get("character"), "card.character")
        if character in result:
            raise EditorialOverrideError(f"corpus has duplicate card {character}")
        result[character] = card
    if len(result) != EXPECTED_CARD_COUNT:
        raise EditorialOverrideError(
            f"unexpected corpus coverage: {len(result)} cards, expected {EXPECTED_CARD_COUNT}"
        )
    return result


def load_overrides(path: Path) -> list[dict[str, Any]]:
    ledger = load_object(path, "editorial override ledger")
    if ledger.get("schema_version") != 1:
        raise EditorialOverrideError("editorial override ledger must use schema_version 1")
    raw = ledger.get("overrides")
    if not isinstance(raw, list):
        raise EditorialOverrideError("editorial override ledger must contain an overrides list")
    overrides: list[dict[str, Any]] = []
    # Superseded records remain in the ledger as audit history.  Only one
    # currently actionable record may exist for a character.
    active_characters: set[str] = set()
    for index, override in enumerate(raw, start=1):
        if not isinstance(override, dict):
            raise EditorialOverrideError(f"override {index} must be an object")
        character = one_codepoint(override.get("character"), f"override {index}.character")
        status = str(override.get("status") or "")
        if status not in {"approved", "proposed", "superseded"}:
            raise EditorialOverrideError(
                f"override {character} has invalid status {status!r}"
            )
        if status == "superseded":
            continue
        if character in active_characters:
            raise EditorialOverrideError(f"duplicate active editorial override for {character}")
        active_characters.add(character)
        expected = override.get("expected")
        if not isinstance(expected, dict):
            raise EditorialOverrideError(f"override {character} requires expected fields")
        required_signature = {
            "meaning": str(expected.get("meaning") or ""),
            "equation": str(expected.get("equation") or ""),
            "components": normal_components(expected.get("components"), f"override {character}.expected.components"),
            "visual_components": normal_components(
                expected.get("visual_components"),
                f"override {character}.expected.visual_components",
            ),
        }
        if not required_signature["meaning"] or not required_signature["equation"]:
            raise EditorialOverrideError(
                f"override {character} must pin expected meaning and equation"
            )
        mnemonic = str(override.get("mnemonic") or "").strip()
        if not mnemonic:
            raise EditorialOverrideError(f"override {character} must provide a mnemonic")
        base_card_hash = str(override.get("base_card_hash") or "")
        if not base_card_hash.startswith("sha256:"):
            raise EditorialOverrideError(f"override {character} must pin base_card_hash")
        confidence = override.get("confidence")
        if not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1:
            raise EditorialOverrideError(
                f"override {character}.confidence must be a number from 0 to 1"
            )
        overrides.append({
            **copy.deepcopy(override),
            "character": character,
            "status": status,
            "expected": required_signature,
            "mnemonic": mnemonic,
            "base_card_hash": base_card_hash,
            "confidence": float(confidence),
        })
    return overrides


def validate_expected_card(card: dict[str, Any], override: dict[str, Any]) -> None:
    character = override["character"]
    actual = card_signature(card)
    if actual != override["expected"]:
        raise EditorialOverrideError(
            f"{character}: component, gloss, meaning, or equation changed since this "
            "editorial override was written; re-review it instead of applying it blindly"
        )


def apply_override(card: dict[str, Any], override: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Return an updated card and whether this was a change or an idempotent no-op."""

    validate_expected_card(card, override)
    desired = override["mnemonic"]
    if str(card.get("mnemonic") or "") == desired:
        provenance = card.get("editorial_override") or {}
        if (
            provenance.get("ledger_path") == repo_path(LEDGER_PATH)
            and provenance.get("base_card_hash") == override["base_card_hash"]
        ):
            return copy.deepcopy(card), "already_applied"
        raise EditorialOverrideError(
            f"{override['character']}: the requested wording is already present but "
            "does not carry this ledger record's provenance; review it before marking "
            "the override complete"
        )
    actual_base_hash = sha256_value(card)
    if actual_base_hash != override["base_card_hash"]:
        raise EditorialOverrideError(
            f"{override['character']}: stale base_card_hash; expected "
            f"{override['base_card_hash']}, found {actual_base_hash}"
        )
    updated = copy.deepcopy(card)
    updated["mnemonic"] = desired
    updated["confidence"] = override["confidence"]
    updated["editorial_override"] = {
        "ledger_path": repo_path(LEDGER_PATH),
        "base_card_hash": override["base_card_hash"],
        "recorded_at": str(override.get("recorded_at") or ""),
        "rationale": str(override.get("rationale") or ""),
        "source": str(override.get("source") or ""),
    }
    # Validate against the card's existing, frozen visual decomposition rather
    # than calling the legacy completion builder, which can rewrite it.
    complete.refresh_validation(updated, copy.deepcopy(updated))
    validation = updated.get("validation") or {}
    if not validation.get("valid"):
        raise EditorialOverrideError(
            f"{override['character']}: revised mnemonic is formally invalid: "
            f"{validation.get('problems')}"
        )
    return updated, "applied"


def fresh_validation(cards: list[dict[str, Any]]) -> dict[str, Any]:
    """Revalidate every card in memory without rewriting untouched card fields."""

    invalid: list[dict[str, Any]] = []
    for card in cards:
        probe = copy.deepcopy(card)
        complete.refresh_validation(probe, copy.deepcopy(probe))
        validation = probe.get("validation") or {}
        if not validation.get("valid"):
            invalid.append({
                "character": card.get("character"),
                "problems": validation.get("problems", ["missing validation"]),
            })
    if invalid:
        raise EditorialOverrideError(
            "formal replay found invalid cards: "
            + json.dumps(invalid[:10], ensure_ascii=False)
        )
    evaluation = complete.validate_artifact(cards)
    if evaluation.get("invalid_count") != 0:
        raise EditorialOverrideError(
            f"stored corpus validation has {evaluation['invalid_count']} invalid cards"
        )
    return evaluation


def build_release_documents(
    artifact: dict[str, Any],
    cards: list[dict[str, Any]],
    evaluation: dict[str, Any],
    *,
    ledger_hash: str,
    changed: list[dict[str, Any]],
) -> dict[Path, tuple[Any, bool]]:
    """Rebuild the exact artifact group consumed by the shard publisher."""

    now = utc_now()
    artifact = copy.deepcopy(artifact)
    artifact["count"] = len(cards)
    artifact["created_at"] = now
    artifact["mnemonics"] = cards
    artifact["source_counts"] = complete.count_sources(cards)
    release = copy.deepcopy(artifact.get("gpt56_expedited_release") or {})
    if release.get("certification_status") != expedited.EXPEDITED_CERTIFICATION_STATUS:
        raise EditorialOverrideError(
            "refusing to edit a corpus that is not the expected expedited release"
        )
    projection_hash = expedited.card_projection_hash(cards)
    formal_validation = {"count": len(cards), "invalid_count": evaluation["invalid_count"]}
    release["materialized_card_projection_hash"] = projection_hash
    release["formal_validation"] = formal_validation
    history = list(release.get("editorial_patch_history") or [])
    history.append({
        "applied_at": now,
        "ledger_path": repo_path(LEDGER_PATH),
        "ledger_sha256": ledger_hash,
        "characters": [entry["character"] for entry in changed],
        "count": len(changed),
    })
    release["editorial_patch_history"] = history
    artifact["gpt56_expedited_release"] = release

    quality_report = quality_audit.build_report(artifact, limit=min(2000, len(cards)))
    quality_report["gpt56_expedited_release"] = {
        "certification_status": expedited.EXPEDITED_CERTIFICATION_STATUS,
        "materialized_card_projection_hash": projection_hash,
        "formal_validation": formal_validation,
        "editorial_ledger_sha256": ledger_hash,
    }
    evaluation = copy.deepcopy(evaluation)
    evaluation["quality_review"] = {
        "methodology": quality_report["methodology"],
        "flagged_count": quality_report["flagged_count"],
        "quality_status_counts": quality_report["quality_status_counts"],
        "flag_counts": quality_report["flag_counts"],
        "top_suspicious": quality_report["ranked"][:25],
        "full_review_count": 0,
        "certification_status": expedited.EXPEDITED_CERTIFICATION_STATUS,
    }
    evaluation["gpt56_expedited_release"] = {
        "materialized_card_projection_hash": projection_hash,
        "formal_validation": formal_validation,
        "editorial_ledger_sha256": ledger_hash,
    }
    component_index = expedited._expedited_component_uses(cards)
    component_index["gpt56_expedited_release"]["materialized_card_projection_hash"] = projection_hash
    component_index["gpt56_expedited_release"]["editorial_ledger_sha256"] = ledger_hash
    expected_index_hash = complete.semantic_mnemonic_corpus_hash(cards)
    if component_index.get("source_corpus_hash") != expected_index_hash:
        raise EditorialOverrideError("rebuilt component index does not match the corpus")

    receipt = {
        "created_at": now,
        "gpt56_expedited_release": release,
        "static_artifact": {
            "count": len(cards),
            "materialized_card_projection_hash": projection_hash,
            "component_index_source_corpus_hash": component_index["source_corpus_hash"],
        },
        "editorial_overrides": {
            "ledger_path": repo_path(LEDGER_PATH),
            "ledger_sha256": ledger_hash,
            "characters": [entry["character"] for entry in changed],
        },
    }
    return {
        CORPUS_PATH: (artifact, True),
        EVAL_PATH: (evaluation, False),
        AUDIT_PATH: (quality_report, False),
        COMPONENT_INDEX_PATH: (component_index, True),
        RECEIPT_PATH: (receipt, False),
    }


def dictionary_hint(character: str) -> dict[str, Any] | None:
    if not DICTIONARY_PATH.is_file():
        return None
    with DICTIONARY_PATH.open() as lines:
        for line in lines:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("char") == character:
                return {
                    "gloss": entry.get("gloss"),
                    "hint": entry.get("hint"),
                }
    return None


def lookup_card(character: str) -> dict[str, Any]:
    corpus = load_object(CORPUS_PATH, "mnemonic corpus")
    cards = corpus.get("mnemonics")
    if not isinstance(cards, list):
        raise EditorialOverrideError("mnemonic corpus lacks mnemonics")
    card = card_by_character(cards).get(character)
    if card is None:
        raise EditorialOverrideError(f"no mnemonic card for {character}")
    overrides = {item["character"]: item for item in load_overrides(LEDGER_PATH)}
    return {
        "character": character,
        "card_hash": sha256_value(card),
        "meaning": card.get("meaning"),
        "equation": card.get("equation"),
        "mnemonic": card.get("mnemonic"),
        "components": card.get("components"),
        "visual_components": card.get("visual_components"),
        "confidence": card.get("confidence"),
        "dictionary": dictionary_hint(character),
        "card_editorial_provenance": card.get("editorial_override"),
        "ledger_override": overrides.get(character),
    }


def lookup_component(character: str) -> dict[str, Any]:
    index = load_object(COMPONENT_INDEX_PATH, "mnemonic component index")
    component = (index.get("components") or {}).get(character)
    if component is None:
        raise EditorialOverrideError(f"no mnemonic component entry for {character}")
    cards = index.get("cards") or {}
    rows = component.get("mnemonics") or []
    return {
        "component": character,
        "summary": {
            key: component.get(key)
            for key in (
                "card_count",
                "occurrence_count",
                "canonical_gloss",
                "lexical_gloss",
                "gloss_counts",
            )
        },
        "mnemonics": [
            {**row, "card": cards.get(row.get("character"))}
            for row in rows
        ],
    }


def selected_overrides(overrides: list[dict[str, Any]], character: str | None) -> list[dict[str, Any]]:
    if character is None:
        return overrides
    matches = [override for override in overrides if override["character"] == character]
    if not matches:
        raise EditorialOverrideError(f"no active editorial override for {character}")
    return matches


def check_or_apply(*, character: str | None, write: bool) -> dict[str, Any]:
    corpus = load_object(CORPUS_PATH, "mnemonic corpus")
    cards = corpus.get("mnemonics")
    if not isinstance(cards, list):
        raise EditorialOverrideError("mnemonic corpus lacks a mnemonics list")
    cards = copy.deepcopy(cards)
    by_character = card_by_character(cards)
    ledger_hash = sha256_path(LEDGER_PATH)
    overrides = selected_overrides(load_overrides(LEDGER_PATH), character)
    changed: list[dict[str, Any]] = []
    proposed: list[str] = []
    already_applied: list[str] = []
    for override in overrides:
        target = override["character"]
        card = by_character.get(target)
        if card is None:
            raise EditorialOverrideError(f"override references absent card {target}")
        validate_expected_card(card, override)
        if override["status"] != "approved":
            proposed.append(target)
            continue
        updated, result = apply_override(card, override)
        if result == "applied":
            for index, current in enumerate(cards):
                if current.get("character") == target:
                    cards[index] = updated
                    by_character[target] = updated
                    break
            changed.append(override)
        else:
            already_applied.append(target)
    evaluation = fresh_validation(cards)
    result: dict[str, Any] = {
        "write": write,
        "ledger": {"path": repo_path(LEDGER_PATH), "sha256": ledger_hash},
        "changed": [entry["character"] for entry in changed],
        "already_applied": already_applied,
        "proposed_not_applied": proposed,
        "formal_validation": {
            "count": evaluation["count"],
            "invalid_count": evaluation["invalid_count"],
        },
    }
    if not changed:
        result["published"] = False
        return result
    documents = build_release_documents(
        corpus,
        cards,
        evaluation,
        ledger_hash=ledger_hash,
        changed=changed,
    )
    result["new_projection_hash"] = documents[CORPUS_PATH][0]["gpt56_expedited_release"]["materialized_card_projection_hash"]
    result["published"] = bool(write)
    result["outputs"] = {repo_path(path): "minified" if compact else "pretty" for path, (_, compact) in documents.items()}
    if write:
        complete.publish_json_artifacts(documents)
        # Reload the materialized set after the atomic rename, not the in-memory
        # documents, so a future refactor cannot accidentally report success for
        # data that was not actually installed.
        reloaded = load_object(CORPUS_PATH, "published mnemonic corpus")
        reloaded_cards = reloaded.get("mnemonics")
        if not isinstance(reloaded_cards, list):
            raise EditorialOverrideError("published mnemonic corpus lacks mnemonics")
        reloaded_eval = load_object(EVAL_PATH, "published mnemonic evaluation")
        reloaded_index = load_object(COMPONENT_INDEX_PATH, "published component index")
        if len(reloaded_cards) != EXPECTED_CARD_COUNT or reloaded_eval.get("invalid_count") != 0:
            raise EditorialOverrideError("published editorial artifacts failed post-write verification")
        if reloaded_index.get("source_corpus_hash") != complete.semantic_mnemonic_corpus_hash(reloaded_cards):
            raise EditorialOverrideError("published component index does not match corpus")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--character", metavar="CHAR", help="show the current card and hint for CHAR")
    action.add_argument("--component", metavar="CHAR", help="show every mnemonic using component CHAR")
    parser.add_argument("--check", action="store_true", help="validate all approved ledger edits without writing")
    parser.add_argument("--apply", action="store_true", help="publish approved ledger edits to local static artifacts")
    args = parser.parse_args()
    try:
        if args.component:
            print(json.dumps(lookup_component(one_codepoint(args.component, "--component")), ensure_ascii=False, indent=2))
            return
        if args.character and not args.apply and not args.check:
            print(json.dumps(lookup_card(one_codepoint(args.character, "--character")), ensure_ascii=False, indent=2))
            return
        # With --apply, --character intentionally scopes publication to one
        # card.  Without a character, all approved overrides are checked/applied.
        character = one_codepoint(args.character, "--character") if args.character else None
        print(json.dumps(check_or_apply(character=character, write=args.apply), ensure_ascii=False, indent=2))
    except EditorialOverrideError as exc:
        parser.exit(2, f"error: {exc}\n")


if __name__ == "__main__":
    main()
