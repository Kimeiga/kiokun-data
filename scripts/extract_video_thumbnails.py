#!/usr/bin/env python3
"""
Extract video URLs AND thumbnail URLs from Cosmos.so by scrolling and intercepting GraphQL.
Creates a mapping of video_id -> thumbnail_url for faster loading in the webapp.
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


async def extract_video_thumbnails(url: str, output_file: str = "video_thumbnails.json"):
    """Intercept GraphQL requests to capture video IDs and their thumbnail URLs."""

    # Map video_id -> thumbnail info
    video_thumbnails = {}

    async with async_playwright() as p:
        print("Launching browser with network interception...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1280, "height": 2000})
        page = await context.new_page()

        def extract_from_data(data):
            """Recursively extract video/thumbnail mappings from GraphQL data."""
            if isinstance(data, dict):
                # Check if this is an element with video info
                video_url = data.get("video", {}).get("url") if isinstance(data.get("video"), dict) else None
                image_url = data.get("image", {}).get("url") if isinstance(data.get("image"), dict) else None
                mux_thumb = data.get("mux", {}).get("thumbnailImageUrl") if isinstance(data.get("mux"), dict) else None
                
                if video_url and (image_url or mux_thumb):
                    # Extract video ID from URL: https://cdn.cosmos.so/{uuid}.mp4
                    match = re.search(r'cdn\.cosmos\.so/([a-f0-9\-]+)\.mp4', video_url)
                    if match:
                        video_id = match.group(1)
                        video_thumbnails[video_id] = {
                            "image_url": image_url,
                            "mux_thumbnail": mux_thumb,
                            "video_url": video_url
                        }
                
                # Recurse into nested objects
                for v in data.values():
                    extract_from_data(v)
            elif isinstance(data, list):
                for item in data:
                    extract_from_data(item)

        async def handle_response(response):
            if "graphql" in response.url:
                try:
                    json_data = await response.json()
                    extract_from_data(json_data)
                    print(f"  Captured thumbnails (total: {len(video_thumbnails)})")
                except:
                    pass

        page.on("response", handle_response)

        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(3)

        # Also extract from initial HTML state
        html = await page.content()
        # Look for __NEXT_DATA__ JSON
        next_data_match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.+?)</script>', html, re.DOTALL)
        if next_data_match:
            try:
                next_data = json.loads(next_data_match.group(1))
                extract_from_data(next_data)
                print(f"Extracted from initial state: {len(video_thumbnails)} videos")
            except:
                pass

        # Scroll to load all content
        print("Scrolling to load all videos...")
        prev_count = len(video_thumbnails)
        no_change_count = 0

        for i in range(300):
            await page.evaluate(f"window.scrollTo(0, {(i+1) * 1000})")
            await asyncio.sleep(0.3)

            if i % 10 == 0:
                if len(video_thumbnails) == prev_count:
                    no_change_count += 1
                    if no_change_count >= 5:
                        print(f"\nNo new videos after {no_change_count} checks. Total: {len(video_thumbnails)}")
                        break
                else:
                    no_change_count = 0
                    prev_count = len(video_thumbnails)
                    print(f"  Progress: {len(video_thumbnails)} videos found...")

        await browser.close()
        
        # Save to file
        output_path = Path(output_file)
        with open(output_path, "w") as f:
            json.dump(video_thumbnails, f, indent=2)
        
        print(f"\nSaved {len(video_thumbnails)} video thumbnails to {output_path.absolute()}")
        return video_thumbnails


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.cosmos.so/kimeiga/j"
    output = sys.argv[2] if len(sys.argv) > 2 else "video_thumbnails.json"
    
    print(f"Extracting video thumbnails from: {url}")
    thumbnails = asyncio.run(extract_video_thumbnails(url, output))
    print(f"\nDone! Found {len(thumbnails)} video thumbnail mappings.")

