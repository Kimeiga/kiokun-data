#!/usr/bin/env python3
"""
Download all videos from a public Cosmos.so collection.
Extracts video URLs from the Apollo GraphQL state and handles pagination.
"""

import json
import re
import argparse
from pathlib import Path
from urllib.request import urlopen, Request
from concurrent.futures import ThreadPoolExecutor, as_completed


GRAPHQL_URL = "https://api.cosmos.so/graphql"

ELEMENTS_QUERY = """
query Elements($filters: ElementFiltersInput, $cursor: String, $orderBy: ElementOrderBy) {
  elements(filters: $filters, cursor: $cursor, orderBy: $orderBy) {
    items {
      id
      type
      url
      sourceUrl
      createdAt
      authorName
      ... on InstagramElement {
        video {
          url
          duration
          isStored
        }
      }
    }
    meta {
      nextPageCursor
      count
    }
  }
}
"""


def fetch_page(url: str) -> str:
    """Fetch a webpage with proper headers."""
    req = Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    })
    with urlopen(req, timeout=30) as response:
        return response.read().decode('utf-8')


def graphql_request(query: str, variables: dict) -> dict:
    """Make a GraphQL request to Cosmos API."""
    payload = json.dumps({"query": query, "variables": variables}).encode('utf-8')
    req = Request(GRAPHQL_URL, data=payload, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    })
    with urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode('utf-8'))


def extract_cluster_id(html: str) -> int | None:
    """Extract the cluster ID from the page HTML."""
    # Look for cluster ID in Apollo state
    match = re.search(r'"Cluster:\{\\"id\\":(\d+)\}"', html)
    if match:
        return int(match.group(1))
    # Alternative pattern
    match = re.search(r'"cluster":\{"__ref":"Cluster:\{\\"id\\":(\d+)\}"\}', html)
    if match:
        return int(match.group(1))
    # Direct pattern
    match = re.search(r'"clusterId":(\d+)', html)
    if match:
        return int(match.group(1))
    return None


def fetch_all_videos_graphql(cluster_id: int) -> list[dict]:
    """Fetch all videos from a cluster using GraphQL pagination."""
    videos = []
    cursor = None
    page = 1

    while True:
        print(f"  📄 Fetching page {page}...", end=" ", flush=True)

        variables = {
            "filters": {"clusterId": cluster_id},
            "cursor": cursor,
            "orderBy": "CREATED_AT_DESC"
        }

        try:
            result = graphql_request(ELEMENTS_QUERY, variables)
            elements_data = result.get('data', {}).get('elements', {})
            items = elements_data.get('items', [])
            meta = elements_data.get('meta', {})

            for item in items:
                video_info = item.get('video')
                if video_info and video_info.get('url'):
                    video_url = video_info['url']
                    if video_url.endswith('.mp4'):
                        video_id = video_url.split('/')[-1].replace('.mp4', '')
                        videos.append({
                            'id': video_id,
                            'url': video_url,
                            'duration': video_info.get('duration', 0),
                            'author': item.get('authorName', 'unknown'),
                            'created_at': item.get('createdAt', ''),
                            'source_url': item.get('sourceUrl', ''),
                            'element_id': item.get('id'),
                        })

            print(f"got {len(items)} items (total: {len(videos)})")

            cursor = meta.get('nextPageCursor')
            if not cursor:
                break
            page += 1

        except Exception as e:
            print(f"Error: {e}")
            break

    return videos


def extract_videos_from_html(html: str) -> list[dict]:
    """Extract video URLs directly from HTML (first page only)."""
    videos = []
    pattern = r'"video":\{"__typename":"Video","url":"(https://cdn\.cosmos\.so/[a-f0-9-]+\.mp4)"[^}]*"duration":(\d+)\}'
    matches = re.findall(pattern, html)

    for url, duration in matches:
        video_id = url.split('/')[-1].replace('.mp4', '')
        if not any(v['url'] == url for v in videos):
            videos.append({
                'id': video_id,
                'url': url,
                'duration': int(duration),
            })

    return videos


def download_video(video: dict, output_dir: Path, index: int, total: int) -> bool:
    """Download a single video."""
    video_id = video['id']
    url = video['url']
    output_path = output_dir / f"{video_id}.mp4"
    
    if output_path.exists():
        print(f"[{index}/{total}] ⏭️  Skipping (exists): {video_id}")
        return True
    
    try:
        print(f"[{index}/{total}] ⬇️  Downloading: {video_id} ({video.get('duration', '?')}s)")
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=60) as response:
            with open(output_path, 'wb') as f:
                f.write(response.read())
        return True
    except Exception as e:
        print(f"[{index}/{total}] ❌ Failed: {video_id} - {e}")
        return False


def download_from_url_file(url_file: str, output_dir: Path, workers: int = 4):
    """Download videos from a pre-extracted URL list file."""
    with open(url_file, 'r') as f:
        urls = [line.strip() for line in f if line.strip()]

    print(f"📄 Loaded {len(urls)} URLs from {url_file}")

    # Convert URLs to video dict format
    videos = []
    for url in urls:
        # Extract video ID from URL (UUID)
        video_id = url.split('/')[-1].replace('.mp4', '')
        videos.append({'url': url, 'id': video_id})

    output_dir.mkdir(exist_ok=True)
    print(f"📁 Downloading to: {output_dir}")

    success = 0
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(download_video, v, output_dir, i+1, len(videos)): v
            for i, v in enumerate(videos)
        }
        for future in as_completed(futures):
            if future.result():
                success += 1

    print(f"\n✅ Downloaded {success}/{len(videos)} videos")
    return success


def main():
    parser = argparse.ArgumentParser(description="Download videos from Cosmos.so collection")
    parser.add_argument("url", nargs='?', help="Cosmos.so collection URL (e.g., https://www.cosmos.so/kimeiga/j)")
    parser.add_argument("--output", "-o", default="cosmos_videos", help="Output directory")
    parser.add_argument("--list-only", "-l", action="store_true", help="List videos without downloading")
    parser.add_argument("--workers", "-w", type=int, default=4, help="Parallel download workers")
    parser.add_argument("--save-urls", "-s", help="Save video URLs to JSON file")
    parser.add_argument("--first-page-only", action="store_true", help="Only fetch first page (no pagination)")
    parser.add_argument("--from-file", "-f", help="Load URLs from a text file (one URL per line)")
    args = parser.parse_args()

    # If using pre-extracted URL file
    if args.from_file:
        output_dir = Path(args.output)
        download_from_url_file(args.from_file, output_dir, args.workers)
        return 0

    if not args.url:
        parser.error("Either 'url' or '--from-file' is required")

    print(f"🌐 Fetching: {args.url}")
    html = fetch_page(args.url)

    # Extract cluster ID for GraphQL pagination
    cluster_id = extract_cluster_id(html)

    if cluster_id and not args.first_page_only:
        print(f"🔍 Found cluster ID: {cluster_id}")
        print("📡 Fetching all pages via GraphQL API...")
        videos = fetch_all_videos_graphql(cluster_id)
    else:
        # Fallback to HTML extraction (first page only)
        videos = extract_videos_from_html(html)
        print(f"📹 Found {len(videos)} videos (first page only)")

    print(f"\n📊 Total videos found: {len(videos)}")

    # Calculate total duration
    total_duration = sum(v.get('duration', 0) for v in videos)
    print(f"⏱️  Total duration: {total_duration // 60}m {total_duration % 60}s")

    if args.save_urls:
        with open(args.save_urls, 'w') as f:
            json.dump(videos, f, indent=2)
        print(f"💾 Saved URLs to: {args.save_urls}")

    if args.list_only:
        for i, v in enumerate(videos, 1):
            print(f"  [{i:3d}] {v['id']}: {v.get('duration', '?'):3d}s - {v.get('author', 'unknown')}")
        return 0

    # Download videos
    output_dir = Path(args.output)
    output_dir.mkdir(exist_ok=True)

    print(f"\n📁 Downloading to: {output_dir}")

    success = 0
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(download_video, v, output_dir, i+1, len(videos)): v
            for i, v in enumerate(videos)
        }
        for future in as_completed(futures):
            if future.result():
                success += 1

    print(f"\n✅ Downloaded {success}/{len(videos)} videos")
    return 0


if __name__ == "__main__":
    exit(main())

