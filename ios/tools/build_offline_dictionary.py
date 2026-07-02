#!/usr/bin/env python3
"""Build the immutable Kiokun iOS dictionary bundle.

The web pipeline already emits raw-deflate JSON records and a CSV search index.
This script preserves those compressed records in SQLite so iOS can ship the
full dictionary without expanding multiple gigabytes of JSON at install time.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import sqlite3
import sys
import time
import urllib.request
import zlib
from dataclasses import asdict, dataclass
from itertools import islice
from pathlib import Path
from urllib.parse import unquote


SCHEMA = """
PRAGMA journal_mode = OFF;
PRAGMA synchronous = OFF;
PRAGMA temp_store = MEMORY;
PRAGMA locking_mode = EXCLUSIVE;
PRAGMA page_size = 4096;

CREATE TABLE app_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

CREATE TABLE dictionary_entries (
    key TEXT PRIMARY KEY NOT NULL,
    json TEXT,
    compressedData BLOB,
    sourceFormat TEXT NOT NULL DEFAULT 'raw-deflate',
    dictionaryVersion TEXT NOT NULL,
    updatedAt INTEGER NOT NULL
);

CREATE VIRTUAL TABLE dictionary_search USING fts5(
    word,
    language,
    definition,
    pronunciation,
    reading_search,
    is_common,
    tokenize = 'porter unicode61'
);

CREATE TABLE static_assets (
    path TEXT PRIMARY KEY NOT NULL,
    compressedData BLOB NOT NULL,
    sourceBytes INTEGER NOT NULL,
    compressedBytes INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);
"""


def parse_byte_count(raw: str) -> int:
    value = raw.strip()
    units = {
        "kib": 1024,
        "kb": 1024,
        "mib": 1024**2,
        "mb": 1024**2,
        "gib": 1024**3,
        "gb": 1024**3,
        "tib": 1024**4,
        "tb": 1024**4,
        "b": 1,
    }
    lower = value.lower()
    for suffix, multiplier in sorted(units.items(), key=lambda item: len(item[0]), reverse=True):
        if lower.endswith(suffix):
            number = value[: -len(suffix)].strip()
            return int(float(number) * multiplier)
    return int(value)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dictionary-dir", type=Path, required=True)
    parser.add_argument("--search-csv", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--limit-dictionary", type=int)
    parser.add_argument("--limit-search", type=int)
    parser.add_argument("--skip-search", action="store_true")
    parser.add_argument("--static-dir", type=Path)
    parser.add_argument(
        "--static-glob",
        action="append",
        default=[],
        help="Glob relative to --static-dir. May be repeated. Example: 'game_data/*.json'.",
    )
    parser.add_argument("--include-game-data", action="store_true")
    parser.add_argument(
        "--game-data-url",
        default="https://raw.githubusercontent.com/Kimeiga/duojp/main/frontend/static/data-unified",
    )
    parser.add_argument("--limit-game-chunks", type=int)
    parser.add_argument(
        "--skip-disk-check",
        action="store_true",
        help="Disable the conservative free-space preflight for production imports.",
    )
    parser.add_argument(
        "--skip-vacuum",
        action="store_true",
        help="Skip final VACUUM. Faster and uses less temporary disk, but produces a larger bundle.",
    )
    parser.add_argument(
        "--disk-headroom-gib",
        type=float,
        default=2.0,
        help="Extra free space to require beyond the estimated SQLite build and VACUUM footprint.",
    )
    parser.add_argument(
        "--preflight-only",
        action="store_true",
        help="Print source-size and disk-space estimates without creating a SQLite bundle.",
    )
    parser.add_argument(
        "--preflight-json",
        action="store_true",
        help="Emit the preflight report as JSON instead of human-readable text.",
    )
    parser.add_argument(
        "--source-manifest",
        type=Path,
        help="Use a previous --write-source-manifest JSON file for disk estimates.",
    )
    parser.add_argument(
        "--write-source-manifest",
        type=Path,
        help="Write the computed source counts, byte sizes, and disk estimates to JSON.",
    )
    parser.add_argument(
        "--dictionary-source-bytes",
        type=parse_byte_count,
        help="Known dictionary source byte size for preflight estimates, e.g. 6.3GiB.",
    )
    parser.add_argument(
        "--dictionary-source-count",
        type=int,
        default=0,
        help="Known dictionary record count for preflight reports when using --dictionary-source-bytes.",
    )
    parser.add_argument(
        "--static-source-bytes",
        type=parse_byte_count,
        help="Known local static asset byte size for preflight estimates, e.g. 40MiB.",
    )
    parser.add_argument(
        "--static-source-count",
        type=int,
        default=0,
        help="Known static asset file count for preflight reports when using --static-source-bytes.",
    )
    parser.add_argument(
        "--progress-interval",
        type=int,
        default=50_000,
        help="Print import progress every N dictionary/search rows. Use 0 to disable.",
    )
    return parser.parse_args()


@dataclass
class SourceEstimate:
    dictionary_count: int
    dictionary_bytes: int
    search_bytes: int
    static_count: int
    static_bytes: int
    game_reserve_bytes: int
    estimated_sqlite_bytes: int
    existing_output_bytes: int
    required_bytes: int
    free_bytes: int
    build_multiplier: float
    fits: bool


def iter_dictionary_files(root: Path, *, sorted_entries: bool = True):
    for dirpath, dirnames, filenames in os.walk(root):
        if sorted_entries:
            dirnames.sort()
            filenames.sort()
        for filename in filenames:
            if filename.endswith(".json.deflate"):
                yield Path(dirpath) / filename


def limited_dictionary_files(args: argparse.Namespace):
    files = iter_dictionary_files(args.dictionary_dir)
    if args.limit_dictionary is not None:
        return islice(files, args.limit_dictionary)
    return files


def key_for_file(path: Path) -> str:
    name = path.name.removesuffix(".json.deflate")
    return unquote(name)


def raw_deflate(data: bytes) -> bytes:
    compressor = zlib.compressobj(level=9, wbits=-zlib.MAX_WBITS)
    return compressor.compress(data) + compressor.flush()


def remove_sqlite_files(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    for suffix in ("-wal", "-shm"):
        sidecar = Path(f"{path}{suffix}")
        if sidecar.exists():
            sidecar.unlink()


def temporary_output_path(path: Path) -> Path:
    return path.with_name(f".{path.name}.tmp-{os.getpid()}")


def static_asset_paths(args: argparse.Namespace) -> list[Path]:
    if not args.static_dir:
        return []

    patterns = args.static_glob or [
        "game_data/*.json",
        "homophones_*.json",
        "frequency_list.json",
        "japanese_labels.json",
        "pitch/**/*.json",
        "zh_sentences/**/*.json",
        "kr_sentences/**/*.json",
        "video_data.json",
        "chinese_video_data.json",
        "reel_transcripts*.json",
    ]

    seen: set[Path] = set()
    paths: list[Path] = []
    for pattern in patterns:
        for path in sorted(args.static_dir.glob(pattern)):
            if path.is_file() and path not in seen:
                seen.add(path)
                paths.append(path)
    return paths


def dictionary_source_stats(args: argparse.Namespace) -> tuple[int, int]:
    dictionary_count = 0
    dictionary_bytes = 0
    files = (
        limited_dictionary_files(args)
        if args.limit_dictionary is not None
        else iter_dictionary_files(args.dictionary_dir, sorted_entries=False)
    )
    for path in files:
        dictionary_count += 1
        dictionary_bytes += path.stat().st_size
    return dictionary_count, dictionary_bytes


def load_source_estimate_manifest(path: Path) -> tuple[int, int, int, int, int, int]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1:
        raise SystemExit(f"Unsupported source manifest schema: {path}")
    return (
        int(data["dictionary"]["count"]),
        int(data["dictionary"]["bytes"]),
        int(data["search"]["bytes"]),
        int(data["static"]["count"]),
        int(data["static"]["bytes"]),
        int(data.get("gameReserveBytes", 0)),
    )


def estimate_sources(args: argparse.Namespace) -> tuple[int, int, int, int, int, int]:
    if args.source_manifest:
        return load_source_estimate_manifest(args.source_manifest)

    if args.dictionary_source_bytes is not None:
        dictionary_count = args.dictionary_source_count
        dictionary_bytes = args.dictionary_source_bytes
    else:
        dictionary_count, dictionary_bytes = dictionary_source_stats(args)
    search_bytes = 0 if args.skip_search else args.search_csv.stat().st_size
    if args.static_source_bytes is not None:
        static_count = args.static_source_count
        static_bytes = args.static_source_bytes
    else:
        static_paths = static_asset_paths(args)
        static_count = len(static_paths)
        static_bytes = sum(path.stat().st_size for path in static_paths)
    game_reserve_bytes = 0
    if args.include_game_data:
        # The remote duojp chunks are currently modest, but reserve enough for
        # network pack growth without needing to download every chunk first.
        game_reserve_bytes = 512 * 1024 * 1024
    return dictionary_count, dictionary_bytes, search_bytes, static_count, static_bytes, game_reserve_bytes


def build_source_estimate(args: argparse.Namespace, final_output: Path) -> SourceEstimate:
    (
        dictionary_count,
        dictionary_bytes,
        search_bytes,
        static_count,
        static_bytes,
        game_reserve_bytes,
    ) = estimate_sources(args)
    existing_output_bytes = final_output.stat().st_size if final_output.exists() else 0

    estimated_sqlite_bytes = (
        dictionary_bytes
        + search_bytes * 4
        + static_bytes
        + game_reserve_bytes
        + 512 * 1024 * 1024
    )
    build_multiplier = 1.25 if args.skip_vacuum else 2.15
    required_bytes = int(
        estimated_sqlite_bytes * build_multiplier
        + existing_output_bytes
        + args.disk_headroom_gib * 1024 * 1024 * 1024
    )
    free_bytes = shutil.disk_usage(final_output.parent).free
    return SourceEstimate(
        dictionary_count=dictionary_count,
        dictionary_bytes=dictionary_bytes,
        search_bytes=search_bytes,
        static_count=static_count,
        static_bytes=static_bytes,
        game_reserve_bytes=game_reserve_bytes,
        estimated_sqlite_bytes=estimated_sqlite_bytes,
        existing_output_bytes=existing_output_bytes,
        required_bytes=required_bytes,
        free_bytes=free_bytes,
        build_multiplier=build_multiplier,
        fits=free_bytes >= required_bytes,
    )


def gib(value: int) -> str:
    return f"{value / 1024 / 1024 / 1024:.1f} GiB"


def format_source_estimate(estimate: SourceEstimate, args: argparse.Namespace, final_output: Path) -> str:
    source = "source manifest" if args.source_manifest else "current source tree"
    verdict = "fits" if estimate.fits else "does not fit"
    return "\n".join(
        [
            f"Offline bundle preflight for {final_output} ({source}):",
            f"  dictionary: {estimate.dictionary_count:,} records, {gib(estimate.dictionary_bytes)}",
            f"  search CSV: {gib(estimate.search_bytes)}",
            f"  static assets: {estimate.static_count:,} local files, {gib(estimate.static_bytes)}",
            f"  remote game reserve: {gib(estimate.game_reserve_bytes)}",
            f"  estimated SQLite footprint: {gib(estimate.estimated_sqlite_bytes)}",
            f"  build multiplier: {estimate.build_multiplier:.2f} ({'skip VACUUM' if args.skip_vacuum else 'with VACUUM'})",
            f"  existing output: {gib(estimate.existing_output_bytes)}",
            f"  required free space: {gib(estimate.required_bytes)}",
            f"  available free space: {gib(estimate.free_bytes)}",
            f"  verdict: {verdict}",
        ]
    )


def write_source_manifest(path: Path, estimate: SourceEstimate, args: argparse.Namespace) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "schemaVersion": 1,
        "createdAt": int(time.time() * 1000),
        "dictionary": {
            "dir": str(args.dictionary_dir),
            "limit": args.limit_dictionary,
            "count": estimate.dictionary_count,
            "bytes": estimate.dictionary_bytes,
        },
        "search": {
            "csv": str(args.search_csv),
            "skipped": bool(args.skip_search),
            "limit": args.limit_search,
            "bytes": estimate.search_bytes,
        },
        "static": {
            "dir": str(args.static_dir) if args.static_dir else None,
            "globs": args.static_glob,
            "count": estimate.static_count,
            "bytes": estimate.static_bytes,
        },
        "includeGameData": bool(args.include_game_data),
        "gameReserveBytes": estimate.game_reserve_bytes,
        "skipVacuum": bool(args.skip_vacuum),
        "diskHeadroomGiB": args.disk_headroom_gib,
        "estimate": asdict(estimate),
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def preflight_disk_space(args: argparse.Namespace, final_output: Path, estimate: SourceEstimate) -> None:
    if not estimate.fits:
        raise SystemExit(
            "Insufficient free disk for offline bundle build: "
            f"estimated need {gib(estimate.required_bytes)}, available {gib(estimate.free_bytes)}. "
            "Free disk, choose another --output volume, lower limits, pass --skip-vacuum, "
            "or override with --skip-disk-check if you have already accounted for SQLite temp files."
        )


def create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(SCHEMA)


def report_progress(args: argparse.Namespace, label: str, count: int, last_reported: int) -> int:
    if args.progress_interval <= 0:
        return last_reported
    if count - last_reported < args.progress_interval:
        return last_reported
    print(f"Imported {count:,} {label}...", file=sys.stderr, flush=True)
    return count


def import_dictionary(connection: sqlite3.Connection, args: argparse.Namespace, now_ms: int) -> int:
    count = 0
    last_reported = 0
    batch: list[tuple[str, sqlite3.Binary, str, str, int]] = []
    statement = """
        INSERT INTO dictionary_entries
            (key, compressedData, sourceFormat, dictionaryVersion, updatedAt)
        VALUES (?, ?, ?, ?, ?)
    """
    for path in limited_dictionary_files(args):
        batch.append((key_for_file(path), sqlite3.Binary(path.read_bytes()), "raw-deflate", args.version, now_ms))
        if len(batch) >= 1_000:
            connection.executemany(statement, batch)
            count += len(batch)
            batch.clear()
            last_reported = report_progress(args, "dictionary records", count, last_reported)

    if batch:
        connection.executemany(statement, batch)
        count += len(batch)
        report_progress(args, "dictionary records", count, last_reported)

    return count


def import_search(connection: sqlite3.Connection, args: argparse.Namespace) -> int:
    if args.skip_search:
        return 0

    count = 0
    batch: list[tuple[str, str, str, str, str, int]] = []
    with args.search_csv.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            batch.append(
                (
                    row.get("word", ""),
                    row.get("language", ""),
                    row.get("definition", ""),
                    row.get("pronunciation", ""),
                    row.get("reading_search", ""),
                    int(row.get("is_common") or 0),
                )
            )
            if len(batch) >= 10_000:
                connection.executemany(
                    """
                    INSERT INTO dictionary_search
                        (word, language, definition, pronunciation, reading_search, is_common)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    batch,
                )
                count += len(batch)
                batch.clear()
                last_reported = getattr(args, "_last_search_reported", 0)
                args._last_search_reported = report_progress(args, "search rows", count, last_reported)
            if args.limit_search is not None and count + len(batch) >= args.limit_search:
                batch = batch[: args.limit_search - count]
                break

    if batch:
        connection.executemany(
            """
            INSERT INTO dictionary_search
                (word, language, definition, pronunciation, reading_search, is_common)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            batch,
        )
        count += len(batch)
        last_reported = getattr(args, "_last_search_reported", 0)
        report_progress(args, "search rows", count, last_reported)

    return count


def insert_static_asset(
    connection: sqlite3.Connection,
    path: str,
    data: bytes,
    now_ms: int,
) -> None:
    compressed = raw_deflate(data)
    connection.execute(
        """
        INSERT OR REPLACE INTO static_assets
            (path, compressedData, sourceBytes, compressedBytes, updatedAt)
        VALUES (?, ?, ?, ?, ?)
        """,
        (path, sqlite3.Binary(compressed), len(data), len(compressed), now_ms),
    )


def import_static_assets(connection: sqlite3.Connection, args: argparse.Namespace, now_ms: int) -> int:
    if not args.static_dir:
        return 0
    if not args.static_dir.is_dir():
        raise SystemExit(f"Static directory not found: {args.static_dir}")

    count = 0
    last_reported = 0
    for path in static_asset_paths(args):
        rel = path.relative_to(args.static_dir).as_posix()
        insert_static_asset(connection, rel, path.read_bytes(), now_ms)
        count += 1
        last_reported = report_progress(args, "static assets", count, last_reported)
    return count


def fetch_url(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def import_game_data(connection: sqlite3.Connection, args: argparse.Namespace, now_ms: int) -> int:
    if not args.include_game_data:
        return 0

    base = args.game_data_url.rstrip("/")
    manifest_data = fetch_url(f"{base}/manifest.json")
    distractors_data = fetch_url(f"{base}/distractors.json")
    import json

    manifest = json.loads(manifest_data)
    chunk_count = int(manifest["chunks"])
    if args.limit_game_chunks is not None:
        chunk_count = min(chunk_count, args.limit_game_chunks)

    insert_static_asset(connection, "game_unified/manifest.json", manifest_data, now_ms)
    insert_static_asset(connection, "game_unified/distractors.json", distractors_data, now_ms)
    count = 2
    for index in range(chunk_count):
        chunk_data = fetch_url(f"{base}/chunks/{index}.json")
        insert_static_asset(connection, f"game_unified/chunks/{index}.json", chunk_data, now_ms)
        count += 1
        if index and index % 25 == 0:
            connection.commit()
            print(f"Imported {index + 1:,}/{chunk_count:,} game chunks...", file=sys.stderr, flush=True)
    return count


def write_metadata(connection: sqlite3.Connection, args: argparse.Namespace, now_ms: int) -> None:
    rows = [
        ("dictionaryVersion", args.version),
        ("createdAt", str(now_ms)),
        ("sourceDictionaryDir", str(args.dictionary_dir)),
        ("sourceSearchCsv", str(args.search_csv)),
    ]
    connection.executemany("INSERT INTO app_metadata (key, value) VALUES (?, ?)", rows)


def main() -> None:
    args = parse_args()
    if not args.dictionary_dir.is_dir():
        raise SystemExit(f"Dictionary directory not found: {args.dictionary_dir}")
    if not args.search_csv.is_file():
        raise SystemExit(f"Search CSV not found: {args.search_csv}")

    started = time.time()
    now_ms = int(started * 1000)
    final_output = args.output
    build_output = temporary_output_path(final_output)
    estimate = None
    if args.preflight_only or args.write_source_manifest or not args.skip_disk_check:
        estimate = build_source_estimate(args, final_output)
        if args.write_source_manifest:
            write_source_manifest(args.write_source_manifest, estimate, args)
        if args.preflight_only:
            if args.preflight_json:
                print(json.dumps(asdict(estimate), ensure_ascii=False, indent=2))
            else:
                print(format_source_estimate(estimate, args, final_output))
            return
        if not args.skip_disk_check:
            preflight_disk_space(args, final_output, estimate)
    remove_sqlite_files(build_output)

    connection = sqlite3.connect(build_output)
    try:
        create_schema(connection)
        dictionary_count = import_dictionary(connection, args, now_ms)
        search_count = import_search(connection, args)
        static_count = import_static_assets(connection, args, now_ms)
        game_count = import_game_data(connection, args, now_ms)
        write_metadata(connection, args, now_ms)
        connection.commit()
        connection.execute("ANALYZE")
        if not args.skip_vacuum:
            connection.execute("VACUUM")
    except BaseException:
        connection.close()
        connection = None
        remove_sqlite_files(build_output)
        raise
    finally:
        if connection:
            connection.close()

    remove_sqlite_files(final_output)
    build_output.replace(final_output)

    elapsed = time.time() - started
    size_mb = final_output.stat().st_size / 1024 / 1024
    print(
        f"Built {final_output} with {dictionary_count:,} dictionary entries "
        f"{search_count:,} search rows, {static_count:,} static assets, "
        f"and {game_count:,} game assets in {elapsed:.1f}s ({size_mb:.1f} MiB)."
    )


if __name__ == "__main__":
    main()
