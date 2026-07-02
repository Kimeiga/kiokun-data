#!/usr/bin/env python3
"""
Test script to verify all components are working:
1. YouTube API (video fetching)
2. YouTube Transcript API (with cookies)
3. Gemini API
4. Cloudflare D1 Database
"""

import os
import sys
from pathlib import Path

# Load .env file
env_file = Path(__file__).parent / '.env'
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip()

print("🧪 Testing Learning Resources Automation Setup\n")
print("=" * 60)

# Test 1: Environment Variables
print("\n1️⃣ Testing Environment Variables...")
required_vars = [
    "YOUTUBE_API_KEY",
    "GEMINI_API_KEY",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_D1_DATABASE_ID",
    "CLOUDFLARE_API_TOKEN"
]

all_vars_present = True
for var in required_vars:
    value = os.getenv(var)
    if value and value != "use_wrangler":
        print(f"  ✅ {var}: {value[:10]}...")
    else:
        print(f"  ❌ {var}: MISSING or INVALID")
        all_vars_present = False

if not all_vars_present:
    print("\n❌ Please update scripts/.env with all required variables")
    sys.exit(1)

# Test 2: YouTube API
print("\n2️⃣ Testing YouTube Data API...")
try:
    from googleapiclient.discovery import build
    youtube = build('youtube', 'v3', developerKey=os.getenv("YOUTUBE_API_KEY"))
    request = youtube.channels().list(part='snippet', id='UCcSeOwSRnOZvNYOelU-RUkw')
    response = request.execute()
    if response.get('items'):
        print(f"  ✅ YouTube API working! Channel: {response['items'][0]['snippet']['title']}")
    else:
        print("  ❌ YouTube API failed: No channel found")
except Exception as e:
    print(f"  ❌ YouTube API error: {e}")

# Test 3: YouTube Transcript API (with cookies)
print("\n3️⃣ Testing YouTube Transcript API...")
cookies_path = Path(__file__).parent / 'cookies.txt'
if cookies_path.exists():
    print(f"  ✅ cookies.txt found!")
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        from http.cookiejar import MozillaCookieJar
        import requests

        # Load cookies into a Session
        session = requests.Session()
        cookie_jar = MozillaCookieJar(str(cookies_path))
        cookie_jar.load(ignore_discard=True, ignore_expires=True)
        session.cookies = cookie_jar

        # Add browser-like headers to avoid detection
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Referer': 'https://www.youtube.com/',
        })

        # Pass the session to YouTubeTranscriptApi
        ytt_api = YouTubeTranscriptApi(http_client=session)
        transcript = ytt_api.fetch('BvatNr0225o', languages=['ja', 'en'])
        print(f"  ✅ Transcript API working! Got {len(transcript)} segments")
    except Exception as e:
        print(f"  ❌ Transcript API error: {e}")
else:
    print(f"  ⚠️  cookies.txt NOT found at {cookies_path}")
    print(f"  💡 See SETUP_COOKIES.md for instructions")

# Test 4: Gemini API
print("\n4️⃣ Testing Gemini API...")
try:
    import google.generativeai as genai
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel('gemini-2.5-flash')
    response = model.generate_content("Say 'Hello from Gemini!'")
    print(f"  ✅ Gemini API working! Response: {response.text[:50]}...")
except Exception as e:
    print(f"  ❌ Gemini API error: {e}")

# Test 5: Cloudflare D1 Database
print("\n5️⃣ Testing Cloudflare D1 Database...")
try:
    import requests
    url = f"https://api.cloudflare.com/client/v4/accounts/{os.getenv('CLOUDFLARE_ACCOUNT_ID')}/d1/database/{os.getenv('CLOUDFLARE_D1_DATABASE_ID')}/query"
    headers = {
        "Authorization": f"Bearer {os.getenv('CLOUDFLARE_API_TOKEN')}",
        "Content-Type": "application/json"
    }
    payload = {
        "sql": "SELECT COUNT(*) as count FROM video_posts"
    }
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 200:
        result = response.json()
        if result.get("success"):
            count = result['result'][0]['results'][0]['count']
            print(f"  ✅ D1 Database working! Current video count: {count}")
        else:
            print(f"  ❌ D1 query failed: {result.get('errors')}")
    else:
        print(f"  ❌ D1 API error: {response.status_code} - {response.text}")
except Exception as e:
    print(f"  ❌ D1 Database error: {e}")

print("\n" + "=" * 60)
print("✅ Setup test complete!\n")
