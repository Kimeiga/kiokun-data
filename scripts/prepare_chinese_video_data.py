#!/usr/bin/env python3
"""Prepare Chinese video data for the webapp by adding CDN URLs and thumbnails."""
import json
from pathlib import Path

# Load the Chinese video words database
db_path = Path("chinese_video_words_db.json")
with open(db_path) as f:
    db = json.load(f)

# Load Chinese thumbnail mappings (keyed by Cosmos element ID, but we need video ID)
thumb_path = Path("chinese_video_thumbnails.json")
thumbnails_by_element = {}
if thumb_path.exists():
    with open(thumb_path) as f:
        thumbnails_by_element = json.load(f)
    print(f"📷 Loaded {len(thumbnails_by_element)} thumbnail mappings by element ID")

# Create a mapping from video ID to thumbnails
# The chinese_video_thumbnails.json uses element IDs, not video UUIDs
# We need to load the URL file to map video IDs to thumbnails
url_path = Path("cosmos_chinese_video_urls.txt")
video_ids = []
if url_path.exists():
    with open(url_path) as f:
        for line in f:
            line = line.strip()
            if line:
                # Extract UUID from URL: https://cdn.cosmos.so/{uuid}.mp4
                if "cdn.cosmos.so/" in line:
                    video_id = line.split("/")[-1].replace(".mp4", "")
                    video_ids.append(video_id)

# For now, just use the thumbnails we have (keyed by element ID)
# We'll need to find a way to map video ID to element ID
# Looking at the extraction script output, the video URL contains the UUID
# Let's build a reverse mapping by checking which thumbnail has which video URL

thumbnails = {}
for elem_id, thumb_data in thumbnails_by_element.items():
    # Check if we have a video_url field that matches
    video_url = thumb_data.get("video_url", "")
    if video_url:
        video_id = video_url.split("/")[-1].replace(".mp4", "")
        thumbnails[video_id] = thumb_data

# If we didn't find video URLs in thumbnail data, try direct matching
if not thumbnails:
    # The cosmos_scroll_extract_chinese.py saves video_id as the key
    # Check if any keys are UUIDs
    for key, thumb_data in thumbnails_by_element.items():
        if len(key) == 36 and key.count("-") == 4:
            thumbnails[key] = thumb_data

print(f"📷 Mapped {len(thumbnails)} thumbnails to video IDs")

# Create the output structure for the webapp
output = {
    "videos": {},
    "words": {}
}

# Process videos - extract video ID and construct CDN URL
for video_id, video_data in db.get("videos", {}).items():
    # Construct CDN URL from video ID (UUID format)
    if len(video_id) == 36 and video_id.count("-") == 4:
        cdn_url = f"https://cdn.cosmos.so/{video_id}.mp4"
    else:
        # Skip non-Cosmos videos
        continue

    # Get thumbnail URL from mappings (prefer image_url, fallback to mux_thumbnail)
    thumb_data = thumbnails.get(video_id, {})
    thumbnail_url = thumb_data.get("image_url") or thumb_data.get("mux_thumbnail")

    output["videos"][video_id] = {
        "url": cdn_url,
        "thumbnail": thumbnail_url,
        "word_count": video_data.get("word_count", 0)
    }

# Process words - keep only entries with valid video IDs
for word, occurrences in db.get("words", {}).items():
    valid_occurrences = []
    for occ in occurrences:
        video_id = occ.get("video_id", "")
        # Only include if it's a valid Cosmos video
        if video_id in output["videos"]:
            valid_occurrences.append({
                "video_id": video_id,
                "start_time": occ.get("start_time", 0),
                "end_time": occ.get("end_time", 0),
                "sentence": occ.get("sentence", "")
            })

    if valid_occurrences:
        output["words"][word] = valid_occurrences

# Save to the sveltekit-app static folder
output_path = Path("sveltekit-app/static/chinese_video_data.json")
output_path.parent.mkdir(parents=True, exist_ok=True)

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"✅ Saved Chinese video data to {output_path}")
print(f"   Videos: {len(output['videos'])}")
print(f"   Words with videos: {len(output['words'])}")

