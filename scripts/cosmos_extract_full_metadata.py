#!/usr/bin/env python3
"""
Extract full video metadata from Cosmos.so including Instagram source, author, and caption.
"""

import asyncio
import json
import sys
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Playwright not installed. Run:")
    print("  pip3 install playwright")
    print("  playwright install chromium")
    sys.exit(1)


def extract_elements(data, videos_dict):
    """Extract video elements from GraphQL response."""
    if isinstance(data, dict):
        # Check for elements.items structure
        if "elements" in data and isinstance(data["elements"], dict):
            items = data["elements"].get("items", [])
            for item in items:
                process_element(item, videos_dict)

        # Recurse
        for value in data.values():
            extract_elements(value, videos_dict)
    elif isinstance(data, list):
        for item in data:
            extract_elements(item, videos_dict)


def process_element(elem, videos_dict):
    """Process a single element and extract metadata."""
    if not isinstance(elem, dict):
        return

    # Get video URL
    video_url = None
    if "video" in elem and elem["video"]:
        video_url = elem["video"].get("url")
    if "downloadableVideo" in elem and elem["downloadableVideo"]:
        video_url = elem["downloadableVideo"].get("url")

    if not video_url or "cdn.cosmos.so" not in video_url:
        return

    # Extract video ID
    video_id = video_url.split("/")[-1].replace(".mp4", "")

    # Get thumbnail
    thumbnail = None
    if "image" in elem and elem["image"]:
        thumbnail = elem["image"].get("url")
    if "downloadableImage" in elem and elem["downloadableImage"]:
        thumbnail = elem["downloadableImage"].get("url")

    # Get caption/description
    caption = None
    if "generatedCaption" in elem and elem["generatedCaption"]:
        caption = elem["generatedCaption"].get("text")

    metadata = {
        "video_id": video_id,
        "video_url": video_url,
        "source_url": elem.get("sourceUrl") or elem.get("url"),
        "author": elem.get("authorName"),
        "caption": caption,
        "thumbnail": thumbnail,
        "duration": elem.get("video", {}).get("duration") if elem.get("video") else None,
        "type": elem.get("type"),
        "created_at": elem.get("createdAt"),
    }

    if video_id not in videos_dict:
        videos_dict[video_id] = metadata
        author = metadata["author"] or "unknown"
        print(f"  {video_id[:8]}... | {author}")


async def extract_cosmos_metadata(url: str, output_file: str):
    """Extract full video metadata from Cosmos.so collection."""

    videos = {}

    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1280, "height": 2000})
        page = await context.new_page()

        async def handle_response(response):
            if "graphql" in response.url:
                try:
                    json_data = await response.json()
                    extract_elements(json_data.get("data", {}), videos)
                except:
                    pass

        page.on("response", handle_response)

        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(3)

        print("Scrolling to load all videos...")
        prev_count = 0
        no_change_count = 0

        for i in range(500):
            await page.evaluate(f"window.scrollTo(0, {(i+1) * 800})")
            await asyncio.sleep(0.25)

            if i % 15 == 0:
                if len(videos) == prev_count:
                    no_change_count += 1
                    if no_change_count >= 6:
                        print(f"\nNo new videos after {no_change_count} checks. Total: {len(videos)}")
                        break
                else:
                    no_change_count = 0
                    prev_count = len(videos)
                    print(f"  Progress: {len(videos)} videos...")

        await browser.close()

    # Save metadata
    print(f"\nSaving {len(videos)} videos to {output_file}...")
    with open(output_file, "w") as f:
        json.dump(videos, f, indent=2, ensure_ascii=False)

    # Print summary
    with_source = sum(1 for v in videos.values() if v.get("source_url"))
    with_author = sum(1 for v in videos.values() if v.get("author"))
    with_caption = sum(1 for v in videos.values() if v.get("caption"))
    print(f"\nSummary:")
    print(f"  Total videos: {len(videos)}")
    print(f"  With source URL: {with_source}")
    print(f"  With author: {with_author}")
    print(f"  With caption: {with_caption}")

    return videos


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.cosmos.so/kimeiga/j"
    output = sys.argv[2] if len(sys.argv) > 2 else "cosmos_video_metadata.json"

    print(f"Extracting metadata from: {url}")
    videos = asyncio.run(extract_cosmos_metadata(url, output))
    print(f"\nDone! Found {len(videos)} videos with metadata.")
