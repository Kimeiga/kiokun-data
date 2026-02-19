#!/usr/bin/env python3
"""
Video to Dictionary Pipeline

Transcribes Japanese videos using Whisper, tokenizes with SudachiPy,
and links words to dictionary entries.

Usage:
    python scripts/video_to_dictionary.py video.mp4
    python scripts/video_to_dictionary.py video.mp4 --output results.json
"""

import argparse
import json
import os
import hashlib
import zlib
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional

import mlx_whisper
from sudachipy import dictionary, tokenizer


@dataclass
class WordOccurrence:
    """A word occurrence in a video."""
    word: str                    # Dictionary form (e.g., 食べる)
    surface: str                 # As spoken (e.g., 食べて)
    pos: str                     # Part of speech
    start_time: float            # Start timestamp in seconds
    end_time: float              # End timestamp in seconds
    sentence: str                # Full sentence context
    video_id: str                # Video identifier
    video_path: str              # Path to video file


def get_video_id(video_path: str) -> str:
    """Generate a unique ID for a video based on filename."""
    name = Path(video_path).stem
    # If it looks like a Cosmos ID, use it directly
    if len(name) == 36 and name.count('-') == 4:
        return name
    # Otherwise, create a short hash
    return hashlib.md5(name.encode()).hexdigest()[:12]


def transcribe_video(video_path: str, model: str = "mlx-community/whisper-large-v3-turbo") -> dict:
    """Transcribe a video file using Whisper."""
    print(f"🎤 Transcribing: {video_path}")
    result = mlx_whisper.transcribe(
        video_path,
        path_or_hf_repo=model,
        language="ja"
    )
    print(f"   Found {len(result['segments'])} segments")
    return result


def tokenize_segment(text: str, tokenizer_obj, mode) -> list[dict]:
    """Tokenize a text segment using SudachiPy."""
    tokens = tokenizer_obj.tokenize(text, mode)
    return [
        {
            "surface": t.surface(),
            "dictionary_form": t.dictionary_form(),
            "pos": t.part_of_speech()[0],
            "pos_detail": "/".join(t.part_of_speech()[:3]),
        }
        for t in tokens
    ]


def simple_hash(s: str) -> int:
    """Hash function matching Rust/TypeScript implementation."""
    hash_val = 0
    for c in s:
        # Wrapping multiplication and addition (32-bit unsigned)
        hash_val = ((hash_val * 31) + ord(c)) & 0xFFFFFFFF
    return hash_val


def is_han_character(char: str) -> bool:
    """Check if a character is a Han character (Chinese/Japanese kanji)."""
    code = ord(char)
    return (0x4E00 <= code <= 0x9FFF or      # CJK Unified Ideographs
            0x3400 <= code <= 0x4DBF or      # CJK Extension A
            0x20000 <= code <= 0x2A6DF or    # CJK Extension B
            0x2A700 <= code <= 0x2B73F or    # CJK Extension C
            0x2B740 <= code <= 0x2B81F or    # CJK Extension D
            0x2B820 <= code <= 0x2CEAF)      # CJK Extension E


def count_han_characters(word: str) -> int:
    """Count Han characters in a string."""
    return sum(1 for c in word if is_han_character(c))


def get_shard_name(word: str) -> str:
    """Get the shard name for a word (matches TypeScript getShardName)."""
    han_count = count_han_characters(word)
    hash_val = simple_hash(word)

    if han_count == 0:
        shard_num = (hash_val % 4) + 1
        return f"non-han-{shard_num}"
    elif han_count == 1:
        shard_num = (hash_val % 8) + 1
        return f"han-1char-{shard_num}"
    elif han_count == 2:
        shard_num = (hash_val % 8) + 1
        return f"han-2char-{shard_num}"
    else:
        shard_num = (hash_val % 8) + 1
        return f"han-3plus-{shard_num}"


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
    """Process a video and extract word occurrences."""
    video_id = get_video_id(video_path)
    
    # Transcribe
    result = transcribe_video(video_path)
    
    # Initialize tokenizer
    tok = dictionary.Dictionary().create()
    mode = tokenizer.Tokenizer.SplitMode.C
    
    occurrences = []
    content_pos = {"名詞", "動詞", "形容詞", "形状詞", "副詞"}  # Content words only
    
    print(f"🔤 Tokenizing and matching to dictionary...")
    
    for segment in result["segments"]:
        text = segment["text"]
        start = segment["start"]
        end = segment["end"]
        
        tokens = tokenize_segment(text, tok, mode)
        
        for token in tokens:
            # Skip particles, auxiliary verbs, etc.
            if token["pos"] not in content_pos:
                continue
            
            word = token["dictionary_form"]
            
            # Check if word exists in dictionary
            if check_dictionary_entry(word, dict_path):
                occurrences.append(WordOccurrence(
                    word=word,
                    surface=token["surface"],
                    pos=token["pos"],
                    start_time=start,
                    end_time=end,
                    sentence=text,
                    video_id=video_id,
                    video_path=video_path,
                ))
    
    # Keep all occurrences (no deduplication) for complete transcript
    print(f"   Found {len(occurrences)} word occurrences ({len(set(o.word for o in occurrences))} unique words)")
    return occurrences


def load_database(db_path: Path) -> dict:
    """Load or create the video-word database."""
    if db_path.exists():
        with open(db_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"videos": {}, "words": {}}


def save_database(db: dict, db_path: Path):
    """Save the video-word database."""
    with open(db_path, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


def add_to_database(db: dict, occurrences: list[WordOccurrence], video_url: Optional[str] = None):
    """Add word occurrences to the database."""
    if not occurrences:
        return

    video_id = occurrences[0].video_id
    video_path = occurrences[0].video_path

    # Add video info
    db["videos"][video_id] = {
        "path": video_path,
        "url": video_url,
        "word_count": len(occurrences),
    }

    # Add word-video links
    for occ in occurrences:
        if occ.word not in db["words"]:
            db["words"][occ.word] = []

        # Check if this video is already linked
        existing = [v for v in db["words"][occ.word] if v["video_id"] == video_id]
        if not existing:
            db["words"][occ.word].append({
                "video_id": video_id,
                "video_url": video_url,
                "start_time": occ.start_time,
                "end_time": occ.end_time,
                "sentence": occ.sentence,
                "surface": occ.surface,
            })


def process_batch(video_dir: Path, dict_path: Path, db_path: Path):
    """Process all videos in a directory."""
    video_extensions = {".mp4", ".mov", ".webm", ".mkv", ".m4v"}
    videos = [f for f in video_dir.iterdir()
              if f.suffix.lower() in video_extensions]

    print(f"📁 Found {len(videos)} videos in {video_dir}")

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
            add_to_database(db, occurrences)
            save_database(db, db_path)
            print(f"   ✅ Added {len(occurrences)} words")
        except Exception as e:
            print(f"   ❌ Error: {e}")

    # Print summary
    print(f"\n{'='*60}")
    print("DATABASE SUMMARY:")
    print(f"{'='*60}")
    print(f"  Videos processed: {len(db['videos'])}")
    print(f"  Unique words: {len(db['words'])}")

    # Top words by video count
    word_counts = [(w, len(v)) for w, v in db["words"].items()]
    word_counts.sort(key=lambda x: -x[1])
    print(f"\n  Top 10 words (by video appearances):")
    for word, count in word_counts[:10]:
        print(f"    {word}: {count} videos")


def main():
    parser = argparse.ArgumentParser(description="Process video for dictionary linking")
    parser.add_argument("video", nargs="?", help="Path to video file or directory")
    parser.add_argument("--output", "-o", help="Output JSON file", default=None)
    parser.add_argument("--dict-path", "-d", help="Path to dictionary",
                        default="output_dictionary")
    parser.add_argument("--database", "-db", help="Path to video-word database",
                        default="video_words_db.json")
    parser.add_argument("--batch", "-b", action="store_true",
                        help="Process all videos in directory")
    args = parser.parse_args()

    dict_path = Path(args.dict_path)
    if not dict_path.exists():
        print(f"❌ Dictionary not found: {dict_path}")
        return 1

    # Batch mode
    if args.batch:
        if not args.video:
            print("❌ Please specify a directory with --batch")
            return 1
        video_dir = Path(args.video)
        if not video_dir.is_dir():
            print(f"❌ Not a directory: {video_dir}")
            return 1
        process_batch(video_dir, dict_path, Path(args.database))
        return 0

    # Single video mode
    if not args.video:
        print("❌ Please specify a video file or use --batch with a directory")
        return 1

    occurrences = process_video(args.video, dict_path)

    # Print results
    print(f"\n{'='*60}")
    print(f"WORDS FOUND IN DICTIONARY ({len(occurrences)} words):")
    print(f"{'='*60}")
    for occ in occurrences:
        print(f"  {occ.word:12} ({occ.pos}) @ {occ.start_time:.1f}s")
        print(f"    Context: 「{occ.sentence}」")

    # Save to JSON if requested
    if args.output:
        output_data = [asdict(occ) for occ in occurrences]
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        print(f"\n💾 Saved to: {args.output}")

    # Add to database
    db = load_database(Path(args.database))
    add_to_database(db, occurrences)
    save_database(db, Path(args.database))
    print(f"📊 Updated database: {args.database}")

    return 0


if __name__ == "__main__":
    exit(main())

