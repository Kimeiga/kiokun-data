#!/usr/bin/env python3
"""
Extract video URLs and thumbnails from Cosmos.so Chinese collection.
Uses Playwright to scroll through the page and intercept GraphQL responses.
"""

import asyncio
import json
import re
from pathlib import Path
from playwright.async_api import async_playwright

COSMOS_URL = "https://www.cosmos.so/kimeiga/c"
OUTPUT_URLS = "cosmos_chinese_video_urls.txt"
OUTPUT_THUMBNAILS = "chinese_video_thumbnails.json"

async def extract_videos():
    """Extract all video URLs and thumbnails from the Chinese collection."""
    
    video_data = {}  # video_id -> {url, image_url, mux_thumbnail}
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Intercept GraphQL responses
        async def handle_response(response):
            if "graphql" in response.url:
                try:
                    data = await response.json()
                    if "data" in data:
                        # Look for elements in response
                        elements = None
                        if "elements" in data["data"]:
                            elements = data["data"]["elements"].get("edges", [])
                        elif "cluster" in data["data"] and data["data"]["cluster"]:
                            elements = data["data"]["cluster"].get("elements", {}).get("edges", [])
                        
                        if elements:
                            for edge in elements:
                                node = edge.get("node", {})
                                if node.get("type") == "VIDEO":
                                    video_id = node.get("id")
                                    video_url = node.get("video", {}).get("url")
                                    image_url = node.get("image", {}).get("url")
                                    mux_thumb = node.get("video", {}).get("mux", {}).get("thumbnailImageUrl") if node.get("video", {}).get("mux") else None
                                    
                                    if video_id and video_url:
                                        video_data[video_id] = {
                                            "url": video_url,
                                            "image_url": image_url,
                                            "mux_thumbnail": mux_thumb
                                        }
                                        print(f"Found video: {video_id}")
                except Exception as e:
                    pass
        
        page.on("response", handle_response)
        
        print(f"🌐 Loading {COSMOS_URL}...")
        await page.goto(COSMOS_URL, timeout=60000, wait_until="domcontentloaded")
        await asyncio.sleep(5)  # Wait for initial data to load
        
        # Scroll to load all videos
        print("📜 Scrolling to load all videos...")
        last_count = 0
        stable_count = 0
        
        while stable_count < 5:
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(1)
            
            current_count = len(video_data)
            if current_count == last_count:
                stable_count += 1
            else:
                stable_count = 0
                print(f"   Found {current_count} videos...")
            last_count = current_count
        
        await browser.close()
    
    # Save URLs
    print(f"\n✅ Found {len(video_data)} videos total")
    
    with open(OUTPUT_URLS, "w") as f:
        for video_id, data in video_data.items():
            f.write(data["url"] + "\n")
    print(f"📝 Saved video URLs to {OUTPUT_URLS}")
    
    # Save thumbnails
    thumbnails = {vid: {"image_url": d.get("image_url"), "mux_thumbnail": d.get("mux_thumbnail")} 
                  for vid, d in video_data.items()}
    with open(OUTPUT_THUMBNAILS, "w") as f:
        json.dump(thumbnails, f, indent=2)
    print(f"📝 Saved thumbnails to {OUTPUT_THUMBNAILS}")
    
    return video_data

if __name__ == "__main__":
    asyncio.run(extract_videos())

