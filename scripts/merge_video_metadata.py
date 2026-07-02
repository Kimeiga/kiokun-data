#!/usr/bin/env python3
"""
Merge extracted metadata (source URLs, authors, captions) into video_data.json files.
"""

import json
from pathlib import Path


def merge_metadata(video_data_path: str, metadata_path: str, output_path: str = None):
    """Merge metadata into video data file."""

    if output_path is None:
        output_path = video_data_path

    print(f"Loading video data from {video_data_path}...")
    with open(video_data_path) as f:
        video_data = json.load(f)

    print(f"Loading metadata from {metadata_path}...")
    with open(metadata_path) as f:
        metadata = json.load(f)

    # Merge metadata into videos
    merged_count = 0
    for video_id, video_info in video_data.get("videos", {}).items():
        if video_id in metadata:
            meta = metadata[video_id]
            video_info["source_url"] = meta.get("source_url")
            video_info["author"] = meta.get("author")
            video_info["caption"] = meta.get("caption")
            video_info["duration"] = meta.get("duration")
            merged_count += 1

    # Also update words data if they reference videos
    # (No changes needed to words - they just reference video IDs)

    print(f"Merged metadata for {merged_count} out of {len(video_data.get('videos', {}))} videos")

    # Check for videos without metadata
    missing = []
    for video_id in video_data.get("videos", {}).keys():
        if video_id not in metadata:
            missing.append(video_id)

    if missing:
        print(f"\nVideos without metadata ({len(missing)}):")
        for vid in missing[:10]:
            print(f"  {vid}")
        if len(missing) > 10:
            print(f"  ... and {len(missing) - 10} more")

    # Save merged data
    print(f"\nSaving to {output_path}...")
    with open(output_path, "w") as f:
        json.dump(video_data, f, indent=2, ensure_ascii=False)

    return merged_count


if __name__ == "__main__":
    # Merge Japanese videos
    print("=" * 60)
    print("Processing Japanese video data")
    print("=" * 60)
    merge_metadata(
        "sveltekit-app/static/video_data.json",
        "cosmos_japanese_metadata.json"
    )

    # Merge Chinese videos
    print("\n" + "=" * 60)
    print("Processing Chinese video data")
    print("=" * 60)
    merge_metadata(
        "sveltekit-app/static/chinese_video_data.json",
        "cosmos_chinese_metadata.json"
    )

    print("\nDone!")
