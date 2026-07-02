#!/usr/bin/env python3
"""
Batch generate CJK character mnemonics using Claude Haiku 4.5.
Fetches character data from CDN, generates mnemonics, inserts into D1 database.
"""

import json
import os
import sys
import time
import zlib
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime

# ─── Configuration ───────────────────────────────────────────────────────────

BATCH_SIZE = 10  # Characters per batch
DELAY_BETWEEN_CALLS = 0.3  # Seconds between API calls
DELAY_BETWEEN_BATCHES = 2  # Seconds between DB insert batches
MODEL = "claude-haiku-4-5-20251001"
USER_ID = "claude-ai-mnemonic-author"
PROGRESS_FILE = Path(__file__).parent / "mnemonic_progress.json"

# ─── Load API key ────────────────────────────────────────────────────────────

env_path = Path(__file__).parent.parent / "sveltekit-app" / ".env.local"
env_vars = {}
if env_path.exists():
    for line in env_path.read_text().strip().split("\n"):
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env_vars[k.strip()] = v.strip()

ANTHROPIC_API_KEY = env_vars.get("ANTHROPIC_API_KEY", "")
if not ANTHROPIC_API_KEY:
    print("ERROR: No ANTHROPIC_API_KEY in .env.local")
    sys.exit(1)

# ─── Load component glosses ─────────────────────────────────────────────────

glosses_path = Path(__file__).parent.parent / "sveltekit-app" / "static" / "game_data" / "component_glosses.json"
GLOSSES = json.loads(glosses_path.read_text())


# ─── Shard utilities (match TypeScript implementation) ───────────────────────

def simple_hash(s: str) -> int:
    """Must match the TypeScript simpleHash exactly."""
    h = 0
    for ch in s:
        h = ((h * 31) + ord(ch)) & 0xFFFFFFFF  # unsigned 32-bit
    return h


def is_han(ch: str) -> bool:
    code = ord(ch)
    return (0x4E00 <= code <= 0x9FFF or
            0x3400 <= code <= 0x4DBF or
            0x20000 <= code <= 0x2A6DF or
            0x2A700 <= code <= 0x2B73F or
            0x2B740 <= code <= 0x2B81F or
            0x2B820 <= code <= 0x2CEAF)


def get_shard_name(word: str) -> str:
    han_count = sum(1 for c in word if is_han(c))
    h = simple_hash(word)
    if han_count == 0:
        return f"non-han-{(h % 4) + 1}"
    elif han_count == 1:
        return f"han-1char-{(h % 8) + 1}"
    elif han_count == 2:
        return f"han-2char-{(h % 8) + 1}"
    else:
        return f"han-3plus-{(h % 8) + 1}"


def get_subdir(word: str) -> str:
    return f"{simple_hash(word) & 0xFF:02x}"


def get_cdn_url(word: str) -> str:
    shard = get_shard_name(word)
    subdir = get_subdir(word)
    encoded = urllib.request.quote(word)
    return f"https://raw.githubusercontent.com/Kimeiga/kiokun2-dict-{shard}/main/{subdir}/{encoded}.json.deflate"


# ─── Fetch character data from CDN ──────────────────────────────────────────

def fetch_char_data(char: str) -> dict | None:
    """Fetch and decompress character data from CDN."""
    url = get_cdn_url(char)
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            compressed = resp.read()
            decompressed = zlib.decompress(compressed, -15)  # raw deflate
            return json.loads(decompressed)
    except Exception as e:
        return None


def build_equation(data: dict, char: str) -> str | None:
    """Build component equation string like 'water (氵) + every (每) = sea (海)'."""
    # Look for components in chinese_char (traditional), then japanese_char
    char_data = data.get("chinese_char") or data.get("japanese_char") or {}
    components = char_data.get("components", [])

    if not components:
        return None

    parts = []
    for comp in components:
        if isinstance(comp, str):
            c = comp
        elif isinstance(comp, dict):
            c = comp.get("character") or comp.get("char", "")
        else:
            continue

        if not c:
            continue

        # Get gloss from component_glosses
        gloss = GLOSSES.get(c, "")
        if gloss:
            parts.append(f"{gloss} ({c})")
        else:
            parts.append(c)

    if not parts:
        return None

    return " + ".join(parts)


def get_meanings(data: dict) -> str:
    """Extract meanings and readings from dictionary data."""
    meanings = []

    # Chinese data — gloss field has the primary meaning
    zh = data.get("chinese_char") or {}
    if zh:
        gloss = zh.get("gloss", "")
        if gloss:
            meanings.append(gloss)
        # Pinyin from pinyinFrequencies
        pf = zh.get("pinyinFrequencies", [])
        if pf:
            pinyin_str = ", ".join(p["pinyin"] for p in pf[:3])
            meanings.append(f"Pinyin: {pinyin_str}")
        # Also check chinese_words for additional definitions
        cw = data.get("chinese_words", [])
        if cw:
            for word_entry in cw[:1]:
                for item in word_entry.get("items", [])[:1]:
                    defs = item.get("definitions", [])
                    if defs:
                        meanings.append("; ".join(defs[:3]))

    # Japanese data — readingMeaning.groups
    ja = data.get("japanese_char") or {}
    if ja:
        rm = ja.get("readingMeaning", {})
        groups = rm.get("groups", [])
        for group in groups[:1]:
            # English meanings
            en_meanings = [m["value"] for m in group.get("meanings", []) if m.get("lang") == "en"]
            if en_meanings and not meanings:  # Don't duplicate if we already have Chinese gloss
                meanings.append("; ".join(en_meanings[:3]))
            # On and Kun readings
            on_readings = [r["value"] for r in group.get("readings", []) if r.get("type") == "ja_on"]
            kun_readings = [r["value"] for r in group.get("readings", []) if r.get("type") == "ja_kun"]
            if on_readings:
                meanings.append(f"On: {', '.join(on_readings[:3])}")
            if kun_readings:
                meanings.append(f"Kun: {', '.join(kun_readings[:3])}")

    # Korean data
    ko = data.get("korean_char") or {}
    if ko:
        ko_meanings = ko.get("meaningsEn", [])
        if ko_meanings:
            meanings.append(f"Korean: {'; '.join(ko_meanings[:2])}")

    return " | ".join(meanings) if meanings else ""


# ─── Claude API ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a mnemonic writer for CJK (Chinese/Japanese/Korean) characters.
You create short, memorable mnemonics that help learners remember both the meaning AND pronunciation of characters.

Style guidelines:
- Reference the character's visual components and what they mean
- Include pronunciation hints embedded naturally (e.g., "SĒN-sational" for 森 sēn, "ĀN-xiety free" for 安 ān)
- Use puns, wordplay, and vivid imagery
- Keep it concise — 1-2 sentences max
- The mnemonic should work for someone learning Chinese AND Japanese readings where possible
- Don't use emoji
- Don't start with "The character..." or be overly formal
- Be creative and memorable, not encyclopedic
- Don't use markdown formatting (no bold, italic, etc.)"""


def generate_mnemonic(char: str, equation: str, meanings: str) -> str | None:
    """Call Claude Haiku to generate a mnemonic."""
    prompt = f"""Write a mnemonic for the character {char}.

Components: {equation}
Meanings: {meanings}

Write ONLY the mnemonic, nothing else. Keep it to 1-2 sentences."""

    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
    }
    payload = json.dumps({
        "model": MODEL,
        "max_tokens": 200,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            text = data["content"][0]["text"].strip()
            # Remove any markdown formatting the model might add
            text = text.replace("**", "").replace("*", "").replace("__", "")
            return text
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  API ERROR {e.code}: {body[:200]}")
        if e.code == 429:
            print("  Rate limited, waiting 30s...")
            time.sleep(30)
            return generate_mnemonic(char, equation, meanings)  # Retry once
        return None
    except Exception as e:
        print(f"  ERROR: {e}")
        return None


# ─── Database insertion ──────────────────────────────────────────────────────

def insert_mnemonics(mnemonics: list[tuple[str, str]]) -> bool:
    """Insert mnemonics into D1 database via wrangler."""
    if not mnemonics:
        return True

    # Build SQL with proper escaping
    values = []
    for char, text in mnemonics:
        # Escape single quotes in text
        escaped_text = text.replace("'", "''")
        escaped_char = char.replace("'", "''")
        note_id = f"claude-mnemonic-{ord(char):x}" if len(char) == 1 else f"claude-mnemonic-{simple_hash(char):x}"
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        values.append(
            f"('{note_id}', '{USER_ID}', '{escaped_char}', '{escaped_text}', 1, '{now}', '{now}')"
        )

    sql = f"""INSERT OR REPLACE INTO notes (id, userId, character, noteText, isAdmin, createdAt, updatedAt)
VALUES {', '.join(values)};"""

    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "kiokun-dictionary", "--remote", "--command", sql],
        capture_output=True, text=True, cwd=str(Path(__file__).parent.parent)
    )

    if result.returncode != 0:
        print(f"  DB ERROR: {result.stderr[:300]}")
        return False
    return True


# ─── Progress tracking ──────────────────────────────────────────────────────

def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {"completed": [], "failed": [], "skipped": []}


def save_progress(progress: dict):
    PROGRESS_FILE.write_text(json.dumps(progress, ensure_ascii=False, indent=2))


# ─── Get all characters that need mnemonics ──────────────────────────────────

def get_characters_needing_mnemonics() -> list[str]:
    """Get CJK characters from component_glosses that don't yet have Claude mnemonics."""
    # Focus on main CJK block (0x4E00-0x9FFF) — the common characters
    # Extension A/B/C/D/E characters are too rare and often lack component data
    all_chars = sorted([k for k in GLOSSES if len(k) == 1 and 0x4E00 <= ord(k) <= 0x9FFF])

    # Get existing Claude mnemonics
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "kiokun-dictionary", "--remote",
         "--command", "SELECT character FROM notes WHERE userId = 'claude-ai-mnemonic-author'"],
        capture_output=True, text=True, cwd=str(Path(__file__).parent.parent)
    )

    existing = set()
    if result.returncode == 0:
        try:
            # Parse the JSON output
            output = result.stdout
            # Find the results array
            import re
            match = re.search(r'"results"\s*:\s*\[([^\]]*)\]', output, re.DOTALL)
            if match:
                results_str = match.group(0)
                # Extract characters
                for m in re.finditer(r'"character"\s*:\s*"([^"]*)"', results_str):
                    existing.add(m.group(1))
        except Exception as e:
            print(f"Warning: couldn't parse existing mnemonics: {e}")

    print(f"Total CJK chars in glosses: {len(all_chars)}")
    print(f"Already have Claude mnemonics for: {len(existing)} chars")

    # Filter out already-done characters
    needed = [c for c in all_chars if c not in existing]
    print(f"Characters needing mnemonics: {len(needed)}")

    return needed


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    # Parse args
    max_chars = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    dry_run = "--dry-run" in sys.argv

    print("=" * 60)
    print(f"Batch Mnemonic Generator (Claude Haiku 4.5)")
    print(f"Max characters: {max_chars}")
    print(f"Dry run: {dry_run}")
    print("=" * 60)

    chars = get_characters_needing_mnemonics()
    if not chars:
        print("\nAll characters already have mnemonics!")
        return

    # Limit to max_chars
    chars = chars[:max_chars]
    print(f"\nProcessing {len(chars)} characters...\n")

    progress = load_progress()
    # Skip already completed from this run
    completed_set = set(progress["completed"])
    chars = [c for c in chars if c not in completed_set]

    batch = []  # (char, mnemonic) pairs waiting to be inserted
    total_generated = 0
    total_skipped = 0
    total_failed = 0

    for i, char in enumerate(chars):
        print(f"[{i+1}/{len(chars)}] {char}", end="  ")

        # Fetch data from CDN
        data = fetch_char_data(char)
        if not data:
            print("⚠ No CDN data, skipping")
            progress["skipped"].append(char)
            total_skipped += 1
            continue

        # Build equation
        equation = build_equation(data, char)
        if not equation:
            print("⚠ No components, skipping")
            progress["skipped"].append(char)
            total_skipped += 1
            continue

        # Get meanings
        meanings = get_meanings(data)
        if not meanings:
            print("⚠ No meanings, skipping")
            progress["skipped"].append(char)
            total_skipped += 1
            continue

        print(f"({equation[:50]}...) ", end="")

        if dry_run:
            print("(dry run)")
            continue

        # Generate mnemonic
        mnemonic = generate_mnemonic(char, equation, meanings)
        if not mnemonic:
            print("✗ Generation failed")
            progress["failed"].append(char)
            total_failed += 1
            continue

        print(f"✓ {mnemonic[:60]}...")
        batch.append((char, mnemonic))
        total_generated += 1

        # Insert batch when full
        if len(batch) >= BATCH_SIZE:
            print(f"\n  → Inserting batch of {len(batch)} mnemonics...")
            if insert_mnemonics(batch):
                for c, _ in batch:
                    progress["completed"].append(c)
                save_progress(progress)
                print(f"  → Saved. Total: {total_generated} generated, {total_skipped} skipped, {total_failed} failed\n")
            else:
                print("  → DB insert failed!")
                for c, _ in batch:
                    progress["failed"].append(c)
                save_progress(progress)
            batch = []
            time.sleep(DELAY_BETWEEN_BATCHES)

        time.sleep(DELAY_BETWEEN_CALLS)

    # Insert remaining batch
    if batch and not dry_run:
        print(f"\n  → Inserting final batch of {len(batch)} mnemonics...")
        if insert_mnemonics(batch):
            for c, _ in batch:
                progress["completed"].append(c)
        else:
            for c, _ in batch:
                progress["failed"].append(c)
        save_progress(progress)

    print("\n" + "=" * 60)
    print(f"DONE: {total_generated} generated, {total_skipped} skipped, {total_failed} failed")
    print(f"Progress saved to {PROGRESS_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
