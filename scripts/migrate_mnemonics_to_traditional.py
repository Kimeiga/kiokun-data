#!/usr/bin/env python3
"""
Migrate mnemonics from simplified/variant characters to their traditional forms.
After this, Notes component can use traditionalChar (post-redirect) to find mnemonics.
"""

import json
import re
import sys
import zlib
import subprocess
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

USER_ID = "claude-ai-mnemonic-author"
ROOT = Path(__file__).parent.parent

def simple_hash(s):
    h = 0
    for ch in s:
        h = ((h * 31) + ord(ch)) & 0xFFFFFFFF
    return h

def fetch(char):
    h = simple_hash(char)
    shard = f'han-1char-{(h % 8) + 1}'
    subdir = f'{h & 0xFF:02x}'
    encoded = urllib.request.quote(char)
    url = f'https://raw.githubusercontent.com/Kimeiga/kiokun2-dict-{shard}/main/{subdir}/{encoded}.json.deflate'
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(zlib.decompress(resp.read(), -15))
    except:
        return None

def run_sql(sql):
    result = subprocess.run(
        ["npx", "wrangler", "d1", "execute", "kiokun-dictionary", "--remote", "--command", sql],
        capture_output=True, text=True, cwd=str(ROOT)
    )
    return result

def get_all_claude_notes():
    result = run_sql(f"SELECT id, character, noteText FROM notes WHERE userId = '{USER_ID}'")
    notes = {}
    for m in re.finditer(r'"id"\s*:\s*"([^"]*)".*?"character"\s*:\s*"([^"]*)".*?"noteText"\s*:\s*"((?:[^"\\]|\\.)*)"', result.stdout, re.DOTALL):
        notes[m.group(2)] = {"id": m.group(1), "text": m.group(3)}
    return notes

def main():
    dry_run = "--dry-run" in sys.argv

    print("Loading existing mnemonics...")
    notes = get_all_claude_notes()
    print(f"Found {len(notes)} Claude mnemonics")

    single_cjk = {c: n for c, n in notes.items() if len(c) == 1 and ord(c) >= 0x4E00}
    print(f"Single CJK: {len(single_cjk)}")

    # Find chars that redirect and need migration
    to_migrate = []  # (old_char, new_trad_char, note_id, note_text)
    to_delete = []   # note IDs to delete (simplified has mnemonic, but traditional already does too)
    checked = 0

    for char, note in single_cjk.items():
        data = fetch(char)
        if not data:
            continue

        redirect = data.get("redirect")
        if not redirect:
            continue  # Already traditional or standalone

        checked += 1
        trad = redirect

        if trad in notes:
            # Traditional already has a mnemonic — delete the simplified copy
            to_delete.append(note["id"])
        else:
            # Migrate: move mnemonic to traditional form
            to_migrate.append((char, trad, note["id"], note["text"]))
            # Mark as having a note so we don't double-migrate
            notes[trad] = note

        if checked % 200 == 0:
            print(f"  ...checked {checked}, migrate: {len(to_migrate)}, delete: {len(to_delete)}")

    print(f"\nResults: {len(to_migrate)} to migrate, {len(to_delete)} duplicates to delete")

    if dry_run:
        print("(dry run)")
        for old, new, _, _ in to_migrate[:10]:
            print(f"  {old} → {new}")
        return

    # Migrate: update character field to traditional form
    migrated = 0
    for i in range(0, len(to_migrate), 20):
        batch = to_migrate[i:i+20]
        cases = []
        ids = []
        for old_char, new_char, note_id, _ in batch:
            escaped_new = new_char.replace("'", "''")
            cases.append(f"WHEN id = '{note_id}' THEN '{escaped_new}'")
            ids.append(f"'{note_id}'")

        sql = f"UPDATE notes SET character = CASE {' '.join(cases)} END WHERE id IN ({', '.join(ids)})"
        result = run_sql(sql)
        if "success" in result.stdout:
            migrated += len(batch)
            print(f"  Migrated {migrated}/{len(to_migrate)}")
        else:
            print(f"  FAILED at batch {i}: {result.stderr[:200]}")

    # Delete duplicates
    deleted = 0
    for i in range(0, len(to_delete), 50):
        batch = to_delete[i:i+50]
        ids_str = ", ".join(f"'{id}'" for id in batch)
        sql = f"DELETE FROM notes WHERE id IN ({ids_str})"
        result = run_sql(sql)
        if "success" in result.stdout:
            deleted += len(batch)
            print(f"  Deleted {deleted}/{len(to_delete)} duplicates")

    print(f"\nDone: {migrated} migrated, {deleted} duplicates deleted")

if __name__ == "__main__":
    main()
