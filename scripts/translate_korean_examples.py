#!/usr/bin/env python3
"""
Translate every sense-linked KRDICT example into English.

The Rust exporter is the source of truth for example occurrence IDs, sense
context, and shard attachment. Provider artifacts stay in the gitignored work
directory; only the compact translation JSONL parts are committed.

The bakeoff quality winner can run through the bounded OpenAI Batch path:

  python3 scripts/translate_korean_examples.py prepare
  python3 scripts/translate_korean_examples.py run
  python3 scripts/translate_korean_examples.py process

The zero-severe-error high-throughput fallback is resumable Gemini 3.6 Flash:

  python3 scripts/translate_korean_examples.py prepare
  python3 scripts/translate_korean_examples.py translate-gemini
  python3 scripts/translate_korean_examples.py process-gemini

Finish either path with:

  python3 scripts/translate_korean_examples.py verify
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from contextlib import ExitStack
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator

from dotenv import load_dotenv
from openai import OpenAI


ROOT = Path(__file__).resolve().parents[1]
WORK_DIR = ROOT / "data" / "korean_example_translation_work"
SOURCE_FILE = WORK_DIR / "source_examples.jsonl"
BATCH_DIR = WORK_DIR / "batch_requests"
JOB_DIR = WORK_DIR / "jobs"
RESULT_DIR = WORK_DIR / "batch_results"
ERROR_DIR = WORK_DIR / "errors"
GEMINI_PROGRESS_FILE = WORK_DIR / "gemini-3.6-flash-minimal-results.jsonl"
GEMINI_BATCH_PROGRESS_FILE = WORK_DIR / "gemini-3.6-flash-minimal-batch-results.jsonl"
GEMINI_BATCH_INPUT_FILE = WORK_DIR / "gemini-batch-current.jsonl"
GEMINI_BATCH_JOB_FILE = WORK_DIR / "gemini-batch-current-job.json"
GEMINI_BATCH_JOB_LOG = WORK_DIR / "gemini-batch-jobs.jsonl"
GEMINI_BATCH_RESULT_DIR = WORK_DIR / "gemini_batch_results"
OUTPUT_DIR = ROOT / "data" / "krdict-example-translations-en"
MANIFEST_FILE = OUTPUT_DIR / "manifest.json"

MODEL_NAME = "gpt-5.6-sol"
REASONING_EFFORT = "none"
GEMINI_MODEL_NAME = "gemini-3.6-flash"
GEMINI_THINKING_LEVEL = "minimal"
EXAMPLES_PER_REQUEST = 80
# This OpenAI organization currently permits 900K GPT-5.6 Sol input tokens
# enqueued at once. The source averages just under 5K input tokens per request,
# so 140 requests leaves a useful safety margin for unusually long senses.
REQUESTS_PER_BATCH_FILE = 140
OUTPUT_PARTS = 16
GEMINI_REQUESTS_PER_BATCH_JOB = 400

SYSTEM_PROMPT = """Translate Korean dictionary example sentences into accurate, natural learner-facing English.

Requirements:
- Return ONLY a JSON object with one key, "translations", whose value is an array of strings in the exact same order as the input items.
- Return exactly one English string for every input item.
- Preserve meaning, register, tense, names, numbers, quoted language, and sentence/fragment status.
- Translate idioms by meaning rather than word for word, while staying close enough for a language learner.
- Use the headword and English definition only to disambiguate the example. Do not add information not present in the Korean.
- When an example discusses or contrasts exact Korean wording, preserve the quoted Korean and explain its English meaning naturally.
- Keep sound effects, labels, and fragments concise.
- Do not add labels, notes, alternatives, romanization, markdown, or commentary."""

HANGUL_RE = re.compile(r"[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]")
ASCII_LETTER_RE = re.compile(r"[A-Za-z]")


def ensure_work_dirs() -> None:
    for directory in (
        WORK_DIR,
        BATCH_DIR,
        JOB_DIR,
        RESULT_DIR,
        ERROR_DIR,
        GEMINI_BATCH_RESULT_DIR,
    ):
        directory.mkdir(parents=True, exist_ok=True)


def load_env() -> None:
    load_dotenv(ROOT / "sveltekit-app" / ".env.local")
    load_dotenv(ROOT / "scripts" / ".env", override=False)
    if not os.getenv("OPENAI_API_KEY"):
        raise SystemExit(
            "OPENAI_API_KEY is not set in sveltekit-app/.env.local, scripts/.env, or the environment"
        )


def load_gemini_env() -> str:
    load_dotenv(ROOT / "scripts" / ".env")
    key = os.getenv("GEMINI_API_KEY")
    if key:
        return key
    load_dotenv(ROOT / "sveltekit-app" / ".env.local", override=False)
    key = os.getenv("GOOGLE_API_KEY")
    if not key:
        raise SystemExit(
            "GEMINI_API_KEY/GOOGLE_API_KEY is not set in scripts/.env, "
            "sveltekit-app/.env.local, or the environment"
        )
    return key


def get_client() -> OpenAI:
    load_env()
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    with path.open(encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"{path}:{line_number}: invalid JSON: {exc}") from exc
            if not isinstance(value, dict):
                raise RuntimeError(f"{path}:{line_number}: expected a JSON object")
            yield value


def batched(rows: Iterable[dict[str, Any]], size: int) -> Iterator[list[dict[str, Any]]]:
    batch: list[dict[str, Any]] = []
    for row in rows:
        batch.append(row)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch


def export_source(force: bool = False) -> None:
    ensure_work_dirs()
    if SOURCE_FILE.exists() and not force:
        print(f"Source export already exists: {SOURCE_FILE}")
        return
    subprocess.run(
        [
            "cargo",
            "run",
            "--release",
            "--bin",
            "build_dictionary",
            "--",
            "--export-korean-examples",
            str(SOURCE_FILE),
        ],
        cwd=ROOT,
        check=True,
    )


def compact_prompt_row(row: dict[str, Any]) -> dict[str, str]:
    korean = str(row.get("korean") or "").strip()
    headword = str(row.get("headword") or "").strip()
    definition = str(row.get("definition") or "").strip()
    if not korean or not headword:
        raise RuntimeError(f"Source row has an empty Korean example or headword: {row!r}")

    # Long KRDICT explanations sometimes repeat usage notes. The first 280
    # characters preserve enough semantic context for ambiguous fragments
    # without multiplying the batch input cost unnecessarily.
    compact = {"korean": korean, "headword": headword}
    if definition:
        compact["definition"] = definition[:280]
    return compact


def request_body(rows: list[dict[str, Any]]) -> dict[str, Any]:
    prompt = json.dumps(
        {"items": [compact_prompt_row(row) for row in rows]},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return {
        "model": MODEL_NAME,
        "input": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "reasoning": {"effort": REASONING_EFFORT},
        "max_output_tokens": 12_000,
        "text": {"format": {"type": "json_object"}},
    }


def create_batch_request(rows: list[dict[str, Any]], start: int) -> dict[str, Any]:
    end = start + len(rows)
    return {
        "custom_id": f"ko-{start}-{end}",
        "method": "POST",
        "url": "/v1/responses",
        "body": request_body(rows),
    }


def clear_matching_files(directory: Path, pattern: str) -> None:
    for path in directory.glob(pattern):
        if path.is_file():
            path.unlink()


def prepare(force_export: bool = False, force_batches: bool = False) -> None:
    export_source(force=force_export)
    ensure_work_dirs()

    existing = sorted(BATCH_DIR.glob("batch-*.jsonl"))
    if existing and not force_batches:
        print(f"{len(existing)} batch request files already exist under {BATCH_DIR}")
        return
    if force_batches:
        clear_matching_files(BATCH_DIR, "batch-*.jsonl")

    request_count = 0
    example_count = 0
    file_index = -1
    output_handle = None
    try:
        for rows in batched(iter_jsonl(SOURCE_FILE), EXAMPLES_PER_REQUEST):
            if request_count % REQUESTS_PER_BATCH_FILE == 0:
                if output_handle:
                    output_handle.close()
                file_index += 1
                path = BATCH_DIR / f"batch-{file_index:03}.jsonl"
                output_handle = path.open("w", encoding="utf-8")

            request = create_batch_request(rows, example_count)
            output_handle.write(json.dumps(request, ensure_ascii=False, separators=(",", ":")) + "\n")
            request_count += 1
            example_count += len(rows)
    finally:
        if output_handle:
            output_handle.close()

    print(
        f"Prepared {example_count:,} examples in {request_count:,} requests "
        f"across {file_index + 1:,} batch files"
    )


def job_metadata_path(batch_file: Path) -> Path:
    return JOB_DIR / f"{batch_file.stem}.json"


def submit_batch(client: OpenAI, batch_file: Path) -> dict[str, Any]:
    print(f"{batch_file.stem}: uploading {batch_file.name}...", flush=True)
    with batch_file.open("rb") as handle:
        uploaded = client.files.create(file=handle, purpose="batch")
    job = client.batches.create(
        input_file_id=uploaded.id,
        endpoint="/v1/responses",
        completion_window="24h",
        metadata={
            "project": "kiokun",
            "task": "krdict-ko-en-examples",
            "source": batch_file.stem,
            "model": MODEL_NAME,
        },
    )
    metadata = {
        "batchFile": str(batch_file),
        "inputFileId": uploaded.id,
        "jobId": job.id,
        "model": MODEL_NAME,
        "createdAt": int(time.time()),
    }
    job_metadata_path(batch_file).write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
    print(f"{batch_file.stem}: submitted {job.id}", flush=True)
    return metadata


def submit(force: bool = False, limit: int = 1) -> None:
    ensure_work_dirs()
    batch_files = sorted(BATCH_DIR.glob("batch-*.jsonl"))
    if not batch_files:
        raise SystemExit("No batch request files exist; run prepare first")

    client = get_client()
    submitted = 0
    for batch_file in batch_files:
        metadata_path = job_metadata_path(batch_file)
        if metadata_path.exists() and not force:
            print(f"{batch_file.stem}: job already recorded")
            continue
        submit_batch(client, batch_file)
        submitted += 1
        if limit > 0 and submitted >= limit:
            break

    print(f"Submitted {submitted:,} new batch jobs")


def read_job_metadata() -> list[dict[str, Any]]:
    metadata_files = sorted(JOB_DIR.glob("batch-*.json"))
    if not metadata_files:
        raise SystemExit("No batch jobs are recorded; run submit first")
    return [json.loads(path.read_text(encoding="utf-8")) for path in metadata_files]


TERMINAL_STATES = {"completed", "failed", "expired", "cancelled"}


def wait_for_job(
    client: OpenAI, metadata: dict[str, Any], poll_interval: int = 30
) -> None:
    batch_stem = Path(metadata["batchFile"]).stem
    last_state = ""
    while True:
        job = client.batches.retrieve(metadata["jobId"])
        state = str(job.status)
        if state != last_state:
            counts = getattr(job, "request_counts", None)
            counts_text = ""
            if counts:
                counts_text = (
                    f" total={getattr(counts, 'total', 0)}"
                    f" completed={getattr(counts, 'completed', 0)}"
                    f" failed={getattr(counts, 'failed', 0)}"
                )
            print(f"{batch_stem}: {state}{counts_text}", flush=True)
            last_state = state
        if state == "completed":
            return
        if state in TERMINAL_STATES:
            raise RuntimeError(f"{batch_stem}: batch ended in {state}: {job.errors}")
        time.sleep(poll_interval)


def run(poll_interval: int = 30) -> None:
    """Submit at most one Sol batch at a time and resume safely after interruption."""
    ensure_work_dirs()
    batch_files = sorted(BATCH_DIR.glob("batch-*.jsonl"))
    if not batch_files:
        raise SystemExit("No batch request files exist; run prepare first")

    client = get_client()
    for index, batch_file in enumerate(batch_files, 1):
        metadata_path = job_metadata_path(batch_file)
        if metadata_path.exists():
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        else:
            metadata = submit_batch(client, batch_file)
        wait_for_job(client, metadata, poll_interval=poll_interval)
        print(f"Progress: {index}/{len(batch_files)} batch files complete", flush=True)


def status(wait: bool = False, poll_interval: int = 30) -> bool:
    client = get_client()
    metadata = read_job_metadata()
    last_states: dict[str, str] = {}

    while True:
        all_completed = True
        has_failure = False
        for item in metadata:
            job = client.batches.retrieve(item["jobId"])
            state = str(job.status)
            if last_states.get(job.id) != state or not wait:
                counts = getattr(job, "request_counts", None)
                counts_text = ""
                if counts:
                    counts_text = (
                        f" total={getattr(counts, 'total', 0)}"
                        f" completed={getattr(counts, 'completed', 0)}"
                        f" failed={getattr(counts, 'failed', 0)}"
                    )
                print(f"{Path(item['batchFile']).stem}: {state}{counts_text}")
                last_states[job.id] = state
            if state != "completed":
                all_completed = False
            if state in TERMINAL_STATES and state != "completed":
                has_failure = True

        if not wait or all_completed or has_failure:
            return all_completed
        time.sleep(poll_interval)


def response_text(body: dict[str, Any]) -> str:
    texts: list[str] = []
    for item in body.get("output", []):
        for part in item.get("content", []):
            if part.get("type") in ("output_text", "text") and part.get("text"):
                texts.append(str(part["text"]))
    if not texts and body.get("output_text"):
        texts.append(str(body["output_text"]))
    return "\n".join(texts).strip()


def parse_translation_array(text: str) -> list[str]:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    parsed = json.loads(cleaned)
    if not isinstance(parsed, dict) or not isinstance(parsed.get("translations"), list):
        raise ValueError('response must be {"translations": [...]}')
    translations = parsed["translations"]
    if not all(isinstance(item, str) and item.strip() for item in translations):
        raise ValueError("every translation must be a non-empty string")
    return [item.strip() for item in translations]


def parse_custom_id(custom_id: str) -> tuple[int, int]:
    match = re.fullmatch(r"ko-(\d+)-(\d+)", custom_id)
    if not match:
        raise ValueError(f"invalid custom_id: {custom_id!r}")
    return int(match.group(1)), int(match.group(2))


def iter_batch_requests() -> Iterator[dict[str, Any]]:
    batch_files = sorted(BATCH_DIR.glob("batch-*.jsonl"))
    if not batch_files:
        raise SystemExit("No batch request files exist; run prepare first")
    for path in batch_files:
        yield from iter_jsonl(path)


def gemini_request(
    api_key: str, batch_request: dict[str, Any], attempts: int = 120
) -> dict[str, Any]:
    custom_id = str(batch_request["custom_id"])
    body = batch_request["body"]
    user_prompt = str(body["input"][1]["content"])
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "maxOutputTokens": 12_000,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingLevel": GEMINI_THINKING_LEVEL},
        },
    }
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL_NAME}:generateContent?key={api_key}"
    )

    for attempt in range(attempts):
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                result = json.loads(response.read())
            text = "".join(
                part.get("text", "")
                for part in result["candidates"][0]["content"]["parts"]
            )
            translations = parse_translation_array(text)
            start, end = parse_custom_id(custom_id)
            if len(translations) != end - start:
                raise RuntimeError(
                    f"{custom_id}: expected {end - start} translations, "
                    f"got {len(translations)}"
                )
            return {
                "customId": custom_id,
                "translations": translations,
                "usage": result.get("usageMetadata", {}),
            }
        except urllib.error.HTTPError as exc:
            body_text = exc.read().decode(errors="ignore")
            if exc.code not in {408, 429, 500, 502, 503, 504} or attempt + 1 == attempts:
                raise RuntimeError(
                    f"{custom_id}: Gemini HTTP {exc.code}: {body_text[:500]}"
                ) from exc
            retry_after = exc.headers.get("Retry-After")
            if "spend-based rate limit" in body_text:
                # Gemini evaluates this guard over a rolling ten-minute
                # window. Keep checkpoints alive through several windows.
                delay = 60.0
            else:
                delay = (
                    float(retry_after)
                    if retry_after and retry_after.replace(".", "", 1).isdigit()
                    else min(60.0, 2.0**attempt)
                )
            time.sleep(max(1.0, delay))
        except (
            TimeoutError,
            urllib.error.URLError,
            json.JSONDecodeError,
            KeyError,
            IndexError,
            RuntimeError,
        ):
            if attempt + 1 == attempts:
                raise
            time.sleep(min(60.0, 2.0**attempt))
    raise AssertionError("Gemini retry loop exhausted without returning or raising")


def read_gemini_progress() -> dict[str, dict[str, Any]]:
    completed: dict[str, dict[str, Any]] = {}
    for path in (GEMINI_PROGRESS_FILE, GEMINI_BATCH_PROGRESS_FILE):
        if not path.exists():
            continue
        for row in iter_jsonl(path):
            custom_id = str(row.get("customId") or "")
            if custom_id:
                completed[custom_id] = row
    return completed


def translate_gemini(concurrency: int = 24) -> None:
    """Run the zero-severe-error bakeoff fallback with resumable checkpoints."""
    ensure_work_dirs()
    api_key = load_gemini_env()
    completed = read_gemini_progress()
    pending = [
        request
        for request in iter_batch_requests()
        if str(request["custom_id"]) not in completed
    ]
    if not pending:
        print(f"All {len(completed):,} Gemini requests are already complete")
        return

    print(
        f"Gemini: {len(completed):,} complete, {len(pending):,} pending, "
        f"concurrency={concurrency}",
        flush=True,
    )
    write_lock = threading.Lock()
    started = time.monotonic()
    completed_now = 0
    with GEMINI_PROGRESS_FILE.open("a", encoding="utf-8") as output:
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = {
                pool.submit(gemini_request, api_key, request): request["custom_id"]
                for request in pending
            }
            for future in concurrent.futures.as_completed(futures):
                custom_id = str(futures[future])
                try:
                    result = future.result()
                except Exception as exc:
                    raise RuntimeError(f"Gemini request failed at {custom_id}") from exc
                with write_lock:
                    output.write(
                        json.dumps(result, ensure_ascii=False, separators=(",", ":"))
                        + "\n"
                    )
                    output.flush()
                completed_now += 1
                if completed_now % 100 == 0 or completed_now == len(pending):
                    elapsed = max(1.0, time.monotonic() - started)
                    rate = completed_now / elapsed
                    remaining = (len(pending) - completed_now) / rate if rate else 0
                    print(
                        f"Gemini progress: {completed_now:,}/{len(pending):,} new "
                        f"({rate:.1f} req/s, ~{remaining / 60:.1f} min remaining)",
                        flush=True,
                    )


def gemini_batch_line(batch_request: dict[str, Any]) -> dict[str, Any]:
    body = batch_request["body"]
    return {
        "key": batch_request["custom_id"],
        "request": {
            "contents": [
                {
                    "parts": [{"text": body["input"][1]["content"]}],
                    "role": "user",
                }
            ],
            "system_instruction": {
                "parts": [{"text": body["input"][0]["content"]}]
            },
            "generation_config": {
                "max_output_tokens": 12_000,
                "response_mime_type": "application/json",
                "thinking_config": {"thinking_level": GEMINI_THINKING_LEVEL},
            },
        },
    }


def write_current_gemini_batch(requests: list[dict[str, Any]]) -> None:
    with GEMINI_BATCH_INPUT_FILE.open("w", encoding="utf-8") as output:
        for request in requests:
            output.write(
                json.dumps(
                    gemini_batch_line(request),
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
                + "\n"
            )


def download_gemini_batch_file(api_key: str, file_name: str, output: Path) -> None:
    base_url = "https://generativelanguage.googleapis.com/v1beta"
    urls = [
        f"{base_url}/{file_name}:download?key={api_key}&alt=media",
        f"{base_url}/{file_name}?key={api_key}&alt=media",
    ]
    last_error: Exception | None = None
    for url in urls:
        try:
            with urllib.request.urlopen(url, timeout=180) as response:
                output.write_bytes(response.read())
            return
        except Exception as exc:  # noqa: BLE001 - preserve the fallback URL
            last_error = exc
    raise RuntimeError(f"Could not download Gemini batch result {file_name}: {last_error}")


def import_gemini_batch_result(result_file: Path) -> int:
    existing = read_gemini_progress()
    imported = 0
    errors: list[dict[str, str]] = []
    with GEMINI_BATCH_PROGRESS_FILE.open("a", encoding="utf-8") as output:
        for row in iter_jsonl(result_file):
            custom_id = str(row.get("key") or "")
            if not custom_id or custom_id in existing:
                continue
            try:
                response = row.get("response") or {}
                text = "".join(
                    part.get("text", "")
                    for part in response["candidates"][0]["content"]["parts"]
                )
                translations = parse_translation_array(text)
                start, end = parse_custom_id(custom_id)
                if len(translations) != end - start:
                    raise RuntimeError(
                        f"expected {end - start} translations, got {len(translations)}"
                    )
                checkpoint = {
                    "customId": custom_id,
                    "translations": translations,
                    "usage": response.get("usageMetadata", {}),
                }
                output.write(
                    json.dumps(checkpoint, ensure_ascii=False, separators=(",", ":"))
                    + "\n"
                )
                existing[custom_id] = checkpoint
                imported += 1
            except Exception as exc:  # noqa: BLE001 - leave the block pending for retry
                errors.append(
                    {
                        "resultFile": str(result_file),
                        "customId": custom_id,
                        "error": str(exc),
                    }
                )
    if errors:
        error_file = ERROR_DIR / "gemini-batch-import-errors.jsonl"
        with error_file.open("a", encoding="utf-8") as output:
            for error in errors:
                output.write(json.dumps(error, ensure_ascii=False) + "\n")
        print(
            f"Gemini Batch: left {len(errors):,} malformed blocks pending for retry "
            f"({error_file})",
            flush=True,
        )
    return imported


def run_gemini_batch(poll_interval: int = 20) -> None:
    """Consume the untouched corpus tail through Gemini's separate Batch queue."""
    from google import genai
    from google.genai import types

    ensure_work_dirs()
    api_key = load_gemini_env()
    client = genai.Client(api_key=api_key)

    while True:
        completed = read_gemini_progress()
        pending = [
            request
            for request in iter_batch_requests()
            if str(request["custom_id"]) not in completed
        ]
        if not pending and not GEMINI_BATCH_JOB_FILE.exists():
            print(f"Gemini Batch: all {len(completed):,} requests are complete")
            return

        if GEMINI_BATCH_JOB_FILE.exists():
            metadata = json.loads(GEMINI_BATCH_JOB_FILE.read_text(encoding="utf-8"))
        else:
            selected = pending[-GEMINI_REQUESTS_PER_BATCH_JOB:]
            write_current_gemini_batch(selected)
            display_name = f"kiokun-ko-en-{selected[0]['custom_id']}-{int(time.time())}"
            print(
                f"Gemini Batch: uploading {len(selected):,} tail requests "
                f"({selected[0]['custom_id']} … {selected[-1]['custom_id']})",
                flush=True,
            )
            uploaded = client.files.upload(
                file=str(GEMINI_BATCH_INPUT_FILE),
                config=types.UploadFileConfig(
                    display_name=display_name,
                    mime_type="application/jsonl",
                ),
            )
            job = client.batches.create(
                model=f"models/{GEMINI_MODEL_NAME}",
                src=uploaded.name,
                config={"display_name": display_name},
            )
            metadata = {
                "jobName": job.name,
                "uploadedFile": uploaded.name,
                "firstKey": selected[0]["custom_id"],
                "lastKey": selected[-1]["custom_id"],
                "requestCount": len(selected),
                "createdAt": int(time.time()),
            }
            GEMINI_BATCH_JOB_FILE.write_text(
                json.dumps(metadata, indent=2), encoding="utf-8"
            )
            print(f"Gemini Batch: submitted {job.name}", flush=True)

        last_state = ""
        while True:
            job = client.batches.get(name=metadata["jobName"])
            state = (
                job.state.name if hasattr(job.state, "name") else str(job.state)
            )
            if state != last_state:
                print(f"Gemini Batch: {state}", flush=True)
                last_state = state
            if state in {"JOB_STATE_SUCCEEDED", "SUCCEEDED"}:
                break
            if state in {
                "JOB_STATE_FAILED",
                "FAILED",
                "JOB_STATE_CANCELLED",
                "CANCELLED",
                "JOB_STATE_EXPIRED",
                "EXPIRED",
            }:
                raise RuntimeError(f"Gemini batch ended in {state}: {job}")
            time.sleep(poll_interval)

        destination = getattr(job, "dest", None)
        file_name = getattr(destination, "file_name", None) if destination else None
        if not file_name:
            raise RuntimeError(f"Gemini batch has no downloadable result: {job}")
        result_file = GEMINI_BATCH_RESULT_DIR / (
            metadata["jobName"].replace("/", "-") + ".jsonl"
        )
        download_gemini_batch_file(api_key, file_name, result_file)
        imported = import_gemini_batch_result(result_file)
        metadata["completedAt"] = int(time.time())
        metadata["resultFile"] = str(result_file)
        metadata["imported"] = imported
        with GEMINI_BATCH_JOB_LOG.open("a", encoding="utf-8") as log:
            log.write(json.dumps(metadata, separators=(",", ":")) + "\n")
        GEMINI_BATCH_JOB_FILE.unlink()
        print(
            f"Gemini Batch: imported {imported:,}; "
            f"{len(read_gemini_progress()):,}/7,278 requests complete",
            flush=True,
        )


def download_results(client: OpenAI, metadata: dict[str, Any], force: bool = False) -> Path:
    batch_stem = Path(metadata["batchFile"]).stem
    result_path = RESULT_DIR / f"{batch_stem}.jsonl"
    if result_path.exists() and not force:
        return result_path

    job = client.batches.retrieve(metadata["jobId"])
    if str(job.status) != "completed":
        raise RuntimeError(f"{batch_stem}: batch is {job.status}, not completed")
    if not job.output_file_id:
        raise RuntimeError(f"{batch_stem}: completed batch has no output file")

    content = client.files.content(job.output_file_id)
    if hasattr(content, "write_to_file"):
        content.write_to_file(result_path)
    else:
        raw = content.read() if hasattr(content, "read") else bytes(content)
        result_path.write_bytes(raw)
    return result_path


def collect_translation_blocks(
    result_files: list[Path],
) -> tuple[dict[int, list[str]], list[dict[str, Any]]]:
    blocks: dict[int, list[str]] = {}
    errors: list[dict[str, Any]] = []

    for result_file in result_files:
        for row in iter_jsonl(result_file):
            custom_id = str(row.get("custom_id") or "")
            try:
                start, end = parse_custom_id(custom_id)
                response = row.get("response") or {}
                if response.get("status_code") != 200:
                    raise ValueError(
                        f"HTTP {response.get('status_code')}: {response.get('body')}"
                    )
                body = response.get("body") or {}
                translations = parse_translation_array(response_text(body))
                expected = end - start
                if len(translations) != expected:
                    raise ValueError(
                        f"expected {expected} translations, got {len(translations)}"
                    )
                if start in blocks:
                    raise ValueError(f"duplicate response block starting at {start}")
                blocks[start] = translations
            except Exception as exc:  # noqa: BLE001 - preserve repair evidence
                errors.append(
                    {
                        "resultFile": str(result_file),
                        "customId": custom_id,
                        "error": str(exc),
                        "providerError": row.get("error"),
                    }
                )

    return blocks, errors


def output_part(row_id: str) -> int:
    digest = hashlib.sha256(row_id.encode("utf-8")).digest()
    return digest[0] % OUTPUT_PARTS


def source_sha256() -> str:
    digest = hashlib.sha256()
    with SOURCE_FILE.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def write_translation_parts(
    blocks: dict[int, list[str]],
    *,
    model: str,
    reasoning_effort: str,
    batch_jobs: list[str] | None = None,
) -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    temp_paths = [OUTPUT_DIR / f"part-{index:02x}.jsonl.tmp" for index in range(OUTPUT_PARTS)]
    final_paths = [OUTPUT_DIR / f"part-{index:02x}.jsonl" for index in range(OUTPUT_PARTS)]

    source_iter = iter_jsonl(SOURCE_FILE)
    written = 0
    expected_start = 0
    with ExitStack() as stack:
        writers = [
            stack.enter_context(path.open("w", encoding="utf-8")) for path in temp_paths
        ]
        for start in sorted(blocks):
            if start != expected_start:
                raise RuntimeError(
                    f"Missing translation block: expected start {expected_start}, got {start}"
                )
            translations = blocks[start]
            for translation in translations:
                try:
                    source = next(source_iter)
                except StopIteration as exc:
                    raise RuntimeError("Provider returned more translations than source rows") from exc

                korean = str(source.get("korean") or "").strip()
                english = translation.strip()
                if not english:
                    raise RuntimeError(f"{source.get('id')}: empty translation")
                if HANGUL_RE.search(english) and not ASCII_LETTER_RE.search(english):
                    raise RuntimeError(
                        f"{source.get('id')}: translation contains Korean but no English: {english!r}"
                    )
                output = {
                    "id": source["id"],
                    "korean": korean,
                    "translation": english,
                }
                part = output_part(str(source["id"]))
                writers[part].write(
                    json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n"
                )
                written += 1
            expected_start += len(translations)

        try:
            extra = next(source_iter)
        except StopIteration:
            extra = None
        if extra is not None:
            raise RuntimeError(
                f"Provider returned only {written:,} translations; source rows remain"
            )

    for temp_path, final_path in zip(temp_paths, final_paths, strict=True):
        temp_path.replace(final_path)

    manifest = {
        "schemaVersion": 1,
        "language": "ko",
        "targetLanguage": "en",
        "source": "KRDICT examples extracted by the Rust dictionary loader",
        "model": model,
        "reasoningEffort": reasoning_effort,
        "records": written,
        "parts": OUTPUT_PARTS,
        "sourceSha256": source_sha256(),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "batchJobs": batch_jobs or [],
    }
    MANIFEST_FILE.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return written


def process(force_download: bool = False) -> None:
    ensure_work_dirs()
    client = get_client()
    metadata = read_job_metadata()
    result_files = [
        download_results(client, item, force=force_download) for item in metadata
    ]
    blocks, errors = collect_translation_blocks(result_files)
    if errors:
        error_path = ERROR_DIR / "process-errors.json"
        error_path.write_text(
            json.dumps(errors, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        raise SystemExit(
            f"{len(errors):,} provider responses need repair; details: {error_path}"
        )

    written = write_translation_parts(
        blocks,
        model=MODEL_NAME,
        reasoning_effort=REASONING_EFFORT,
        batch_jobs=[str(item["jobId"]) for item in metadata],
    )
    print(f"Wrote {written:,} translations across {OUTPUT_PARTS} files in {OUTPUT_DIR}")


def process_gemini() -> None:
    completed = read_gemini_progress()
    blocks: dict[int, list[str]] = {}
    errors: list[str] = []
    for custom_id, row in completed.items():
        try:
            start, end = parse_custom_id(custom_id)
            translations = row.get("translations")
            if not isinstance(translations, list) or not all(
                isinstance(item, str) and item.strip() for item in translations
            ):
                raise ValueError("translations are not a non-empty string array")
            if len(translations) != end - start:
                raise ValueError(
                    f"expected {end - start} translations, got {len(translations)}"
                )
            blocks[start] = [item.strip() for item in translations]
        except Exception as exc:  # noqa: BLE001 - report every corrupt checkpoint
            errors.append(f"{custom_id}: {exc}")
    expected_requests = sum(1 for _ in iter_batch_requests())
    if len(blocks) != expected_requests or errors:
        raise SystemExit(
            f"Gemini results are incomplete/corrupt: {len(blocks):,}/{expected_requests:,} "
            f"blocks, {len(errors):,} errors"
        )
    written = write_translation_parts(
        blocks,
        model=GEMINI_MODEL_NAME,
        reasoning_effort=GEMINI_THINKING_LEVEL,
    )
    print(f"Wrote {written:,} translations across {OUTPUT_PARTS} files in {OUTPUT_DIR}")


def verify() -> None:
    if not SOURCE_FILE.exists():
        raise SystemExit("Source export is missing; run prepare first")
    translation_files = sorted(OUTPUT_DIR.glob("part-*.jsonl"))
    if len(translation_files) != OUTPUT_PARTS:
        raise SystemExit(
            f"Expected {OUTPUT_PARTS} translation parts, found {len(translation_files)}"
        )

    translations: dict[str, tuple[str, str]] = {}
    duplicate_ids: list[str] = []
    for path in translation_files:
        for row in iter_jsonl(path):
            row_id = str(row.get("id") or "")
            value = (
                str(row.get("korean") or ""),
                str(row.get("translation") or "").strip(),
            )
            if row_id in translations:
                duplicate_ids.append(row_id)
            translations[row_id] = value

    missing: list[str] = []
    mismatched: list[str] = []
    empty: list[str] = []
    untranslated: list[str] = []
    hangul_in_english = 0
    source_count = 0
    for source in iter_jsonl(SOURCE_FILE):
        source_count += 1
        row_id = str(source.get("id") or "")
        value = translations.pop(row_id, None)
        if value is None:
            if len(missing) < 20:
                missing.append(row_id)
            continue
        korean, english = value
        if korean != source.get("korean") and len(mismatched) < 20:
            mismatched.append(row_id)
        if not english and len(empty) < 20:
            empty.append(row_id)
        if english == korean and len(untranslated) < 20:
            untranslated.append(row_id)
        if HANGUL_RE.search(english):
            hangul_in_english += 1

    problems = {
        "duplicateIds": duplicate_ids[:20],
        "missing": missing,
        "stale": list(translations)[:20],
        "sourceMismatches": mismatched,
        "emptyTranslations": empty,
        "untranslated": untranslated,
    }
    bad = {name: values for name, values in problems.items() if values}
    if bad:
        raise SystemExit("Verification failed:\n" + json.dumps(bad, ensure_ascii=False, indent=2))

    manifest = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    if manifest.get("records") != source_count:
        raise SystemExit(
            f"Manifest records={manifest.get('records')} but source has {source_count}"
        )
    if manifest.get("sourceSha256") != source_sha256():
        raise SystemExit("Manifest source SHA-256 does not match the current Rust export")

    print(
        f"Verified {source_count:,} exact occurrence translations; "
        f"{hangul_in_english:,} English rows intentionally retain quoted Korean"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    prepare_parser = sub.add_parser("prepare", help="Export examples and create Batch JSONL")
    prepare_parser.add_argument("--force-export", action="store_true")
    prepare_parser.add_argument("--force-batches", action="store_true")

    submit_parser = sub.add_parser("submit", help="Upload a bounded number of Batch files")
    submit_parser.add_argument("--force", action="store_true")
    submit_parser.add_argument(
        "--limit",
        type=int,
        default=1,
        help="Maximum new jobs to enqueue (0 means all; default: 1)",
    )

    run_parser = sub.add_parser(
        "run", help="Resume the one-at-a-time submit/wait loop through the whole corpus"
    )
    run_parser.add_argument("--poll-interval", type=int, default=30)

    status_parser = sub.add_parser("status", help="Inspect submitted Batch jobs")
    status_parser.add_argument("--wait", action="store_true")
    status_parser.add_argument("--poll-interval", type=int, default=30)

    process_parser = sub.add_parser("process", help="Download and materialize translations")
    process_parser.add_argument("--force-download", action="store_true")

    gemini_parser = sub.add_parser(
        "translate-gemini",
        help="Run the parallel, resumable Gemini 3.6 minimal fallback",
    )
    gemini_parser.add_argument("--concurrency", type=int, default=24)

    gemini_batch_parser = sub.add_parser(
        "run-gemini-batch",
        help="Resume serial Gemini Batch jobs from the untouched corpus tail",
    )
    gemini_batch_parser.add_argument("--poll-interval", type=int, default=20)

    import_batch_parser = sub.add_parser(
        "import-gemini-batch",
        help="Import a previously downloaded Gemini Batch result JSONL",
    )
    import_batch_parser.add_argument("path", type=Path)

    sub.add_parser(
        "process-gemini",
        help="Materialize completed Gemini checkpoints as translation parts",
    )

    sub.add_parser("verify", help="Verify exact source/output coverage")

    args = parser.parse_args()
    if args.command == "prepare":
        prepare(
            force_export=args.force_export,
            force_batches=args.force_batches,
        )
    elif args.command == "submit":
        submit(force=args.force, limit=args.limit)
    elif args.command == "run":
        run(poll_interval=args.poll_interval)
    elif args.command == "status":
        complete = status(wait=args.wait, poll_interval=args.poll_interval)
        if not complete:
            sys.exit(1)
    elif args.command == "process":
        process(force_download=args.force_download)
    elif args.command == "translate-gemini":
        translate_gemini(concurrency=args.concurrency)
    elif args.command == "run-gemini-batch":
        run_gemini_batch(poll_interval=args.poll_interval)
    elif args.command == "import-gemini-batch":
        print(f"Imported {import_gemini_batch_result(args.path):,} request blocks")
    elif args.command == "process-gemini":
        process_gemini()
    elif args.command == "verify":
        verify()
    else:
        raise AssertionError(args.command)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
