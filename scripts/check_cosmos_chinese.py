#!/usr/bin/env python3
"""Quick check of Chinese collection on Cosmos.so"""

import asyncio
import re
from playwright.async_api import async_playwright

async def check_page():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()

        responses = []
        async def handle_response(response):
            url = response.url
            if "api" in url or "graphql" in url:
                try:
                    text = await response.text()
                    responses.append({"url": url, "status": response.status, "length": len(text)})
                    print(f"  API Response: {url[:80]}... status={response.status}")
                except:
                    pass

        page.on("response", handle_response)

        print("Navigating to Chinese collection...")
        await page.goto("https://www.cosmos.so/kimeiga/c", wait_until="networkidle", timeout=60000)

        # Wait for content
        await asyncio.sleep(5)

        # Get page content
        content = await page.content()
        print(f"\nPage content length: {len(content)}")

        # Check for video URLs in HTML
        video_urls = set(re.findall(r'https://cdn\.cosmos\.so/[a-f0-9\-]+\.mp4', content))
        print(f"Video URLs in HTML: {len(video_urls)}")
        for url in list(video_urls)[:5]:
            print(f"  {url}")

        print(f"\nTotal API responses: {len(responses)}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(check_page())
