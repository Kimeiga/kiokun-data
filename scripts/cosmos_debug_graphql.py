#!/usr/bin/env python3
"""
Debug script to capture and save raw GraphQL responses from Cosmos.so.
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


async def capture_graphql(url: str, output_file: str = "cosmos_graphql_debug.json"):
    """Capture all GraphQL responses from Cosmos.so."""

    responses = []

    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1280, "height": 2000})
        page = await context.new_page()

        # Intercept ALL network responses
        async def handle_response(response):
            url_str = response.url
            if "graphql" in url_str or "api.cosmos" in url_str:
                try:
                    json_data = await response.json()
                    responses.append({
                        "url": url_str,
                        "data": json_data
                    })
                    print(f"  Captured GraphQL response #{len(responses)}")
                except Exception as e:
                    print(f"  Error parsing response: {e}")

        page.on("response", handle_response)

        print(f"Navigating to {url}...")
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)

        # Wait and scroll a bit
        await asyncio.sleep(3)

        for i in range(30):  # Just scroll a bit to capture some data
            await page.evaluate(f"window.scrollTo(0, {(i+1) * 500})")
            await asyncio.sleep(0.2)

        await asyncio.sleep(2)
        await browser.close()

    # Save responses
    print(f"\nSaving {len(responses)} GraphQL responses to {output_file}...")
    with open(output_file, "w") as f:
        json.dump(responses, f, indent=2, ensure_ascii=False)

    # Print summary of what we found
    print("\n=== SUMMARY ===")
    for i, resp in enumerate(responses[:5]):  # Show first 5
        data = resp["data"]
        print(f"\nResponse #{i+1}:")
        print(f"  URL: {resp['url'][:80]}...")
        if isinstance(data, dict):
            print(f"  Keys: {list(data.keys())}")
            if "data" in data:
                print(f"  Data keys: {list(data['data'].keys()) if isinstance(data['data'], dict) else type(data['data'])}")

    return responses


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.cosmos.so/kimeiga/j"
    output = sys.argv[2] if len(sys.argv) > 2 else "cosmos_graphql_debug.json"

    responses = asyncio.run(capture_graphql(url, output))
    print(f"\nDone! Captured {len(responses)} responses.")
    print(f"Inspect {output} to see the data structure.")
