#!/usr/bin/env python3
"""
Learning Resources Automation Script for Kiokun.com

This script automates the content pipeline for the Learning Resources section:
1. Fetches latest videos from YouTube channels (e.g., Scripting Japan)
2. Extracts transcripts using youtube_transcript_api
3. Processes transcripts with Google Gemini Pro to extract slang and summaries
4. Saves data to Cloudflare D1 database

Environment Variables Required:
- YOUTUBE_API_KEY: YouTube Data API v3 key
- GEMINI_API_KEY: Google Gemini Pro API key
- CLOUDFLARE_ACCOUNT_ID: Cloudflare account ID
- CLOUDFLARE_D1_DATABASE_ID: D1 database ID (kiokun-dictionary)
- CLOUDFLARE_API_TOKEN: Cloudflare API token with D1 write permissions
"""

import os
import sys
import json
import time
import hashlib
from datetime import datetime
from typing import List, Dict, Optional
from urllib.parse import urlparse, parse_qs

# Third-party imports
try:
    from googleapiclient.discovery import build
    from youtube_transcript_api import YouTubeTranscriptApi
    import google.generativeai as genai
    import requests
except ImportError as e:
    print(f"Error: Missing required package. Install with:")
    print("pip install google-api-python-client youtube-transcript-api google-generativeai requests")
    sys.exit(1)


class LearningResourcesAutomation:
    """Main automation class for processing YouTube videos into learning resources."""
    
    def __init__(self):
        """Initialize API clients and configuration."""
        # Load environment variables
        self.youtube_api_key = os.getenv("YOUTUBE_API_KEY")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.cf_account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
        self.cf_database_id = os.getenv("CLOUDFLARE_D1_DATABASE_ID")
        self.cf_api_token = os.getenv("CLOUDFLARE_API_TOKEN")
        
        # Validate environment variables
        self._validate_env_vars()
        
        # Initialize YouTube API client
        self.youtube = build('youtube', 'v3', developerKey=self.youtube_api_key)
        
        # Initialize Gemini API
        genai.configure(api_key=self.gemini_api_key)
        self.gemini_model = genai.GenerativeModel('gemini-pro')
        
        # Cloudflare D1 API endpoint
        self.d1_api_url = f"https://api.cloudflare.com/client/v4/accounts/{self.cf_account_id}/d1/database/{self.cf_database_id}/query"
        
        print("✅ Initialized Learning Resources Automation")
    
    def _validate_env_vars(self):
        """Validate that all required environment variables are set."""
        required_vars = [
            "YOUTUBE_API_KEY",
            "GEMINI_API_KEY",
            "CLOUDFLARE_ACCOUNT_ID",
            "CLOUDFLARE_D1_DATABASE_ID",
            "CLOUDFLARE_API_TOKEN"
        ]
        
        missing = [var for var in required_vars if not os.getenv(var)]
        if missing:
            print(f"❌ Error: Missing required environment variables: {', '.join(missing)}")
            sys.exit(1)
    
    def generate_id(self, *args) -> str:
        """Generate a unique ID from input strings using SHA-256."""
        combined = "-".join(str(arg) for arg in args)
        return hashlib.sha256(combined.encode()).hexdigest()[:16]
    
    def generate_slug(self, text: str) -> str:
        """Generate URL-friendly slug from text."""
        import re
        # Convert to lowercase and replace spaces/special chars with hyphens
        slug = re.sub(r'[^\w\s-]', '', text.lower())
        slug = re.sub(r'[-\s]+', '-', slug)
        return slug.strip('-')[:100]  # Limit to 100 chars
    
    def execute_d1_query(self, sql: str, params: Optional[List] = None) -> Dict:
        """Execute a SQL query on Cloudflare D1 database."""
        headers = {
            "Authorization": f"Bearer {self.cf_api_token}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "sql": sql
        }
        
        if params:
            payload["params"] = params
        
        response = requests.post(self.d1_api_url, headers=headers, json=payload)
        response.raise_for_status()
        
        result = response.json()
        if not result.get("success"):
            raise Exception(f"D1 query failed: {result.get('errors')}")
        
        return result.get("result", [{}])[0]

    def fetch_channel_videos(self, channel_id: str, max_results: int = 10) -> List[Dict]:
        """
        Fetch latest videos from a YouTube channel.

        Args:
            channel_id: YouTube channel ID (e.g., "UCcSeOwSRnOZvNYOelU-RUkw" for Scripting Japan)
            max_results: Maximum number of videos to fetch (default: 10)

        Returns:
            List of video dictionaries with metadata
        """
        print(f"📺 Fetching latest {max_results} videos from channel {channel_id}...")

        try:
            # Get channel's uploads playlist ID
            channel_response = self.youtube.channels().list(
                part='contentDetails',
                id=channel_id
            ).execute()

            if not channel_response.get('items'):
                print(f"❌ Channel {channel_id} not found")
                return []

            uploads_playlist_id = channel_response['items'][0]['contentDetails']['relatedPlaylists']['uploads']

            # Get videos from uploads playlist
            playlist_response = self.youtube.playlistItems().list(
                part='snippet,contentDetails',
                playlistId=uploads_playlist_id,
                maxResults=max_results
            ).execute()

            videos = []
            for item in playlist_response.get('items', []):
                video_id = item['contentDetails']['videoId']
                snippet = item['snippet']

                # Get additional video details (duration, view count)
                video_details = self.youtube.videos().list(
                    part='contentDetails,statistics',
                    id=video_id
                ).execute()

                if video_details.get('items'):
                    details = video_details['items'][0]

                    # Parse ISO 8601 duration (e.g., "PT15M33S" -> 933 seconds)
                    duration_str = details['contentDetails']['duration']
                    duration_seconds = self._parse_duration(duration_str)

                    video_data = {
                        'video_id': video_id,
                        'title': snippet['title'],
                        'description': snippet.get('description', ''),
                        'published_at': snippet['publishedAt'],
                        'thumbnail_url': snippet['thumbnails']['high']['url'],
                        'video_url': f"https://www.youtube.com/watch?v={video_id}",
                        'duration': duration_seconds,
                        'view_count': int(details['statistics'].get('viewCount', 0))
                    }

                    videos.append(video_data)
                    print(f"  ✓ {video_data['title']} ({duration_seconds}s, {video_data['view_count']} views)")

            print(f"✅ Fetched {len(videos)} videos")
            return videos

        except Exception as e:
            print(f"❌ Error fetching videos: {e}")
            return []

    def _parse_duration(self, duration_str: str) -> int:
        """Parse ISO 8601 duration string to seconds."""
        import re

        # Example: "PT15M33S" -> 933 seconds
        pattern = r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?'
        match = re.match(pattern, duration_str)

        if not match:
            return 0

        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)

        return hours * 3600 + minutes * 60 + seconds

    def fetch_transcript(self, video_id: str, language: str = 'ja') -> Optional[Dict]:
        """
        Fetch transcript for a YouTube video.

        Args:
            video_id: YouTube video ID
            language: Language code (default: 'ja' for Japanese)

        Returns:
            Dictionary with 'text' (full transcript) and 'segments' (timestamped segments)
            Returns None if transcript is not available
        """
        print(f"📝 Fetching transcript for video {video_id}...")

        try:
            # Fetch transcript (tries auto-generated if manual not available)
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            # Try to get transcript in target language
            try:
                transcript = transcript_list.find_transcript([language])
            except:
                # Fallback to any available transcript
                print(f"  ⚠️  {language} transcript not found, trying auto-generated...")
                transcript = transcript_list.find_generated_transcript([language])

            # Fetch the actual transcript data
            segments = transcript.fetch()

            # Combine all text segments
            full_text = " ".join(segment['text'] for segment in segments)

            print(f"  ✓ Transcript fetched: {len(full_text)} characters, {len(segments)} segments")

            return {
                'text': full_text,
                'segments': segments,
                'language': language
            }

        except Exception as e:
            print(f"  ❌ Error fetching transcript: {e}")
            return None

    def process_with_gemini(self, transcript_text: str, video_title: str) -> Optional[Dict]:
        """
        Process transcript with Gemini Pro to extract slang and generate summary.

        CRITICAL: Uses natural, spoken Japanese forms (e.g., "ittokeba" not "itte okeba")

        Args:
            transcript_text: Full transcript text
            video_title: Video title for context

        Returns:
            Dictionary with 'summary' and 'slang_words' (list of extracted slang)
        """
        print(f"🤖 Processing transcript with Gemini Pro...")

        # Construct the prompt with specific instructions for natural translations
        prompt = f"""You are analyzing a Japanese YouTube video transcript to extract slang, colloquial expressions, and interesting vocabulary for Japanese learners.

Video Title: {video_title}

Transcript:
{transcript_text}

Please provide:

1. A concise summary (2-3 sentences) of what this video is about in English.

2. Extract 10-15 interesting slang words, colloquial expressions, or useful vocabulary from the transcript. For each word:
   - Provide the EXACT form as it appears in natural spoken Japanese (e.g., "ittokeba" NOT "itte okeba", "yatchatta" NOT "yatte shimatta")
   - Give a natural English translation that captures the casual/spoken meaning
   - Provide a short example sentence from the video showing how it's used
   - Include the approximate timestamp where it appears (in seconds)

CRITICAL RULES:
- Use the NATURAL SPOKEN FORM as it would actually be said (contracted, casual)
- Do NOT use formal dictionary forms or written Japanese
- Examples: "ittokeba" (not "itte okeba"), "yatchatta" (not "yatte shimatta"), "jan" (not "ja nai")
- Focus on slang, contractions, and expressions that learners wouldn't find in textbooks

Return your response as valid JSON in this exact format:
{{
  "summary": "Brief summary here...",
  "slang_words": [
    {{
      "word": "ittokeba",
      "translation": "should have said/done",
      "context": "Example sentence from video",
      "timestamp": 45
    }}
  ]
}}

Respond ONLY with valid JSON, no additional text."""

        try:
            # Generate content with Gemini
            response = self.gemini_model.generate_content(prompt)
            response_text = response.text.strip()

            # Extract JSON from response (handle markdown code blocks)
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            # Parse JSON response
            result = json.loads(response_text)

            print(f"  ✓ Summary: {result['summary'][:100]}...")
            print(f"  ✓ Extracted {len(result.get('slang_words', []))} slang words")

            return result

        except json.JSONDecodeError as e:
            print(f"  ❌ Error parsing Gemini response as JSON: {e}")
            print(f"  Response was: {response_text[:200]}...")
            return None
        except Exception as e:
            print(f"  ❌ Error processing with Gemini: {e}")
            return None

    def save_video_to_database(self, video_data: Dict, transcript: Dict, gemini_result: Dict, source_id: str) -> bool:
        """
        Save processed video and extracted words to D1 database.

        Args:
            video_data: Video metadata from YouTube
            transcript: Transcript data
            gemini_result: Processed data from Gemini (summary + slang words)
            source_id: Resource source ID (e.g., "scripting-japan")

        Returns:
            True if successful, False otherwise
        """
        print(f"💾 Saving video to database...")

        try:
            # Generate IDs
            video_id = self.generate_id("video", video_data['video_id'])
            slug = self.generate_slug(video_data['title'])

            # Convert published_at to timestamp
            published_timestamp = int(datetime.fromisoformat(video_data['published_at'].replace('Z', '+00:00')).timestamp())
            current_timestamp = int(time.time())

            # Insert video post
            video_sql = """
            INSERT INTO video_posts (
                id, resourceSourceId, title, slug, videoUrl, videoId,
                thumbnailUrl, duration, publishedAt, transcript, summary,
                viewCount, isProcessed, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """

            self.execute_d1_query(video_sql, [
                video_id,
                source_id,
                video_data['title'],
                slug,
                video_data['video_url'],
                video_data['video_id'],
                video_data['thumbnail_url'],
                video_data['duration'],
                published_timestamp,
                transcript['text'],
                gemini_result['summary'],
                video_data['view_count'],
                1,  # isProcessed = true
                current_timestamp,
                current_timestamp
            ])

            print(f"  ✓ Video saved: {video_data['title']}")

            # Insert extracted words
            for idx, word_data in enumerate(gemini_result.get('slang_words', [])):
                word_id = self.generate_id("word", video_id, word_data['word'], idx)
                word_slug = self.generate_slug(word_data['word'])

                word_sql = """
                INSERT INTO extracted_words (
                    id, videoPostId, word, wordSlug, reading, translation,
                    context, timestamp, sortOrder, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """

                self.execute_d1_query(word_sql, [
                    word_id,
                    video_id,
                    word_data['word'],
                    word_slug,
                    word_data.get('reading', ''),  # Optional reading field
                    word_data['translation'],
                    word_data.get('context', ''),
                    word_data.get('timestamp', 0),
                    idx,
                    current_timestamp
                ])

            print(f"  ✓ Saved {len(gemini_result.get('slang_words', []))} extracted words")
            return True

        except Exception as e:
            print(f"  ❌ Error saving to database: {e}")
            return False

    def initialize_database(self):
        """Initialize database with language categories and resource sources."""
        print("🔧 Initializing database with default data...")

        try:
            current_timestamp = int(time.time())

            # Insert Japanese language category
            lang_sql = """
            INSERT OR IGNORE INTO language_categories (id, name, slug, languageCode, createdAt)
            VALUES (?, ?, ?, ?, ?)
            """
            self.execute_d1_query(lang_sql, [
                "japanese",
                "Japanese",
                "japanese",
                "ja",
                current_timestamp
            ])

            # Insert Scripting Japan resource source
            source_sql = """
            INSERT OR IGNORE INTO resource_sources (
                id, languageCategoryId, name, slug, sourceType, sourceUrl,
                sourceIdentifier, description, isActive, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            self.execute_d1_query(source_sql, [
                "scripting-japan",
                "japanese",
                "Scripting Japan",
                "scripting-japan",
                "youtube",
                "https://www.youtube.com/@ScriptingJapan",
                "UCcSeOwSRnOZvNYOelU-RUkw",  # Scripting Japan channel ID
                "Learn natural Japanese through real conversations and street interviews",
                1,
                current_timestamp,
                current_timestamp
            ])

            print("  ✓ Database initialized")
            return True

        except Exception as e:
            print(f"  ⚠️  Database initialization (may already exist): {e}")
            return False

    def process_channel(self, channel_id: str, source_id: str, max_videos: int = 5):
        """
        Main processing pipeline: fetch videos, extract transcripts, process with Gemini, save to DB.

        Args:
            channel_id: YouTube channel ID
            source_id: Resource source ID in database
            max_videos: Maximum number of videos to process
        """
        print(f"\n{'='*60}")
        print(f"Processing channel: {channel_id}")
        print(f"{'='*60}\n")

        # Fetch latest videos
        videos = self.fetch_channel_videos(channel_id, max_videos)

        if not videos:
            print("❌ No videos found")
            return

        # Process each video
        for i, video in enumerate(videos, 1):
            print(f"\n--- Processing video {i}/{len(videos)} ---")
            print(f"Title: {video['title']}")

            # Check if video already exists in database
            check_sql = "SELECT id FROM video_posts WHERE videoId = ?"
            result = self.execute_d1_query(check_sql, [video['video_id']])

            if result.get('results'):
                print(f"  ⏭️  Video already processed, skipping...")
                continue

            # Fetch transcript
            transcript = self.fetch_transcript(video['video_id'])
            if not transcript:
                print(f"  ⏭️  No transcript available, skipping...")
                continue

            # Process with Gemini
            gemini_result = self.process_with_gemini(transcript['text'], video['title'])
            if not gemini_result:
                print(f"  ⏭️  Gemini processing failed, skipping...")
                continue

            # Save to database
            success = self.save_video_to_database(video, transcript, gemini_result, source_id)

            if success:
                print(f"  ✅ Video processed successfully!")
            else:
                print(f"  ❌ Failed to save video")

            # Rate limiting (be nice to APIs)
            if i < len(videos):
                print("  ⏳ Waiting 5 seconds before next video...")
                time.sleep(5)

        print(f"\n{'='*60}")
        print(f"✅ Processing complete! Processed {len(videos)} videos")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    print("🚀 Starting Learning Resources Automation")
    print("="*60)

    automation = LearningResourcesAutomation()

    # Initialize database with default data
    automation.initialize_database()

    # Process Scripting Japan channel
    SCRIPTING_JAPAN_CHANNEL_ID = "UCcSeOwSRnOZvNYOelU-RUkw"
    automation.process_channel(
        channel_id=SCRIPTING_JAPAN_CHANNEL_ID,
        source_id="scripting-japan",
        max_videos=5  # Process 5 most recent videos
    )

    print("\n✅ Automation complete!")

