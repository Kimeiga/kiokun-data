#!/usr/bin/env python3
"""
Compare AI models for CJK character mnemonic generation.
Tests multiple models against Hakan's hand-written mnemonics as gold standard.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# Load API keys
env_path = Path(__file__).parent.parent / "sveltekit-app" / ".env.local"
env_vars = {}
if env_path.exists():
    for line in env_path.read_text().strip().split("\n"):
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env_vars[k.strip()] = v.strip()

ANTHROPIC_API_KEY = env_vars.get("ANTHROPIC_API_KEY", os.environ.get("ANTHROPIC_API_KEY", ""))
OPENAI_API_KEY = env_vars.get("OPENAI_API_KEY", os.environ.get("OPENAI_API_KEY", ""))
GOOGLE_API_KEY = env_vars.get("GOOGLE_API_KEY", os.environ.get("GOOGLE_API_KEY", ""))

# Test characters — ones that have Hakan's mnemonics for comparison
TEST_CHARS = [
    ("花", "grass + change", "flower; HUĀ / KA"),
    ("遠", "walk + long robes", "far, distant; YUǍN / EN"),
    ("根", "tree + tough/stubborn", "root; GĒN / KON"),
    ("富", "roof + field + abundance", "rich, wealthy; FÙ / FU"),
    ("印", "claw + kneeling person", "seal, stamp, print; YÌN / IN"),
    ("忘", "die/perish + heart", "forget; WÀNG / BŌ"),
    ("海", "water + every", "sea, ocean; HǍI / KAI"),
    ("森", "tree + tree + tree", "forest; SĒN / SHIN"),
    ("明", "sun/window + moon", "bright, clear; MÍNG / MEI"),
    ("安", "roof + woman", "peaceful, safe; ĀN / AN"),
]

# Hakan's hand-written mnemonics (gold standard)
HAKAN_MNEMONICS = {
    "花": "I KAn smell the flowers",
    "遠": "Walk ⻌ a long distance like the length of the long robes 袁",
    "根": "Tree + stiff/tough\nThe toughest part of the tree is its KONnecting roots\nKON from 艮",
    "富": "Tommy is rich",
    "印": "= E E 卩 P\n= Executive Postage\n= stamp on Executive Postage",
}

# Existing Claude Opus hand-crafted mnemonics (from previous session)
CLAUDE_OPUS_MNEMONICS = {
    "花": "When grass 艹 transforms 化, it blooms into a flower 花. HUĀ-t a beautiful change!",
    "遠": "Walking 辶 on a long journey through the garden 袁 — far 遠.",
    "根": "The tree 木 part that's tough 艮 and stubborn underground — the root 根.",
    "富": "Under a roof 宀 with a field 田 of abundance 畐 — rich 富. FÙ-ll of wealth.",
    "印": "A claw 爪 pressing down on someone kneeling 卩 — stamping a seal, making a print 印. Left side looks like E, right like P: Executive Postage.",
    "忘": "When the heart 心 dies 亡, you forget 忘. The dead don't remember — WÀNG, gone from memory.",
    "海": "Every 每 body of water 氵 leads to the sea 海. The ocean is where every drop HǍI-nds up.",
    "森": "Three trees 木木木 together make a dense forest 森. SĒN-sational amount of trees.",
    "明": "A window 囧 letting in moonlight 月 — that's what makes it bright 明. It's the MING dynasty of illumination.",
    "安": "A woman 女 safe under a roof 宀 — peaceful 安. She's ĀN-xiety free.",
}

SYSTEM_PROMPT = """You are a mnemonic writer for CJK (Chinese/Japanese/Korean) characters.
You create short, memorable mnemonics that help learners remember both the meaning AND pronunciation of characters.

Style guidelines (based on the best human-written mnemonics):
- Reference the character's visual components and what they mean
- Include pronunciation hints embedded naturally (e.g., "SĒN-sational" for 森 sēn, "ĀN-xiety free" for 安 ān)
- Use puns, wordplay, and vivid imagery
- Keep it concise — 1-3 sentences max
- The mnemonic should work for someone learning Chinese AND Japanese readings
- Don't use emoji
- Don't start with "The character..." or be overly formal
- Be creative and memorable, not encyclopedic
- Don't use markdown formatting (no bold, italic, etc.)"""


def build_prompt(char, components, meanings):
    return f"""Write a mnemonic for the character {char}.

Components: {components}
Meanings: {meanings}

Write ONLY the mnemonic, nothing else. Keep it to 1-3 sentences."""


def call_api(provider, model, char, components, meanings, retries=2):
    """Call any AI API with retry logic."""
    for attempt in range(retries + 1):
        try:
            if provider == "anthropic":
                return _call_anthropic(model, char, components, meanings)
            elif provider == "openai":
                return _call_openai(model, char, components, meanings)
            elif provider == "google":
                return _call_google(model, char, components, meanings)
        except Exception as e:
            err = str(e)
            if attempt < retries and ("429" in err or "503" in err or "timed out" in err):
                wait = 5 * (attempt + 1)
                print(f"    (retry in {wait}s: {err[:60]})")
                time.sleep(wait)
            else:
                return f"ERROR: {err[:200]}"
    return "ERROR: all retries failed"


def _call_anthropic(model, char, components, meanings):
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
    }
    payload = json.dumps({
        "model": model,
        "max_tokens": 300,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": build_prompt(char, components, meanings)}],
    }).encode()
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
        return data["content"][0]["text"].strip()


def _call_openai(model, char, components, meanings):
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}",
    }
    payload = json.dumps({
        "model": model,
        "max_tokens": 300,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_prompt(char, components, meanings)},
        ],
    }).encode()
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())
        return data["choices"][0]["message"]["content"].strip()


def _call_google(model, char, components, meanings):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GOOGLE_API_KEY}"
    headers = {"Content-Type": "application/json"}
    payload = json.dumps({
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"parts": [{"text": build_prompt(char, components, meanings)}]}],
        "generationConfig": {"maxOutputTokens": 300, "temperature": 0.8},
    }).encode()
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read())
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        # Clean markdown
        text = text.replace("**", "").replace("*", "")
        return text


# Models to test
MODELS = [
    ("Claude Sonnet 4", "anthropic", "claude-sonnet-4-20250514"),
    ("Claude Haiku 4.5", "anthropic", "claude-haiku-4-5-20251001"),
    ("Gemini 2.5 Flash", "google", "gemini-2.5-flash"),
    ("Gemini 3 Flash", "google", "gemini-3-flash-preview"),
    ("GPT-4.1 Mini", "openai", "gpt-4.1-mini"),
    ("GPT-4.1 Nano", "openai", "gpt-4.1-nano"),
    ("GPT-5.4 Mini", "openai", "gpt-5.4-mini"),
]


def main():
    print("=" * 80)
    print("CJK Mnemonic Model Comparison")
    print("=" * 80)

    # Check API availability
    available = []
    for name, provider, model in MODELS:
        key_ok = (provider == "anthropic" and ANTHROPIC_API_KEY) or \
                 (provider == "openai" and OPENAI_API_KEY) or \
                 (provider == "google" and GOOGLE_API_KEY)
        if key_ok:
            available.append((name, provider, model))
        else:
            print(f"  SKIP {name}: no API key")

    print(f"\nTesting {len(available)} models on {len(TEST_CHARS)} characters\n")

    results = {}  # char -> model_name -> mnemonic

    for char, components, meanings in TEST_CHARS:
        print(f"\n{'─' * 70}")
        print(f"  {char}  ({components}) = {meanings}")
        print(f"{'─' * 70}")

        if char in HAKAN_MNEMONICS:
            print(f"\n  HAKAN:       {HAKAN_MNEMONICS[char][:80]}")
        if char in CLAUDE_OPUS_MNEMONICS:
            print(f"  OPUS (hand): {CLAUDE_OPUS_MNEMONICS[char][:80]}")

        results[char] = {}

        for name, provider, model in available:
            print(f"\n  {name}:", end=" ")
            mnemonic = call_api(provider, model, char, components, meanings)
            results[char][name] = mnemonic

            if mnemonic.startswith("ERROR"):
                print(mnemonic[:70])
            else:
                # Print multiline with indent
                lines = mnemonic.split("\n")
                print(lines[0][:75])
                for line in lines[1:]:
                    print(f"              {line[:75]}")

            time.sleep(1)  # Be gentle with rate limits

        time.sleep(1)

    # Save full results
    output_path = Path(__file__).parent / "mnemonic_comparison_results.json"
    with open(output_path, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n\nResults saved to {output_path}")

    # Summary table
    print("\n" + "=" * 80)
    print("RESULTS SUMMARY")
    print("=" * 80)

    for name, _, _ in available:
        successes = sum(1 for c in results if not results[c].get(name, "ERROR").startswith("ERROR"))
        print(f"  {name:20s}: {successes}/{len(TEST_CHARS)} successful")

    # Quality criteria analysis
    print("\n" + "=" * 80)
    print("QUALITY ANALYSIS")
    print("=" * 80)

    for name, _, _ in available:
        print(f"\n  {name}:")
        texts = [results[c][name] for c in results if not results[c].get(name, "ERROR").startswith("ERROR")]
        if not texts:
            print("    No successful generations")
            continue

        avg_len = sum(len(t) for t in texts) / len(texts)
        has_pun = sum(1 for t in texts if any(x in t for x in ["-", "—"]))
        has_caps_pun = sum(1 for t in texts if any(c.isupper() and i > 0 and t[i-1] == "-" for i, c in enumerate(t)))

        print(f"    Avg length: {avg_len:.0f} chars")
        print(f"    Uses dashes/puns: {has_pun}/{len(texts)}")
        print(f"    Pronunciation-embedded puns: {has_caps_pun}/{len(texts)}")


if __name__ == "__main__":
    main()
