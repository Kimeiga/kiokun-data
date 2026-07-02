#!/usr/bin/env python3
"""
Find simplified/Japanese characters with significantly different components from traditional,
and append variant mnemonic sections to existing traditional mnemonics.
"""

import json
import os
import re
import sys
import time
import zlib
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime, timezone

# Config
MODEL = "claude-haiku-4-5-20251001"
USER_ID = "claude-ai-mnemonic-author"
ROOT = Path(__file__).parent.parent
BATCH_SIZE = 10
PROGRESS_FILE = Path(__file__).parent / "variant_mnemonic_progress.json"

# Load API key
env_path = ROOT / "sveltekit-app" / ".env.local"
env_vars = {}
if env_path.exists():
    for line in env_path.read_text().strip().split("\n"):
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env_vars[k.strip()] = v.strip()
ANTHROPIC_API_KEY = env_vars.get("ANTHROPIC_API_KEY", "")

# Load glosses
glosses = json.load(open(ROOT / "sveltekit-app" / "static" / "game_data" / "component_glosses.json"))

# ─── CDN fetch ───────────────────────────────────────────────────────────────

def simple_hash(s):
    h = 0
    for ch in s:
        h = ((h * 31) + ord(ch)) & 0xFFFFFFFF
    return h

def fetch(char):
    h = simple_hash(char)
    code = ord(char) if len(char) == 1 else 0
    is_han = (0x4E00 <= code <= 0x9FFF or 0x3400 <= code <= 0x4DBF or 0x20000 <= code <= 0x2CEAF)
    if len(char) == 1 and is_han:
        shard = f'han-1char-{(h % 8) + 1}'
    else:
        shard = f'non-han-{(h % 4) + 1}'
    subdir = f'{h & 0xFF:02x}'
    encoded = urllib.request.quote(char)
    url = f'https://raw.githubusercontent.com/Kimeiga/kiokun2-dict-{shard}/main/{subdir}/{encoded}.json.deflate'
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(zlib.decompress(resp.read(), -15))
    except:
        return None

# ─── Component variant detection (union-find) ───────────────────────────────

parent = {}
def find(x):
    while parent.get(x, x) != x:
        parent[x] = parent.get(parent[x], parent[x])
        x = parent[x]
    return x
def union(a, b):
    a, b = find(a), find(b)
    if a != b:
        parent[b] = a

# Build from glosses
for char, gloss in glosses.items():
    if '(simp)' not in gloss and '🇨🇳' not in gloss:
        continue
    base = gloss.replace('(simp)', '').replace('🇨🇳', '').strip().lower()
    for tchar, tgloss in glosses.items():
        if tchar == char: continue
        tbase = tgloss.replace('(trad/jp)', '').replace('(trad)', '').replace('(jp)', '').replace('🇹🇼', '').replace('🇯🇵', '').strip().lower()
        if base and tbase and base == tbase:
            union(char, tchar)

# Hardcoded reliable pairs
for s, t in {
    '讠': '言', '钅': '金', '饣': '食', '纟': '糸', '贝': '貝',
    '车': '車', '见': '見', '页': '頁', '鱼': '魚', '鸟': '鳥',
    '马': '馬', '齿': '齒', '龙': '龍', '门': '門',
    '飠': '食', '釒': '金', '訁': '言', '糹': '糸',
    '忄': '心', '扌': '手', '氵': '水', '犭': '犬', '礻': '示',
    '衤': '衣', '亻': '人', '刂': '刀', '冫': '氵',
    '义': '義',
}.items():
    union(s, t)

def are_variants(a, b):
    if a == b: return True
    return find(a) == find(b)

def get_components(data):
    zh = data.get('chinese_char', {})
    return [c.get('character', '') if isinstance(c, dict) else c for c in zh.get('components', [])]

def get_component_glosses(comps):
    """Get gloss for each component."""
    return [(c, glosses.get(c, '?')) for c in comps]

def are_components_equivalent(trad_comps, variant_comps):
    """Check if variant components are just simplified forms of traditional ones."""
    if not trad_comps and not variant_comps: return True
    if not variant_comps: return False  # variant has no data = structurally different
    if not trad_comps: return True
    if trad_comps == variant_comps: return True

    used_trad = set()
    for vc in variant_comps:
        for i, tc in enumerate(trad_comps):
            if i not in used_trad and are_variants(tc, vc):
                used_trad.add(i)
                break

    unmatched_trad = [tc for i, tc in enumerate(trad_comps) if i not in used_trad and tc != '◎']
    matched_variant = set()
    for vc in variant_comps:
        for i in used_trad:
            if are_variants(trad_comps[i], vc):
                matched_variant.add(vc)
                break
    unmatched_variant = [vc for vc in variant_comps if vc not in matched_variant and vc != '◎']

    return not unmatched_trad and not unmatched_variant

# ─── Get existing mnemonics from DB ──────────────────────────────────────────

def get_claude_notes():
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "kiokun-dictionary", "--remote",
         "--command", f"SELECT id, character, noteText FROM notes WHERE userId = '{USER_ID}'"],
        capture_output=True, text=True, cwd=str(ROOT)
    )
    notes = {}
    for m in re.finditer(r'"id"\s*:\s*"([^"]*)".*?"character"\s*:\s*"([^"]*)".*?"noteText"\s*:\s*"((?:[^"\\]|\\.)*)"', result.stdout, re.DOTALL):
        notes[m.group(2)] = {"id": m.group(1), "text": m.group(3).replace('\\n', '\n').replace('\\"', '"').replace("\\'", "'")}
    return notes

# ─── Claude API ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a mnemonic writer for CJK characters.
Create short, memorable mnemonics using the character's components and pronunciation.
Style: reference components, embed pronunciation puns (e.g., "SĒN-sational"), 1-2 sentences, no emoji, no markdown."""

def generate_mnemonic(char, equation, meanings):
    prompt = f"""Write a mnemonic for the SIMPLIFIED/JAPANESE form of {char}.

Components: {equation}
Meanings: {meanings}

This is a simplified or Japanese version of a character. Reference these specific components.
Write ONLY the mnemonic, 1-2 sentences."""

    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
    }
    payload = json.dumps({
        "model": MODEL, "max_tokens": 200,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            text = data["content"][0]["text"].strip()
            return text.replace("**", "").replace("*", "")
    except urllib.error.HTTPError as e:
        if e.code == 429:
            time.sleep(30)
            return generate_mnemonic(char, equation, meanings)
        return None
    except:
        return None

def build_equation(comps):
    parts = []
    for c in comps:
        g = glosses.get(c, '')
        if g:
            parts.append(f"{g} ({c})")
        else:
            parts.append(c)
    return " + ".join(parts)

# ─── DB update ───────────────────────────────────────────────────────────────

def update_note(note_id, new_text):
    escaped = new_text.replace("'", "''")
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    sql = f"UPDATE notes SET noteText = '{escaped}', updatedAt = '{now}' WHERE id = '{note_id}'"
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "kiokun-dictionary", "--remote", "--command", sql],
        capture_output=True, text=True, cwd=str(ROOT)
    )
    return "success" in result.stdout

# ─── Progress ────────────────────────────────────────────────────────────────

def load_progress():
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {"completed": [], "skipped": [], "different_pairs": []}

def save_progress(p):
    PROGRESS_FILE.write_text(json.dumps(p, ensure_ascii=False, indent=2))

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    dry_run = "--dry-run" in sys.argv
    scan_only = "--scan-only" in sys.argv
    max_chars = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 99999

    print("=" * 60)
    print("Variant Mnemonic Generator")
    print(f"Mode: {'scan only' if scan_only else 'dry run' if dry_run else 'LIVE'}")
    print("=" * 60)

    print("\nLoading existing mnemonics...")
    notes = get_claude_notes()
    single_cjk = {c: n for c, n in notes.items() if len(c) == 1 and ord(c) >= 0x4E00}
    print(f"Found {len(single_cjk)} single CJK character mnemonics")

    progress = load_progress()
    done = set(progress["completed"] + progress["skipped"])

    different_simp = []
    different_jp = []
    same_count = 0
    checked = 0

    for char, note in sorted(single_cjk.items()):
        if char in done:
            continue
        if checked >= max_chars:
            break

        data = fetch(char)
        if not data:
            continue

        checked += 1
        trad_comps = get_components(data)
        zh = data.get("chinese_char", {})
        ja = data.get("japanese_char", {})

        # Check simplified variant
        simp_chars = zh.get("simpVariants", [])
        for sc in simp_chars:
            sd = fetch(sc)
            if not sd:
                continue
            simp_comps = get_components(sd)
            if not are_components_equivalent(trad_comps, simp_comps) and simp_comps:
                trad_eq = build_equation(trad_comps)
                simp_eq = build_equation(simp_comps)
                different_simp.append((char, sc, trad_eq, simp_eq, note))

        # Check Japanese variant
        jp_lit = ja.get("literal") if ja else None
        if jp_lit and jp_lit != char and jp_lit not in simp_chars:
            jd = fetch(jp_lit)
            if jd:
                jp_comps = get_components(jd)
                if not are_components_equivalent(trad_comps, jp_comps) and jp_comps:
                    trad_eq = build_equation(trad_comps)
                    jp_eq = build_equation(jp_comps)
                    different_jp.append((char, jp_lit, trad_eq, jp_eq, note))

        if checked % 500 == 0:
            print(f"  ...checked {checked}, found {len(different_simp)} simp + {len(different_jp)} jp different")

    print(f"\nScan complete:")
    print(f"  Simplified chars needing separate mnemonics: {len(different_simp)}")
    print(f"  Japanese chars needing separate mnemonics: {len(different_jp)}")

    if scan_only:
        print("\nSimplified examples:")
        for trad, simp, trad_eq, simp_eq, _ in different_simp[:15]:
            print(f"  {trad}→{simp}: {trad_eq[:40]} vs {simp_eq[:40]}")
        print("\nJapanese examples:")
        for trad, jp, trad_eq, jp_eq, _ in different_jp[:15]:
            print(f"  {trad}→{jp}: {trad_eq[:40]} vs {jp_eq[:40]}")
        return

    # Generate and append variant mnemonics
    total = len(different_simp) + len(different_jp)
    print(f"\nGenerating {total} variant mnemonics...")

    generated = 0
    for trad_char, variant_char, trad_eq, variant_eq, note in different_simp + different_jp:
        if trad_char in done:
            continue

        is_jp = any(trad_char == t and variant_char == j for t, j, _, _, _ in different_jp)
        label = "🇯🇵" if is_jp else "🇨🇳"

        # Get meanings
        td = fetch(trad_char)
        meanings = td.get("chinese_char", {}).get("gloss", "") if td else ""

        print(f"  {trad_char}→{variant_char} ({label}): {variant_eq[:50]}...", end=" ")

        if dry_run:
            print("(dry run)")
            continue

        mnemonic = generate_mnemonic(variant_char, variant_eq, meanings)
        if not mnemonic:
            print("✗ failed")
            continue

        # Append to existing note
        existing_text = note["text"]
        # Check if it already has variant sections
        if f"\n\n{label}" not in existing_text:
            new_text = f"{existing_text}\n\n{label} {mnemonic}"
            if update_note(note["id"], new_text):
                print(f"✓ {mnemonic[:50]}...")
                generated += 1
                progress["completed"].append(trad_char)
            else:
                print("✗ db error")
        else:
            print("(already has variant)")
            progress["skipped"].append(trad_char)

        save_progress(progress)
        time.sleep(0.3)

    print(f"\nDone: {generated} variant mnemonics appended")

if __name__ == "__main__":
    main()
