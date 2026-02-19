#!/usr/bin/env python3
"""
Extract ALL video URLs from Cosmos.so by parsing the full HTML Apollo cache.
The Apollo cache embedded in the HTML contains many more items than the API returns.
"""

import json
import re
from urllib.request import urlopen, Request

def fetch_cosmos_html(url):
    """Fetch the Cosmos page HTML."""
    req = Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    })
    with urlopen(req, timeout=60) as response:
        return response.read().decode("utf-8")

def extract_video_urls_from_html(html):
    """Extract all CDN video URLs from the HTML."""
    # Pattern for Cosmos CDN video URLs
    pattern = r'https://cdn\.cosmos\.so/[a-f0-9\-]+\.mp4'
    urls = set(re.findall(pattern, html))
    return list(urls)

def extract_apollo_state(html):
    """Extract Apollo state from Next.js __NEXT_DATA__."""
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(1))
            return data.get("props", {}).get("pageProps", {}).get("initialApolloState", {})
        except json.JSONDecodeError:
            pass
    return {}

def extract_videos_from_apollo_state(apollo_state):
    """Extract video information from Apollo cache."""
    videos = []
    for key, value in apollo_state.items():
        if isinstance(value, dict):
            # Look for video objects with url and duration
            if "url" in value and "duration" in value:
                url = value.get("url", "")
                if url and "cdn.cosmos.so" in url and url.endswith(".mp4"):
                    videos.append({
                        "url": url,
                        "duration": value.get("duration"),
                    })
            # Also look for InstagramElement objects
            if value.get("__typename") == "InstagramElement":
                video_ref = value.get("video")
                if video_ref and isinstance(video_ref, dict) and "__ref" in video_ref:
                    video_key = video_ref["__ref"]
                    video_data = apollo_state.get(video_key, {})
                    if video_data.get("url"):
                        videos.append({
                            "id": value.get("id"),
                            "url": video_data.get("url"),
                            "duration": video_data.get("duration"),
                            "author": value.get("authorName"),
                        })
    return videos

if __name__ == "__main__":
    print("Fetching Cosmos page...")
    html = fetch_cosmos_html("https://www.cosmos.so/kimeiga/j")
    print(f"Got {len(html)} bytes of HTML")

    # Method 1: Simple regex extraction
    print("\n" + "="*60)
    print("Method 1: Direct URL extraction from HTML")
    print("="*60)
    urls = extract_video_urls_from_html(html)
    print(f"Found {len(urls)} unique video URLs via regex")
    if urls:
        print(f"Sample: {urls[0]}")

    # Method 2: Parse Apollo state
    print("\n" + "="*60)
    print("Method 2: Apollo State extraction")
    print("="*60)
    apollo_state = extract_apollo_state(html)
    print(f"Apollo state has {len(apollo_state)} keys")

    videos = extract_videos_from_apollo_state(apollo_state)
    print(f"Found {len(videos)} videos from Apollo state")

    # Deduplicate by URL
    unique_urls = set()
    for v in videos:
        if v.get("url"):
            unique_urls.add(v["url"])
    for u in urls:
        unique_urls.add(u)

    print(f"\nTotal unique video URLs: {len(unique_urls)}")

    # Save to file for use by download script
    if unique_urls:
        with open("cosmos_video_urls.txt", "w") as f:
            for url in sorted(unique_urls):
                f.write(url + "\n")
        print(f"\nSaved {len(unique_urls)} URLs to cosmos_video_urls.txt")
