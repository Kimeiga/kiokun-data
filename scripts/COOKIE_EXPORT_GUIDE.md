# 🍪 YouTube Cookie Export Guide

## Why Do We Need Cookies?

YouTube blocks requests from cloud providers and rate-limits residential IPs. Using authenticated cookies bypasses these blocks.

---

## ✅ **Recommended Method: Browser Extension**

The Chrome cookie database encryption is complex and version-dependent. The **easiest and most reliable** method is using a browser extension.

### **Step 1: Install the Extension**

Install **"Get cookies.txt LOCALLY"** extension:
- **Chrome/Brave**: https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
- **Firefox**: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/

### **Step 2: Export YouTube Cookies**

1. **Go to YouTube.com** and make sure you're logged in
2. **Click the extension icon** in your browser toolbar
3. **Click "Export"** or "Download" button
4. **Save the file** as `cookies.txt` in the `scripts/` directory

### **Step 3: Verify the File**

The file should look like this:

```
# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1234567890	VISITOR_INFO1_LIVE	abc123def456...
.youtube.com	TRUE	/	TRUE	1234567890	LOGIN_INFO	xyz789...
```

**Important**: The cookie values (last column) should NOT be empty!

### **Step 4: Test It**

Run the test script to verify everything works:

```bash
python3 scripts/test_setup.py
```

You should see:
```
3️⃣ Testing YouTube Transcript API...
  ✅ cookies.txt found!
  ✅ Transcript API working! Got X segments
```

---

## 🔐 **For GitHub Actions**

Once you have a working `cookies.txt` file:

1. **Base64 encode it**:
   ```bash
   base64 -i scripts/cookies.txt | pbcopy
   ```

2. **Add as GitHub Secret**:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `YOUTUBE_COOKIES_BASE64`
   - Value: Paste the base64 string

3. **The GitHub Action will decode it** automatically before running

---

## ⚠️ **Cookie Expiration**

Cookies typically expire after 30-90 days. If the automation starts failing:

1. Re-export cookies using the extension
2. Update the GitHub secret with the new base64-encoded cookies

---

## 🎯 **Ready to Go!**

Once you have `scripts/cookies.txt` with valid cookie values, run:

```bash
python3 scripts/learning_resources_automation.py
```

The automation will use the cookies to bypass YouTube's IP blocks! 🚀
