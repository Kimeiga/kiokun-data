#!/usr/bin/env python3
"""Materialize an explicitly non-certified, expedited GPT-5.6 mnemonic release.

This is deliberately separate from the normal full-corpus release applier.
The product owner explicitly authorized an expedited best-available release,
while the normal 19,537-card second pass and whole-corpus QA remain pending.

The script still fails closed on the evidence that *is* available: it replays
the signed recovery7 quality-mandatory manifest, all eight author shards, and
the completed protected A/B gate.  Gate-promoted mnemonics are materialized;
gate-restored rows receive a focused, structurally validated label repair so
the learner-facing corpus never ships known-invalid component pairs.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import author_semantic_mnemonics_gpt56 as author  # noqa: E402
import audit_semantic_mnemonics as quality_audit  # noqa: E402
import complete_semantic_mnemonics_all as complete  # noqa: E402
import verify_gpt56_quarantine as verifier  # noqa: E402


EXPECTED_FULL_CORPUS_COUNT = 24_037
EXPEDITED_RELEASE_CONTRACT_VERSION = "2026-07-19.1"
EXPEDITED_CERTIFICATION_STATUS = "expedited_non_certified"
EXPEDITED_PENDING_PROVENANCE = "gpt56_quality_ledger_pending_mandatory_verification"


class ExpeditedReleaseError(RuntimeError):
    """The requested expedited materialization is incomplete or misleading."""


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
    path = path.resolve()
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def lineage(path: Path) -> dict[str, str]:
    path = path.resolve()
    if not path.is_file():
        raise ExpeditedReleaseError(f"missing release evidence: {path}")
    return {"path": repo_path(path), "sha256": sha256_path(path)}


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise ExpeditedReleaseError(f"cannot read JSON artifact {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ExpeditedReleaseError(f"JSON artifact must be an object: {path}")
    return value


def card_projection_hash(cards: Iterable[dict[str, Any]]) -> str:
    return sha256_value([
        {
            "character": str(card.get("character") or ""),
            "card_hash": sha256_value(card),
        }
        for card in cards
    ])


def _selection_gate_summary(selection: dict[str, Any]) -> dict[str, Any]:
    gate = selection.get("gate_record") or {}
    review = (selection.get("second_pass_record") or {}).get("review") or {}
    return {
        "selected_origin": selection.get("selected_origin"),
        "protected_gate_decision": gate.get("decision"),
        "protected_gate_decision_reason": gate.get("decision_reason"),
        "protected_gate_record_hash": gate.get("record_hash"),
        "second_pass_record_hash": review.get("record_hash"),
    }


def _refresh(card: dict[str, Any]) -> dict[str, Any]:
    # The quality-ledger base is already the authoritative semantic-card
    # projection.  Do not pass it through the older completion builder's
    # gloss sanitiser here: that builder can normalize a target such as
    # ``an ox walking slowly`` and make an otherwise exact current card look
    # stale.  ``validate_card`` needs the current canonical semantic fields,
    # not a regenerated decomposition.
    return complete.refresh_validation(card, copy.deepcopy(card))


def _validate_repair_record(
    record: dict[str, Any],
    source_card: dict[str, Any],
) -> dict[str, Any]:
    character = str(source_card.get("character") or "")
    model = "codex:gpt-5.6-sol"
    reasoning_effort = "high"
    contract_hash = author.gpt56_author_contract_hash(model, reasoning_effort)
    try:
        author.validate_stored_gpt56_review(
            record,
            source_card,
            model=model,
            reasoning_effort=reasoning_effort,
            contract_hash=contract_hash,
        )
    except Exception as exc:
        raise ExpeditedReleaseError(
            f"{character}: focused restore repair does not replay: {exc}"
        ) from exc
    review = record.get("review") or {}
    mnemonic = str(record.get("mnemonic") or "").strip()
    if review.get("decision") != "rewrite" or not mnemonic:
        raise ExpeditedReleaseError(
            f"{character}: focused restore repair must be a nonempty rewrite"
        )
    candidate = copy.deepcopy(source_card)
    candidate["mnemonic"] = mnemonic
    candidate["quality_provenance"] = "gpt56_expedited_gate_restore_label_repair"
    _refresh(candidate)
    if not (candidate.get("validation") or {}).get("valid"):
        raise ExpeditedReleaseError(
            f"{character}: focused restore repair remains invalid: "
            f"{(candidate.get('validation') or {}).get('problems')}"
        )
    return copy.deepcopy(record)


def load_repair_records(
    path: Path,
    *,
    source_by_character: dict[str, dict[str, Any]],
    expected_characters: set[str],
) -> dict[str, dict[str, Any]]:
    artifact = load_json(path)
    records = artifact.get("reviews")
    if not isinstance(records, list):
        raise ExpeditedReleaseError("focused repair artifact lacks reviews")
    by_character: dict[str, dict[str, Any]] = {}
    for record in records:
        if not isinstance(record, dict):
            raise ExpeditedReleaseError("focused repair artifact has a non-object review")
        character = str(record.get("character") or "")
        if not character or character in by_character:
            raise ExpeditedReleaseError(
                f"focused repair artifact has duplicate/empty character {character!r}"
            )
        source = source_by_character.get(character)
        if source is None:
            raise ExpeditedReleaseError(
                f"focused repair artifact contains non-source character {character}"
            )
        by_character[character] = _validate_repair_record(record, source)
    if set(by_character) != expected_characters:
        missing = sorted(expected_characters.difference(by_character))
        extra = sorted(set(by_character).difference(expected_characters))
        raise ExpeditedReleaseError(
            "focused repair character coverage mismatch: "
            f"missing={missing[:12]} extra={extra[:12]}"
        )
    return by_character


def _expedited_component_uses(cards: list[dict[str, Any]]) -> dict[str, Any]:
    """Build the normal reverse index, retaining explicit variant evidence.

    The older index builder rejects post-ledger scoped glosses that are valid in
    the current card corpus but absent from its frozen exception table.  This
    output retains every variant visibly rather than discarding or flattening
    it, so no stale index claims to describe the expedited corpus.
    """

    uses: dict[str, list[dict[str, Any]]] = {}
    card_details: dict[str, dict[str, str]] = {}
    for card in cards:
        target = str(card.get("character") or "")
        if not target or target in card_details:
            raise ExpeditedReleaseError(f"component index duplicate/empty card {target!r}")
        card_details[target] = {
            "meaning": str(card.get("meaning") or ""),
            "equation": str(card.get("equation") or ""),
            "mnemonic": str(card.get("mnemonic") or ""),
            "component_source": str(card.get("component_source") or ""),
        }
        grouped: dict[str, dict[str, Any]] = {}
        for position, component in enumerate(
            card.get("visual_components") or card.get("components") or [], start=1,
        ):
            component_char = str(component.get("character") or "")
            gloss = str(component.get("gloss") or "")
            if not component_char:
                continue
            row = grouped.setdefault(component_char, {
                "character": target,
                "meaning": str(card.get("meaning") or ""),
                "component_gloss": gloss,
                "occurrences": 0,
                "positions": [],
            })
            if row["component_gloss"] != gloss:
                raise ExpeditedReleaseError(
                    f"mixed repeated component glosses for {component_char} in {target}"
                )
            row["occurrences"] += 1
            row["positions"].append(position)
        review = (
            card.get("gpt56_quality_mandatory_author_review")
            or card.get("gpt56_expedited_restore_repair", {}).get("review")
            or card.get("gpt56_author_review")
            or card.get("review")
            or {}
        )
        for component_char, row in grouped.items():
            exception = complete.scoped_component_gloss_exception(
                target, component_char, str(row["component_gloss"]),
            )
            if exception:
                row["gloss_exception"] = exception
            if isinstance(review, dict):
                row["quality_score"] = review.get("quality_score")
                row["review_confidence"] = review.get("review_confidence")
                row["review_status"] = review.get("status")
            uses.setdefault(component_char, []).append(row)

    components: dict[str, dict[str, Any]] = {}
    variant_components: list[str] = []
    for component_char, rows in sorted(uses.items(), key=lambda item: (ord(item[0]), item[0])):
        rows = sorted(rows, key=lambda row: str(row["character"]))
        gloss_counts = Counter({})
        for row in rows:
            gloss_counts[str(row["component_gloss"])] += int(row["occurrences"])
        policy = complete.effective_component_gloss_policy(component_char)
        noncanonical = sorted(
            gloss for gloss in gloss_counts if gloss != policy["canonical_gloss"]
        )
        record: dict[str, Any] = {
            "count": len(rows),
            "card_count": len(rows),
            "occurrence_count": sum(gloss_counts.values()),
            "gloss_counts": dict(sorted(gloss_counts.items())),
            **policy,
            "mnemonics": rows,
        }
        exceptions = [row["gloss_exception"] for row in rows if row.get("gloss_exception")]
        if exceptions:
            record["scoped_exceptions"] = exceptions
        if noncanonical:
            record["expedited_noncertified_gloss_variants"] = noncanonical
            variant_components.append(component_char)
        components[component_char] = record
    return {
        "created_at": utc_now(),
        "schema_version": 2,
        "source_corpus_hash": complete.semantic_mnemonic_corpus_hash(cards),
        "position_base": 1,
        "card_count": len(cards),
        "component_count": len(uses),
        "cards": dict(sorted(card_details.items())),
        "components": components,
        "gpt56_expedited_release": {
            "certification_status": EXPEDITED_CERTIFICATION_STATUS,
            "variant_component_count": len(variant_components),
            "variant_components": variant_components,
            "rule": (
                "Scoped post-ledger component-gloss variants are retained as "
                "visible evidence instead of being rejected by the legacy index policy."
            ),
        },
    }


def build_expedited_release(
    *,
    applied_path: Path,
    merged_path: Path,
    manifest_path: Path,
    author_paths: list[Path],
    gate_path: Path,
    repair_path: Path,
    execution_lock_path: Path,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any], dict[str, Any]]:
    """Return corpus, evaluation, audit, index, and release receipt in memory."""

    inputs = verifier.prepare_verifier_inputs(
        applied_path=applied_path,
        merged_path=merged_path,
        manifest_path=manifest_path,
        author_artifact_paths=author_paths,
        protected_gate_path=gate_path,
    )
    source_artifact = load_json(applied_path)
    source_cards = inputs["source_cards"]
    if (
        len(source_cards) != EXPECTED_FULL_CORPUS_COUNT
        or source_artifact.get("count") != EXPECTED_FULL_CORPUS_COUNT
        or len({str(card.get("character") or "") for card in source_cards})
        != EXPECTED_FULL_CORPUS_COUNT
    ):
        raise ExpeditedReleaseError("expedited release base is not a complete 24,037-card corpus")
    cards = copy.deepcopy(source_cards)
    source_by_character = {str(card["character"]): card for card in source_cards}
    cards_by_character = {str(card["character"]): card for card in cards}
    selections = inputs["selections"]
    target_characters = {str(selection["character"]) for selection in selections}
    expected_pending = {
        str(card.get("character") or "")
        for card in source_cards
        if card.get("quality_provenance") == EXPEDITED_PENDING_PROVENANCE
    }
    if target_characters != expected_pending or len(target_characters) != 416:
        raise ExpeditedReleaseError(
            "quality-mandatory selection does not exactly cover the pending 416-card base"
        )
    origin_counts = Counter(str(selection.get("selected_origin") or "") for selection in selections)
    expected_origins = {
        "second_pass_keep": 340,
        "gate_promoted_candidate": 38,
        "gate_restored_required_rewrite_source": 38,
    }
    if dict(origin_counts) != expected_origins:
        raise ExpeditedReleaseError(
            f"unexpected recovery7 selection split: {dict(origin_counts)}"
        )
    repair_characters = {
        str(selection["character"])
        for selection in selections
        if selection.get("selected_origin") == "gate_restored_required_rewrite_source"
    }
    repair_records = load_repair_records(
        repair_path,
        source_by_character=source_by_character,
        expected_characters=repair_characters,
    )

    promoted_characters: list[str] = []
    repaired_characters: list[str] = []
    frozen_characters: list[str] = []
    selection_audit: dict[str, dict[str, Any]] = {}
    for selection in selections:
        character = str(selection["character"])
        card = cards_by_character[character]
        source = source_by_character[character]
        origin = str(selection["selected_origin"])
        audit = _selection_gate_summary(selection)
        if origin == "gate_promoted_candidate":
            option = selection["selected_option"]
            if (
                option.get("hero_image_prompt") != source.get("hero_image_prompt")
                or option.get("mnemonic") == source.get("mnemonic")
            ):
                raise ExpeditedReleaseError(
                    f"{character}: gate promotion is not a mnemonic-only source-bound change"
                )
            card["mnemonic"] = str(option["mnemonic"])
            card["generation_source"] = "gpt56_expedited_gate_promoted"
            card["quality_provenance"] = "gpt56_expedited_gate_promoted_noncertified"
            card["gpt56_quality_mandatory_author_review"] = copy.deepcopy(
                (selection.get("second_pass_record") or {}).get("review") or {}
            )
            review = card["gpt56_quality_mandatory_author_review"]
            card["quality_score"] = review.get("quality_score")
            card["review_confidence"] = review.get("review_confidence")
            promoted_characters.append(character)
        elif origin == "gate_restored_required_rewrite_source":
            repair = repair_records[character]
            card["mnemonic"] = str(repair["mnemonic"])
            # Preserve the source hero: the focused repair changes only prose
            # labels, and its model hero is not an independently promoted field.
            card["generation_source"] = "gpt56_expedited_gate_restore_label_repair"
            card["quality_provenance"] = "gpt56_expedited_gate_restore_label_repair"
            card["gpt56_expedited_restore_repair"] = copy.deepcopy(repair)
            review = repair.get("review") or {}
            card["quality_score"] = review.get("quality_score")
            card["review_confidence"] = review.get("review_confidence")
            audit["focused_restore_repair_record_hash"] = review.get("record_hash")
            repaired_characters.append(character)
        elif origin == "second_pass_keep":
            option = selection["selected_option"]
            if (
                option.get("mnemonic") != source.get("mnemonic")
                or option.get("hero_image_prompt") != source.get("hero_image_prompt")
            ):
                raise ExpeditedReleaseError(
                    f"{character}: frozen quality target is not an exact source keep"
                )
            card["quality_provenance"] = "gpt56_expedited_quality_ledger_content_frozen"
            frozen_characters.append(character)
        else:
            raise ExpeditedReleaseError(f"{character}: unknown selected origin {origin!r}")
        card["gpt56_expedited_gate_selection"] = audit
        selection_audit[character] = copy.deepcopy(audit)

    if len(promoted_characters) != 38 or len(repaired_characters) != 38 or len(frozen_characters) != 340:
        raise ExpeditedReleaseError("expedited materialization did not preserve the 38/38/340 split")
    remaining_pending = [
        str(card.get("character") or "")
        for card in cards
        if card.get("quality_provenance") == EXPEDITED_PENDING_PROVENANCE
    ]
    if remaining_pending:
        raise ExpeditedReleaseError(
            f"expedited materialization left pending-provenance cards: {remaining_pending[:12]}"
        )

    for card in cards:
        _refresh(card)
    evaluation = complete.validate_artifact(cards)
    if evaluation.get("invalid_count") != 0:
        raise ExpeditedReleaseError(
            "focused repairs did not produce a formally valid full corpus: "
            f"{evaluation.get('invalid')[:12]}"
        )

    created_at = utc_now()
    gate_artifact = inputs["gate_artifact"] or {}
    release_metadata = {
        "contract_version": EXPEDITED_RELEASE_CONTRACT_VERSION,
        "certification_status": EXPEDITED_CERTIFICATION_STATUS,
        "user_authorized_policy": "explicit expedited best-available release",
        "full_corpus_qa_certified": False,
        "independent_verifier_run": False,
        "broad_19537_reauthoring_started": False,
        "broad_19537_reauthoring_note": (
            "Not started: it is a slower second-pass certification queue, not missing first-pass authorship."
        ),
        "quality_mandatory_scope": {
            "target_count": len(selections),
            "content_frozen_exact_keep_count": len(frozen_characters),
            "protected_gate_promoted_mnemonic_count": len(promoted_characters),
            "gate_restored_focused_label_repair_count": len(repaired_characters),
            "gate_restored_focused_label_repair_characters": sorted(repaired_characters),
            "gate_decision_counts": {
                "promote_candidate": int(gate_artifact.get("promote_count") or 0),
                "restore_source": int(gate_artifact.get("restore_count") or 0),
            },
            "selection_audit": selection_audit,
        },
        "base_quality_applied_artifact": lineage(applied_path),
        "merged_author_reviews": lineage(merged_path),
        "quality_mandatory_manifest": lineage(manifest_path),
        "recovery7_execution_lock": lineage(execution_lock_path),
        "protected_gate": lineage(gate_path),
        "focused_restore_repairs": lineage(repair_path),
        "second_pass_author_artifacts": [lineage(path) for path in author_paths],
        "base_card_projection_hash": card_projection_hash(source_cards),
        "materialized_card_projection_hash": card_projection_hash(cards),
        "formal_validation": {
            "count": evaluation["count"],
            "invalid_count": evaluation["invalid_count"],
        },
        "materialization_rule": (
            "Start from quality-applied; retain all 340 frozen cards exactly; use the "
            "38 protected-gate promotions; and repair only exact labels on the 38 gate-restored "
            "source stories so every published card remains formally valid."
        ),
        "certification_note": (
            "This is an expedited, explicitly non-certified publication. It is not a substitute "
            "for the 19,537-card second-pass promotion queue or whole-corpus independent QA."
        ),
    }
    artifact = copy.deepcopy(source_artifact)
    artifact["created_at"] = created_at
    artifact["mnemonics"] = cards
    artifact["source_counts"] = complete.count_sources(cards)
    artifact["full_review_count"] = 0
    artifact["full_review_batch"] = None
    artifact["full_review_note"] = (
        "Expedited, explicitly non-certified best-available release. The complete GPT-5.6 "
        "author pass and targeted quality repairs are materialized, but the separate broad "
        "second-pass and whole-corpus independent QA remain pending."
    )
    artifact["quality_patch_at"] = created_at
    artifact["quality_patch_note"] = (
        "Recovery7 protected-gate decisions and focused exact-label repairs are applied under "
        "an explicitly authorized expedited release policy; see gpt56_expedited_release."
    )
    artifact["gpt56_expedited_release"] = copy.deepcopy(release_metadata)

    quality_report = quality_audit.build_report(artifact, limit=min(2000, len(cards)))
    quality_report["gpt56_expedited_release"] = {
        "certification_status": EXPEDITED_CERTIFICATION_STATUS,
        "materialized_card_projection_hash": release_metadata["materialized_card_projection_hash"],
        "formal_validation": release_metadata["formal_validation"],
    }
    evaluation["quality_review"] = {
        "methodology": quality_report["methodology"],
        "flagged_count": quality_report["flagged_count"],
        "quality_status_counts": quality_report["quality_status_counts"],
        "flag_counts": quality_report["flag_counts"],
        "top_suspicious": quality_report["ranked"][:25],
        "full_review_count": 0,
        "certification_status": EXPEDITED_CERTIFICATION_STATUS,
    }
    evaluation["gpt56_expedited_release"] = {
        "materialized_card_projection_hash": release_metadata["materialized_card_projection_hash"],
        "formal_validation": release_metadata["formal_validation"],
    }
    component_index = _expedited_component_uses(cards)
    component_index["gpt56_expedited_release"]["materialized_card_projection_hash"] = (
        release_metadata["materialized_card_projection_hash"]
    )
    receipt = {
        "created_at": created_at,
        "gpt56_expedited_release": release_metadata,
        "static_artifact": {
            "count": len(cards),
            "materialized_card_projection_hash": release_metadata[
                "materialized_card_projection_hash"
            ],
            "component_index_source_corpus_hash": component_index["source_corpus_hash"],
        },
    }
    return artifact, evaluation, quality_report, component_index, receipt


def _verify_published(
    *,
    corpus_path: Path,
    evaluation_path: Path,
    audit_path: Path,
    component_index_path: Path,
    receipt_path: Path,
) -> None:
    corpus = load_json(corpus_path)
    cards = corpus.get("mnemonics")
    if not isinstance(cards, list) or len(cards) != EXPECTED_FULL_CORPUS_COUNT:
        raise ExpeditedReleaseError("published expedited corpus lacks complete card coverage")
    evaluation = load_json(evaluation_path)
    audit = load_json(audit_path)
    index = load_json(component_index_path)
    receipt = load_json(receipt_path)
    if complete.validate_artifact(cards).get("invalid_count") != 0:
        raise ExpeditedReleaseError("published expedited corpus failed formal replay")
    metadata = corpus.get("gpt56_expedited_release") or {}
    if (
        metadata.get("certification_status") != EXPEDITED_CERTIFICATION_STATUS
        or evaluation.get("count") != EXPECTED_FULL_CORPUS_COUNT
        or evaluation.get("invalid_count") != 0
        or audit.get("count") != EXPECTED_FULL_CORPUS_COUNT
        or index.get("source_corpus_hash") != complete.semantic_mnemonic_corpus_hash(cards)
        or receipt.get("gpt56_expedited_release") != metadata
    ):
        raise ExpeditedReleaseError("published expedited artifacts are inconsistent")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", required=True, type=Path)
    parser.add_argument("--merged-reviews", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--protected-gate", required=True, type=Path)
    parser.add_argument("--execution-lock", required=True, type=Path)
    parser.add_argument("--repair-reviews", required=True, type=Path)
    parser.add_argument("--author-artifacts", required=True, nargs="+", type=Path)
    parser.add_argument(
        "--output-corpus",
        type=Path,
        default=complete.OUTPUT_PATH,
    )
    parser.add_argument("--output-eval", type=Path, default=complete.EVAL_PATH)
    parser.add_argument("--output-audit", type=Path, default=complete.QUALITY_AUDIT_PATH)
    parser.add_argument(
        "--output-component-index",
        type=Path,
        default=complete.MNEMONIC_COMPONENT_USES_PATH,
    )
    parser.add_argument(
        "--output-receipt",
        type=Path,
        default=complete.RESEARCH_DIR / "semantic_mnemonics_all_best_available_expedited_release.json",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="transactionally replace the static artifacts after in-memory validation",
    )
    parser.add_argument(
        "--confirm-expedited-non-certified",
        action="store_true",
        help="acknowledge that this intentionally does not claim the full certification path",
    )
    args = parser.parse_args()
    if not args.confirm_expedited_non_certified:
        parser.error("--confirm-expedited-non-certified is required")
    artifact, evaluation, audit, component_index, receipt = build_expedited_release(
        applied_path=args.artifact,
        merged_path=args.merged_reviews,
        manifest_path=args.manifest,
        author_paths=list(args.author_artifacts),
        gate_path=args.protected_gate,
        repair_path=args.repair_reviews,
        execution_lock_path=args.execution_lock,
    )
    summary = {
        "write": bool(args.write),
        "count": artifact["count"],
        "invalid_count": evaluation["invalid_count"],
        "certification_status": artifact["gpt56_expedited_release"]["certification_status"],
        "quality_mandatory_scope": {
            key: value
            for key, value in artifact["gpt56_expedited_release"][
                "quality_mandatory_scope"
            ].items()
            if key != "selection_audit"
        },
        "materialized_card_projection_hash": artifact["gpt56_expedited_release"][
            "materialized_card_projection_hash"
        ],
    }
    if not args.write:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return
    documents = {
        args.output_corpus.resolve(): (artifact, True),
        args.output_eval.resolve(): (evaluation, False),
        args.output_audit.resolve(): (audit, False),
        args.output_component_index.resolve(): (component_index, True),
        args.output_receipt.resolve(): (receipt, False),
    }
    complete.publish_json_artifacts(documents)
    _verify_published(
        corpus_path=args.output_corpus.resolve(),
        evaluation_path=args.output_eval.resolve(),
        audit_path=args.output_audit.resolve(),
        component_index_path=args.output_component_index.resolve(),
        receipt_path=args.output_receipt.resolve(),
    )
    summary["outputs"] = {key: str(path) for key, path in {
        "corpus": args.output_corpus.resolve(),
        "evaluation": args.output_eval.resolve(),
        "audit": args.output_audit.resolve(),
        "component_index": args.output_component_index.resolve(),
        "receipt": args.output_receipt.resolve(),
    }.items()}
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
