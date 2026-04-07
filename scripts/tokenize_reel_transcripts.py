#!/usr/bin/env python3
"""
Takes GCP STT transcripts and tokenizes them with kuromoji-compatible segmentation,
then updates video_data.json so every word in every sentence is clickable.
"""

import json
import subprocess
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent.parent / "sveltekit-app" / "static"
TRANSCRIPT_FILE = OUTPUT_DIR / "reel_transcripts.json"
VIDEO_DATA_FILE = OUTPUT_DIR / "video_data.json"
VIDEO_DATA_OUTPUT = OUTPUT_DIR / "video_data.json"


def main():
    # Load transcripts
    with open(TRANSCRIPT_FILE) as f:
        transcripts = json.load(f)

    # Load existing video data
    with open(VIDEO_DATA_FILE) as f:
        video_data = json.load(f)

    print(f"Transcripts: {len(transcripts)} videos")
    print(f"With data: {sum(1 for v in transcripts.values() if v)} videos")

    # Rebuild the words index from STT transcripts
    # New structure: each word occurrence has the full sentence + timestamps
    new_words = {}

    for video_id, segments in transcripts.items():
        if not segments:
            continue

        for seg in segments:
            sentence = seg.get("sentence", "")
            start_time = seg.get("start_time", 0)
            end_time = seg.get("end_time", 0)

            if not sentence.strip():
                continue

            # Each word from STT is already segmented
            for word_info in seg.get("words", []):
                word = word_info["word"]
                # Skip very short particles for the word index
                # (they'll still be in the sentence for display)
                if len(word) < 2 and word in "のはがをにでもとかへやよねわ":
                    continue

                if word not in new_words:
                    new_words[word] = []

                new_words[word].append({
                    "video_id": video_id,
                    "start_time": start_time,
                    "end_time": end_time,
                    "sentence": sentence,
                })

    # Also keep existing manually-extracted words that may not be in STT
    existing_words = video_data.get("words", {})
    for word, occurrences in existing_words.items():
        if word not in new_words:
            new_words[word] = occurrences
        else:
            # Merge: add occurrences from videos not covered by STT
            stt_video_ids = {occ["video_id"] for occ in new_words[word]}
            for occ in occurrences:
                if occ["video_id"] not in stt_video_ids:
                    new_words[word].append(occ)

    # Update video_data
    video_data["words"] = new_words

    # Also store the full transcript per video for the reel page
    if "transcripts" not in video_data:
        video_data["transcripts"] = {}

    for video_id, segments in transcripts.items():
        if segments:
            video_data["transcripts"][video_id] = [
                {
                    "sentence": seg["sentence"],
                    "start_time": seg["start_time"],
                    "end_time": seg["end_time"],
                    "words": [w["word"] for w in seg.get("words", [])],
                }
                for seg in segments
            ]

    # Write updated video data
    with open(VIDEO_DATA_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(video_data, f, ensure_ascii=False)

    print(f"\nUpdated video_data.json:")
    print(f"  Words: {len(new_words)} (was {len(existing_words)})")
    print(f"  Transcripts: {len(video_data['transcripts'])} videos")
    print(f"  File size: {VIDEO_DATA_OUTPUT.stat().st_size / 1024 / 1024:.1f}MB")


if __name__ == "__main__":
    main()
