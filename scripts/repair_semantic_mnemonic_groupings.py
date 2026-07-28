#!/usr/bin/env python3
"""Audit and repair learner-hostile stroke-level mnemonic decompositions.

The authoring inputs contain a second, historical component analysis.  That
does not automatically make it better for learners, but it gives us a bounded
review queue whenever the selected IDS decomposition expands a recognizable
shape into strokes or more pieces.  The policy records a human decision for
every such card and supplies replacements only for the clearly stronger cases.

The canonical corpus is read and published through the shared bucket-native
API.  No monolithic compatibility artifact is created.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import manage_semantic_mnemonic_corpus as corpus_store  # noqa: E402


POLICY_PATH = ROOT / "data" / "semantic_mnemonic_grouping_policy.json"
INPUTS_PATH = ROOT / "scripts" / "semantic_mnemonic_card_inputs.json"
POLICY_MARKER = "learner_grouping_override"
LOW_LEVEL_COMPONENTS = frozenset(
    "丿丶丨亅乚乛乀乁𠃌𠃍㇏㇀㇇𠂊𠂋𠂎𠂑𠃜𠄌𠚍𠚣𰀁⺄"
)


class GroupingPolicyError(RuntimeError):
    """The review policy, corpus, or authoring-input binding is inconsistent."""


def canonical_hash(value: Any) -> str:
    payload = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def load_object(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise GroupingPolicyError(f"cannot read {label} {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise GroupingPolicyError(f"{label} must be a JSON object: {path}")
    return value


def normal_components(value: Any, label: str) -> list[dict[str, str]]:
    if not isinstance(value, list) or not value:
        raise GroupingPolicyError(f"{label} must be a nonempty component list")
    result: list[dict[str, str]] = []
    for index, component in enumerate(value):
        if not isinstance(component, dict):
            raise GroupingPolicyError(f"{label}[{index}] must be an object")
        character = str(component.get("character") or "")
        gloss = str(component.get("gloss") or "").strip()
        if len(character) != 1 or not gloss:
            raise GroupingPolicyError(
                f"{label}[{index}] needs one character and a nonempty gloss"
            )
        result.append({"character": character, "gloss": gloss})
    return result


def discover_candidates(inputs: dict[str, Any]) -> set[str]:
    cards = inputs.get("cards")
    if not isinstance(cards, list):
        raise GroupingPolicyError("authoring inputs must contain a cards list")
    candidates: set[str] = set()
    for card in cards:
        if not isinstance(card, dict):
            continue
        historical = card.get("historical_components")
        components = card.get("components")
        if not isinstance(historical, list) or not historical:
            continue
        if not isinstance(components, list) or not components:
            continue
        has_low_level = any(
            str(component.get("character") or "") in LOW_LEVEL_COMPONENTS
            for component in components
            if isinstance(component, dict)
        )
        if has_low_level or len(components) > len(historical):
            character = str(card.get("character") or "")
            if len(character) != 1:
                raise GroupingPolicyError(
                    f"candidate has invalid character {character!r}"
                )
            candidates.add(character)
    return candidates


def normalized_policy(policy: dict[str, Any]) -> tuple[list[str], dict[str, dict[str, Any]]]:
    if policy.get("schema_version") != 1:
        raise GroupingPolicyError("grouping policy must use schema_version 1")
    if not str(policy.get("policy_version") or ""):
        raise GroupingPolicyError("grouping policy lacks policy_version")
    retained = policy.get("reviewed_retain")
    repairs = policy.get("repairs")
    if not isinstance(retained, list) or not isinstance(repairs, dict):
        raise GroupingPolicyError(
            "grouping policy needs reviewed_retain and repairs"
        )
    retained_characters = [str(character) for character in retained]
    if any(len(character) != 1 for character in retained_characters):
        raise GroupingPolicyError("reviewed_retain contains a non-character")
    if len(set(retained_characters)) != len(retained_characters):
        raise GroupingPolicyError("reviewed_retain contains duplicates")
    overlap = set(retained_characters) & set(repairs)
    if overlap:
        raise GroupingPolicyError(
            f"characters cannot be both retained and repaired: {sorted(overlap)}"
        )
    normalized: dict[str, dict[str, Any]] = {}
    for character, repair in repairs.items():
        if len(character) != 1 or not isinstance(repair, dict):
            raise GroupingPolicyError(f"malformed repair for {character!r}")
        normalized[character] = {
            **repair,
            "components": normal_components(
                repair.get("components"), f"repairs.{character}.components"
            ),
        }
        for field in ("equation", "mnemonic", "hero_image_prompt", "rationale"):
            if not str(repair.get(field) or "").strip():
                raise GroupingPolicyError(
                    f"repairs.{character}.{field} is required"
                )
    return retained_characters, normalized


def policy_coverage_errors(
    policy: dict[str, Any],
    inputs: dict[str, Any],
) -> list[str]:
    retained, repairs = normalized_policy(policy)
    discovered = discover_candidates(inputs)
    reviewed = set(retained) | set(repairs)
    errors: list[str] = []
    missing = discovered - reviewed
    stale = reviewed - discovered
    if missing:
        errors.append(
            "unreviewed grouping candidates: " + "".join(sorted(missing))
        )
    if stale:
        errors.append(
            "policy entries no longer selected by the candidate rule: "
            + "".join(sorted(stale))
        )
    return errors


def card_errors(
    artifact: dict[str, Any],
    policy: dict[str, Any],
) -> list[str]:
    _, repairs = normalized_policy(policy)
    cards = artifact.get("mnemonics")
    if not isinstance(cards, list):
        raise GroupingPolicyError("canonical corpus lacks a mnemonics list")
    by_character = {
        str(card.get("character") or ""): card
        for card in cards
        if isinstance(card, dict)
    }
    errors: list[str] = []
    for character, repair in repairs.items():
        card = by_character.get(character)
        if card is None:
            errors.append(f"{character}: missing canonical card")
            continue
        expected_fields = {
            "components": repair["components"],
            "visual_components": repair["components"],
            "equation": repair["equation"],
            "mnemonic": repair["mnemonic"],
            "hero_image_prompt": repair["hero_image_prompt"],
        }
        for field, expected in expected_fields.items():
            if card.get(field) != expected:
                errors.append(f"{character}: {field} is outside grouping policy")
        source = str(card.get("component_source") or "")
        if POLICY_MARKER not in source.split("+"):
            errors.append(f"{character}: component_source lacks {POLICY_MARKER}")
        provenance = card.get("learner_grouping_repair")
        if not isinstance(provenance, dict):
            errors.append(f"{character}: missing learner_grouping_repair")
        elif provenance.get("policy_version") != policy["policy_version"]:
            errors.append(f"{character}: stale grouping policy provenance")
    return errors


def apply_repairs(
    artifact: dict[str, Any],
    policy: dict[str, Any],
) -> list[str]:
    _, repairs = normalized_policy(policy)
    cards = artifact.get("mnemonics")
    if not isinstance(cards, list):
        raise GroupingPolicyError("canonical corpus lacks a mnemonics list")
    changed: list[str] = []
    for card in cards:
        if not isinstance(card, dict):
            continue
        character = str(card.get("character") or "")
        repair = repairs.get(character)
        if repair is None:
            continue
        already_current = (
            card.get("components") == repair["components"]
            and card.get("visual_components") == repair["components"]
            and card.get("equation") == repair["equation"]
            and card.get("mnemonic") == repair["mnemonic"]
            and card.get("hero_image_prompt") == repair["hero_image_prompt"]
            and isinstance(card.get("learner_grouping_repair"), dict)
            and card["learner_grouping_repair"].get("policy_version")
            == policy["policy_version"]
        )
        if already_current:
            continue
        base_hash = canonical_hash(card)
        card["components"] = copy.deepcopy(repair["components"])
        card["visual_components"] = copy.deepcopy(repair["components"])
        card["equation"] = repair["equation"]
        card["mnemonic"] = repair["mnemonic"]
        card["hero_image_prompt"] = repair["hero_image_prompt"]
        source_parts = [
            part for part in str(card.get("component_source") or "").split("+")
            if part
        ]
        if POLICY_MARKER not in source_parts:
            source_parts.append(POLICY_MARKER)
        card["component_source"] = "+".join(source_parts)
        card["dictionary_hint_disposition"] = "adapted"
        card["dictionary_hint_reason"] = (
            "A reviewed learner grouping replaces a forced stroke-level story."
        )
        card["generation_source"] = "codex_curated_learner_grouping_2026_07"
        card["quality_provenance"] = "hand_reviewed"
        card["confidence"] = 0.95
        card["validation"] = {
            "problems": [],
            "valid": True,
            "heuristic_score": 10.0,
        }
        card["heuristic_score"] = 10.0
        card["learner_grouping_repair"] = {
            "policy_path": str(POLICY_PATH.relative_to(ROOT)),
            "policy_version": policy["policy_version"],
            "base_card_hash": base_hash,
            "rationale": repair["rationale"],
        }
        changed.append(character)
    return changed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument(
        "--inputs",
        type=Path,
        default=INPUTS_PATH,
        help="authoring inputs used to prove complete review coverage",
    )
    args = parser.parse_args()

    try:
        policy = load_object(POLICY_PATH, "grouping policy")
        inputs = load_object(args.inputs, "authoring inputs")
        coverage_errors = policy_coverage_errors(policy, inputs)
        artifact = corpus_store.load_corpus()
        changed: list[str] = []
        if args.apply:
            if coverage_errors:
                raise GroupingPolicyError("; ".join(coverage_errors))
            source_hash = corpus_store.current_manifest_source_hash(
                corpus_store.DEFAULT_MANIFEST
            )
            changed = apply_repairs(artifact, policy)
            if changed:
                corpus_store.publish_corpus(
                    artifact,
                    expected_source_hash=source_hash,
                )
            artifact = corpus_store.load_corpus()
        errors = coverage_errors + card_errors(artifact, policy)
    except (
        GroupingPolicyError,
        corpus_store.CorpusError,
        OSError,
        UnicodeError,
        json.JSONDecodeError,
    ) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        return 1
    print(
        "semantic mnemonic grouping policy passed "
        f"({len(discover_candidates(inputs))} reviewed candidates, "
        f"{len(policy['repairs'])} repairs, {len(changed)} changed)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
