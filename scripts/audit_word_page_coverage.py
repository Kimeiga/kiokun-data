#!/usr/bin/env python3
"""Audit deterministic samples of publishable source headwords on kiokun.com."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import sys
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = (
    ROOT / "reports" / "word-pages" / "source-headword-coverage-2026-07-28.json"
)
DEFAULT_SEED = 20260728
DEFAULT_SAMPLE_SIZE = 50
DEFAULT_BASE_URL = "https://kiokun.com"


class WordCoverageAuditError(RuntimeError):
    """Raised when a source dictionary cannot provide an auditable headword pool."""


def is_hangul_initial(term: str) -> bool:
    """Match the KRDICT acceptance rule used by the Rust loader."""
    if not term:
        return False
    codepoint = ord(term[0])
    return (
        0xAC00 <= codepoint <= 0xD7AF
        or 0x1100 <= codepoint <= 0x11FF
        or 0x3130 <= codepoint <= 0x318F
    )


def unique_nonempty(values: Iterable[str]) -> list[str]:
    return sorted({value for value in values if isinstance(value, str) and value})


def load_chinese_headwords(
    path: Path = ROOT / "data" / "chinese_dictionary_word_2025-06-25.jsonl",
) -> list[str]:
    headwords: list[str] = []
    with path.open(encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            try:
                entry = json.loads(line)
            except json.JSONDecodeError as exc:
                raise WordCoverageAuditError(
                    f"{path}:{line_number}: invalid JSON: {exc}"
                ) from exc
            headword = entry.get("trad") or entry.get("simp")
            if isinstance(headword, str) and headword:
                headwords.append(headword)
    result = unique_nonempty(headwords)
    if not result:
        raise WordCoverageAuditError(f"{path}: no Chinese headwords found")
    return result


def japanese_primary_form(word: dict[str, Any]) -> str | None:
    """Return the same primary source form used when the Rust merger chooses a key."""
    kanji = word.get("kanji")
    if isinstance(kanji, list) and kanji:
        text = kanji[0].get("text") if isinstance(kanji[0], dict) else None
        if isinstance(text, str) and text:
            return text
    kana = word.get("kana")
    if isinstance(kana, list) and kana:
        text = kana[0].get("text") if isinstance(kana[0], dict) else None
        if isinstance(text, str) and text:
            return text
    return None


def load_japanese_headwords(
    path: Path = ROOT / "data" / "jmdict-examples-eng-3.6.1.json",
) -> list[str]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise WordCoverageAuditError(f"{path}: cannot load JMdict: {exc}") from exc
    words = payload.get("words")
    if not isinstance(words, list):
        raise WordCoverageAuditError(f"{path}: JMdict words must be a list")
    result = unique_nonempty(
        form
        for word in words
        if isinstance(word, dict)
        for form in [japanese_primary_form(word)]
        if form is not None
    )
    if not result:
        raise WordCoverageAuditError(f"{path}: no Japanese headwords found")
    return result


def load_krdict_rows(
    directory: Path = ROOT / "data" / "krdict-en",
) -> list[list[Any]]:
    paths = sorted(directory.glob("term_bank_*.json"))
    if not paths:
        raise WordCoverageAuditError(f"{directory}: no KRDICT term banks found")
    rows: list[list[Any]] = []
    for path in paths:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise WordCoverageAuditError(f"{path}: cannot load term bank: {exc}") from exc
        if not isinstance(payload, list):
            raise WordCoverageAuditError(f"{path}: term bank must be a list")
        rows.extend(row for row in payload if isinstance(row, list) and len(row) >= 7)
    return rows


def load_korean_headwords(rows: Iterable[list[Any]]) -> list[str]:
    """Return only Hangul rows accepted as publishable headwords by the loader."""
    return unique_nonempty(
        row[0]
        for row in rows
        if isinstance(row[0], str) and is_hangul_initial(row[0])
    )


def krdict_index_summary(rows: Iterable[list[Any]]) -> dict[str, int]:
    """Describe why raw KRDICT index rows are not all publishable URL keys."""
    raw_terms = [row[0] for row in rows if isinstance(row[0], str) and row[0]]
    accepted = [term for term in raw_terms if is_hangul_initial(term)]
    excluded = [term for term in raw_terms if not is_hangul_initial(term)]
    return {
        "raw_index_rows": len(raw_terms),
        "raw_unique_terms": len(set(raw_terms)),
        "publishable_hangul_rows": len(accepted),
        "publishable_unique_headwords": len(set(accepted)),
        "alternate_index_rows_excluded_by_loader": len(excluded),
        "alternate_unique_index_terms_excluded_by_loader": len(set(excluded)),
    }


def krdict_loader_summary(rows: Iterable[list[Any]]) -> dict[str, Any]:
    """Expose source properties that can silently collapse Korean homonyms."""
    accepted_rows = [
        row
        for row in rows
        if isinstance(row[0], str) and is_hangul_initial(row[0])
    ]
    exact_rows = {
        json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        for row in accepted_rows
    }
    term_counts: dict[str, int] = {}
    for row in accepted_rows:
        term_counts[row[0]] = term_counts.get(row[0], 0) + 1
    sequences = sorted(
        {
            row[6]
            for row in accepted_rows
            if isinstance(row[6], (int, str))
        },
        key=str,
    )
    return {
        "accepted_rows": len(accepted_rows),
        "exact_duplicate_rows": len(accepted_rows) - len(exact_rows),
        "rows_after_exact_deduplication": len(exact_rows),
        "headwords_with_multiple_source_rows": sum(
            count > 1 for count in term_counts.values()
        ),
        "maximum_rows_for_one_headword": max(term_counts.values(), default=0),
        "sequence_values": sequences,
        "finding": (
            "The Yomitan sequence column is constant and cannot identify entries. "
            "Deduplicating by headword plus sequence collapses real homonyms."
        ),
        "remediation": (
            "Deduplicate exact rows, assign stable bank-and-row IDs, retain ambiguous "
            "Hangul homonyms together, and redirect only unambiguous forms."
        ),
    }


def deterministic_sample(
    values: Iterable[str],
    *,
    language: str,
    seed: int = DEFAULT_SEED,
    sample_size: int = DEFAULT_SAMPLE_SIZE,
) -> list[str]:
    unique = unique_nonempty(values)
    if len(unique) < sample_size:
        raise WordCoverageAuditError(
            f"{language}: requested {sample_size} headwords from a pool of {len(unique)}"
        )

    def sample_rank(value: str) -> bytes:
        material = f"{seed}\0{language}\0{value}".encode("utf-8")
        return hashlib.sha256(material).digest()

    return sorted(unique, key=lambda value: (sample_rank(value), value))[:sample_size]


def fetch_status(
    headword: str,
    *,
    base_url: str = DEFAULT_BASE_URL,
    timeout: float = 20,
) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}/{quote(headword, safe='')}"
    request = Request(
        url,
        headers={
            "User-Agent": "kiokun-source-headword-coverage-audit/1.0",
            "Accept": "text/html",
        },
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            status = response.status
            final_url = response.geturl()
    except HTTPError as exc:
        status = exc.code
        final_url = exc.geturl()
    except (URLError, TimeoutError, OSError) as exc:
        return {
            "headword": headword,
            "url": url,
            "status": None,
            "error": str(exc),
        }
    result: dict[str, Any] = {
        "headword": headword,
        "url": url,
        "status": status,
    }
    if final_url != url:
        result["final_url"] = final_url
    return result


def audit_language(
    language: str,
    headwords: list[str],
    *,
    seed: int,
    sample_size: int,
    base_url: str,
    workers: int,
) -> dict[str, Any]:
    sample = deterministic_sample(
        headwords,
        language=language,
        seed=seed,
        sample_size=sample_size,
    )
    results: dict[str, dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(fetch_status, headword, base_url=base_url): headword
            for headword in sample
        }
        for future in as_completed(futures):
            headword = futures[future]
            results[headword] = future.result()
    ordered_results = [results[headword] for headword in sample]
    failures = [result for result in ordered_results if result.get("status") != 200]
    return {
        "source_pool_count": len(headwords),
        "requested": len(sample),
        "http_200": len(sample) - len(failures),
        "failures": failures,
        "sample": ordered_results,
    }


def build_report(
    *,
    seed: int,
    sample_size: int,
    base_url: str,
    workers: int,
) -> dict[str, Any]:
    krdict_rows = load_krdict_rows()
    pools = {
        "chinese": load_chinese_headwords(),
        "japanese": load_japanese_headwords(),
        "korean": load_korean_headwords(krdict_rows),
    }
    return {
        "schema_version": 1,
        "created_at": "2026-07-28",
        "seed": seed,
        "sampling": {
            "method": (
                "Take the lowest SHA-256 ranks of "
                "seed + language + canonical source headword."
            ),
            "sample_size_per_language": sample_size,
            "base_url": base_url,
        },
        "source_contract": {
            "chinese": "traditional form, falling back to simplified",
            "japanese": "first JMdict kanji form, falling back to first kana form",
            "korean": (
                "Hangul-initial KRDICT rows accepted by load_korean_dictionary; "
                "Hanja and mixed-script Yomitan index rows are alternate lookup keys"
            ),
        },
        "krdict_index_summary": krdict_index_summary(krdict_rows),
        "krdict_loader_summary": krdict_loader_summary(krdict_rows),
        "languages": {
            language: audit_language(
                language,
                headwords,
                seed=seed,
                sample_size=sample_size,
                base_url=base_url,
                workers=workers,
            )
            for language, headwords in pools.items()
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--sample-size", type=int, default=DEFAULT_SAMPLE_SIZE)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--output", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()

    try:
        report = build_report(
            seed=args.seed,
            sample_size=args.sample_size,
            base_url=args.base_url,
            workers=args.workers,
        )
    except WordCoverageAuditError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    for language, result in report["languages"].items():
        print(
            f"{language}: {result['http_200']}/{result['requested']} HTTP 200; "
            f"{len(result['failures'])} failures"
        )
    print(f"report: {args.output}")
    return 1 if any(
        result["failures"] for result in report["languages"].values()
    ) else 0


if __name__ == "__main__":
    raise SystemExit(main())
