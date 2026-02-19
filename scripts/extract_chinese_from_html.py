#!/usr/bin/env python3
"""
Extract video URLs from Cosmos.so Chinese collection HTML.
Downloads the page and extracts video data from __NEXT_DATA__.
Then uses GraphQL API to fetch remaining videos.
"""

import json
import re
import subprocess
import requests

COSMOS_URL = "https://www.cosmos.so/kimeiga/c"
GRAPHQL_URL = "https://api.cosmos.so/graphql"
OUTPUT_URLS = "cosmos_chinese_video_urls.txt"
OUTPUT_THUMBNAILS = "chinese_video_thumbnails.json"

def fetch_html():
    """Fetch HTML from Cosmos page."""
    print(f"🌐 Fetching {COSMOS_URL}...")
    result = subprocess.run(['curl', '-s', COSMOS_URL], capture_output=True, text=True)
    return result.stdout

def extract_initial_videos(html):
    """Extract videos from __NEXT_DATA__ in HTML."""
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL)
    if not match:
        print("❌ No __NEXT_DATA__ found")
        return {}, None
    
    data = json.loads(match.group(1))
    props = data.get('props', {}).get('pageProps', {})
    apollo_state = props.get('__APOLLO_STATE__', {})
    
    videos = {}
    cluster_id = None
    
    for key, value in apollo_state.items():
        # Find cluster ID
        if key.startswith('Cluster:'):
            cluster_id = value.get('id')
        
        # Find videos
        if isinstance(value, dict) and value.get('type') == 'VIDEO':
            video_id = value.get('id')
            video_ref = value.get('video', {}).get('__ref') if value.get('video') else None
            image_ref = value.get('image', {}).get('__ref') if value.get('image') else None
            
            video_url = None
            image_url = None
            mux_thumb = None
            
            # Get video URL
            if video_ref and video_ref in apollo_state:
                video_url = apollo_state[video_ref].get('url')
                mux_data = apollo_state[video_ref].get('mux')
                if mux_data and isinstance(mux_data, dict):
                    mux_ref = mux_data.get('__ref')
                    if mux_ref and mux_ref in apollo_state:
                        mux_thumb = apollo_state[mux_ref].get('thumbnailImageUrl')
            
            # Get image URL
            if image_ref and image_ref in apollo_state:
                image_url = apollo_state[image_ref].get('url')
            
            if video_id and video_url:
                videos[video_id] = {
                    'url': video_url,
                    'image_url': image_url,
                    'mux_thumbnail': mux_thumb
                }
    
    print(f"   Found {len(videos)} videos in initial HTML")
    if cluster_id:
        print(f"   Cluster ID: {cluster_id}")
    
    return videos, cluster_id

def fetch_more_videos(cluster_id, existing_videos):
    """Fetch more videos via GraphQL API."""
    if not cluster_id:
        return existing_videos
    
    print(f"\n📡 Fetching more videos via GraphQL...")
    
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
        nextPageCursor
      }
    }
    """
    
    variables = {"filters": {"clusterId": int(cluster_id)}}
    
    try:
        response = requests.post(
            GRAPHQL_URL,
            json={"query": query, "variables": variables},
            headers={"Content-Type": "application/json"}
        )
        data = response.json()
        
        edges = data.get('data', {}).get('elements', {}).get('edges', [])
        for edge in edges:
            node = edge.get('node', {})
            if node.get('type') == 'VIDEO':
                video_id = node.get('id')
                video_data = node.get('video', {})
                if video_id and video_data:
                    existing_videos[video_id] = {
                        'url': video_data.get('url'),
                        'image_url': node.get('image', {}).get('url') if node.get('image') else None,
                        'mux_thumbnail': video_data.get('mux', {}).get('thumbnailImageUrl') if video_data.get('mux') else None
                    }
        
        print(f"   Total videos after GraphQL: {len(existing_videos)}")
    except Exception as e:
        print(f"   ⚠️  GraphQL fetch failed: {e}")
    
    return existing_videos

def main():
    # Fetch and parse HTML
    html = fetch_html()
    videos, cluster_id = extract_initial_videos(html)
    
    # Try to fetch more via GraphQL
    videos = fetch_more_videos(cluster_id, videos)
    
    # Save URLs
    print(f"\n✅ Found {len(videos)} videos total")
    
    with open(OUTPUT_URLS, "w") as f:
        for video_id, data in videos.items():
            if data['url']:
                f.write(data['url'] + "\n")
    print(f"📝 Saved video URLs to {OUTPUT_URLS}")
    
    # Save thumbnails
    thumbnails = {vid: {"image_url": d.get("image_url"), "mux_thumbnail": d.get("mux_thumbnail")} 
                  for vid, d in videos.items()}
    with open(OUTPUT_THUMBNAILS, "w") as f:
        json.dump(thumbnails, f, indent=2, ensure_ascii=False)
    print(f"📝 Saved thumbnails to {OUTPUT_THUMBNAILS}")

if __name__ == "__main__":
    main()

