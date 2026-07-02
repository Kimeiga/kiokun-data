#!/usr/bin/env python3
"""
Copy mnemonics from traditional characters to their simplified and Japanese variants.
This ensures the mnemonic shows up regardless of which variant URL the user visits.
"""

import json
import os
import sys
import zlib
import subprocess
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

USER_ID = "claude-ai-mnemonic-author"

def simple_hash(s):
    h = 0
    for ch in s:
        h = ((h * 31) + ord(ch)) & 0xFFFFFFFF
    return h

def fetch_char_data(char):
    h = simple_hash(char)
    shard_num = (h % 8) + 1
    shard = f'han-1char-{shard_num}'
    subdir = f'{h & 0xFF:02x}'
    encoded = urllib.request.quote(char)
    url = f'https://raw.githubusercontent.com/Kimeiga/kiokun2-dict-{shard}/main/{subdir}/{encoded}.json.deflate'
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(zlib.decompress(resp.read(), -15))
    except:
        return None

def get_existing_mnemonics():
    """Get all characters that have Claude mnemonics."""
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "kiokun-dictionary", "--remote",
         "--command", f"SELECT character, noteText FROM notes WHERE userId = '{USER_ID}'"],
        capture_output=True, text=True, cwd=str(Path(__file__).parent.parent)
    )

    import re
    mnemonics = {}
    if result.returncode == 0:
        for m in re.finditer(r'"character"\s*:\s*"([^"]*)".*?"noteText"\s*:\s*"((?:[^"\\]|\\.)*)"', result.stdout, re.DOTALL):
            char = m.group(1)
            text = m.group(2).replace('\\"', '"').replace('\\n', '\n').replace("\\'", "'")
            mnemonics[char] = text
    return mnemonics

def insert_mnemonics(pairs):
    """Insert (char, text) pairs into DB."""
    if not pairs:
        return True
    values = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    for char, text in pairs:
        escaped_text = text.replace("'", "''")
        escaped_char = char.replace("'", "''")
        note_id = f"claude-mnemonic-variant-{ord(char):x}" if len(char) == 1 else f"claude-mnemonic-variant-{simple_hash(char):x}"
        values.append(f"('{note_id}', '{USER_ID}', '{escaped_char}', '{escaped_text}', 1, '{now}', '{now}')")

    sql = f"INSERT OR IGNORE INTO notes (id, userId, character, noteText, isAdmin, createdAt, updatedAt) VALUES {', '.join(values)};"
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "kiokun-dictionary", "--remote", "--command", sql],
        capture_output=True, text=True, cwd=str(Path(__file__).parent.parent)
    )
    return result.returncode == 0

def main():
    dry_run = "--dry-run" in sys.argv

    print("Fetching existing mnemonics...")
    existing = get_existing_mnemonics()
    print(f"Found {len(existing)} existing mnemonics")

    # Only process single CJK characters
    chars_with_mnemonics = [c for c in existing if len(c) == 1 and 0x2E80 <= ord(c) <= 0x9FFF]
    print(f"Single CJK characters with mnemonics: {len(chars_with_mnemonics)}")

    to_insert = []  # (variant_char, mnemonic_text)
    checked = 0

    for char in chars_with_mnemonics:
        data = fetch_char_data(char)
        if not data:
            continue

        checked += 1
        zh = data.get("chinese_char", {})
        ja = data.get("japanese_char", {})

        variants = set()

        # Simplified variants
        for sv in zh.get("simpVariants", []):
            if sv != char and sv not in existing:
                variants.add(sv)

        # Traditional variants (if this is a simplified entry)
        for tv in zh.get("tradVariants", []):
            if tv != char and tv not in existing:
                variants.add(tv)

        # Japanese shinjitai
        jp_lit = ja.get("literal") if ja else None
        if jp_lit and jp_lit != char and jp_lit not in existing:
            variants.add(jp_lit)

        for v in variants:
            to_insert.append((v, existing[char]))
            # Also add to existing so we don't duplicate
            existing[v] = existing[char]

        if variants and checked <= 20:
            print(f"  {char} → variants: {', '.join(variants)}")

        if checked % 500 == 0:
            print(f"  ...checked {checked} characters, found {len(to_insert)} variants to insert")

    print(f"\nTotal variants to insert: {len(to_insert)}")

    if dry_run:
        print("(dry run, not inserting)")
        # Show some examples
        for char, text in to_insert[:10]:
            print(f"  {char}: {text[:60]}...")
        return

    # Insert in batches
    batch_size = 20
    inserted = 0
    for i in range(0, len(to_insert), batch_size):
        batch = to_insert[i:i+batch_size]
        if insert_mnemonics(batch):
            inserted += len(batch)
            print(f"  Inserted {inserted}/{len(to_insert)}")
        else:
            print(f"  FAILED batch at {i}")

    print(f"\nDone: {inserted} variant mnemonics inserted")

if __name__ == "__main__":
    main()
