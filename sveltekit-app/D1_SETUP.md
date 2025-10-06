# D1 Database Setup Guide

Complete guide to set up Cloudflare D1 database for the dictionary.

## 🎯 Why D1?

- ✅ **5 GB free storage** (your 1.7 GB fits easily)
- ✅ **Fast SQL queries** - Built for this use case
- ✅ **Easy updates** - No need to re-upload files
- ✅ **Unlimited rebuilds** - Delete and re-insert as many times as you want (FREE)
- ✅ **5 million reads/day** - More than enough

## 📊 Free Tier Limits

| Resource | Free Tier | Your Usage | Status |
|----------|-----------|------------|--------|
| Storage | 5 GB | 1.7 GB | ✅ 34% used |
| Reads | 5M/day | ~10k/day | ✅ 0.2% used |
| Writes | 100k/day | One-time | ✅ |
| Rebuilds | Unlimited | As needed | ✅ FREE |

**You can delete and re-upload as many times as you want - it's FREE!**

---

## 🚀 Setup Steps

### Step 1: Install Wrangler CLI

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### Step 2: Create D1 Database

```bash
# Create the database
wrangler d1 create kiokun-dictionary

# Output will look like:
# ✅ Successfully created DB 'kiokun-dictionary'!
# 
# [[d1_databases]]
# binding = "DB"
# database_name = "kiokun-dictionary"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id` from the output!**

### Step 3: Update wrangler.toml

Edit `sveltekit-app/wrangler.toml` and replace `YOUR_DATABASE_ID_HERE` with your actual database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "kiokun-dictionary"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Your actual ID here
```

### Step 4: Create Database Schema

```bash
cd sveltekit-app

# Create the tables (local for testing)
wrangler d1 execute kiokun-dictionary --local --file=migrations/0001_dictionary.sql

# Create the tables (remote for production)
wrangler d1 execute kiokun-dictionary --remote --file=migrations/0001_dictionary.sql
```

### Step 5: Upload Dictionary Data

```bash
cd ..  # Back to project root

# Make upload script executable
chmod +x scripts/upload-to-d1.js

# Run the upload script
node scripts/upload-to-d1.js
```

**This will:**
1. Read all 431,750 JSON files from `output_dictionary/`
2. Batch them into groups of 1,000
3. Upload to D1 using SQL INSERT statements
4. Show progress and timing

**Expected time:** 10-30 minutes depending on your connection

---

## ⏱️ Upload Performance

### Expected Upload Time

Based on D1 performance:
- **Batch size:** 1,000 entries
- **Batches:** 432 batches
- **Rate:** ~50-100 entries/second
- **Total time:** 10-30 minutes

### Progress Output

```
🚀 Starting dictionary upload to D1...

📂 Reading dictionary files...
   Found 431,750 files

📖 Reading file contents...
   Processed 10,000 / 431,750 files
   Processed 20,000 / 431,750 files
   ...
   ✅ Processed 431,750 entries

📦 Creating batches of 1000...
   Created 432 batches

⬆️  Uploading to D1...
   [10.0%] Batch 43/432 - 43,000 entries uploaded (85 entries/sec, 506s elapsed)
   [20.0%] Batch 86/432 - 86,000 entries uploaded (82 entries/sec, 1048s elapsed)
   ...
   [100%] Batch 432/432 - 431,750 entries uploaded (80 entries/sec, 5397s elapsed)

✅ Upload complete!
   Total entries: 431,750
   Total time: 5397s (90 minutes)
   Average rate: 80 entries/sec

🎉 Dictionary is now live in D1!
```

---

## 🔄 Re-uploading / Updating Data

### To Delete All Data and Re-upload

```bash
# Delete all entries
wrangler d1 execute kiokun-dictionary --remote --command="DELETE FROM dictionary_entries;"

# Re-upload
node scripts/upload-to-d1.js
```

**Cost:** $0 (deletes and re-inserts are FREE within the 100k writes/day limit)

### To Update Specific Entries

```bash
# Update a single entry
wrangler d1 execute kiokun-dictionary --remote --command="
UPDATE dictionary_entries 
SET data = '{\"key\":\"好\",\"chinese_char\":{...}}' 
WHERE word = '好';
"
```

### To Add New Entries

Just run the upload script again - it uses `INSERT OR REPLACE` so it will update existing entries and add new ones.

---

## 🧪 Testing Locally

### Test with Local D1

```bash
cd sveltekit-app

# Start dev server with local D1
npm run dev

# Visit http://localhost:5173/好
```

### Query Local Database

```bash
# List all entries
wrangler d1 execute kiokun-dictionary --local --command="SELECT word FROM dictionary_entries LIMIT 10;"

# Get specific entry
wrangler d1 execute kiokun-dictionary --local --command="SELECT * FROM dictionary_entries WHERE word = '好';"

# Count entries
wrangler d1 execute kiokun-dictionary --local --command="SELECT COUNT(*) FROM dictionary_entries;"
```

---

## 📊 Monitoring Usage

### Check Database Size

```bash
# Get database info
wrangler d1 info kiokun-dictionary

# Count entries
wrangler d1 execute kiokun-dictionary --remote --command="SELECT COUNT(*) as total FROM dictionary_entries;"
```

### View in Dashboard

1. Go to https://dash.cloudflare.com
2. Click "Workers & Pages" → "D1"
3. Click your database
4. View:
   - Storage usage
   - Query metrics
   - Recent queries

---

## 🚀 Deployment

### Deploy to Cloudflare Pages

Once data is uploaded:

1. **Connect GitHub to Cloudflare Pages** (see CLOUDFLARE_DEPLOYMENT.md)
2. **Configure build settings:**
   - Build command: `cd sveltekit-app && npm install && npm run build`
   - Build output: `sveltekit-app/.svelte-kit/cloudflare`
3. **D1 binding is automatic** (from wrangler.toml)
4. **Deploy!**

Your app will automatically use the D1 database in production.

---

## 🐛 Troubleshooting

### "Database not found"

Make sure you:
1. Created the database: `wrangler d1 create kiokun-dictionary`
2. Updated `wrangler.toml` with the correct `database_id`
3. Ran migrations: `wrangler d1 execute ... --file=migrations/0001_dictionary.sql`

### "Platform not available" in development

D1 bindings require running through Wrangler:

```bash
# Instead of: npm run dev
# Use: wrangler pages dev

cd sveltekit-app
wrangler pages dev .svelte-kit/cloudflare --compatibility-date=2024-09-23
```

Or just test in production after deploying.

### Upload script fails

If upload fails partway through:
1. Check your internet connection
2. The script will continue from where it left off
3. Re-run: `node scripts/upload-to-d1.js`
4. It uses `INSERT OR REPLACE` so duplicates are fine

### Slow queries

Add indexes if needed:

```bash
wrangler d1 execute kiokun-dictionary --remote --command="
CREATE INDEX IF NOT EXISTS idx_word ON dictionary_entries(word);
"
```

(Already included in migration file)

---

## 💰 Cost Tracking

### Current Usage (Estimated)

- **Storage:** 1.7 GB / 5 GB free = **$0**
- **Reads:** 10,000/day / 5M free = **$0**
- **Writes:** One-time upload / 100k free = **$0**
- **Total:** **$0/month**

### If You Exceed Free Tier

- **Storage:** $0.75/GB/month (after 5 GB)
- **Reads:** $0.001 per 1,000 reads (after 5M/day)
- **Writes:** $1.00 per 1M writes (after 100k/day)

**You won't exceed the free tier with this use case!**

---

## ✅ Checklist

- [ ] Install Wrangler CLI
- [ ] Login to Cloudflare
- [ ] Create D1 database
- [ ] Copy database_id to wrangler.toml
- [ ] Run migrations (local and remote)
- [ ] Run upload script
- [ ] Test locally
- [ ] Deploy to Cloudflare Pages
- [ ] Test in production

---

## 📚 Resources

- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)

---

**Ready to upload?** Run `node scripts/upload-to-d1.js` and watch the magic happen! 🚀

