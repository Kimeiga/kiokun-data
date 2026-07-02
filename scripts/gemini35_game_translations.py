#!/usr/bin/env python3
"""
Regenerate Kiokun /game translations with Gemini 3.5 Flash.

The script keeps paid/large artifacts under data/game_translations_gemini35/,
which is gitignored. Typical flow:

  python3 scripts/gemini35_game_translations.py prepare
  python3 scripts/gemini35_game_translations.py submit --langs ja zh ko tr
  python3 scripts/gemini35_game_translations.py status --langs ja zh ko tr
  python3 scripts/gemini35_game_translations.py process --langs ja zh ko tr

The source corpus is the current public duojp unified data used by prod.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types


ROOT = Path(__file__).resolve().parents[1]
WORK_DIR = ROOT / "data" / "game_translations_gemini35"
SOURCE_FILE = WORK_DIR / "source_sentences.jsonl"
BATCH_DIR = WORK_DIR / "batch_requests"
JOB_DIR = WORK_DIR / "jobs"
OUT_DIR = WORK_DIR / "translations"
ERROR_DIR = WORK_DIR / "errors"

SOURCE_DATA_PATH = "https://raw.githubusercontent.com/Kimeiga/duojp/main/frontend/static/data-unified"
MODEL_NAME = "gemini-3.5-flash"
SENTENCES_PER_REQUEST = 40


@dataclass(frozen=True)
class LangSpec:
    code: str
    label: str
    output_hint: str
    examples: tuple[str, str]


LANGS: dict[str, LangSpec] = {
    "ja": LangSpec(
        "ja",
        "Japanese",
        "modern natural Japanese using Japanese script, not romaji",
        ("I made up my mind.", "決心した。"),
    ),
    "zh": LangSpec(
        "zh",
        "Mandarin Chinese",
        "natural Mandarin Chinese using simplified Chinese characters",
        ("I made up my mind.", "我下定决心了。"),
    ),
    "ko": LangSpec(
        "ko",
        "Korean",
        "natural Korean using Hangul",
        ("I made up my mind.", "마음을 정했어."),
    ),
    "tr": LangSpec(
        "tr",
        "Turkish",
        "natural Turkish",
        ("I made up my mind.", "Kararımı verdim."),
    ),
}


def ensure_dirs() -> None:
    for directory in (WORK_DIR, BATCH_DIR, JOB_DIR, OUT_DIR, ERROR_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def load_env() -> None:
    load_dotenv(ROOT / "scripts" / ".env")
    if not os.getenv("GEMINI_API_KEY"):
        raise SystemExit("GEMINI_API_KEY is not set in the environment or scripts/.env")


def fetch_json(url: str) -> Any:
    with urllib.request.urlopen(url) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_source(force: bool = False) -> list[dict[str, Any]]:
    ensure_dirs()
    if SOURCE_FILE.exists() and not force:
        return load_source()

    manifest = fetch_json(f"{SOURCE_DATA_PATH}/manifest.json")
    rows: list[dict[str, Any]] = []
    position = 0

    for chunk_idx in range(manifest["chunks"]):
        chunk = fetch_json(f"{SOURCE_DATA_PATH}/chunks/{chunk_idx}.json")
        for sentence in chunk:
            rows.append(
                {
                    "pos": position,
                    "id": sentence.get("id", position),
                    "en": (sentence.get("en") or "").strip(),
                }
            )
            position += 1
        print(f"Fetched chunk {chunk_idx + 1}/{manifest['chunks']}", end="\r")

    with SOURCE_FILE.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"\nWrote {len(rows):,} source sentences to {SOURCE_FILE}")
    return rows


def load_source() -> list[dict[str, Any]]:
    if not SOURCE_FILE.exists():
        return fetch_source()

    rows = []
    with SOURCE_FILE.open(encoding="utf-8") as f:
        for line in f:
            if line.strip():
                rows.append(json.loads(line))
    return rows


def system_prompt(spec: LangSpec) -> str:
    example_en, example_target = spec.examples
    return f"""Translate English example sentences into {spec.label}.

Output requirements:
- Return ONLY a JSON array of strings, in the exact same order as the input array.
- Each output string must be {spec.output_hint}.
- Preserve the meaning, tense, names, numbers, register, and sentence/fragment status.
- Translate idioms by meaning, not word by word.
- Do not add explanations, labels, markdown, transliteration, or extra alternatives.

Example input: ["{example_en}"]
Example output: ["{example_target}"]"""


def create_batch_request(lang: str, batch: list[dict[str, Any]], start: int) -> dict[str, Any]:
    spec = LANGS[lang]
    english = [row["en"] for row in batch]
    prompt = "Translate these English sentences:\n" + json.dumps(english, ensure_ascii=False)
    return {
        "key": f"{lang}-{start}-{start + len(batch)}",
        "request": {
            "contents": [{"parts": [{"text": prompt}], "role": "user"}],
            "system_instruction": {"parts": [{"text": system_prompt(spec)}]},
        },
    }


def prepare(langs: list[str], force_source: bool = False, force_batches: bool = False) -> None:
    ensure_dirs()
    rows = fetch_source(force=force_source)
    for lang in langs:
        batch_file = BATCH_DIR / f"{lang}.jsonl"
        if batch_file.exists() and not force_batches:
            print(f"{lang}: {batch_file} already exists")
            continue

        request_count = 0
        with batch_file.open("w", encoding="utf-8") as f:
            for start in range(0, len(rows), SENTENCES_PER_REQUEST):
                batch = rows[start : start + SENTENCES_PER_REQUEST]
                f.write(json.dumps(create_batch_request(lang, batch, start), ensure_ascii=False) + "\n")
                request_count += 1

        print(f"{lang}: wrote {request_count:,} requests to {batch_file}")


def get_client() -> genai.Client:
    load_env()
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def submit(langs: list[str], force: bool = False) -> None:
    ensure_dirs()
    client = get_client()
    for lang in langs:
        batch_file = BATCH_DIR / f"{lang}.jsonl"
        job_file = JOB_DIR / f"{lang}.json"
        if job_file.exists() and not force:
            print(f"{lang}: job already recorded in {job_file}")
            continue
        if not batch_file.exists():
            raise SystemExit(f"{batch_file} is missing; run prepare first")

        display_name = f"kiokun-game-{lang}-gemini35-{int(time.time())}"
        uploaded_file = client.files.upload(
            file=str(batch_file),
            config=types.UploadFileConfig(display_name=display_name, mime_type="application/jsonl"),
        )
        job = client.batches.create(
            model=f"models/{MODEL_NAME}",
            src=uploaded_file.name,
            config={"display_name": display_name},
        )
        metadata = {
            "lang": lang,
            "model": MODEL_NAME,
            "job_name": job.name,
            "display_name": display_name,
            "uploaded_file": uploaded_file.name,
            "source_file": str(SOURCE_FILE),
            "batch_file": str(batch_file),
            "sentences_per_request": SENTENCES_PER_REQUEST,
            "created_at": int(time.time()),
        }
        job_file.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        print(f"{lang}: submitted {job.name}")


def read_job(lang: str) -> dict[str, Any]:
    job_file = JOB_DIR / f"{lang}.json"
    if not job_file.exists():
        raise SystemExit(f"{lang}: no job metadata found at {job_file}")
    return json.loads(job_file.read_text(encoding="utf-8"))


def job_state(job: Any) -> str:
    return job.state.name if hasattr(job.state, "name") else str(job.state)


def status(langs: list[str], wait: bool = False, poll_interval: int = 60) -> None:
    client = get_client()
    for lang in langs:
        meta = read_job(lang)
        while True:
            job = client.batches.get(name=meta["job_name"])
            state = job_state(job)
            stats = getattr(job, "stats", None)
            stats_text = ""
            if stats:
                total = getattr(stats, "total_count", None)
                success = getattr(stats, "success_count", None)
                failure = getattr(stats, "failure_count", None)
                stats_text = f" total={total} success={success} failure={failure}"
            print(f"{lang}: {state}{stats_text}")

            if not wait or state in {
                "JOB_STATE_SUCCEEDED",
                "SUCCEEDED",
                "JOB_STATE_FAILED",
                "FAILED",
                "JOB_STATE_CANCELLED",
                "CANCELLED",
                "JOB_STATE_EXPIRED",
                "EXPIRED",
            }:
                break
            time.sleep(poll_interval)


def download_batch_results(file_name: str) -> list[dict[str, Any]]:
    api_key = os.environ["GEMINI_API_KEY"]
    base_url = "https://generativelanguage.googleapis.com/v1beta"
    urls = [
        f"{base_url}/{file_name}:download?key={api_key}&alt=media",
        f"{base_url}/{file_name}?key={api_key}&alt=media",
    ]
    last_error: Exception | None = None
    for url in urls:
        try:
            with urllib.request.urlopen(url) as response:
                content = response.read().decode("utf-8")
            return [json.loads(line) for line in content.splitlines() if line.strip()]
        except Exception as exc:  # noqa: BLE001 - keep fallback attempt simple
            last_error = exc
    raise RuntimeError(f"Could not download batch results for {file_name}: {last_error}")


def extract_response_text(resp: Any) -> str | None:
    if not isinstance(resp, dict):
        response = getattr(resp, "response", None)
        return response.text.strip() if response and hasattr(response, "text") and response.text else None

    data = resp.get("response") or {}
    try:
        parts = data["candidates"][0]["content"]["parts"]
        if parts and parts[0].get("text"):
            return parts[0]["text"].strip()
    except (KeyError, IndexError, TypeError):
        return None
    return None


def parse_json_array(text: str) -> list[str]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        cleaned = cleaned.rsplit("```", 1)[0].strip()
    parsed = json.loads(cleaned)
    if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
        raise ValueError("response is not a JSON string array")
    return parsed


def process(langs: list[str]) -> None:
    ensure_dirs()
    client = get_client()
    rows = load_source()

    for lang in langs:
        meta = read_job(lang)
        job = client.batches.get(name=meta["job_name"])
        state = job_state(job)
        if state not in {"JOB_STATE_SUCCEEDED", "SUCCEEDED"}:
            print(f"{lang}: job is {state}; skipping")
            continue

        responses: list[Any] = []
        dest = getattr(job, "dest", None)
        if dest and getattr(dest, "inlined_responses", None):
            responses = list(dest.inlined_responses)
        elif dest and getattr(dest, "file_name", None):
            responses = download_batch_results(dest.file_name)
        else:
            print(f"{lang}: no batch destination found")
            continue

        by_start: dict[int, list[str]] = {}
        errors: list[dict[str, Any]] = []
        for resp in responses:
            key = resp.get("key") if isinstance(resp, dict) else getattr(resp, "key", None)
            try:
                _, start_s, end_s = str(key).split("-")
                start = int(start_s)
                expected_len = int(end_s) - start
                text = extract_response_text(resp)
                if not text:
                    raise ValueError("empty response text")
                translations = parse_json_array(text)
                if len(translations) != expected_len:
                    raise ValueError(f"expected {expected_len} translations, got {len(translations)}")
                by_start[start] = translations
            except Exception as exc:  # noqa: BLE001 - preserve response info for repair
                errors.append({"key": key, "error": str(exc), "response": resp})

        out_file = OUT_DIR / f"{lang}.jsonl"
        count = 0
        with out_file.open("w", encoding="utf-8") as f:
            for start in sorted(by_start):
                translations = by_start[start]
                for offset, text in enumerate(translations):
                    source = rows[start + offset]
                    f.write(
                        json.dumps(
                            {
                                "pos": source["pos"],
                                "id": source["id"],
                                "en": source["en"],
                                lang: text.strip(),
                            },
                            ensure_ascii=False,
                        )
                        + "\n"
                    )
                    count += 1

        if errors:
            error_file = ERROR_DIR / f"{lang}.json"
            error_file.write_text(json.dumps(errors, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"{lang}: wrote {count:,} rows with {len(errors):,} response errors ({error_file})")
        else:
            print(f"{lang}: wrote {count:,} rows to {out_file}")


def parse_langs(values: list[str] | None) -> list[str]:
    langs = values or list(LANGS)
    unknown = [lang for lang in langs if lang not in LANGS]
    if unknown:
        raise SystemExit(f"Unknown language(s): {', '.join(unknown)}")
    return langs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_prepare = sub.add_parser("prepare", help="Fetch source corpus and create batch request files")
    p_prepare.add_argument("--langs", nargs="+", choices=sorted(LANGS), help="Languages to prepare")
    p_prepare.add_argument("--force-source", action="store_true")
    p_prepare.add_argument("--force-batches", action="store_true")

    p_submit = sub.add_parser("submit", help="Submit Gemini Batch API jobs")
    p_submit.add_argument("--langs", nargs="+", choices=sorted(LANGS), help="Languages to submit")
    p_submit.add_argument("--force", action="store_true", help="Submit even if a job metadata file exists")

    p_status = sub.add_parser("status", help="Check batch job status")
    p_status.add_argument("--langs", nargs="+", choices=sorted(LANGS), help="Languages to check")
    p_status.add_argument("--wait", action="store_true", help="Poll until terminal state")
    p_status.add_argument("--poll-interval", type=int, default=60)

    p_process = sub.add_parser("process", help="Download and parse completed batch results")
    p_process.add_argument("--langs", nargs="+", choices=sorted(LANGS), help="Languages to process")

    args = parser.parse_args()
    langs = parse_langs(getattr(args, "langs", None))

    if args.cmd == "prepare":
        prepare(langs, force_source=args.force_source, force_batches=args.force_batches)
    elif args.cmd == "submit":
        submit(langs, force=args.force)
    elif args.cmd == "status":
        status(langs, wait=args.wait, poll_interval=args.poll_interval)
    elif args.cmd == "process":
        process(langs)
    else:
        raise AssertionError(args.cmd)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
