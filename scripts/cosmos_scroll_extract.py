#!/usr/bin/env python3
"""
Extract ALL video URLs from Cosmos.so by scrolling through the page.
Uses Playwright to handle infinite scroll and extract all video URLs.

Install dependencies:
    pip3 install playwright
    playwright install chromium
"""

import asyncio
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


async def extract_all_cosmos_videos(url: str, output_file: str = "cosmos_video_urls.txt"):
    """Intercept GraphQL requests to capture all video URLs."""

    all_urls = set()
    graphql_responses = []

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
                    graphql_responses.append(json_data)
                    # Extract video URLs from response
                    text = str(json_data)
                    urls = set(re.findall(r'https://cdn\.cosmos\.so/[a-f0-9\-]+\.mp4', text))
                    if urls:
                        all_urls.update(urls)
                        print(f"  Captured {len(urls)} new URLs from GraphQL (total: {len(all_urls)})")
                except:
                    pass

        page.on("response", handle_response)

        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)

        # Wait for initial content
        await asyncio.sleep(3)

        # Also extract from HTML
        html = await page.content()
        html_urls = set(re.findall(r'https://cdn\.cosmos\.so/[a-f0-9\-]+\.mp4', html))
        all_urls.update(html_urls)
        print(f"Initial URLs from HTML: {len(html_urls)}")

        # Scroll aggressively to trigger loading
        print("Scrolling to trigger infinite scroll...")

        prev_count = len(all_urls)
        no_change_count = 0

        for i in range(300):  # Up to 300 scroll iterations
            # Scroll in chunks
            await page.evaluate(f"window.scrollTo(0, {(i+1) * 1000})")
            await asyncio.sleep(0.3)

            # Check for new URLs periodically
            if i % 10 == 0:
                html = await page.content()
                new_urls = set(re.findall(r'https://cdn\.cosmos\.so/[a-f0-9\-]+\.mp4', html))
                all_urls.update(new_urls)

                if len(all_urls) == prev_count:
                    no_change_count += 1
                    if no_change_count >= 5:
                        print(f"\nNo new videos after {no_change_count} checks. Total: {len(all_urls)}")
                        break
                else:
                    no_change_count = 0
                    prev_count = len(all_urls)
                    print(f"  Progress: {len(all_urls)} videos found...")

        print(f"\nTotal unique videos found: {len(all_urls)}")

        await browser.close()
        
        # Save to file
        output_path = Path(output_file)
        with open(output_path, "w") as f:
            for url in sorted(all_urls):
                f.write(url + "\n")
        
        print(f"Saved to {output_path.absolute()}")
        return list(all_urls)


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.cosmos.so/kimeiga/j"
    output = sys.argv[2] if len(sys.argv) > 2 else "cosmos_video_urls.txt"
    
    print(f"Extracting videos from: {url}")
    urls = asyncio.run(extract_all_cosmos_videos(url, output))
    print(f"\nDone! Found {len(urls)} videos.")

