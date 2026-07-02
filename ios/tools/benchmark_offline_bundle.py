#!/usr/bin/env python3
"""Benchmark the Kiokun iOS offline SQLite bundle.

This is intentionally a local, read-only benchmark. It measures the same
compressed SQLite bundle that ships with the app, so fixture builds and future
production builds can be compared with one command.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import statistics
import time
import zlib
from pathlib import Path
from typing import Any, Callable


DEFAULT_QUERIES = ["hillock", "語", "kakehiki", "exit", "subway", "的"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--dictionary-sample", type=int, default=250)
    parser.add_argument("--static-sample", type=int, default=100)
    parser.add_argument("--iterations", type=int, default=5)
    parser.add_argument("--search-iterations", type=int, default=20)
    parser.add_argument("--query", action="append", default=[])
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser.parse_args()


def inflate_raw(blob: bytes) -> bytes:
    return zlib.decompress(blob, -zlib.MAX_WBITS)


def timed_ms(operation: Callable[[], Any]) -> float:
    start = time.perf_counter_ns()
    operation()
    end = time.perf_counter_ns()
    return (end - start) / 1_000_000


def percentile(values: list[float], percent: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((percent / 100) * (len(ordered) - 1))))
    return ordered[index]


def timing_summary(values: list[float]) -> dict[str, float]:
    if not values:
        return {"min_ms": 0.0, "median_ms": 0.0, "p95_ms": 0.0, "max_ms": 0.0}
    return {
        "min_ms": min(values),
        "median_ms": statistics.median(values),
        "p95_ms": percentile(values, 95),
        "max_ms": max(values),
    }


def phrase_query(term: str) -> str:
    return f'"{term.replace("\"", "\"\"")}"'


def load_json_asset(connection: sqlite3.Connection, path: str) -> Any | None:
    row = connection.execute(
        "SELECT compressedData FROM static_assets WHERE path = ?",
        (path,),
    ).fetchone()
    if not row:
        return None
    return json.loads(inflate_raw(row[0]))


def row_count(connection: sqlite3.Connection, table: str) -> int:
    return int(connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0])


def compression_ratio(compressed: int, expanded: int) -> float:
    if expanded <= 0:
        return 0.0
    return compressed / expanded


def measure_dictionary(
    connection: sqlite3.Connection,
    sample_size: int,
    iterations: int,
) -> dict[str, Any]:
    rows = connection.execute(
        """
        SELECT key, compressedData
        FROM dictionary_entries
        WHERE compressedData IS NOT NULL
        ORDER BY key
        LIMIT ?
        """,
        (sample_size,),
    ).fetchall()

    expanded_bytes = 0
    compressed_bytes = 0
    timings: list[float] = []
    decoded_keys: list[str] = []
    for _ in range(max(1, iterations)):
        for key, blob in rows:
            def operation() -> None:
                payload = inflate_raw(blob)
                data = json.loads(payload)
                if data.get("key") != key:
                    raise AssertionError(f"dictionary key mismatch for {key}")

            timings.append(timed_ms(operation))

    for key, blob in rows:
        payload = inflate_raw(blob)
        expanded_bytes += len(payload)
        compressed_bytes += len(blob)
        decoded_keys.append(key)

    return {
        "sample_records": len(rows),
        "sample_keys": decoded_keys[:10],
        "sample_compressed_bytes": compressed_bytes,
        "sample_expanded_bytes": expanded_bytes,
        "sample_compression_ratio": compression_ratio(compressed_bytes, expanded_bytes),
        "lookup_inflate_decode": timing_summary(timings),
    }


def measure_static_assets(
    connection: sqlite3.Connection,
    sample_size: int,
    iterations: int,
) -> dict[str, Any]:
    source_bytes, compressed_bytes = connection.execute(
        "SELECT coalesce(sum(sourceBytes), 0), coalesce(sum(compressedBytes), 0) FROM static_assets"
    ).fetchone()
    rows = connection.execute(
        """
        SELECT path, compressedData
        FROM static_assets
        ORDER BY path
        LIMIT ?
        """,
        (sample_size,),
    ).fetchall()

    timings: list[float] = []
    for _ in range(max(1, iterations)):
        for _, blob in rows:
            timings.append(timed_ms(lambda blob=blob: inflate_raw(blob)))

    return {
        "source_bytes": int(source_bytes),
        "compressed_bytes": int(compressed_bytes),
        "compression_ratio": compression_ratio(int(compressed_bytes), int(source_bytes)),
        "sample_assets": len(rows),
        "inflate": timing_summary(timings),
    }


def measure_search(
    connection: sqlite3.Connection,
    queries: list[str],
    iterations: int,
) -> dict[str, Any]:
    results: dict[str, Any] = {}
    for term in queries:
        timings: list[float] = []
        row_total = 0
        statement = (
            "SELECT word, language FROM dictionary_search "
            "WHERE dictionary_search MATCH ? LIMIT 20"
        )
        for _ in range(max(1, iterations)):
            rows: list[tuple[str, str]] = []

            def operation() -> None:
                nonlocal rows
                rows = connection.execute(statement, (phrase_query(term),)).fetchall()

            timings.append(timed_ms(operation))
            row_total += len(rows)
        results[term] = {
            "average_result_count": row_total / max(1, iterations),
            "query": timing_summary(timings),
        }
    return results


def measure_game_pack(connection: sqlite3.Connection) -> dict[str, Any]:
    manifest = load_json_asset(connection, "game_unified/manifest.json") or {}
    chunk_assets = row_count_for_like(connection, "game_unified/chunks/%.json")
    return {
        "manifest_total": int(manifest.get("total", 0) or 0),
        "manifest_chunks": int(manifest.get("chunks", 0) or 0),
        "chunk_assets": chunk_assets,
        "complete_chunk_pack": bool(manifest) and chunk_assets >= int(manifest.get("chunks", 0) or 0),
    }


def row_count_for_like(connection: sqlite3.Connection, pattern: str) -> int:
    return int(
        connection.execute(
            "SELECT count(*) FROM static_assets WHERE path LIKE ?",
            (pattern,),
        ).fetchone()[0]
    )


def byte_string(value: int) -> str:
    units = ["B", "KiB", "MiB", "GiB"]
    size = float(value)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
    return f"{value} B"


def percent(value: float) -> str:
    return f"{value * 100:.1f}%"


def format_timing(summary: dict[str, float]) -> str:
    return (
        f"median {summary['median_ms']:.3f} ms, "
        f"p95 {summary['p95_ms']:.3f} ms, "
        f"max {summary['max_ms']:.3f} ms"
    )


def print_text(report: dict[str, Any]) -> None:
    dictionary = report["dictionary"]
    static = report["static_assets"]
    game = report["game_pack"]
    print(f"Benchmarked {report['bundle']}")
    print(f"Size: {byte_string(report['file_size_bytes'])}")
    print(
        "Rows: "
        f"{report['row_counts']['dictionary_entries']:,} dictionary, "
        f"{report['row_counts']['dictionary_search']:,} search, "
        f"{report['row_counts']['static_assets']:,} static assets"
    )
    print(
        "Dictionary sample: "
        f"{dictionary['sample_records']:,} records, "
        f"{byte_string(dictionary['sample_compressed_bytes'])} compressed -> "
        f"{byte_string(dictionary['sample_expanded_bytes'])} inflated "
        f"({percent(dictionary['sample_compression_ratio'])})"
    )
    print(
        "Static assets: "
        f"{byte_string(static['compressed_bytes'])} compressed -> "
        f"{byte_string(static['source_bytes'])} source "
        f"({percent(static['compression_ratio'])})"
    )
    print(
        "Game pack: "
        f"{game['chunk_assets']:,}/{game['manifest_chunks']:,} chunks, "
        f"{game['manifest_total']:,} manifest rows"
    )
    print(
        "Timings: "
        f"dictionary lookup+inflate+decode {format_timing(dictionary['lookup_inflate_decode'])}; "
        f"static inflate {format_timing(static['inflate'])}"
    )
    for term, result in report["search"].items():
        print(
            f"Search {term!r}: "
            f"{result['average_result_count']:.1f} avg rows, "
            f"{format_timing(result['query'])}"
        )


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    connection = sqlite3.connect(args.bundle)
    try:
        queries = args.query or DEFAULT_QUERIES
        return {
            "bundle": str(args.bundle),
            "file_size_bytes": args.bundle.stat().st_size,
            "row_counts": {
                "dictionary_entries": row_count(connection, "dictionary_entries"),
                "dictionary_search": row_count(connection, "dictionary_search"),
                "static_assets": row_count(connection, "static_assets"),
            },
            "dictionary": measure_dictionary(
                connection,
                max(1, args.dictionary_sample),
                max(1, args.iterations),
            ),
            "static_assets": measure_static_assets(
                connection,
                max(1, args.static_sample),
                max(1, args.iterations),
            ),
            "search": measure_search(
                connection,
                queries,
                max(1, args.search_iterations),
            ),
            "game_pack": measure_game_pack(connection),
        }
    finally:
        connection.close()


def main() -> None:
    args = parse_args()
    report = build_report(args)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_text(report)


if __name__ == "__main__":
    main()
