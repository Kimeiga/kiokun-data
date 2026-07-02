#!/usr/bin/env python3
"""
Extract video metadata from Cosmos.so HTML page content.
The page embeds JSON data with video information.
"""

import json
import re
import sys
from urllib.request import Request, urlopen


def extract_metadata_from_page(url: str) -> dict:
    """Extract video metadata from Cosmos.so page."""

    print(f"Fetching {url}...")
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=30) as response:
        html = response.read().decode("utf-8")

    # Find the __NEXT_DATA__ JSON embedded in the page
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.+?)</script>', html)
    if not match:
        # Try to find the JSON data in the page
        match = re.search(r'\{"props":\{.*?"pageProps":.*?\},"page":', html)
        if match:
            # Find the full JSON object
            json_text = html[match.start():]
            # Find the closing }
            depth = 0
            for i, c in enumerate(json_text):
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        json_text = json_text[:i+1]
                        break
        else:
            print("Could not find JSON data in page")
            return {}
    else:
        json_text = match.group(1)

    data = json.loads(json_text)

    # Navigate to the Apollo cache which has all the elements
    props = data.get("props", {})
    page_props = props.get("pageProps", {})
    # Try both possible keys for Apollo state
    apollo_state = page_props.get("__APOLLO_STATE__", {})
    if not apollo_state:
        apollo_state = page_props.get("initialApolloState", {})

    videos = {}

    for key, value in apollo_state.items():
        if not key.startswith("ElementInterface:"):
            continue

        if not isinstance(value, dict):
            continue

        # Get video info
        video_info = value.get("video", {})
        video_url = video_info.get("url") if video_info else None

        if not video_url or "cdn.cosmos.so" not in video_url:
            continue

        video_id = video_url.split("/")[-1].replace(".mp4", "")

        # Get thumbnail
        thumbnail = None
        image_info = value.get("image", {})
        if image_info:
            thumbnail = image_info.get("url")

        # Get caption
        caption = None
        caption_info = value.get("generatedCaption", {})
        if caption_info:
            caption = caption_info.get("text")

        metadata = {
            "video_id": video_id,
            "video_url": video_url,
            "source_url": value.get("sourceUrl") or value.get("url"),
            "author": value.get("authorName"),
            "caption": caption,
            "thumbnail": thumbnail,
            "duration": video_info.get("duration") if video_info else None,
            "type": value.get("type"),
            "created_at": value.get("createdAt"),
        }

        videos[video_id] = metadata
        author = metadata["author"] or "unknown"
        print(f"  {video_id[:8]}... | {author}")

    return videos


if __name__ == "__main__":
    # Extract both Japanese and Chinese collections
    collections = [
        ("https://www.cosmos.so/kimeiga/c", "cosmos_chinese_metadata.json"),
    ]

    for url, output in collections:
        print(f"\n{'='*60}")
        print(f"Processing: {url}")
        print(f"{'='*60}")

        videos = extract_metadata_from_page(url)

        print(f"\nSaving {len(videos)} videos to {output}...")
        with open(output, "w") as f:
            json.dump(videos, f, indent=2, ensure_ascii=False)

        # Summary
        with_source = sum(1 for v in videos.values() if v.get("source_url"))
        with_author = sum(1 for v in videos.values() if v.get("author"))
        with_caption = sum(1 for v in videos.values() if v.get("caption"))
        print(f"\nSummary:")
        print(f"  Total videos: {len(videos)}")
        print(f"  With source URL: {with_source}")
        print(f"  With author: {with_author}")
        print(f"  With caption: {with_caption}")
