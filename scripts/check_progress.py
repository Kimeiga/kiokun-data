#!/usr/bin/env python3
"""Check transcription progress."""
import json
from pathlib import Path

db_path = Path("video_words_db.json")
if not db_path.exists():
    print("No database file found yet.")
    exit(1)

with open(db_path) as f:
    d = json.load(f)

videos = len(d.get("videos", {}))
words = len(d.get("words", {}))
total = 418
pct = videos * 100 // total if total > 0 else 0
remaining = total - videos
eta = remaining // 10  # ~10 videos per minute

print(f"Progress: {videos}/{total} videos ({pct}%)")
print(f"Dictionary words with video examples: {words}")
print(f"Estimated time remaining: ~{eta} minutes")

