# 🚀 Quick Start Guide - Learning Resources Automation

## ✅ What's Already Done

- ✅ Script updated to use Cloudflare D1 REST API (no more wrangler auth issues!)
- ✅ Script updated to support YouTube cookies (bypasses IP blocks!)
- ✅ Gemini model updated to `gemini-2.5-flash`
- ✅ Frontend pages created and ready
- ✅ Database schema deployed

## 📋 What You Need To Do (5 minutes)

### Step 1: Create Cloudflare API Token (2 minutes)

1. **Open**: https://dash.cloudflare.com/profile/api-tokens
2. **Click**: "Create Token"
3. **Click**: "Create Custom Token"
4. **Configure**:
   - Token name: `D1 Learning Resources Automation`
   - Permissions: `Account` → `D1` → `Edit`
   - Account Resources: `Include` → `Your Account`
5. **Click**: "Continue to summary" → "Create Token"
6. **Copy** the token (you'll only see it once!)

### Step 2: Update .env File (30 seconds)

Open `scripts/.env` and replace the `CLOUDFLARE_API_TOKEN` line:

```bash
CLOUDFLARE_API_TOKEN=your_actual_token_here
```

### Step 3: Get YouTube Cookies (2 minutes)

1. **Install Extension**:
   - Chrome: https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/

2. **Download Cookies**:
   - Go to YouTube.com (make sure you're logged in)
   - Click the extension icon
   - Click "Export" or "Download"
   - Save as `cookies.txt`

3. **Move File**:
   ```bash
   mv ~/Downloads/cookies.txt /Users/haki/code/kiokun-data/scripts/cookies.txt
   ```

### Step 4: Test Everything (30 seconds)

```bash
cd /Users/haki/code/kiokun-data/scripts
python3 test_setup.py
```

You should see all ✅ green checkmarks!

### Step 5: Run the Automation! (5 minutes)

```bash
cd /Users/haki/code/kiokun-data/scripts
python3 learning_resources_automation.py
```

Watch it:
1. ✅ Fetch videos from Scripting Japan
2. ✅ Download transcripts (using cookies!)
3. ✅ Process with Gemini AI
4. ✅ Save to Cloudflare D1
5. ✅ Display on kiokun.com!

---

## 🎉 Expected Output

```
📄 Loading environment variables from /Users/haki/code/kiokun-data/scripts/.env
🚀 Starting Learning Resources Automation
============================================================
✅ Initialized Learning Resources Automation
🔧 Initializing database with default data...
  ✓ Database initialized

============================================================
Processing channel: UCcSeOwSRnOZvNYOelU-RUkw
============================================================

📺 Fetching latest 5 videos from channel UCcSeOwSRnOZvNYOelU-RUkw...
  ✓ Japanese Words for Poo and Pee (527s, 518 views)
  ✓ キボンヌ and 保守 (Yay Dead 2chan Words) (341s, 1407 views)
✅ Fetched 5 videos

--- Processing video 1/5 ---
Title: Japanese Words for Poo and Pee
📝 Fetching transcript for video BvatNr0225o...
  🍪 Using cookies.txt to bypass IP restrictions...
  ✓ Transcript fetched: 10496 characters, 278 segments
🤖 Processing transcript with Gemini...
  ✓ Extracted 15 slang words
💾 Saving to database...
  ✅ Video processed successfully!
```

---

## 🔧 Troubleshooting

### "401 Unauthorized" on D1 API
- ❌ API token is invalid or missing D1 permissions
- ✅ Create a new token with `Account → D1 → Edit` permission

### "IpBlocked" on YouTube
- ❌ cookies.txt is missing or expired
- ✅ Download fresh cookies from YouTube (see Step 3)

### "404 models/gemini-xxx not found"
- ❌ Wrong model name
- ✅ Script uses `gemini-2.5-flash` (already fixed!)

---

## 📚 Additional Resources

- **Cookies Setup**: See `SETUP_COOKIES.md`
- **Architecture**: See `LEARNING_RESOURCES_SUMMARY.md`
- **Deployment**: See `LEARNING_RESOURCES_DEPLOYMENT.md`

---

## 🎯 Next Steps After Success

Once the automation works locally:

1. **Schedule it**: Run daily with cron or launchd
2. **Deploy to GitHub Actions**: We'll add cookies as a secret
3. **Monitor**: Check kiokun.com/learning-resources for new content!

---

**Ready? Let's go! 🚀**
