#!/usr/bin/env python3
"""Validate and assemble independently AI-authored pronunciation prose."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any

import manage_pronunciation_mnemonic_corpus as corpus


ROOT = Path(__file__).resolve().parents[1]
PROPOSAL_DIR = ROOT / "reports" / "pronunciation-mnemonics" / "ai-authoring"
OUTPUT = (
    ROOT
    / "data"
    / "pronunciation_mnemonic_authoring"
    / "mnemonics.jsonl"
)
PROPOSAL_FILES = (
    "zh-rank-1-50.jsonl",
    "zh-rank-51-100-plus-xing.jsonl",
    "ja-rank-1-50.jsonl",
    "ja-rank-51-100-plus-extensions.jsonl",
)
REVIEW_FILES = {
    filename: PROPOSAL_DIR / "reviews" / filename.replace(".jsonl", "-review.json")
    for filename in PROPOSAL_FILES
}
STRATEGIES = {"phonetic_component", "integrated_sound_cue", "word_anchor"}
TEMPLATE_SCAFFOLD = re.compile(
    r"(?:\blocks? in\b|\battach .+ semantic scene\b|\breuse the scene\b|"
    r"\blives in the full lexeme\b|\banchor the native reading\b|\bpromoted because\b)",
    re.IGNORECASE,
)


class AssemblyError(RuntimeError):
    pass


def card_key(card: dict[str, Any]) -> str:
    return f"{card.get('language')}:{card.get('character')}"


def reading_key(reading: dict[str, Any]) -> tuple[str, str]:
    return reading.get("reading_type", ""), reading.get("display_reading", "")


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise AssemblyError(f"missing AI author proposal: {path}")
    values: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise AssemblyError(f"{path}:{line_number}: invalid JSON: {exc}") from exc
            if not isinstance(value, dict):
                raise AssemblyError(f"{path}:{line_number}: record must be an object")
            values.append(value)
    return values


def validate_and_assemble() -> list[dict[str, Any]]:
    current = corpus.verify_corpus(deep=False)["cards"]
    expected = {card_key(card): card for card in current}
    proposals: dict[str, dict[str, Any]] = {}
    proposal_hashes: dict[str, str] = {}

    proposal_counts: dict[str, tuple[int, int]] = {}
    for filename in PROPOSAL_FILES:
        proposal_path = PROPOSAL_DIR / filename
        proposal_hashes[filename] = hashlib.sha256(proposal_path.read_bytes()).hexdigest()
        file_proposals = load_jsonl(proposal_path)
        proposal_counts[filename] = (
            len(file_proposals),
            sum(len(proposal.get("readings") or []) for proposal in file_proposals),
        )
        for proposal in file_proposals:
            key = card_key(proposal)
            if key in proposals:
                raise AssemblyError(f"duplicate AI proposal: {key}")
            proposals[key] = proposal

    for filename, review_path in REVIEW_FILES.items():
        if not review_path.exists():
            raise AssemblyError(f"missing independent review: {review_path}")
        try:
            review = json.loads(review_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise AssemblyError(f"cannot read independent review {review_path}: {exc}") from exc
        if review.get("result") != "pass" and review.get("pass") is not True:
            raise AssemblyError(f"independent review did not pass: {review_path}")
        review_hash = str(review.get("proposal_sha256") or "").removeprefix("sha256:")
        if review_hash != proposal_hashes[filename]:
            raise AssemblyError(f"independent review is stale for {filename}")
        if review.get("contract_version") != 2:
            raise AssemblyError(f"independent review uses the wrong contract for {filename}")
        if review.get("input_commit") != "62ef8ac3483a1344a6c9259e26cf988cf0fe4380":
            raise AssemblyError(f"independent review uses the wrong input commit for {filename}")
        counts = review.get("reviewed_counts") or {}
        expected_cards, expected_readings = proposal_counts[filename]
        if counts.get("cards") != expected_cards or counts.get("readings") != expected_readings:
            raise AssemblyError(
                f"independent review counts are stale for {filename}: "
                f"expected {(expected_cards, expected_readings)}, got "
                f"{(counts.get('cards'), counts.get('readings'))}"
            )

    missing = sorted(set(expected) - set(proposals))
    unexpected = sorted(set(proposals) - set(expected))
    if missing or unexpected:
        raise AssemblyError(
            f"AI proposal coverage mismatch; missing={missing}, unexpected={unexpected}"
        )

    assembled: list[dict[str, Any]] = []
    seen_overlays: dict[str, str] = {}
    for key in sorted(expected):
        source = expected[key]
        proposal = proposals[key]
        if proposal.get("target_rank") != source.get("target_rank"):
            raise AssemblyError(f"{key}: target_rank changed")
        bridge = proposal.get("memory_bridge")
        if bridge is not None and (not isinstance(bridge, str) or not bridge.strip()):
            raise AssemblyError(f"{key}: memory_bridge must be non-empty when present")
        if bridge is not None and TEMPLATE_SCAFFOLD.search(bridge):
            raise AssemblyError(f"{key}: template-like memory_bridge: {bridge}")

        source_readings = {reading_key(reading): reading for reading in source["readings"]}
        proposed_readings = proposal.get("readings")
        if not isinstance(proposed_readings, list):
            raise AssemblyError(f"{key}: readings must be a list")
        proposed_by_key = {reading_key(reading): reading for reading in proposed_readings}
        if set(proposed_by_key) != set(source_readings) or len(proposed_by_key) != len(
            proposed_readings
        ):
            raise AssemblyError(f"{key}: reading identities changed or were duplicated")

        output_readings: list[dict[str, str]] = []
        for identity in source_readings:
            reading = proposed_by_key[identity]
            strategy = reading.get("strategy")
            overlay = reading.get("overlay")
            if strategy not in STRATEGIES:
                raise AssemblyError(f"{key} {identity}: invalid strategy")
            if not isinstance(overlay, str) or not overlay.strip():
                raise AssemblyError(f"{key} {identity}: overlay is required")
            if TEMPLATE_SCAFFOLD.search(overlay):
                raise AssemblyError(f"{key} {identity}: template-like overlay: {overlay}")
            normalized_overlay = " ".join(overlay.casefold().split())
            if normalized_overlay in seen_overlays:
                raise AssemblyError(
                    f"{key} {identity}: duplicate overlay also used by {seen_overlays[normalized_overlay]}"
                )
            seen_overlays[normalized_overlay] = f"{key} {identity}"
            if strategy == "phonetic_component" and not source_readings[identity].get(
                "phonetic_component"
            ):
                raise AssemblyError(f"{key} {identity}: invented phonetic component strategy")
            output_readings.append(
                {
                    "reading_type": identity[0],
                    "display_reading": identity[1],
                    "strategy": strategy,
                    "overlay": overlay.strip(),
                }
            )

        output: dict[str, Any] = {
            "language": source["language"],
            "character": source["character"],
            "target_rank": source.get("target_rank"),
            "readings": output_readings,
        }
        if bridge is not None:
            output["memory_bridge"] = bridge.strip()
        assembled.append(output)
    return assembled


def encoded(values: list[dict[str, Any]]) -> bytes:
    return b"".join(
        json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode(
            "utf-8"
        )
        + b"\n"
        for value in values
    )


def publish(values: list[dict[str, Any]]) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{OUTPUT.name}.", dir=OUTPUT.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(encoded(values))
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, OUTPUT)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    values = validate_and_assemble()
    result = encoded(values)
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_bytes() != result:
            raise AssemblyError(f"assembled AI authoring is stale: {OUTPUT}")
    else:
        publish(values)
    print(json.dumps({"card_count": len(values), "status": "verified" if args.check else "assembled"}))


if __name__ == "__main__":
    main()
