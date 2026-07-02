# 🍪 YouTube Cookies Setup Guide

## Why Do We Need Cookies?

YouTube blocks IP addresses from:
- ✅ Cloud providers (GitHub Actions, AWS, Azure)
- ✅ Residential IPs making too many requests

**Solution**: Pass YouTube cookies from a logged-in session. This makes YouTube treat your script like a legitimate user instead of a bot.

---

## 📥 How to Get Your cookies.txt File

### Step 1: Install Browser Extension

**Chrome/Edge/Brave:**
1. Go to: https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
2. Click "Add to Chrome"

**Firefox:**
1. Go to: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/
2. Click "Add to Firefox"

### Step 2: Download Cookies

1. **Go to YouTube.com** (make sure you're logged in)
2. **Click the extension icon** in your browser toolbar
3. **Click "Export"** or "Download"
4. **Save the file** as `cookies.txt`

### Step 3: Place in Scripts Directory

Move the downloaded `cookies.txt` file to:
```
/Users/haki/code/kiokun-data/scripts/cookies.txt
```

The file should be in the same directory as `learning_resources_automation.py`.

---

## ✅ Verify It Works

Run this test command:
```bash
cd scripts
python3 -c "from youtube_transcript_api import YouTubeTranscriptApi; t = YouTubeTranscriptApi.get_transcript('BvatNr0225o', cookies='cookies.txt'); print(f'✅ Success! Got {len(t)} segments')"
```

If you see `✅ Success!`, you're all set!

---

## 🔒 Security Notes

- **Never commit cookies.txt to Git!** (Already in `.gitignore`)
- Cookies expire after ~6 months, you'll need to refresh them
- For GitHub Actions, we'll base64-encode and store as a secret

---

## 🚀 For GitHub Actions Deployment

Once cookies.txt works locally, we'll:
1. Base64 encode the file: `base64 -i cookies.txt`
2. Save as GitHub Secret: `YOUTUBE_COOKIES_BASE64`
3. Decode in workflow before running script

---

## 📚 References

- [youtube-transcript-api Cookies Documentation](https://github.com/jdepoix/youtube-transcript-api#cookies)
- [Working Around IP Bans](https://github.com/jdepoix/youtube-transcript-api?tab=readme-ov-file#working-around-ip-bans-requestblocked-or-ipblocked-exception)
