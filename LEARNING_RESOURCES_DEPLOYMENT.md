# Learning Resources - Deployment Guide

Complete deployment guide for the automated Learning Resources content engine.

## Overview

The Learning Resources system consists of:
1. **Database**: Cloudflare D1 (SQLite) with 4 new tables
2. **Python Automation**: Fetches YouTube videos, processes with Gemini AI
3. **Frontend**: SvelteKit pages displaying videos and extracted vocabulary
4. **Automation**: GitHub Actions running daily

## Phase 1: Database Setup ✅

### Local Development

```bash
# Apply migration locally
cd sveltekit-app
wrangler d1 execute kiokun-dictionary --local --file=migrations/0002_aberrant_spirit.sql

# Verify tables
wrangler d1 execute kiokun-dictionary --local --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### Production Deployment

```bash
# Apply migration to remote D1
wrangler d1 execute kiokun-dictionary --remote --file=migrations/0002_aberrant_spirit.sql

# Verify remote tables
wrangler d1 execute kiokun-dictionary --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Phase 2: Python Automation Setup ✅

### Install Dependencies

```bash
cd scripts
pip install -r requirements-learning-resources.txt
```

### Configure Environment Variables

1. Copy the example file:
```bash
cp .env.example .env
```

2. Fill in your API keys in `.env`:
   - `YOUTUBE_API_KEY`: From Google Cloud Console
   - `GEMINI_API_KEY`: From Google AI Studio
   - `CLOUDFLARE_ACCOUNT_ID`: From Cloudflare Dashboard
   - `CLOUDFLARE_D1_DATABASE_ID`: Already set (21f5b45e-ce53-4a63-b07b-dec1a0b44fcc)
   - `CLOUDFLARE_API_TOKEN`: From Cloudflare API Tokens

### Test Locally

```bash
# Load environment variables
source .env  # or: export $(cat .env | xargs)

# Run automation
python3 learning_resources_automation.py
```

Expected output:
- ✅ Fetches 5 latest videos from Scripting Japan
- ✅ Extracts Japanese transcripts
- ✅ Processes with Gemini Pro
- ✅ Saves to D1 database

## Phase 3: Frontend Deployment ✅

### Local Testing

```bash
cd sveltekit-app
npm run dev
```

Visit:
- http://localhost:5173/learning-resources
- http://localhost:5173/learning-resources/japanese/scripting-japan

### Production Deployment

```bash
cd sveltekit-app
npm run build
npm run deploy
```

## Phase 4: GitHub Actions Setup

### Configure Secrets

Go to GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:
- `YOUTUBE_API_KEY`
- `GEMINI_API_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`

### Workflow Schedule

The workflow runs:
- **Automatically**: Daily at 2 AM UTC
- **Manually**: Via GitHub Actions tab → "Run workflow"

### Monitor Execution

1. Go to GitHub → Actions tab
2. View "Learning Resources Automation" workflow
3. Check logs for each run
4. Download artifacts if errors occur

## Verification Checklist

### Database
- [ ] Migration applied to remote D1
- [ ] Tables created: `language_categories`, `resource_sources`, `video_posts`, `extracted_words`
- [ ] Initial data inserted (Japanese category, Scripting Japan source)

### Automation
- [ ] Python script runs without errors
- [ ] Videos fetched from YouTube
- [ ] Transcripts extracted successfully
- [ ] Gemini processing returns slang words
- [ ] Data saved to D1 database

### Frontend
- [ ] `/learning-resources` page loads
- [ ] `/learning-resources/japanese/scripting-japan` shows video list
- [ ] Video detail pages display correctly
- [ ] WordCard components link to dictionary
- [ ] YouTube embeds work

### GitHub Actions
- [ ] Secrets configured
- [ ] Workflow runs successfully
- [ ] Logs show processed videos
- [ ] No API quota errors

## Troubleshooting

### "No transcript available"
- Video doesn't have Japanese captions
- Enable auto-generated captions on YouTube first

### "Gemini processing failed"
- Check API key validity
- Verify Gemini Pro access
- Check quota limits at https://makersuite.google.com/

### "D1 query failed"
- Verify API token has D1 edit permissions
- Check database ID matches wrangler.toml
- Ensure migration was applied

### Frontend shows no videos
- Run automation script first to populate database
- Check D1 database has data: `wrangler d1 execute kiokun-dictionary --remote --command="SELECT COUNT(*) FROM video_posts"`

## Maintenance

### Update Video Processing
Edit `scripts/learning_resources_automation.py`:
- Change `max_videos` parameter
- Add new YouTube channels
- Modify Gemini prompt

### Add New Languages
1. Insert into `language_categories` table
2. Insert into `resource_sources` table
3. Create frontend routes: `/learning-resources/{language}/{source}`

## Support

For issues:
1. Check logs in GitHub Actions artifacts
2. Review `scripts/LEARNING_RESOURCES_README.md`
3. Open GitHub issue with error details

## Next Steps

After successful deployment:
1. Monitor first automated run (2 AM UTC)
2. Verify new videos appear on website
3. Check word links to dictionary work
4. Consider adding more YouTube channels
5. Expand to Chinese/Korean content

