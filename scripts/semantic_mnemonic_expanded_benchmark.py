#!/usr/bin/env python3
"""Run a wider semantic mnemonic model benchmark without overwriting the 2-card bakeoff."""

from __future__ import annotations

import argparse
import json
import shutil
import time
import urllib.error
import urllib.request
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import semantic_mnemonics as sem


BENCHMARK_CHARS = "連 憂 愛 後 教 受 解 務 憲 寒 寝 真 会 家 若 医 学 本 謝 議 稲 稻".split()
SCRIPT_OUTPUT_PATH = sem.SCRIPTS_DIR / "semantic_mnemonic_benchmark_22.json"
STATIC_OUTPUT_PATH = sem.RESEARCH_DIR / "semantic_mnemonic_benchmark_22.json"


def prepare_benchmark_cards() -> tuple[list[dict[str, Any]], dict[str, str]]:
    cards: list[dict[str, Any]] = []
    skipped: dict[str, str] = {}
    for char in BENCHMARK_CHARS:
        _, card, reason = sem.prepare_one_card(char)
        if card:
            cards.append(sem.normalize_prepared_card(card))
        else:
            skipped[char] = reason or "unknown skip"
    return cards, skipped


def load_existing(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def save_payload(payload: dict[str, Any]) -> None:
    sem.RESEARCH_DIR.mkdir(parents=True, exist_ok=True)
    SCRIPT_OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    shutil.copyfile(SCRIPT_OUTPUT_PATH, STATIC_OUTPUT_PATH)


def chunked(items: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def run_one_model(spec: sem.ModelSpec, cards: list[dict[str, Any]], batch_size: int) -> dict[str, Any]:
    tuned = replace(spec, max_output_tokens=max(spec.max_output_tokens, 8192), timeout=max(spec.timeout, 180))
    record: dict[str, Any] = {
        "name": tuned.name,
        "provider": tuned.provider,
        "model": tuned.model,
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    start = time.time()
    outputs: list[dict[str, Any]] = []
    chunk_errors: list[dict[str, Any]] = []

    try:
        for index, chunk in enumerate(chunked(cards, batch_size), start=1):
            chars = "".join(card["character"] for card in chunk)
            print(f"    chunk {index}: {chars}", flush=True)
            try:
                chunk_outputs, meta = sem.call_model(tuned, chunk)
                outputs.extend(chunk_outputs)
                record["last_meta"] = meta
                time.sleep(0.35)
            except Exception as exc:
                message = str(exc)
                chunk_errors.append({"characters": chars, "error": message})
                # Retry singles for likely output-size/format issues, but do not
                # spend extra calls on missing models, quota, auth, or permission.
                systemic = any(
                    token in message.lower()
                    for token in (
                        "404",
                        "not found",
                        "quota",
                        "authentication",
                        "permission",
                        "forbidden",
                        "invalid model",
                        "invalid json",
                    )
                )
                if systemic or len(chunk) == 1:
                    raise
                for single in chunk:
                    try:
                        single_outputs, meta = sem.call_model(tuned, [single])
                        outputs.extend(single_outputs)
                        record["last_meta"] = meta
                        time.sleep(0.35)
                    except Exception as single_exc:
                        chunk_errors.append({
                            "characters": single["character"],
                            "error": str(single_exc),
                        })

        if not outputs:
            raise RuntimeError("no usable normalized card objects returned")

        score, validations = sem.score_model_outputs(outputs, cards)
        problem_count = sum(len(item.get("problems") or []) for item in validations)
        valid_count = sum(1 for item in validations if item.get("valid"))
        record.update({
            "ok": True,
            "elapsed_seconds": round(time.time() - start, 2),
            "score": round(score, 3),
            "coverage": len({str(item.get("character")) for item in outputs}) / max(1, len(cards)),
            "valid_count": valid_count,
            "problem_count": problem_count,
            "outputs": outputs,
            "validations": validations,
            "chunk_errors": chunk_errors,
        })
    except Exception as exc:
        partial_score, validations = sem.score_model_outputs(outputs, cards) if outputs else (0.0, [])
        record.update({
            "ok": False,
            "elapsed_seconds": round(time.time() - start, 2),
            "error": str(exc),
            "partial_score": round(partial_score, 3),
            "outputs": outputs,
            "validations": validations,
            "chunk_errors": chunk_errors,
        })

    return record


def cloudflare_record(cards: list[dict[str, Any]]) -> dict[str, Any]:
    start = time.time()
    account_id = sem.ENV.get("CLOUDFLARE_ACCOUNT_ID")
    token = sem.ENV.get("CLOUDFLARE_API_TOKEN")
    record = {
        "name": "Cloudflare Workers AI",
        "provider": "cloudflare",
        "model": "Workers AI text-generation discovery",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    if not account_id or not token:
        return {
            **record,
            "ok": False,
            "elapsed_seconds": round(time.time() - start, 2),
            "error": "missing CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN",
        }

    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/models/search?task=text-generation&per_page=20"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        models = data.get("result") or []
        return {
            **record,
            "ok": False,
            "elapsed_seconds": round(time.time() - start, 2),
            "error": "Cloudflare model discovery succeeded, but no semantic mnemonic runner is wired for Workers AI in this repo.",
            "discovered_models": [
                {"name": item.get("name"), "id": item.get("id"), "task": item.get("task")}
                for item in models[:20]
            ],
        }
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="ignore")
        return {
            **record,
            "ok": False,
            "elapsed_seconds": round(time.time() - start, 2),
            "error": f"Cloudflare models/search returned HTTP {exc.code}: {body[:500]}",
        }
    except Exception as exc:
        return {
            **record,
            "ok": False,
            "elapsed_seconds": round(time.time() - start, 2),
            "error": str(exc),
        }


def available_models(include_openai: bool = True) -> list[sem.ModelSpec]:
    models: list[sem.ModelSpec] = []
    for spec in sem.CANDIDATE_MODELS:
        if spec.provider == "google" and (sem.ENV.get("GEMINI_API_KEY") or sem.ENV.get("GOOGLE_API_KEY")):
            models.append(spec)
        elif spec.provider == "anthropic" and sem.ENV.get("ANTHROPIC_API_KEY"):
            models.append(spec)
        elif include_openai and spec.provider == "openai" and sem.ENV.get("OPENAI_API_KEY"):
            models.append(spec)
    return models


def build_summary(payload: dict[str, Any]) -> None:
    ranked = sorted(
        (result for result in payload["results"] if result.get("ok")),
        key=lambda result: (
            -float(result.get("score", 0)),
            int(result.get("problem_count", 999)),
            float(result.get("elapsed_seconds", 999999)),
        ),
    )
    payload["ranked"] = [
        {
            "name": result["name"],
            "provider": result["provider"],
            "model": result["model"],
            "score": result["score"],
            "elapsed_seconds": result["elapsed_seconds"],
            "valid_count": result.get("valid_count", 0),
            "problem_count": result.get("problem_count", 0),
            "coverage": result.get("coverage", 0),
        }
        for result in ranked
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--models", nargs="*", default=None, help="Model names or IDs to run")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--skip-openai", action="store_true")
    args = parser.parse_args()

    cards, skipped = prepare_benchmark_cards()
    print(f"Prepared {len(cards)} cards; skipped {len(skipped)}", flush=True)
    if skipped:
        print(f"Skipped: {skipped}", flush=True)

    existing = load_existing(SCRIPT_OUTPUT_PATH)
    existing_results = existing.get("results") or []
    by_model = {result.get("model"): result for result in existing_results if result.get("model")}

    if args.models:
        models = [sem.parse_model_arg(item) for item in args.models]
    else:
        models = available_models(include_openai=not args.skip_openai)

    payload = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "prompt_note": "Expanded semantic-only mnemonic benchmark over 22 high-signal characters. Same strict JSON/component prompt as the original bakeoff; no pronunciation layer.",
        "characters": cards,
        "skipped": skipped,
        "results": [],
        "ranked": [],
    }

    for spec in models:
        if not args.force and spec.model in by_model:
            print(f"\n== reuse {spec.name} ({spec.model}) ==", flush=True)
            payload["results"].append(by_model[spec.model])
            build_summary(payload)
            save_payload(payload)
            continue

        print(f"\n== {spec.name} ({spec.model}) ==", flush=True)
        result = run_one_model(spec, cards, args.batch_size)
        print(
            f"  {'ok' if result.get('ok') else 'failed'} score={result.get('score', result.get('partial_score', '—'))} "
            f"valid={result.get('valid_count', '—')}/{len(cards)} elapsed={result.get('elapsed_seconds')}s",
            flush=True,
        )
        if result.get("error"):
            print(f"  error: {result['error'][:220]}", flush=True)
        payload["results"].append(result)
        build_summary(payload)
        save_payload(payload)

    cf_result = by_model.get("Workers AI text-generation discovery")
    if args.force or not cf_result:
        print("\n== Cloudflare Workers AI discovery ==", flush=True)
        cf_result = cloudflare_record(cards)
        print(f"  failed: {cf_result.get('error', '')[:220]}", flush=True)
    payload["results"].append(cf_result)
    build_summary(payload)
    save_payload(payload)

    print(f"\nWrote {SCRIPT_OUTPUT_PATH}")
    print(f"Copied {STATIC_OUTPUT_PATH}")
    print("\nRanked:")
    for row in payload["ranked"]:
        print(
            f"{row['score']:.3f}\tvalid {row['valid_count']:>2}/{len(cards)}\t"
            f"problems {row['problem_count']:>2}\t{row['elapsed_seconds']:>6.1f}s\t{row['name']}"
        )


if __name__ == "__main__":
    main()
