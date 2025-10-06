# Cloudflare Pages Deployment Guide

Complete guide to deploy the Kiokun Dictionary webapp to Cloudflare Pages with automatic deployments on push to main.

## 🎯 Overview

Cloudflare Pages provides:
- **Free Tier**: Unlimited bandwidth, 500 builds/month
- **Automatic Deployments**: Deploy on every push to main
- **Global CDN**: Fast loading worldwide
- **Custom Domains**: Free SSL certificates
- **Preview Deployments**: Automatic preview for PRs

## 📋 Prerequisites

1. **Cloudflare Account**: Sign up at https://dash.cloudflare.com/sign-up
2. **GitHub Repository**: Your code must be on GitHub (✅ Already done!)
3. **Dictionary Data**: Ensure `output_dictionary/` is committed or accessible

## 🚀 Deployment Steps

### Step 1: Prepare the Project

First, we need to update the SvelteKit adapter for Cloudflare Pages:

```bash
cd sveltekit-app

# Install Cloudflare adapter
npm install -D @sveltejs/adapter-cloudflare

# Update svelte.config.js
```

Update `svelte.config.js`:

```javascript
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			routes: {
				include: ['/*'],
				exclude: ['<all>']
			}
		})
	}
};

export default config;
```

### Step 2: Create `.cfignore` File

Create `sveltekit-app/.cfignore` to exclude unnecessary files:

```
node_modules
.svelte-kit
.git
.env
.dev.vars
*.log
```

### Step 3: Update `package.json` Build Script

Ensure your `package.json` has the correct build command:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### Step 4: Handle Dictionary Data

**Option A: Commit Dictionary Data (Recommended for small datasets)**

```bash
# Remove symlink
rm static/dictionary

# Copy actual files
cp -r ../output_dictionary static/dictionary

# Add to git
git add static/dictionary
git commit -m "Add dictionary data for Cloudflare deployment"
git push origin main
```

**Option B: Use Cloudflare R2 (For large datasets)**

If your dictionary data is too large (>25MB), use R2 object storage:

1. Create R2 bucket in Cloudflare Dashboard
2. Upload `output_dictionary/` to R2
3. Update data loading in `+page.ts` to fetch from R2 URLs

### Step 5: Connect to Cloudflare Pages

1. **Go to Cloudflare Dashboard**
   - Navigate to https://dash.cloudflare.com
   - Click "Workers & Pages" in the left sidebar
   - Click "Create application" → "Pages" → "Connect to Git"

2. **Connect GitHub Repository**
   - Click "Connect GitHub"
   - Authorize Cloudflare to access your repositories
   - Select `Kimeiga/kiokun-data` repository

3. **Configure Build Settings**
   - **Project name**: `kiokun-dictionary` (or your preferred name)
   - **Production branch**: `main`
   - **Framework preset**: `SvelteKit`
   - **Build command**: `cd sveltekit-app && npm install && npm run build`
   - **Build output directory**: `sveltekit-app/.svelte-kit/cloudflare`
   - **Root directory**: `/` (leave as root)

4. **Environment Variables** (if needed)
   - Click "Add variable" if you have any environment variables
   - For this project, no environment variables are needed initially

5. **Click "Save and Deploy"**

### Step 6: Wait for First Deployment

- Cloudflare will clone your repo and run the build
- First build takes 2-5 minutes
- You'll see build logs in real-time
- Once complete, you'll get a URL like: `https://kiokun-dictionary.pages.dev`

### Step 7: Test Your Deployment

Visit your Cloudflare Pages URL and test:

```
https://kiokun-dictionary.pages.dev/好
https://kiokun-dictionary.pages.dev/的
https://kiokun-dictionary.pages.dev/地圖
```

## 🔄 Automatic Deployments on Push

Once connected, Cloudflare Pages automatically:

1. **Watches your `main` branch**
2. **Triggers build on every push**
3. **Deploys automatically** when build succeeds
4. **Creates preview deployments** for pull requests

### How It Works

```
You: git push origin main
  ↓
GitHub: Webhook to Cloudflare
  ↓
Cloudflare: Clone repo → Install deps → Build → Deploy
  ↓
Live: https://kiokun-dictionary.pages.dev updated!
```

### Deployment Status

Check deployment status:
- **Cloudflare Dashboard**: Workers & Pages → Your project → Deployments
- **GitHub**: Commit status checks show deployment status
- **Email**: Cloudflare sends deployment notifications

## 🎨 Custom Domain Setup

### Add Custom Domain

1. **Go to your Pages project** in Cloudflare Dashboard
2. **Click "Custom domains"** tab
3. **Click "Set up a custom domain"**
4. **Enter your domain**: `dictionary.yourdomain.com`
5. **Follow DNS instructions**:
   - If domain is on Cloudflare: Automatic setup
   - If domain is elsewhere: Add CNAME record

### DNS Configuration

For domain on Cloudflare:
```
Type: CNAME
Name: dictionary
Target: kiokun-dictionary.pages.dev
Proxy: Enabled (orange cloud)
```

For domain elsewhere:
```
Type: CNAME
Name: dictionary
Target: kiokun-dictionary.pages.dev
```

### SSL Certificate

- Cloudflare automatically provisions SSL certificate
- HTTPS enabled by default
- Certificate renews automatically

## 🔧 Advanced Configuration

### Build Configuration File

Create `sveltekit-app/wrangler.toml` for advanced settings:

```toml
name = "kiokun-dictionary"
compatibility_date = "2024-01-01"

[site]
bucket = ".svelte-kit/cloudflare"

[[routes]]
pattern = "/*"
```

### Environment Variables

Add environment variables in Cloudflare Dashboard:
- Go to project → Settings → Environment variables
- Add variables for production/preview environments

### Build Caching

Cloudflare automatically caches:
- `node_modules/` between builds
- Build artifacts for faster rebuilds

### Preview Deployments

Every pull request gets a unique preview URL:
```
https://abc123.kiokun-dictionary.pages.dev
```

## 📊 Monitoring & Analytics

### View Analytics

1. Go to your Pages project
2. Click "Analytics" tab
3. View:
   - Page views
   - Unique visitors
   - Bandwidth usage
   - Geographic distribution

### Build Logs

View build logs:
1. Go to "Deployments" tab
2. Click on any deployment
3. View full build logs

### Error Tracking

Check for errors:
1. Go to "Functions" tab
2. View function logs
3. Monitor error rates

## 🐛 Troubleshooting

### Build Fails

**Issue**: Build command fails

**Solution**:
```bash
# Test build locally first
cd sveltekit-app
npm install
npm run build

# Check build output
ls -la .svelte-kit/cloudflare
```

### 404 Errors

**Issue**: Routes return 404

**Solution**: Ensure `adapter-cloudflare` is installed and configured correctly

### Dictionary Data Not Found

**Issue**: `/dictionary/*.json` returns 404

**Solution**: 
- Check that `static/dictionary/` exists
- Verify symlink is replaced with actual files
- Check build output includes dictionary files

### Slow Build Times

**Issue**: Builds take too long

**Solution**:
- Reduce dictionary data size
- Use R2 for large files
- Enable build caching

## 📈 Performance Optimization

### Enable Caching

Add cache headers in `svelte.config.js`:

```javascript
kit: {
  adapter: adapter(),
  csp: {
    directives: {
      'script-src': ['self']
    }
  }
}
```

### Optimize Images

If you add images later:
- Use WebP format
- Enable Cloudflare Image Optimization
- Set appropriate cache headers

### Minify Assets

Cloudflare automatically:
- Minifies HTML, CSS, JS
- Compresses with Brotli/Gzip
- Optimizes delivery

## 🔐 Security

### HTTPS Only

Force HTTPS:
1. Go to project settings
2. Enable "Always Use HTTPS"

### Access Control

Restrict access (if needed):
1. Go to "Settings" → "Access"
2. Set up Cloudflare Access
3. Require authentication

## 💰 Pricing

### Free Tier Includes:
- Unlimited requests
- Unlimited bandwidth
- 500 builds/month
- 1 concurrent build
- 20,000 files per deployment

### Paid Plans:
- **$20/month**: Unlimited builds, 5 concurrent builds
- **Enterprise**: Custom pricing

## 📚 Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [SvelteKit Cloudflare Adapter](https://kit.svelte.dev/docs/adapter-cloudflare)
- [Cloudflare Pages GitHub Integration](https://developers.cloudflare.com/pages/platform/git-integration/)

---

## ✅ Quick Checklist

- [ ] Install `@sveltejs/adapter-cloudflare`
- [ ] Update `svelte.config.js`
- [ ] Replace symlink with actual dictionary files (or use R2)
- [ ] Commit and push changes
- [ ] Connect GitHub repo to Cloudflare Pages
- [ ] Configure build settings
- [ ] Wait for first deployment
- [ ] Test deployment URL
- [ ] (Optional) Add custom domain
- [ ] (Optional) Set up analytics

---

**Your app will be live at**: `https://kiokun-dictionary.pages.dev`

**Automatic deployments**: Every push to `main` triggers a new deployment!

*Last updated: October 2025*

