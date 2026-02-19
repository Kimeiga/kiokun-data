#!/usr/bin/env python3
"""Simple runner for Chinese video extraction - avoids shell escaping issues."""

import os
import sys
import json
import re
import subprocess

# Redirect output to log file
LOG_FILE = "/Users/haki/code/kiokun-data/chinese_extract.log"
sys.stdout = open(LOG_FILE, "w")
sys.stderr = sys.stdout

# Change to project directory
os.chdir("/Users/haki/code/kiokun-data")

COSMOS_URL = "https://www.cosmos.so/kimeiga/c"
OUTPUT_URLS = "cosmos_chinese_video_urls.txt"
OUTPUT_THUMBNAILS = "chinese_video_thumbnails.json"

def main():
    print(f"Fetching {COSMOS_URL}...")
    result = subprocess.run(['curl', '-s', COSMOS_URL], capture_output=True, text=True)
    html = result.stdout
    print(f"Downloaded {len(html)} bytes")

    # Find __NEXT_DATA__ JSON
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL)
    if not match:
        print("No __NEXT_DATA__ found")
        return

    data = json.loads(match.group(1))

    # Debug: show structure
    print(f"Top-level keys: {list(data.keys())}")
    props = data.get('props', {})
    print(f"props keys: {list(props.keys())}")
    page_props = props.get('pageProps', {})
    print(f"pageProps keys: {list(page_props.keys())}")

    # Try different paths to find Apollo state
    apollo_state = page_props.get('__APOLLO_STATE__', {})
    if not apollo_state:
        apollo_state = page_props.get('apolloState', {})
    if not apollo_state:
        apollo_state = data.get('__APOLLO_STATE__', {})
    if not apollo_state:
        # Look for it anywhere in the structure
        def find_apollo(obj, depth=0):
            if depth > 5:
                return None
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if 'apollo' in k.lower() or k == '__APOLLO_STATE__':
                        print(f"Found Apollo at key: {k}")
                        return v
                    result = find_apollo(v, depth+1)
                    if result:
                        return result
            return None
        apollo_state = find_apollo(data) or {}

    print(f"Found {len(apollo_state)} items in Apollo state")

    # Debug: show all keys and types to understand structure
    print("Apollo state keys and types:")
    for key, value in list(apollo_state.items())[:30]:
        vtype = value.get('type') if isinstance(value, dict) else type(value).__name__
        vid = value.get('id') if isinstance(value, dict) else None
        print(f"  {key}: type={vtype}, id={vid}")

    # Show full structure of first INSTAGRAM element
    for key, value in apollo_state.items():
        if isinstance(value, dict) and value.get('type') == 'INSTAGRAM':
            print(f"\nFull structure of {key}:")
            print(json.dumps(value, indent=2, default=str)[:2000])
            break

    videos = {}
    cluster_id = None

    for key, value in apollo_state.items():
        # Find cluster ID
        if key.startswith('Cluster:'):
            cluster_id = value.get('id')
            print(f"Found cluster ID: {cluster_id}")

        # Find videos - handle both VIDEO and INSTAGRAM types
        if isinstance(value, dict):
            vtype = value.get('type', '')

            # Handle INSTAGRAM type (Chinese collection uses this)
            if vtype == 'INSTAGRAM':
                video_id = str(value.get('id'))
                video_data = value.get('video')
                image_data = value.get('image')
                mux_data = value.get('mux')

                video_url = video_data.get('url') if video_data else None
                image_url = image_data.get('url') if image_data else None
                mux_thumb = mux_data.get('thumbnailImageUrl') if mux_data else None

                if video_id and video_url:
                    videos[video_id] = {
                        'url': video_url,
                        'image_url': image_url,
                        'mux_thumbnail': mux_thumb
                    }

            # Handle VIDEO type (Japanese collection uses this)
            elif vtype == 'VIDEO':
                video_id = str(value.get('id'))
                video_ref = value.get('video', {}).get('__ref') if value.get('video') else None
                image_ref = value.get('image', {}).get('__ref') if value.get('image') else None

                video_url = None
                image_url = None
                mux_thumb = None

                # Get video URL from ref
                if video_ref and video_ref in apollo_state:
                    video_url = apollo_state[video_ref].get('url')
                    mux_data = apollo_state[video_ref].get('mux')
                    if mux_data and isinstance(mux_data, dict):
                        mux_ref = mux_data.get('__ref')
                        if mux_ref and mux_ref in apollo_state:
                            mux_thumb = apollo_state[mux_ref].get('thumbnailImageUrl')

                # Get image URL from ref
                if image_ref and image_ref in apollo_state:
                    image_url = apollo_state[image_ref].get('url')

                if video_id and video_url:
                    videos[video_id] = {
                        'url': video_url,
                        'image_url': image_url,
                        'mux_thumbnail': mux_thumb
                    }

    print(f"Found {len(videos)} videos in initial HTML")

    # Try GraphQL for more videos
    if cluster_id:
        import requests
        print(f"Fetching more via GraphQL with cluster {cluster_id}...")
        query = """
        query elements($filters: ElementListFilters!) {
          elements(filters: $filters) {
            edges {
              node {
                id
                type
                video {
                  url
                  mux {
                    thumbnailImageUrl
                  }
                }
                image {
                  url
                }
              }
            }
          }
        }
        """

        try:
            response = requests.post(
                "https://api.cosmos.so/graphql",
                json={"query": query, "variables": {"filters": {"clusterId": int(cluster_id)}}},
                headers={"Content-Type": "application/json"}
            )
            gql_data = response.json()

            edges = gql_data.get('data', {}).get('elements', {}).get('edges', [])
            for edge in edges:
                node = edge.get('node', {})
                node_type = node.get('type', '')
                # Handle both VIDEO and INSTAGRAM types
                if node_type in ('VIDEO', 'INSTAGRAM'):
                    video_id = str(node.get('id'))
                    video_data = node.get('video', {}) or {}
                    image_data = node.get('image', {}) or {}
                    mux_data = video_data.get('mux', {}) or {}

                    video_url = video_data.get('url')
                    if video_id and video_url:
                        videos[video_id] = {
                            'url': video_url,
                            'image_url': image_data.get('url'),
                            'mux_thumbnail': mux_data.get('thumbnailImageUrl')
                        }

            print(f"After GraphQL: {len(videos)} videos total")
        except Exception as e:
            print(f"GraphQL failed: {e}")

    # Save URLs
    print(f"Saving {len(videos)} videos...")

    with open(OUTPUT_URLS, "w") as f:
        for video_id, data in videos.items():
            if data['url']:
                f.write(data['url'] + "\n")
    print(f"Saved URLs to {OUTPUT_URLS}")

    # Save thumbnails
    thumbnails = {vid: {"image_url": d.get("image_url"), "mux_thumbnail": d.get("mux_thumbnail")}
                  for vid, d in videos.items()}
    with open(OUTPUT_THUMBNAILS, "w") as f:
        json.dump(thumbnails, f, indent=2, ensure_ascii=False)
    print(f"Saved thumbnails to {OUTPUT_THUMBNAILS}")

if __name__ == "__main__":
    main()

