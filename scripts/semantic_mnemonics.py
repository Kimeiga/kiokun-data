#!/usr/bin/env python3
"""
Generate Kiokun semantic mnemonics.

This intentionally does not reuse the older pun/pronunciation mnemonic prompt.
The batch output is a structured JSON artifact that can be reviewed, inserted
into D1, or wired into character pages later.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
GAME_DATA_DIR = ROOT / "sveltekit-app" / "static" / "game_data"
RESEARCH_DIR = ROOT / "sveltekit-app" / "static" / "research" / "mnemonics"
IDS_DIR = ROOT / "data" / "ids"
BAKEOFF_PATH = SCRIPTS_DIR / "semantic_mnemonic_bakeoff.json"
OUTPUT_PATH = RESEARCH_DIR / "semantic_mnemonics_1000.json"
PROGRESS_PATH = SCRIPTS_DIR / "semantic_mnemonic_progress.json"
CARD_INPUT_CACHE_PATH = SCRIPTS_DIR / "semantic_mnemonic_card_inputs.json"
CARD_INPUT_CACHE_VERSION = 9
IDS_FORWARD_PATHS = [
    ROOT / "game-concepts" / "kanji-game" / "data" / "ids_forward.json",
    ROOT / "game-concepts" / "hanzi-quiz" / "data" / "ids_forward.json",
    ROOT / "game-concepts" / "kanji-card-game" / "static" / "data" / "ids_forward.json",
]


def load_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    env: dict[str, str] = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for rel in ("scripts/.env", "sveltekit-app/.env.local", "sveltekit-app/.dev.vars"):
        env.update(load_env_file(ROOT / rel))
    env.update({k: v for k, v in os.environ.items() if k in {
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
        "GOOGLE_API_KEY",
        "GEMINI_API_KEY",
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_API_TOKEN",
    }})
    return env


ENV = load_env()
GLOSSES: dict[str, str] = json.loads((GAME_DATA_DIR / "component_glosses.json").read_text())


MANUAL_GLOSS_OVERRIDES: dict[str, str] = {
    # These are the card design decisions from the current prompt. The repo's
    # existing glosses are still preserved in source data.
    "連": "connect",
    "憂": "worry",
    "車": "vehicle",
    "辶": "movement",
    "頁": "head",
    "夂": "walk",
    "儿": "human legs",
    "⺮": "bamboo",
    "竹": "bamboo",
    "幾": "how many",
    "乎": "ooh",
    "誰": "who",
    "館": "building",
    "冊": "volume",
    "飠": "food",
    "隹": "short-tailed bird",
    "◎": "marker",
    "寸": "inch",
    "寺": "temple",
    "厂": "cliff",
    "网": "net",
    "釒": "metal",
    "畐": "fill",
    "甫": "begin",
    "吾": "I",
    "罙": "deep",
    "袁": "loincloth",
    "𡆧": "ironware",
    "厷": "forearm",
    "豦": "wild boar",
    "龶": "growth",
    "圧": "pressure",
    "対": "opposite",
    "荷": "load",
    "忩": "hasty",
    "臤": "firm grip",
    "𰀡": "firm grip",
    "娲": "Nuwa",
    "媧": "Nuwa",
    "叱": "scold",
    "𠮟": "scold",
    "澪": "water route",
    "椙": "Japanese cedar",
    "礒": "rocky shore",
    "笘": "writing slate",
    "鯵": "horse mackerel",
    "鰺": "horse mackerel",
    "鲹": "horse mackerel",
    "梛": "nagi tree",
    "俥": "rickshaw",
    "溂": "lively",
    "鳰": "grebe",
    "﨟": "court rank",
    "欌": "cabinet",
    "慓": "nimble",
    "摋": "strike",
    "蹸": "trample",
    "笒": "bamboo flute",
    "倧": "progenitor",
    "栮": "mushroom",
    "堗": "heated floor",
    "辡": "dispute",
    "㚻": "sexual misconduct",
    "㓺": "cut punishment",
    "㔀": "branding punishment",
    "黥": "tattoo punishment",
}


MANUAL_COMPONENT_GLOSS_OVERRIDES: dict[str, str] = {
    # Visual/component-mode glosses. These intentionally differ from the
    # lexical gloss for some characters, e.g. 又 is "again" as a character but
    # usually a hand-shaped component inside larger forms.
    "囗": "enclosure",
    "又": "hand",
    "臣": "watchful eye",
    "臤": "firm grip",
    "爫": "reaching hand",
    "⺤": "grasping hand",
    "亽": "food cover",
    "乛": "hook mark",
    "乚": "turning hook",
    "㐬": "stream",
    "𫶧": "flow tail",
    "氏": "clan",
    "旡": "choked breath",
    "亀": "turtle",
    "龟": "turtle",
    "夊": "trailing foot",
    "幺": "thread",
    "髟": "long hair",
    "曷": "question",
    "丷": "split horns",
    "龰": "foot",
    "𠔼": "cover",
    "直": "straight",
    "𦥑": "mortar",
    "殳": "hand tool",
    "杀": "cut mark",
    "龹": "raised hands",
    "䒑": "grass top",
    "𦍌": "sheep",
    "氺": "water",
    "㐅": "cross",
    "龴": "top hook",
    "㔾": "seal",
    "劦": "triple power",
    "𠮛": "mouth",
    "𧘇": "garment hem",
    "𦣻": "head",
    "离": "netted beast",
    "𭔰": "beans measure",
    "鱼": "fish",
    "𧾷": "foot (side)",
    "钅": "metal",
    "纟": "silk",
    "贝": "shell",
    "马": "horse",
    "饣": "food (side)",
    "辡": "dispute",
}


MANUAL_IDS_OVERRIDES: dict[str, str] = {
    # Upstream CHISE IDS-UCS-Ext-H has this decomposition, but the local IDS
    # subset only contains Basic/Ext-A/JIS. Do not surface 𱬹 directly in
    # learner-facing cards; many fonts render it as missing-glyph tofu.
    "𱬹": "⿱爫旧",
    "𰕎": "⿰育攵",
    "𭔰": "⿱豆寸",
    "𠮟": "⿰口七",
    "𫲸": "⿱宀丰",
}


MANUAL_COMPONENT_OVERRIDES: dict[str, list[dict[str, str]]] = {
    "憂": [
        {"character": "頁", "gloss": "head"},
        {"character": "心", "gloss": "heart"},
        {"character": "夂", "gloss": "walk"},
    ],
}


IDS_OPERATORS = set("⿰⿱⿲⿳⿴⿵⿶⿷⿸⿹⿺⿻⿼⿽⿾⿿")
IDS_CACHE: dict[str, str] | None = None
IDS_FORWARD_CACHE: dict[str, Any] | None = None


BAKEOFF_CHARACTERS = [
    {
        "character": "連",
        "meaning": "connect",
        "components": [
            {"character": "辶", "gloss": "movement"},
            {"character": "車", "gloss": "vehicle"},
        ],
        "gold_equation": "辶 movement + 車 vehicle = 連 connect",
        "gold_mnemonic": "A 車 vehicle drives on a 辶 movement road, creating 連 connect between places.",
    },
    {
        "character": "憂",
        "meaning": "worry",
        "components": [
            {"character": "頁", "gloss": "head"},
            {"character": "心", "gloss": "heart"},
            {"character": "夂", "gloss": "walk"},
        ],
        "gold_equation": "頁 head + 心 heart + 夂 walk = 憂 worry",
        "gold_mnemonic": "A 頁 head heavy with thoughts and a 心 heart follow every 夂 walk, forming 憂 worry.",
    },
]


@dataclass(frozen=True)
class ModelSpec:
    name: str
    provider: str
    model: str
    max_output_tokens: int = 8192
    timeout: int = 120
    temperature: float = 0.35


CANDIDATE_MODELS = [
    ModelSpec("Gemini 3.5 Flash", "google", "gemini-3.5-flash"),
    ModelSpec("Gemini 3 Pro Preview", "google", "gemini-3-pro-preview"),
    ModelSpec("Gemini 3.1 Pro Preview", "google", "gemini-3.1-pro-preview"),
    ModelSpec("Gemini 3 Flash Preview", "google", "gemini-3-flash-preview"),
    ModelSpec("Gemini 3.1 Flash Lite", "google", "gemini-3.1-flash-lite"),
    ModelSpec("Gemini 2.5 Flash", "google", "gemini-2.5-flash"),
    ModelSpec("Gemini 2.5 Flash Lite", "google", "gemini-2.5-flash-lite"),
    ModelSpec("Gemini 2.5 Pro", "google", "gemini-2.5-pro"),
    ModelSpec("Gemma 4 31B", "google", "gemma-4-31b-it"),
    ModelSpec("Gemma 4 26B A4B", "google", "gemma-4-26b-a4b-it"),
    ModelSpec("GPT-5.5", "openai", "gpt-5.5"),
    ModelSpec("GPT-5.5 Pro", "openai", "gpt-5.5-pro", timeout=180),
    ModelSpec("GPT-5.4", "openai", "gpt-5.4"),
    ModelSpec("GPT-5.4 Mini", "openai", "gpt-5.4-mini"),
    ModelSpec("GPT-5.4 Nano", "openai", "gpt-5.4-nano"),
    ModelSpec("Claude Sonnet 5", "anthropic", "claude-sonnet-5"),
    ModelSpec("Claude Opus 4.8", "anthropic", "claude-opus-4-8", timeout=180),
    ModelSpec("Claude Haiku 4.5", "anthropic", "claude-haiku-4-5-20251001"),
]


SYSTEM_PROMPT = """You write polished semantic mnemonic cards for Kiokun, a serious kanji/hanzi-learning system.

Create short visual mnemonics that teach character meaning from components.
Do not include pronunciation, readings, puns, jokes, word anchors, or meta-commentary.

Two gloss layers:
- Lexical gloss is the real word/character meaning when the character is studied by itself.
- Visual component gloss is the shape meaning to use when that character acts inside another character.
- Use the provided component glosses exactly in the equation and mnemonic.
- Do not force lexical meanings into component stories when a visual gloss is provided.

Opaque components:
- Some components are not useful modern words but are reusable visual chunks.
- Use their provided mnemonic component gloss as the learner-facing component gloss.
- If an opaque component has visual expansion notes, use them only to make the story logical.
- Do not use old bad glosses such as gouge out an eye, KangXi radical, obscure component, variant, same, or Non-Classical.

Mnemonic requirements:
- One sentence only.
- Include every main component exactly as character + gloss.
- Include the final character exactly as character + gloss.
- Be concrete, short, internally consistent, and easy to picture.
- Avoid extra visual objects unless needed for the logic.
- The story should make the final meaning feel inevitable, not clever.
- No English pronunciation puns.
- No meta descriptions: do not say "the character combines", "this character", "component", "radical", or "represents".
- Never use the word "represents" in the mnemonic. Make the components directly cause, create, become, bring, mark, hold, carry, cover, cut, bind, or reveal the final meaning.
- Avoid filler words such as proudly, always, society, polite, poor, beautiful, magical, ancient, mystical, and glowing.

Return strict JSON only."""


def build_semantic_prompt(cards: list[dict[str, Any]]) -> str:
    prompt_cards = [
        {
            "character": card["character"],
            "meaning": card["meaning"],
            "components": card["components"],
            "required_pairs": [
                *(f"{component['character']} {component['gloss']}" for component in card["components"]),
                f"{card['character']} {card['meaning']}",
            ],
            "required_equation": (
                " + ".join(f"{component['character']} {component['gloss']}" for component in card["components"])
                + f" = {card['character']} {card['meaning']}"
            ),
        }
        for card in cards
    ]
    payload = {
        "task": "Generate semantic mnemonic card data.",
        "critical_contract": [
            "Copy required_equation exactly into the equation field.",
            "The mnemonic field must include every string in required_pairs exactly as written.",
            "Never write gloss (character) or character (gloss); write character space gloss.",
            "Never parenthesize the required character/gloss pairs.",
        ],
        "output_schema": [
            {
                "character": "string",
                "meaning": "string",
                "equation": "copy required_equation exactly",
                "mnemonic": "one sentence containing every exact required_pairs string",
                "hero_image_prompt": "concise illustration prompt, not a UI",
            }
        ],
        "cards": prompt_cards,
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def json_request(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    payload: dict[str, Any] | None = None,
    timeout: int = 120,
) -> Any:
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers or {}, method="POST" if payload is not None else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def extract_json_text(text: str) -> Any:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    try:
        start_array = cleaned.find("[")
        start_obj = cleaned.find("{")
        starts = [i for i in (start_array, start_obj) if i >= 0]
        if not starts:
            raise
        start = min(starts)
        end = max(cleaned.rfind("]"), cleaned.rfind("}"))
        if end <= start:
            raise
        return json.loads(cleaned[start : end + 1])
    except Exception:
        pass

    # Gemini occasionally returns valid card objects wrapped in a malformed
    # array tail, e.g. `[{"character": ...}}\n]`. Recover any complete card
    # objects before treating the response as unusable.
    decoder = json.JSONDecoder()
    items: list[dict[str, Any]] = []
    index = 0
    while index < len(cleaned):
        start = cleaned.find("{", index)
        if start < 0:
            break
        try:
            item, end = decoder.raw_decode(cleaned, start)
        except json.JSONDecodeError:
            index = start + 1
            continue
        if isinstance(item, dict) and {"character", "meaning", "equation", "mnemonic"}.issubset(item):
            items.append(item)
        index = max(end, start + 1)
    if items:
        return items
    raise json.JSONDecodeError("could not recover JSON card data", cleaned, 0)


def normalize_model_output(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, dict):
        for key in ("cards", "results", "mnemonics", "items"):
            if isinstance(data.get(key), list):
                data = data[key]
                break
        else:
            if all(isinstance(value, dict) for value in data.values()):
                converted: list[dict[str, Any]] = []
                for key, value in data.items():
                    item = dict(value)
                    item.setdefault("character", key)
                    converted.append(item)
                data = converted
            elif {"character", "meaning", "equation", "mnemonic"}.issubset(data):
                data = [data]
    if not isinstance(data, list):
        raise ValueError(f"Expected JSON array, got {type(data).__name__}")
    out: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            out.append(item)
    return out


def call_google(spec: ModelSpec, cards: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    key = ENV.get("GEMINI_API_KEY") or ENV.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("missing Google/Gemini API key")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{spec.model}:generateContent?key={key}"
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"parts": [{"text": build_semantic_prompt(cards)}]}],
        "generationConfig": {
            "maxOutputTokens": spec.max_output_tokens,
            "temperature": spec.temperature,
            "responseMimeType": "application/json",
        },
    }
    data = json_request(url, headers={"Content-Type": "application/json"}, payload=payload, timeout=spec.timeout)
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    try:
        parsed = extract_json_text(text)
    except Exception as exc:
        raise RuntimeError(f"invalid JSON from {spec.model}: {text[:700]!r}") from exc
    return normalize_model_output(parsed), {
        "usage": data.get("usageMetadata", {}),
        "finish_reason": data.get("candidates", [{}])[0].get("finishReason"),
    }


def call_openai(spec: ModelSpec, cards: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    key = ENV.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("missing OpenAI API key")
    payload = {
        "model": spec.model,
        "input": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_semantic_prompt(cards)},
        ],
        "temperature": spec.temperature,
        "max_output_tokens": spec.max_output_tokens,
        "text": {"format": {"type": "json_object"}},
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    try:
        data = json_request("https://api.openai.com/v1/responses", headers=headers, payload=payload, timeout=spec.timeout)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="ignore")
        # Some reasoning models reject explicit temperature; retry without it.
        if exc.code == 400 and "temperature" in body:
            payload.pop("temperature", None)
            data = json_request("https://api.openai.com/v1/responses", headers=headers, payload=payload, timeout=spec.timeout)
        else:
            raise RuntimeError(f"OpenAI HTTP {exc.code}: {body[:500]}")
    texts: list[str] = []
    for item in data.get("output", []):
        for part in item.get("content", []):
            if part.get("type") in ("output_text", "text"):
                texts.append(part.get("text", ""))
    text = "\n".join(texts).strip()
    if not text and data.get("output_text"):
        text = data["output_text"]
    if not text:
        raise RuntimeError(f"empty OpenAI response: {json.dumps(data)[:500]}")
    return normalize_model_output(extract_json_text(text)), {"usage": data.get("usage", {})}


def call_anthropic(spec: ModelSpec, cards: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    key = ENV.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("missing Anthropic API key")
    payload = {
        "model": spec.model,
        "max_tokens": spec.max_output_tokens,
        "temperature": spec.temperature,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": build_semantic_prompt(cards)}],
    }
    headers = {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    try:
        data = json_request("https://api.anthropic.com/v1/messages", headers=headers, payload=payload, timeout=spec.timeout)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="ignore")
        if exc.code == 400 and "temperature" in body:
            payload.pop("temperature", None)
            data = json_request("https://api.anthropic.com/v1/messages", headers=headers, payload=payload, timeout=spec.timeout)
        else:
            raise RuntimeError(f"Anthropic HTTP {exc.code}: {body[:500]}")
    text = "".join(part.get("text", "") for part in data.get("content", []) if part.get("type") == "text")
    return normalize_model_output(extract_json_text(text)), {"usage": data.get("usage", {})}


def call_model(spec: ModelSpec, cards: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if spec.provider == "google":
        return call_google(spec, cards)
    if spec.provider == "openai":
        return call_openai(spec, cards)
    if spec.provider == "anthropic":
        return call_anthropic(spec, cards)
    raise ValueError(f"unknown provider: {spec.provider}")


def validate_card(card: dict[str, Any], expected: dict[str, Any]) -> dict[str, Any]:
    problems: list[str] = []
    character = expected["character"]
    meaning = expected["meaning"]
    components = expected["components"]
    equation = str(card.get("equation", ""))
    mnemonic = str(card.get("mnemonic", ""))
    hero = str(card.get("hero_image_prompt", ""))

    if card.get("character") != character:
        problems.append("wrong character")
    if str(card.get("meaning", "")).strip().lower() != meaning.lower():
        problems.append("wrong meaning")

    for comp in components:
        pair = f"{comp['character']} {comp['gloss']}"
        if is_bad_component_gloss(comp["gloss"]):
            problems.append(f"bad component gloss {pair}")
        if pair not in equation:
            problems.append(f"equation missing {pair}")
        if pair not in mnemonic:
            problems.append(f"mnemonic missing {pair}")

    final_pair = f"{character} {meaning}"
    if final_pair not in equation:
        problems.append(f"equation missing {final_pair}")
    if final_pair not in mnemonic:
        problems.append(f"mnemonic missing {final_pair}")

    if not equation.count("=") == 1:
        problems.append("equation should have one equals sign")
    if len(mnemonic) > 190:
        problems.append("mnemonic too long")
    if len([s for s in re.split(r"[.!?。！？]+", mnemonic) if s.strip()]) > 1:
        problems.append("mnemonic has multiple sentences")
    if any(token in mnemonic.lower() for token in ("sounds like", "pronounced", "on'yomi", "pinyin")):
        problems.append("contains pronunciation hook")
    if META_PHRASE_RE.search(mnemonic):
        problems.append("contains meta phrasing")
    if not hero:
        problems.append("missing hero image prompt")

    return {
        "problems": problems,
        "valid": not problems,
        "heuristic_score": max(0, 10 - len(problems) * 1.5 - max(0, len(mnemonic) - 160) / 40),
    }


def cheap_style_score(card: dict[str, Any]) -> float:
    mnemonic = str(card.get("mnemonic", ""))
    score = 5.0
    if 70 <= len(mnemonic) <= 155:
        score += 1.0
    if any(word in mnemonic.lower() for word in ("because", "so that", "therefore")):
        score -= 0.4
    if FILLER_STYLE_RE.search(mnemonic) or any(word in mnemonic.lower() for word in ("dragon", "neon")):
        score -= 1.0
    if META_PHRASE_RE.search(mnemonic):
        score -= 2.0
    if " and " in mnemonic:
        score += 0.3
    if mnemonic.startswith(("A ", "An ", "The ")):
        score += 0.3
    return max(0.0, min(7.0, score))


def score_model_outputs(outputs: list[dict[str, Any]], expected_cards: list[dict[str, Any]]) -> tuple[float, list[dict[str, Any]]]:
    by_char = {str(item.get("character")): item for item in outputs}
    validations = []
    total = 0.0
    for expected in expected_cards:
        card = by_char.get(expected["character"], {})
        validation = validate_card(card, expected)
        style = cheap_style_score(card)
        combined = validation["heuristic_score"] * 0.65 + style * 0.35
        validation["style_score"] = style
        validation["combined_score"] = combined
        validation["card"] = card
        validations.append(validation)
        total += combined
    return total / max(1, len(expected_cards)), validations


def run_bakeoff(models: list[ModelSpec]) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    for spec in models:
        print(f"\n== {spec.name} ({spec.model}) ==")
        start = time.time()
        record: dict[str, Any] = {
            "name": spec.name,
            "provider": spec.provider,
            "model": spec.model,
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        try:
            outputs, meta = call_model(spec, BAKEOFF_CHARACTERS)
            elapsed = time.time() - start
            score, validations = score_model_outputs(outputs, BAKEOFF_CHARACTERS)
            record.update({
                "ok": True,
                "elapsed_seconds": round(elapsed, 2),
                "score": round(score, 3),
                "outputs": outputs,
                "validations": validations,
                "meta": meta,
            })
            print(f"score={score:.2f} elapsed={elapsed:.1f}s")
            for item in outputs:
                print(f"  {item.get('character')}: {item.get('mnemonic')}")
        except Exception as exc:
            elapsed = time.time() - start
            record.update({
                "ok": False,
                "elapsed_seconds": round(elapsed, 2),
                "error": str(exc),
            })
            print(f"ERROR after {elapsed:.1f}s: {exc}")
        results.append(record)
        BAKEOFF_PATH.write_text(json.dumps({"results": results}, ensure_ascii=False, indent=2))
        time.sleep(0.5)

    ranked = sorted((r for r in results if r.get("ok")), key=lambda r: (-r.get("score", 0), r.get("elapsed_seconds", 9999)))
    summary = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "prompt_note": "Fair semantic-only prompt. The exact user-provided 連/憂 answer examples were not included in the model prompt.",
        "characters": BAKEOFF_CHARACTERS,
        "results": results,
        "ranked": [{"name": r["name"], "model": r["model"], "score": r["score"], "elapsed_seconds": r["elapsed_seconds"]} for r in ranked],
    }
    BAKEOFF_PATH.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    return summary


def simple_hash(text: str) -> int:
    h = 0
    for ch in text:
        h = ((h * 31) + ord(ch)) & 0xFFFFFFFF
    return h


def is_han(ch: str) -> bool:
    code = ord(ch)
    return (
        0x4E00 <= code <= 0x9FFF
        or 0x3400 <= code <= 0x4DBF
        or 0x20000 <= code <= 0x2A6DF
        or 0x2A700 <= code <= 0x2B73F
        or 0x2B740 <= code <= 0x2B81F
        or 0x2B820 <= code <= 0x2CEAF
    )


def shard_name(word: str) -> str:
    han_count = sum(1 for ch in word if is_han(ch))
    h = simple_hash(word)
    if han_count == 0:
        return f"non-han-{(h % 4) + 1}"
    if han_count == 1:
        return f"han-1char-{(h % 8) + 1}"
    if han_count == 2:
        return f"han-2char-{(h % 8) + 1}"
    return f"han-3plus-{(h % 8) + 1}"


def subdir(word: str) -> str:
    return f"{simple_hash(word) & 0xFF:02x}"


def fetch_char_data(char: str) -> dict[str, Any] | None:
    local_path = ROOT / "output_dictionary" / subdir(char) / f"{char}.json.deflate"
    if local_path.exists():
        try:
            return json.loads(zlib.decompress(local_path.read_bytes(), -15))
        except Exception:
            return None
    if (ROOT / "output_dictionary").exists():
        return None

    encoded = urllib.parse.quote(char)
    url = f"https://raw.githubusercontent.com/Kimeiga/kiokun2-dict-{shard_name(char)}/main/{subdir(char)}/{encoded}.json.deflate"
    try:
        with urllib.request.urlopen(url, timeout=12) as resp:
            return json.loads(zlib.decompress(resp.read(), -15))
    except Exception:
        return None


def clean_gloss(gloss: str | None) -> str:
    if not gloss:
        return ""
    value = gloss.strip()
    value = re.sub(r"^variant of\s+[^,;]+(\s*\[[^\]]+\])?\s*", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\s*\((?:trad/jp|trad|simp|jp|latin)\)", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\s*\((?:radical|iii|ii|iv|[0-9a-f]{4,})\)", "", value, flags=re.IGNORECASE)
    value = value.replace("Bldg.", "building").replace("Vol.", "volume")
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"^to\s+", "", value, flags=re.IGNORECASE)
    # Prefer a card-sized single gloss from semicolon/comma-heavy dictionary text.
    for sep in (";", ",", "/"):
        if sep in value:
            value = value.split(sep, 1)[0].strip()
            break
    return value.strip(" .!?")


def canonical_gloss(char: str, fallback: str = "") -> str:
    return MANUAL_GLOSS_OVERRIDES.get(char) or clean_gloss(GLOSSES.get(char)) or clean_gloss(fallback)


BAD_COMPONENT_GLOSS_RE = re.compile(
    r"\b(?:kangxi|non-classical|variant|radical|same|obscure|unknown|archaic|rare)\b|"
    r"gouge out an eye|why\? what\? where\?",
    re.IGNORECASE,
)


META_PHRASE_RE = re.compile(
    r"\b(?:the character combines|this character|component|radical|represents|depicts)\b",
    re.IGNORECASE,
)


FILLER_STYLE_RE = re.compile(
    r"\b(?:proudly|always|society|polite|poor|beautiful|magical|ancient|mystical|glowing)\b",
    re.IGNORECASE,
)


def is_bad_component_gloss(gloss: str) -> bool:
    return bool(BAD_COMPONENT_GLOSS_RE.search(gloss))


def canonical_component_gloss(char: str, fallback: str = "") -> str:
    override = MANUAL_COMPONENT_GLOSS_OVERRIDES.get(char)
    if override:
        return override
    return canonical_gloss(char, fallback)


def normalize_components(components: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    normalized: list[dict[str, str]] = []
    seen: set[str] = set()
    for component in components or []:
        comp_char = str(component.get("character") or component.get("char") or "")
        if not comp_char or comp_char in seen:
            continue
        gloss = canonical_component_gloss(comp_char, str(component.get("gloss") or component.get("meaning") or ""))
        if not gloss:
            continue
        normalized.append({"character": comp_char, "gloss": gloss})
        seen.add(comp_char)
    return normalized


def normalize_prepared_card(card: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(card)
    char = str(normalized.get("character", ""))
    normalized["meaning"] = canonical_gloss(char, str(normalized.get("meaning") or ""))
    normalized["components"] = normalize_components(normalized.get("components"))
    if normalized.get("visual_components"):
        normalized["visual_components"] = normalize_components(normalized.get("visual_components"))
    if normalized.get("historical_components"):
        normalized["historical_components"] = normalize_components(normalized.get("historical_components"))
    return normalized


def load_visual_ids_forward() -> dict[str, Any]:
    global IDS_FORWARD_CACHE
    if IDS_FORWARD_CACHE is not None:
        return IDS_FORWARD_CACHE

    for path in IDS_FORWARD_PATHS:
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text())
        except Exception:
            continue
        if isinstance(data, dict):
            IDS_FORWARD_CACHE = {
                str(char): value
                for char, value in data.items()
                if isinstance(value, dict)
            }
            return IDS_FORWARD_CACHE

    IDS_FORWARD_CACHE = {}
    return IDS_FORWARD_CACHE


def visual_lookup_component_chars(char: str) -> list[str]:
    entry = load_visual_ids_forward().get(char) or {}
    raw = entry.get("components") if isinstance(entry, dict) else None
    if not isinstance(raw, list):
        return []
    return [str(item) for item in raw if isinstance(item, str) and item and item != char]


def is_entity_ref(char: str) -> bool:
    return char.startswith("&") and char.endswith(";")


def load_ids_cache() -> dict[str, str]:
    global IDS_CACHE
    if IDS_CACHE is not None:
        return IDS_CACHE

    ids_map: dict[str, str] = {}
    for path in sorted(IDS_DIR.glob("IDS-*.txt")):
        try:
            for line in path.read_text(errors="ignore").splitlines():
                if not line or line.startswith(";;"):
                    continue
                parts = line.split("\t")
                if len(parts) >= 3 and parts[1] and parts[2] and parts[1] != parts[2]:
                    apparent = next((p.removeprefix("@apparent=") for p in parts[3:] if p.startswith("@apparent=")), "")
                    ids_map[parts[1]] = apparent or parts[2]
        except OSError:
            continue

    ids_map.update(MANUAL_IDS_OVERRIDES)
    IDS_CACHE = ids_map
    return ids_map


def ids_for_char(data: dict[str, Any], char: str) -> str:
    if char in MANUAL_IDS_OVERRIDES:
        return MANUAL_IDS_OVERRIDES[char]
    for key in ("japanese_char", "chinese_char"):
        char_data = data.get(key) or {}
        ids = char_data.get("ids_apparent") or char_data.get("ids")
        if ids and ids != char:
            return str(ids)
    return load_ids_cache().get(char, "")


def ids_component_chars(ids: str) -> list[str]:
    cleaned = re.sub(r"\[[^\]]+\]", "", ids)
    components: list[str] = []
    index = 0
    while index < len(cleaned):
        ch = cleaned[index]
        if ch in IDS_OPERATORS or ch.isspace():
            index += 1
            continue
        if ch == "&":
            end = cleaned.find(";", index + 1)
            if end > index:
                components.append(cleaned[index : end + 1])
                index = end + 1
                continue
        components.append(ch)
        index += 1
    return components


def expand_ids_component(char: str, depth: int = 0) -> list[str]:
    if depth > 4:
        return [] if is_entity_ref(char) else [char]
    ids = load_ids_cache().get(char, "")
    if not ids:
        return [] if is_entity_ref(char) else [char]

    expanded: list[str] = []
    for child in ids_component_chars(ids):
        if child == char:
            if not is_entity_ref(child):
                expanded.append(child)
            continue
        # Keep renderable/glossed components as units. Expand unglossed pieces
        # such as 𱬹, plus entity references such as &CDP-8BB8;, so cards do
        # not show tofu, entity text, or empty glosses.
        child_gloss = canonical_component_gloss(child)
        if child_gloss and not is_bad_component_gloss(child_gloss) and not is_entity_ref(child):
            expanded.append(child)
        else:
            expanded.extend(expand_ids_component(child, depth + 1))
    return expanded or [char]


def components_from_chars(chars: list[str]) -> list[dict[str, str]]:
    components: list[dict[str, str]] = []
    seen: set[str] = set()
    for comp_char in chars:
        gloss = canonical_component_gloss(comp_char)
        expanded_chars = (
            [comp_char]
            if gloss and not is_bad_component_gloss(gloss) and not is_entity_ref(comp_char)
            else expand_ids_component(comp_char)
        )
        for expanded_char in expanded_chars:
            if is_entity_ref(expanded_char):
                continue
            if expanded_char in seen:
                continue
            gloss = canonical_component_gloss(expanded_char)
            if not gloss or is_bad_component_gloss(gloss):
                continue
            components.append({"character": expanded_char, "gloss": gloss})
            seen.add(expanded_char)
    return components


def components_from_ids(ids: str) -> list[dict[str, str]]:
    return components_from_chars(ids_component_chars(ids))


def components_from_raw_component_items(raw_components: list[Any]) -> list[dict[str, str]]:
    components: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in raw_components:
        if isinstance(item, str):
            comp_char = item
            fallback = ""
        elif isinstance(item, dict):
            comp_char = item.get("character") or item.get("char") or ""
            fallback = item.get("meaning") or item.get("gloss") or ""
        else:
            continue
        if not comp_char or comp_char in seen:
            continue
        gloss = canonical_component_gloss(comp_char, fallback)
        if not gloss or is_bad_component_gloss(gloss) or is_entity_ref(comp_char):
            for expanded_char in expand_ids_component(comp_char):
                if expanded_char in seen:
                    continue
                expanded_gloss = canonical_component_gloss(expanded_char)
                if expanded_gloss and not is_bad_component_gloss(expanded_gloss):
                    components.append({"character": expanded_char, "gloss": expanded_gloss})
                    seen.add(expanded_char)
            continue
        components.append({"character": comp_char, "gloss": gloss})
        seen.add(comp_char)
    return components


def dictionary_components(data: dict[str, Any]) -> tuple[list[dict[str, str]], str]:
    for key in ("chinese_char", "japanese_char"):
        char_data = data.get(key) or {}
        raw_components = char_data.get("components") or []
        if not raw_components:
            continue
        components = components_from_raw_component_items(raw_components)
        if components:
            return components, f"{key}.components"
    return [], ""


def visual_components_from_lookup(char: str) -> list[dict[str, str]]:
    return components_from_chars(visual_lookup_component_chars(char))


def expanded_component_set(components: list[dict[str, Any]]) -> set[str]:
    expanded: set[str] = set()

    def walk(char: str, depth: int = 0) -> None:
        if depth > 5 or is_entity_ref(char):
            return
        visual_children = visual_lookup_component_chars(char)
        ids_children = ids_component_chars(load_ids_cache().get(char, "")) if not visual_children else []
        children = visual_children or ids_children
        if not children:
            expanded.add(char)
            return
        for child in children:
            walk(child, depth + 1)

    for component in components:
        comp_char = str(component.get("character") or "")
        if comp_char:
            walk(comp_char)
    return expanded


def component_sets_equivalent(
    visual_components: list[dict[str, Any]],
    historical_components: list[dict[str, Any]],
) -> bool:
    visual_set = {str(item.get("character") or "") for item in visual_components}
    historical_set = {str(item.get("character") or "") for item in historical_components}
    visual_set.discard("")
    historical_set.discard("")
    if visual_set == historical_set:
        return True
    return expanded_component_set(visual_components) == expanded_component_set(historical_components)


def extract_component_bundle(data: dict[str, Any], char: str) -> dict[str, Any]:
    historical, historical_source = dictionary_components(data)

    if char in MANUAL_COMPONENT_OVERRIDES:
        visual = normalize_components(MANUAL_COMPONENT_OVERRIDES[char])
        visual_source = "manual_component_override"
    else:
        visual = visual_components_from_lookup(char)
        visual_source = "resolved_ids_forward" if visual else ""

    if not visual:
        ids = ids_for_char(data, char)
        visual = components_from_ids(ids) if ids else []
        visual_source = "ids" if visual else ""

    if not visual and historical:
        visual = historical
        visual_source = historical_source

    bundle: dict[str, Any] = {
        "components": visual,
        "visual_components": visual,
        "component_source": visual_source,
    }
    if historical and not component_sets_equivalent(visual, historical):
        bundle["historical_components"] = historical
        bundle["historical_component_source"] = historical_source
    return bundle


def extract_components(data: dict[str, Any], char: str) -> list[dict[str, str]]:
    return extract_component_bundle(data, char)["components"]


def extract_meaning(data: dict[str, Any], char: str) -> str:
    override = MANUAL_GLOSS_OVERRIDES.get(char)
    if override:
        return override
    repo_gloss = clean_gloss(GLOSSES.get(char))
    if repo_gloss:
        return repo_gloss
    chinese = data.get("chinese_char") or {}
    if chinese.get("gloss"):
        return clean_gloss(chinese.get("gloss"))
    rm = ((data.get("japanese_char") or {}).get("readingMeaning") or {})
    for group in rm.get("groups") or []:
        for meaning in group.get("meanings") or []:
            if meaning.get("lang") == "en" and meaning.get("value"):
                return clean_gloss(meaning.get("value"))
    return ""


def ranked_characters(limit: int, include_examples: bool = True) -> list[str]:
    candidate_target = max(limit, limit * 3)
    candidates: list[tuple[int, str]] = []
    kanji_path = GAME_DATA_DIR / "kanji_details.json"
    if kanji_path.exists():
        data = json.loads(kanji_path.read_text())
        for char, details in data.items():
            if len(char) == 1 and is_han(char):
                freq = details.get("frequency") or 999999
                candidates.append((int(freq), char))

    seen: set[str] = set()
    chars: list[str] = []
    if include_examples:
        for ch in ("連", "憂"):
            chars.append(ch)
            seen.add(ch)
    for _, char in sorted(candidates):
        if char not in seen:
            chars.append(char)
            seen.add(char)
        if len(chars) >= candidate_target:
            break
    if len(chars) < limit:
        fallback_chars = set()
        fallback_chars.update(ch for ch in GLOSSES if len(ch) == 1 and is_han(ch))
        taxonomy_path = GAME_DATA_DIR / "char_taxonomy.json"
        if taxonomy_path.exists():
            fallback_chars.update(
                ch for ch in json.loads(taxonomy_path.read_text())
                if len(ch) == 1 and is_han(ch)
            )
        for char in sorted(fallback_chars, key=lambda ch: (ord(ch), ch)):
            if char not in seen:
                chars.append(char)
                seen.add(char)
            if len(chars) >= candidate_target:
                break
    return chars


def prepare_one_card(char: str) -> tuple[str, dict[str, Any] | None, str | None]:
    data = fetch_char_data(char)
    if not data:
        return char, None, "missing dictionary data"
    component_bundle = extract_component_bundle(data, char)
    components = component_bundle["components"]
    if not components:
        return char, None, "missing components"
    meaning = extract_meaning(data, char)
    if not meaning:
        return char, None, "missing meaning"
    return char, {
        "character": char,
        "meaning": meaning,
        **component_bundle,
    }, None


def prepare_batch_cards(limit: int, workers: int = 20) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if CARD_INPUT_CACHE_PATH.exists():
        cached = json.loads(CARD_INPUT_CACHE_PATH.read_text())
        cached_cards = cached.get("cards") or []
        if cached.get("version") == CARD_INPUT_CACHE_VERSION and len(cached_cards) >= limit:
            return [normalize_prepared_card(card) for card in cached_cards[:limit]], cached.get("skipped", {})

    cards: list[dict[str, Any]] = []
    skipped: dict[str, str] = {}
    ranked = ranked_characters(limit)
    results: dict[str, dict[str, Any]] = {}

    print(f"Preparing card inputs from {len(ranked)} ranked candidates with {workers} workers...", flush=True)
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(prepare_one_card, char): char for char in ranked}
        completed = 0
        for future in as_completed(futures):
            completed += 1
            char = futures[future]
            try:
                result_char, card, reason = future.result()
            except Exception as exc:
                skipped[char] = f"prepare error: {exc}"
                continue
            if card:
                results[result_char] = normalize_prepared_card(card)
            else:
                skipped[result_char] = reason or "unknown skip"
            if completed % 100 == 0:
                found = sum(1 for ranked_char in ranked if ranked_char in results)
                print(f"  prepared {completed}/{len(ranked)} candidates, usable so far {found}", flush=True)

    for char in ranked:
        if char in results:
            cards.append(results[char])
        if len(cards) >= limit:
            break

    CARD_INPUT_CACHE_PATH.write_text(json.dumps({
        "version": CARD_INPUT_CACHE_VERSION,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "requested_limit": limit,
        "candidate_count": len(ranked),
        "cards": cards,
        "skipped": skipped,
    }, ensure_ascii=False, indent=2))

    return cards, skipped


def load_progress(progress_path: Path = PROGRESS_PATH) -> dict[str, Any]:
    if progress_path.exists():
        return json.loads(progress_path.read_text())
    return {"generated": {}, "failures": [], "skipped": {}, "gloss_issues": []}


def save_progress(progress: dict[str, Any], progress_path: Path = PROGRESS_PATH) -> None:
    progress_path.write_text(json.dumps(progress, ensure_ascii=False, indent=2))


def maybe_repair_card(card: dict[str, Any], expected: dict[str, Any]) -> dict[str, Any]:
    repaired = dict(card)
    repaired.setdefault("character", expected["character"])
    repaired.setdefault("meaning", expected["meaning"])
    expected_equation = " + ".join(f"{c['character']} {c['gloss']}" for c in expected["components"])
    expected_equation += f" = {expected['character']} {expected['meaning']}"
    if validate_card({**repaired, "equation": repaired.get("equation") or expected_equation}, expected)["problems"]:
        # Only repair the equation. The mnemonic is model-authored and should fail
        # validation if it ignores the canonical pair contract.
        repaired["equation"] = expected_equation
    elif not repaired.get("equation"):
        repaired["equation"] = expected_equation
    return repaired


def generated_record(output: dict[str, Any], expected: dict[str, Any], validation: dict[str, Any]) -> dict[str, Any]:
    record = {
        **output,
        "components": expected["components"],
        "visual_components": expected.get("visual_components") or expected["components"],
        "component_source": expected.get("component_source"),
        "source_meaning": expected["meaning"],
        "validation": validation,
    }
    if expected.get("historical_components"):
        record["historical_components"] = expected["historical_components"]
        record["historical_component_source"] = expected.get("historical_component_source")
    return record


def records_from_outputs(
    model: ModelSpec,
    outputs: list[dict[str, Any]],
    expected_cards: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    by_char = {str(item.get("character")): item for item in outputs}
    records: dict[str, dict[str, Any]] = {}
    failures: list[dict[str, Any]] = []
    for expected in expected_cards:
        char = expected["character"]
        output = maybe_repair_card(by_char.get(char, {}), expected)
        validation = validate_card(output, expected)
        records[char] = generated_record(output, expected, validation)
        if not validation["valid"]:
            failures.append({
                "character": char,
                "problems": validation["problems"],
                "model": model.model,
                "at": datetime.now(timezone.utc).isoformat(),
            })
    return records, failures


def generate_chunk(model: ModelSpec, chunk: list[dict[str, Any]]) -> dict[str, Any]:
    try:
        outputs, meta = call_model(model, chunk)
        records, failures = records_from_outputs(model, outputs, chunk)
        return {
            "records": records,
            "failures": failures,
            "meta": meta,
            "error": None,
            "retried": False,
        }
    except Exception as exc:
        if len(chunk) <= 1:
            return {
                "records": {},
                "failures": [{
                    "character": chunk[0]["character"],
                    "error": str(exc),
                    "model": model.model,
                    "at": datetime.now(timezone.utc).isoformat(),
                }],
                "meta": {},
                "error": str(exc),
                "retried": False,
            }

        records: dict[str, dict[str, Any]] = {}
        failures: list[dict[str, Any]] = []
        meta: dict[str, Any] = {}
        for single in chunk:
            try:
                outputs, single_meta = call_model(model, [single])
                single_records, single_failures = records_from_outputs(model, outputs, [single])
                records.update(single_records)
                failures.extend(single_failures)
                meta = single_meta
            except Exception as single_exc:
                failures.append({
                    "character": single["character"],
                    "error": str(single_exc),
                    "model": model.model,
                    "at": datetime.now(timezone.utc).isoformat(),
                })
        return {
            "records": records,
            "failures": failures,
            "meta": meta,
            "error": str(exc),
            "retried": True,
        }


def generate_many(
    model: ModelSpec,
    limit: int,
    batch_size: int,
    workers: int,
    output_path: Path = OUTPUT_PATH,
    progress_path: Path = PROGRESS_PATH,
    reset_progress: bool = False,
    api_workers: int = 1,
) -> dict[str, Any]:
    RESEARCH_DIR.mkdir(parents=True, exist_ok=True)
    cards, skipped = prepare_batch_cards(limit, workers=workers)
    if reset_progress and progress_path.exists():
        progress_path.unlink()
    progress = load_progress(progress_path)
    progress.setdefault("generated", {})
    progress.setdefault("failures", [])
    progress.setdefault("skipped", {}).update(skipped)
    save_progress(progress, progress_path)

    generated: dict[str, Any] = dict(progress["generated"])
    todo = [card for card in cards if card["character"] not in generated]
    print(f"Prepared {len(cards)} cards, {len(generated)} already generated, {len(todo)} remaining")

    chunks = [todo[i : i + batch_size] for i in range(0, len(todo), batch_size)]

    def persist_result(chunk: list[dict[str, Any]], result: dict[str, Any]) -> None:
        generated.update(result["records"])
        progress["generated"] = generated
        progress["failures"].extend(result["failures"])
        if result.get("meta"):
            progress["last_meta"] = result["meta"]
        save_progress(progress, progress_path)
        chars = "".join(card["character"] for card in chunk)
        status = f"{len(result['records'])}/{len(chunk)} saved"
        if result.get("retried"):
            status += " after retry"
        if result.get("error"):
            status += f"; initial error: {result['error'][:180]}"
        print(f"[{len(generated)}/{len(cards)}] {chars} -> {status}")

    if api_workers <= 1:
        for chunk in chunks:
            chars = "".join(card["character"] for card in chunk)
            print(f"[{len(generated) + 1}-{len(generated) + len(chunk)}/{len(cards)}] {chars}")
            persist_result(chunk, generate_chunk(model, chunk))
            time.sleep(0.4)
    else:
        print(f"Using {api_workers} parallel API workers")
        with ThreadPoolExecutor(max_workers=api_workers) as executor:
            future_to_chunk = {executor.submit(generate_chunk, model, chunk): chunk for chunk in chunks}
            for future in as_completed(future_to_chunk):
                persist_result(future_to_chunk[future], future.result())

    ordered = [generated[card["character"]] for card in cards if card["character"] in generated]
    gloss_issues = find_gloss_issues(ordered)
    artifact = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model": {"name": model.name, "provider": model.provider, "id": model.model},
        "card_input_cache_version": CARD_INPUT_CACHE_VERSION,
        "component_note": "Mnemonics are generated from visual IDS components; historical/dictionary components are preserved separately when they differ after expansion.",
        "prompt": {
            "system": SYSTEM_PROMPT,
            "note": "Semantic-only generation: no pronunciation, no word anchors, no recall prompts.",
        },
        "count": len(ordered),
        "manual_gloss_overrides_used": MANUAL_GLOSS_OVERRIDES,
        "manual_component_gloss_overrides_used": MANUAL_COMPONENT_GLOSS_OVERRIDES,
        "gloss_issues": gloss_issues,
        "skipped": progress.get("skipped", {}),
        "mnemonics": ordered,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2))
    print(f"Wrote {output_path}")
    return artifact


def find_gloss_issues(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    for card in cards:
        char = card.get("character", "")
        meaning = card.get("source_meaning") or card.get("meaning") or ""
        original = clean_gloss(GLOSSES.get(char))
        if original and meaning and original != meaning and char in MANUAL_GLOSS_OVERRIDES:
            issues.append({
                "character": char,
                "repo_gloss": original,
                "used_gloss": meaning,
                "reason": "manual override from current Kiokun mnemonic prompt",
            })
        for comp in card.get("components", []):
            comp_char = comp.get("character")
            used = comp.get("gloss")
            original_comp = clean_gloss(GLOSSES.get(comp_char, ""))
            if comp_char in MANUAL_GLOSS_OVERRIDES and original_comp and original_comp != used:
                issues.append({
                    "character": comp_char,
                    "repo_gloss": original_comp,
                    "used_gloss": used,
                    "reason": f"manual override used as component of {char}",
                })
    # Deduplicate while preserving first example.
    seen: set[tuple[str, str, str]] = set()
    unique: list[dict[str, Any]] = []
    for item in issues:
        key = (item["character"], item["repo_gloss"], item["used_gloss"])
        if key not in seen:
            seen.add(key)
            unique.append(item)
    return unique


def list_models() -> None:
    available = []
    for spec in CANDIDATE_MODELS:
        if spec.provider == "google" and (ENV.get("GEMINI_API_KEY") or ENV.get("GOOGLE_API_KEY")):
            available.append(spec)
        elif spec.provider == "openai" and ENV.get("OPENAI_API_KEY"):
            available.append(spec)
        elif spec.provider == "anthropic" and ENV.get("ANTHROPIC_API_KEY"):
            available.append(spec)
    for spec in available:
        print(f"{spec.name}\t{spec.provider}\t{spec.model}")


def parse_model_arg(value: str) -> ModelSpec:
    normalized = value.lower()
    for spec in CANDIDATE_MODELS:
        if normalized in {spec.name.lower(), spec.model.lower()}:
            return spec
    raise SystemExit(f"Unknown model: {value}")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list-models")
    bakeoff = sub.add_parser("bakeoff")
    bakeoff.add_argument("--models", nargs="*", default=None, help="Model names/IDs to run")
    generate = sub.add_parser("generate")
    generate.add_argument("--model", default="gemini-3.5-flash")
    generate.add_argument("--limit", type=int, default=1000)
    generate.add_argument("--batch-size", type=int, default=12)
    generate.add_argument("--api-workers", type=int, default=1)
    generate.add_argument("--prepare-workers", type=int, default=20)
    generate.add_argument("--output", type=Path, default=OUTPUT_PATH)
    generate.add_argument("--progress", type=Path, default=PROGRESS_PATH)
    generate.add_argument("--reset-progress", action="store_true")
    args = parser.parse_args()

    if args.command == "list-models":
        list_models()
        return
    if args.command == "bakeoff":
        if args.models:
            models = [parse_model_arg(item) for item in args.models]
        else:
            models = [
                spec for spec in CANDIDATE_MODELS
                if (spec.provider == "google" and (ENV.get("GEMINI_API_KEY") or ENV.get("GOOGLE_API_KEY")))
                or (spec.provider == "openai" and ENV.get("OPENAI_API_KEY"))
                or (spec.provider == "anthropic" and ENV.get("ANTHROPIC_API_KEY"))
            ]
        summary = run_bakeoff(models)
        print("\nRanked:")
        for row in summary["ranked"]:
            print(f"{row['score']:.2f}\t{row['elapsed_seconds']:>5.1f}s\t{row['name']} ({row['model']})")
        return
    if args.command == "generate":
        model = parse_model_arg(args.model)
        generate_many(
            model,
            args.limit,
            args.batch_size,
            args.prepare_workers,
            output_path=args.output,
            progress_path=args.progress,
            reset_progress=args.reset_progress,
            api_workers=args.api_workers,
        )
        return


if __name__ == "__main__":
    main()
