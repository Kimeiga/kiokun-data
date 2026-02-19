#!/usr/bin/env python3
"""
Extract ALL video URLs and thumbnails from Cosmos.so Chinese collection by scrolling.
Uses Playwright to handle infinite scroll and intercept GraphQL responses.

Usage:
    python3 scripts/cosmos_scroll_extract_chinese.py
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

COSMOS_URL = "https://www.cosmos.so/kimeiga/c"
OUTPUT_URLS = "cosmos_chinese_video_urls.txt"
OUTPUT_THUMBNAILS = "chinese_video_thumbnails.json"


async def extract_all_chinese_videos():
    """Intercept GraphQL requests to capture all video URLs and thumbnails."""

    videos = {}  # video_id -> {url, image_url, mux_thumbnail}

    async with async_playwright() as p:
        print("Launching browser with network interception...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1280, "height": 2000})
        page = await context.new_page()

        # Intercept network responses to capture GraphQL data
        async def handle_response(response):
            if "graphql" in response.url:
                try:
                    json_data = await response.json()
                    # Extract video info from response
                    extract_videos_from_response(json_data, videos)
                    print(f"  GraphQL captured, total videos: {len(videos)}")
                except:
                    pass

        page.on("response", handle_response)

        print(f"Navigating to {COSMOS_URL}...")
        await page.goto(COSMOS_URL, wait_until="domcontentloaded", timeout=60000)
        await asyncio.sleep(3)

        # Also extract from initial HTML __NEXT_DATA__
        html = await page.content()
        match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL)
        if match:
            data = json.loads(match.group(1))
            apollo = data.get('props', {}).get('pageProps', {}).get('initialApolloState', {})
            for key, value in apollo.items():
                if isinstance(value, dict) and value.get('type') == 'INSTAGRAM':
                    extract_instagram_element(value, videos)
        
        print(f"Initial videos from HTML: {len(videos)}")

        # Scroll aggressively to trigger loading
        print("Scrolling to trigger infinite scroll...")
        prev_count = len(videos)
        no_change_count = 0

        for i in range(300):
            await page.evaluate(f"window.scrollTo(0, {(i+1) * 1000})")
            await asyncio.sleep(0.3)

            if i % 10 == 0:
                if len(videos) == prev_count:
                    no_change_count += 1
                    if no_change_count >= 5:
                        print(f"\nNo new videos after {no_change_count} checks. Total: {len(videos)}")
                        break
                else:
                    no_change_count = 0
                    prev_count = len(videos)
                    print(f"  Progress: {len(videos)} videos found...")

        print(f"\nTotal unique videos found: {len(videos)}")
        await browser.close()

        # Save URLs
        with open(OUTPUT_URLS, "w") as f:
            for vid, data in videos.items():
                if data.get('url'):
                    f.write(data['url'] + "\n")
        print(f"Saved URLs to {OUTPUT_URLS}")

        # Save thumbnails - keyed by video UUID extracted from the URL
        thumbnails = {}
        for vid, d in videos.items():
            video_url = d.get("url", "")
            # Extract UUID from URL: https://cdn.cosmos.so/{uuid}.mp4
            if "cdn.cosmos.so/" in video_url:
                video_uuid = video_url.split("/")[-1].replace(".mp4", "")
                thumbnails[video_uuid] = {
                    "image_url": d.get("image_url"),
                    "mux_thumbnail": d.get("mux_thumbnail")
                }
        with open(OUTPUT_THUMBNAILS, "w") as f:
            json.dump(thumbnails, f, indent=2, ensure_ascii=False)
        print(f"Saved thumbnails to {OUTPUT_THUMBNAILS}")

        return videos


def extract_instagram_element(elem, videos):
    """Extract video info from an INSTAGRAM element."""
    video_id = str(elem.get('id'))
    video_data = elem.get('video') or {}
    image_data = elem.get('image') or {}
    mux_data = elem.get('mux') or {}
    
    video_url = video_data.get('url')
    if video_id and video_url:
        videos[video_id] = {
            'url': video_url,
            'image_url': image_data.get('url'),
            'mux_thumbnail': mux_data.get('thumbnailImageUrl')
        }


def extract_videos_from_response(json_data, videos):
    """Recursively extract video info from GraphQL response."""
    if isinstance(json_data, dict):
        # Check if this is an INSTAGRAM element
        if json_data.get('type') == 'INSTAGRAM' or json_data.get('__typename') == 'InstagramElement':
            extract_instagram_element(json_data, videos)
        else:
            for value in json_data.values():
                extract_videos_from_response(value, videos)
    elif isinstance(json_data, list):
        for item in json_data:
            extract_videos_from_response(item, videos)


if __name__ == "__main__":
    print(f"Extracting Chinese videos from: {COSMOS_URL}")
    videos = asyncio.run(extract_all_chinese_videos())
    print(f"\nDone! Found {len(videos)} videos.")

