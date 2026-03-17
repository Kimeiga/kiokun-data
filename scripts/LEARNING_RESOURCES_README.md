# Learning Resources Automation

Automated content pipeline for the Kiokun Learning Resources section. Fetches YouTube videos, extracts transcripts, processes with AI, and publishes to the website.

## Overview

This script automates the entire content pipeline:

1. **Fetch Videos**: Gets latest videos from YouTube channels (e.g., Scripting Japan)
2. **Extract Transcripts**: Downloads Japanese captions using `youtube_transcript_api`
3. **AI Processing**: Uses Google Gemini Pro to:
   - Extract natural slang/colloquial expressions
   - Generate video summaries
   - Provide English translations
4. **Database Storage**: Saves to Cloudflare D1 database
5. **Frontend Display**: Content appears at `/learning-resources/japanese/scripting-japan/[video-slug]`

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements-learning-resources.txt
```

### 2. Get API Keys

#### YouTube Data API v3
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "YouTube Data API v3"
4. Create credentials → API Key
5. Copy the API key

#### Google Gemini Pro API
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create API key
3. Copy the API key

#### Cloudflare API Token
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. My Profile → API Tokens → Create Token
3. Use template "Edit Cloudflare Workers" or create custom with:
   - Account → D1 → Edit permissions
4. Copy the token

### 3. Set Environment Variables

Create a `.env` file or export these variables:

```bash
export YOUTUBE_API_KEY="your_youtube_api_key_here"
export GEMINI_API_KEY="your_gemini_api_key_here"
export CLOUDFLARE_ACCOUNT_ID="your_cloudflare_account_id"
export CLOUDFLARE_D1_DATABASE_ID="21f5b45e-ce53-4a63-b07b-dec1a0b44fcc"
export CLOUDFLARE_API_TOKEN="your_cloudflare_api_token"
```

**Find your Cloudflare Account ID:**
- Dashboard → Workers & Pages → Overview → Account ID (right sidebar)

## Usage

### Run Manually

```bash
cd scripts
python3 learning_resources_automation.py
```

### Run with Custom Settings

Edit the `__main__` section in `learning_resources_automation.py`:

```python
automation.process_channel(
    channel_id="UCXQEfHag5F_wW3kHFBkEJEQ",  # Scripting Japan
    source_id="scripting-japan",
    max_videos=10  # Process 10 most recent videos
)
```

### Schedule with Cron (Daily Updates)

Add to crontab:

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/kiokun-data/scripts && /usr/bin/python3 learning_resources_automation.py >> /var/log/learning-resources.log 2>&1
```

### Schedule with GitHub Actions

See `Phase 4: Deployment & Testing` for GitHub Actions workflow setup.

## How It Works

### Natural Japanese Translations

The Gemini prompt is specifically designed to extract **natural spoken forms**:

- ✅ "ittokeba" (natural contraction)
- ❌ "itte okeba" (formal written form)

This ensures learners see Japanese as it's actually spoken in real conversations.

### Database Schema

- `language_categories`: Japanese, Chinese, etc.
- `resource_sources`: YouTube channels (Scripting Japan)
- `video_posts`: Individual videos with transcripts and summaries
- `extracted_words`: Slang/vocabulary extracted from videos

### Word Linking

Extracted words link to the existing dictionary:
- Word "ittokeba" → `https://kiokun.com/ittokeba`
- Uses the same sharding system as the main dictionary

## Troubleshooting

### "No transcript available"
- Video doesn't have Japanese captions
- Try enabling auto-generated captions on YouTube

### "Gemini processing failed"
- Check API key is valid
- Verify you have Gemini Pro access
- Check quota limits

### "D1 query failed"
- Verify Cloudflare API token has D1 edit permissions
- Check database ID is correct
- Ensure migration was applied

## Next Steps

After running the automation:

1. Check database: `wrangler d1 execute kiokun-dictionary --local --command="SELECT * FROM video_posts LIMIT 5"`
2. View on website: `http://localhost:5173/learning-resources/japanese/scripting-japan`
3. Deploy to production: See Phase 4 documentation

## Support

For issues or questions, see the main project README or open an issue on GitHub.

