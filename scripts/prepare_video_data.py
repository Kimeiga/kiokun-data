#!/usr/bin/env python3
"""Prepare video data for the webapp by adding CDN URLs and thumbnails."""
import json
from pathlib import Path

# Load the video words database
db_path = Path("video_words_db.json")
with open(db_path) as f:
    db = json.load(f)

# Load thumbnail mappings
thumb_path = Path("video_thumbnails.json")
thumbnails = {}
if thumb_path.exists():
    with open(thumb_path) as f:
        thumbnails = json.load(f)
    print(f"📷 Loaded {len(thumbnails)} thumbnail mappings")

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
        # Skip non-Cosmos videos (like test_video.mp4)
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
output_path = Path("sveltekit-app/static/video_data.json")
output_path.parent.mkdir(parents=True, exist_ok=True)

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"✅ Saved video data to {output_path}")
print(f"   Videos: {len(output['videos'])}")
print(f"   Words with videos: {len(output['words'])}")

