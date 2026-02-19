#!/usr/bin/env python3
"""
Chinese Video to Dictionary Pipeline

Transcribes Chinese videos using mlx-whisper, tokenizes with jieba,
and matches words to the Chinese dictionary.

Usage:
    python3 scripts/chinese_video_to_dictionary.py path/to/video.mp4
    python3 scripts/chinese_video_to_dictionary.py cosmos_chinese_videos --batch
"""

import json
import sys
import os
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional
import re

# Check for required dependencies
try:
    import mlx_whisper
except ImportError:
    print("❌ mlx-whisper not installed. Run: pip install mlx-whisper")
    sys.exit(1)

try:
    import jieba
except ImportError:
    print("❌ jieba not installed. Run: pip install jieba")
    sys.exit(1)

# OpenCC for simplified to traditional conversion (optional but recommended)
try:
    import opencc
    converter = opencc.OpenCC('s2t')  # Simplified to Traditional
    HAS_OPENCC = True
except ImportError:
    print("⚠️  opencc-python-reimplemented not installed. Traditional lookup may be incomplete.")
    print("   Install with: pip install opencc-python-reimplemented")
    HAS_OPENCC = False
    converter = None


@dataclass
class WordOccurrence:
    word: str           # Traditional Chinese (dictionary key)
    surface: str        # Original form in transcript (simplified)
    start_time: float
    end_time: float
    sentence: str
    video_id: str
    video_path: str


def get_video_id(video_path: str) -> str:
    """Extract video ID from path (filename without extension)."""
    return Path(video_path).stem


def transcribe_video(video_path: str) -> dict:
    """Transcribe video using mlx-whisper with Chinese language."""
    print(f"🎤 Transcribing: {video_path}")
    
    result = mlx_whisper.transcribe(
        video_path,
        path_or_hf_repo="mlx-community/whisper-large-v3-turbo",
        language="zh",  # Chinese
        word_timestamps=False,
    )
    
    print(f"   Found {len(result.get('segments', []))} segments")
    return result


def is_chinese_char(char: str) -> bool:
    """Check if character is a Chinese character."""
    code = ord(char)
    return (0x4E00 <= code <= 0x9FFF or      # CJK Unified Ideographs
            0x3400 <= code <= 0x4DBF or      # CJK Extension A
            0x20000 <= code <= 0x2A6DF)      # CJK Extension B


def tokenize_chinese(text: str) -> list[dict]:
    """Tokenize Chinese text using jieba."""
    # Use jieba's cut with HMM for better segmentation
    words = list(jieba.cut(text, cut_all=False, HMM=True))
    
    tokens = []
    for word in words:
        # Skip punctuation, spaces, and single non-Chinese chars
        if not word.strip():
            continue
        if len(word) == 1 and not is_chinese_char(word):
            continue
        # Keep only words with at least one Chinese character
        if any(is_chinese_char(c) for c in word):
            tokens.append({
                "surface": word,
                "traditional": converter.convert(word) if HAS_OPENCC else word
            })
    
    return tokens


def simple_hash(s: str) -> int:
    """Hash function matching Rust/TypeScript implementation."""
    hash_val = 0
    for c in s:
        hash_val = ((hash_val * 31) + ord(c)) & 0xFFFFFFFF
    return hash_val


def get_subdir(word: str) -> str:
    """Get the subdirectory (00-ff) for a word."""
    hash_val = simple_hash(word)
    return f"{hash_val & 0xFF:02x}"


def check_dictionary_entry(word: str, dict_path: Path) -> bool:
    """Check if a word exists in the dictionary."""
    subdir = get_subdir(word)
    entry_path = dict_path / subdir / f"{word}.json.deflate"
    return entry_path.exists()


def process_video(video_path: str, dict_path: Path) -> list[WordOccurrence]:
    """Process a video and extract Chinese word occurrences."""
    video_id = get_video_id(video_path)
    
    # Transcribe
    result = transcribe_video(video_path)
    
    occurrences = []
    
    print(f"🔤 Tokenizing and matching to dictionary...")
    
    for segment in result["segments"]:
        text = segment["text"]
        start = segment["start"]
        end = segment["end"]
        
        tokens = tokenize_chinese(text)
        
        for token in tokens:
            # Try traditional form first (dictionary key)
            trad_word = token["traditional"]
            surface = token["surface"]
            
            # Check if word exists in dictionary
            if check_dictionary_entry(trad_word, dict_path):
                occurrences.append(WordOccurrence(
                    word=trad_word,
                    surface=surface,
                    start_time=start,
                    end_time=end,
                    sentence=text,
                    video_id=video_id,
                    video_path=video_path,
                ))
    
    print(f"   Found {len(occurrences)} word occurrences ({len(set(o.word for o in occurrences))} unique)")
    return occurrences


def load_database(db_path: Path) -> dict:
    """Load or create the video-word database."""
    if db_path.exists():
        with open(db_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"videos": {}, "words": {}}


def save_database(db: dict, db_path: Path):
    """Save the database."""
    with open(db_path, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


def add_to_database(db: dict, occurrences: list[WordOccurrence]):
    """Add word occurrences to the database."""
    if not occurrences:
        return 0

    video_id = occurrences[0].video_id
    video_path = occurrences[0].video_path

    # Add video entry
    db["videos"][video_id] = {
        "path": video_path,
        "word_count": len(occurrences)
    }

    # Add word entries
    added = 0
    for occ in occurrences:
        if occ.word not in db["words"]:
            db["words"][occ.word] = []

        db["words"][occ.word].append({
            "video_id": occ.video_id,
            "surface": occ.surface,
            "start_time": occ.start_time,
            "end_time": occ.end_time,
            "sentence": occ.sentence
        })
        added += 1

    return added


def process_batch(video_dir: str, dict_path: Path, db_path: Path):
    """Process all videos in a directory."""
    video_dir = Path(video_dir)

    # Find all MP4 files
    videos = sorted(video_dir.glob("*.mp4"))
    print(f"📁 Found {len(videos)} videos in {video_dir}")

    # Load existing database
    db = load_database(db_path)

    for i, video_path in enumerate(videos, 1):
        video_id = get_video_id(str(video_path))

        # Skip if already processed
        if video_id in db["videos"]:
            print(f"⏭️  [{i}/{len(videos)}] Skipping (already processed): {video_path.name}")
            continue

        print(f"\n🎬 [{i}/{len(videos)}] Processing: {video_path.name}")

        try:
            occurrences = process_video(str(video_path), dict_path)
            added = add_to_database(db, occurrences)
            print(f"   ✅ Added {added} words")

            # Save after each video
            save_database(db, db_path)

        except Exception as e:
            print(f"   ❌ Error: {e}")
            continue

    # Final statistics
    print(f"\n📊 Final Statistics:")
    print(f"   Videos processed: {len(db['videos'])}")
    print(f"   Unique words: {len(db['words'])}")
    total_occurrences = sum(len(v) for v in db["words"].values())
    print(f"   Total word occurrences: {total_occurrences}")


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python3 scripts/chinese_video_to_dictionary.py <video.mp4>")
        print("  python3 scripts/chinese_video_to_dictionary.py <video_dir> --batch")
        sys.exit(1)

    dict_path = Path("output_dictionary")
    if not dict_path.exists():
        print(f"❌ Dictionary not found at {dict_path}")
        sys.exit(1)

    db_path = Path("chinese_video_words_db.json")

    if "--batch" in sys.argv:
        video_dir = sys.argv[1]
        process_batch(video_dir, dict_path, db_path)
    else:
        video_path = sys.argv[1]
        occurrences = process_video(video_path, dict_path)

        # Save to database
        db = load_database(db_path)
        added = add_to_database(db, occurrences)
        save_database(db, db_path)

        print(f"\n✅ Added {added} word occurrences to {db_path}")


if __name__ == "__main__":
    main()

