# Deployment Guide: GitHub Actions → Cloudflare R2

This guide explains how to automatically build and deploy your dictionary to Cloudflare R2 using GitHub Actions.

## 🎯 Why This Approach?

### **Build on Server, Upload to R2**
- ✅ **Fast**: 5-15 minutes total (vs 1-2 hours local upload)
- ✅ **Free**: GitHub Actions provides free compute
- ✅ **Automatic**: Triggers on every push to main
- ✅ **Incremental**: Only uploads changed files (rclone sync)
- ✅ **Parallel**: 32 concurrent uploads for maximum speed
- ✅ **No local resources**: Doesn't block your machine

### **Speed Comparison**

| Method | Build Time | Upload Time | Total Time | Blocks You? |
|--------|-----------|-------------|------------|-------------|
| **Local → R2** | 10-15 min | 60-120 min | 70-135 min | ✅ Yes |
| **Local → GitHub** | 10-15 min | 30-60 min | 40-75 min | ✅ Yes |
| **GitHub Actions → R2 (optimized)** | 10-15 min | 7-10 min | **17-25 min** | ❌ No |

## 📋 Setup Instructions

### 1. Create R2 Bucket

```bash
# Install Wrangler if you haven't
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create R2 bucket
wrangler r2 bucket create kiokun-dictionary-data

# Enable public access (for serving files)
wrangler r2 bucket public-access enable kiokun-dictionary-data
```

### 2. Get R2 API Credentials

1. Go to Cloudflare Dashboard → R2
2. Click "Manage R2 API Tokens"
3. Click "Create API Token"
4. Select "Admin Read & Write" permissions
5. Copy the following:
   - **Access Key ID**
   - **Secret Access Key**
   - **Account ID** (from the URL or dashboard)

### 3. Add GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret

Add these three secrets:

```
CLOUDFLARE_ACCOUNT_ID = your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID = your-access-key-id
CLOUDFLARE_R2_SECRET_ACCESS_KEY = your-secret-access-key
```

### 4. Enable GitHub Actions

The workflow file is already created at `.github/workflows/build-and-deploy-r2.yml`

It will automatically run when you:
- Push to `main` branch
- Manually trigger via GitHub Actions UI
- Monthly (on the 1st of each month)

### 5. Update SvelteKit App

Update `sveltekit-app/src/routes/[word]/+page.ts`:

```typescript
// Add your R2 public URL (get from Cloudflare Dashboard → R2 → Your bucket)
const R2_BASE_URL = import.meta.env.PUBLIC_R2_BASE_URL || 'https://pub-xxxxx.r2.dev';

export const load: PageLoad = async ({ params, fetch }) => {
  const { word } = params;
  
  try {
    // Try local first (for development)
    let response = await fetch(`/dictionary/${word}.json`);
    
    // Fallback to R2 (for production)
    if (!response.ok) {
      response = await fetch(`${R2_BASE_URL}/dictionary/${word}.json`);
    }
    
    if (!response.ok) {
      throw error(404, `Character "${word}" not found`);
    }
    
    const rawData = await response.json();
    const data = expandFields(rawData);
    
    // Handle redirects...
    if (data.redirect) {
      const redirectResponse = await fetch(`${R2_BASE_URL}/dictionary/${data.redirect}.json`);
      if (redirectResponse.ok) {
        const redirectRawData = await redirectResponse.json();
        data = expandFields(redirectRawData);
      }
    }
    
    // ... rest of your code
  } catch (err) {
    throw error(404, `Character "${word}" not found`);
  }
};
```

Add environment variable in Cloudflare Pages:
- Go to Pages → Your project → Settings → Environment variables
- Add: `PUBLIC_R2_BASE_URL` = `https://pub-xxxxx.r2.dev`

## 🚀 How It Works

### Workflow Steps:

1. **Prepare Job** (5-10 min)
   - Downloads all dictionary source files
   - Caches them for the build job
   - Only runs once per workflow

2. **Build and Deploy Job** (10-15 min)
   - Restores cached source files
   - Builds Rust project with `--optimize` flag
   - Generates 431k+ optimized JSON files
   - Uploads to R2 using `rclone sync` with 64 parallel transfers (maximum speed!)

### Key Optimizations:

```bash
# rclone sync only uploads changed files
rclone sync output_dictionary r2:kiokun-dictionary-data/dictionary \
  --transfers 64 \      # 64 parallel uploads (maximum speed!)
  --checkers 32 \       # 32 parallel file checks
  --fast-list \         # Use fast listing (fewer API calls)
  --retries 3           # Retry failed uploads
```

**Why these settings?**
- `sync` only uploads files that changed (incremental!)
- `--transfers 64` = 64 files uploading simultaneously (2x faster than 32!)
- `--checkers 32` = 32 files being checked simultaneously
- Same API calls as lower parallelism, just faster!
- First upload: ~7-10 minutes (all files)
- Subsequent uploads: ~1-3 minutes (only changed files)
- Saves time and API calls!

## 📊 Cost Analysis

### R2 Free Tier (Per Account):
```
Storage: 10 GB/month FREE
Class A Operations: 1M/month FREE (uploads/writes)
Class B Operations: 10M/month FREE (reads)
```

### Your Usage:
```
Storage: 1.7-3 GB ✅ FREE
Initial upload: 431k files = 431k Class A ops ✅ FREE
Monthly updates: ~50k changed files = 50k Class A ops ✅ FREE
Monthly reads (10k page views): ~10k Class B ops ✅ FREE

Total cost: $0/month 🎉
```

## 🔄 Incremental Updates

The beauty of `rclone sync` with high parallelism:

```bash
# First deployment (--transfers 64)
Files uploaded: 431,750
Time: ~7-10 minutes

# After code changes (only 5% of files changed)
Files checked: 431,750
Files uploaded: ~21,587 (5%)
Time: ~2-3 minutes ⚡

# After minor changes (only 1% of files changed)
Files checked: 431,750
Files uploaded: ~4,317 (1%)
Time: ~1 minute ⚡⚡
```

## 🛠️ Manual Deployment

If you need to deploy manually:

```bash
# 1. Build locally
cargo run --release -- --individual-files --optimize

# 2. Configure rclone (one-time setup)
rclone config create r2 s3 \
  provider Cloudflare \
  access_key_id YOUR_ACCESS_KEY_ID \
  secret_access_key YOUR_SECRET_ACCESS_KEY \
  endpoint https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com

# 3. Upload to R2 (with maximum speed!)
rclone sync output_dictionary r2:kiokun-dictionary-data/dictionary \
  --transfers 64 \
  --checkers 32 \
  --fast-list \
  --progress
```

## 🐛 Troubleshooting

### Workflow fails with "Access Denied"
- Check that your R2 API token has "Admin Read & Write" permissions
- Verify all three secrets are set correctly in GitHub

### Upload is slow
- Increase `--transfers` value (try 64 or 128)
- Check GitHub Actions runner location (might be far from Cloudflare)

### Files not updating
- `rclone sync` uses file size and modification time
- If files have same size/time but different content, use `--checksum` flag
- This is slower but more accurate

### R2 bucket not accessible
- Make sure public access is enabled: `wrangler r2 bucket public-access enable kiokun-dictionary-data`
- Get public URL from Cloudflare Dashboard → R2 → Your bucket

## 📈 Monitoring

### GitHub Actions
- Go to Actions tab in your repo
- Click on latest workflow run
- View logs for each step
- Check upload progress and file counts

### Cloudflare R2
- Go to Cloudflare Dashboard → R2 → Your bucket
- View storage usage
- Monitor API operations
- Check bandwidth usage

## 🎯 Next Steps

1. ✅ Set up R2 bucket and get credentials
2. ✅ Add secrets to GitHub
3. ✅ Push to main branch to trigger first deployment
4. ✅ Update SvelteKit app to use R2 URLs
5. ✅ Deploy SvelteKit app to Cloudflare Pages
6. ✅ Test dictionary lookups

## 💡 Pro Tips

1. **Use custom domain**: Set up `cdn.yourdomain.com` → R2 bucket for better branding
2. **Enable caching**: R2 automatically caches at Cloudflare edge
3. **Monitor usage**: Set up alerts if you approach free tier limits
4. **Backup strategy**: Keep GitHub repos as backup (they're already there!)
5. **Version control**: Tag releases in GitHub to track dictionary versions

## 🔄 Migration from GitHub Repos

If you're currently using the 4-repo sharding approach:

1. Keep the repos as backup (they're free!)
2. Set up R2 deployment (this guide)
3. Update SvelteKit to use R2 URLs
4. Test thoroughly
5. Optionally archive the 4 GitHub repos

You can always switch back if needed!

