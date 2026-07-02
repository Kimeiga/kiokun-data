#!/usr/bin/env python3
"""
Extract video metadata (source URL, title, author) from Cosmos.so.
Uses Playwright to intercept GraphQL responses and capture full element data.

Install dependencies:
    pip3 install playwright
    playwright install chromium
"""

import asyncio
import json
import re
import sys
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Playwright not installed. Run:")
    print("  pip3 install playwright")
    print("  playwright install chromium")
    sys.exit(1)


def extract_video_metadata(data, videos_dict):
    """Recursively extract video metadata from GraphQL response."""
    if isinstance(data, dict):
        # Check if this is a video element
        if data.get("__typename") == "Element" or "url" in data:
            video_url = None

            # Find the CDN video URL
            if "url" in data and "cdn.cosmos.so" in str(data.get("url", "")):
                video_url = data["url"]

            # Also check nested data field
            if "data" in data and isinstance(data["data"], dict):
                nested = data["data"]
                if "url" in nested and "cdn.cosmos.so" in str(nested.get("url", "")):
                    video_url = nested["url"]

            if video_url and video_url.endswith(".mp4"):
                # Extract video ID from URL
                video_id = video_url.split("/")[-1].replace(".mp4", "")

                # Get metadata
                metadata = {
                    "video_url": video_url,
                    "video_id": video_id,
                    "source_url": None,
                    "title": None,
                    "author": None,
                    "thumbnail": None,
                }

                # Look for source URL (Instagram, etc.)
                nested_data = data.get("data", {}) if isinstance(data.get("data"), {}) else {}

                # Check various fields for source info
                for key in ["sourceUrl", "source_url", "externalUrl", "link"]:
                    if key in data:
                        metadata["source_url"] = data[key]
                    if key in nested_data:
                        metadata["source_url"] = nested_data[key]

                # Check for title/description
                for key in ["title", "name", "description", "caption"]:
                    if key in data and data[key]:
                        metadata["title"] = data[key]
                        break
                    if key in nested_data and nested_data[key]:
                        metadata["title"] = nested_data[key]
                        break

                # Check for author
                for key in ["author", "username", "handle", "creator"]:
                    if key in data and data[key]:
                        metadata["author"] = data[key]
                        break
                    if key in nested_data and nested_data[key]:
                        metadata["author"] = nested_data[key]
                        break

                # Check for thumbnail
                for key in ["thumbnail", "thumbnailUrl", "poster", "image"]:
                    if key in data and data[key]:
                        metadata["thumbnail"] = data[key]
                        break
                    if key in nested_data and nested_data[key]:
                        metadata["thumbnail"] = nested_data[key]
                        break

                # Store raw data for debugging
                metadata["_raw"] = data

                if video_id not in videos_dict:
                    videos_dict[video_id] = metadata
                    print(f"  Found: {video_id[:8]}... source={metadata['source_url']}")

        # Recurse into nested dicts
        for value in data.values():
            extract_video_metadata(value, videos_dict)

    elif isinstance(data, list):
        for item in data:
            extract_video_metadata(item, videos_dict)


async def extract_cosmos_metadata(url: str, output_file: str):
    """Extract full video metadata from Cosmos.so collection."""

    videos = {}

    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1280, "height": 2000})
        page = await context.new_page()

        # Intercept GraphQL responses
        async def handle_response(response):
            if "graphql" in response.url:
                try:
                    json_data = await response.json()
                    extract_video_metadata(json_data, videos)
                except Exception as e:
                    pass

        page.on("response", handle_response)

        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(3)

        # Scroll to load all content
        print("Scrolling to load all videos...")
        prev_count = len(videos)
        no_change_count = 0

        for i in range(300):
            await page.evaluate(f"window.scrollTo(0, {(i+1) * 1000})")
            await asyncio.sleep(0.3)

            if i % 10 == 0:
                if len(videos) == prev_count:
                    no_change_count += 1
                    if no_change_count >= 5:
                        print(f"\nNo new videos. Total: {len(videos)}")
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

    return videos


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.cosmos.so/kimeiga/j"
    output = sys.argv[2] if len(sys.argv) > 2 else "cosmos_video_metadata.json"

    print(f"Extracting metadata from: {url}")
    videos = asyncio.run(extract_cosmos_metadata(url, output))
    print(f"\nDone! Found {len(videos)} videos with metadata.")
