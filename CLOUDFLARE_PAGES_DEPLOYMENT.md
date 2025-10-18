# Cloudflare Pages Deployment Guide

## Overview

The SvelteKit app is configured to deploy to Cloudflare Pages with automatic environment detection:

- **Development** (`npm run dev`): Uses local dictionary files from `/static/dictionary/`
- **Production** (Cloudflare Pages): Uses jsDelivr CDN to fetch from GitHub repos

## Prerequisites

1. Cloudflare account
2. Wrangler CLI installed: `npm install -g wrangler`
3. Dictionary data deployed to GitHub repos (via GitHub Actions)

## Environment Detection

The app automatically detects the environment using SvelteKit's `dev` flag:

```typescript
// sveltekit-app/src/lib/shard-utils.ts
import { dev } from '$app/environment';

export function getDictionaryUrl(word: string): string {
  if (dev) {
    // Development: use local files
    return `/dictionary/${word}.json`;
  } else {
    // Production: use jsDelivr CDN
    return getJsDelivrUrl(word);
  }
}
```

## Local Development

### 1. Build Dictionary Locally (Optional)

If you want to test with real data locally:

```bash
# Build a single shard for testing
cargo run --release --bin merge_dictionaries -- --individual-files --optimize --mode han-1char

# Copy to SvelteKit static directory
mkdir -p sveltekit-app/static/dictionary
cp output_han_1char/* sveltekit-app/static/dictionary/
```

### 2. Run Dev Server

```bash
cd sveltekit-app
npm install
npm run dev
```

Navigate to `http://localhost:5173/好` to test.

**Console output:**
```
[DEV] Fetching from: /dictionary/好.json
```

## Production Deployment

### Option 1: Wrangler CLI (Recommended)

#### First-time Setup

```bash
cd sveltekit-app

# Login to Cloudflare
wrangler login

# Build the app
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy .svelte-kit/cloudflare --project-name kiokun-dictionary
```

#### Subsequent Deployments

```bash
cd sveltekit-app
npm run build
npx wrangler pages deploy .svelte-kit/cloudflare --project-name kiokun-dictionary
```

### Option 2: Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **Create application** → **Pages**
3. Connect to GitHub repository: `Kimeiga/kiokun-data`
4. Configure build settings:
   - **Build command**: `cd sveltekit-app && npm install && npm run build`
   - **Build output directory**: `sveltekit-app/.svelte-kit/cloudflare`
   - **Root directory**: `/` (leave empty or set to root)
5. Click **Save and Deploy**

### Option 3: GitHub Actions (Automated)

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
    paths:
      - 'sveltekit-app/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd sveltekit-app
          npm install
      
      - name: Build
        run: |
          cd sveltekit-app
          npm run build
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy sveltekit-app/.svelte-kit/cloudflare --project-name=kiokun-dictionary
```

**Required Secrets:**
- `CLOUDFLARE_API_TOKEN`: Get from Cloudflare Dashboard → My Profile → API Tokens
- `CLOUDFLARE_ACCOUNT_ID`: Get from Cloudflare Dashboard → Workers & Pages → Account ID

## Verification

### 1. Check Build Output

After building, verify the adapter is working:

```bash
cd sveltekit-app
npm run build

# Check output directory
ls -la .svelte-kit/cloudflare/
```

Should contain:
- `_worker.js` - Cloudflare Worker
- `_routes.json` - Routing configuration
- Static assets

### 2. Test Production Build Locally

```bash
cd sveltekit-app
npm run preview
```

Navigate to the preview URL and check console:

```
[PROD] Fetching from: https://cdn.jsdelivr.net/gh/Kimeiga/japanese-dict-han-1char@main/好.json
```

### 3. Test Deployed Site

After deployment, visit your Cloudflare Pages URL:

```
https://kiokun-dictionary.pages.dev/好
```

Check browser console for:
- ✅ `[PROD] Fetching from: https://cdn.jsdelivr.net/gh/...`
- ✅ No CORS errors
- ✅ Data loads successfully

## Troubleshooting

### Issue: 404 Errors in Production

**Cause**: Dictionary files not yet deployed to GitHub repos

**Solution**: Wait for GitHub Actions workflow to complete (~30 min), then verify:

```bash
curl -I https://cdn.jsdelivr.net/gh/Kimeiga/japanese-dict-han-1char@main/好.json
```

Should return `200 OK`.

### Issue: CORS Errors

**Cause**: jsDelivr should handle CORS automatically

**Solution**: Verify the URL is correct and the file exists on GitHub.

### Issue: Build Fails

**Cause**: Missing dependencies or incorrect build command

**Solution**: 
```bash
cd sveltekit-app
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue: Wrong Environment Detected

**Cause**: SvelteKit's `dev` flag not working correctly

**Solution**: Check `svelte.config.js` has correct adapter:

```javascript
import adapter from '@sveltejs/adapter-cloudflare';

const config = {
  kit: {
    adapter: adapter()
  }
};
```

## Custom Domain (Optional)

### 1. Add Custom Domain in Cloudflare Dashboard

1. Go to your Pages project
2. Click **Custom domains**
3. Add your domain (e.g., `dictionary.kiokun.com`)
4. Follow DNS setup instructions

### 2. Update DNS

Add CNAME record:
```
dictionary.kiokun.com → kiokun-dictionary.pages.dev
```

## Performance Optimization

### 1. Enable Caching

Cloudflare Pages automatically caches static assets. For API responses:

```typescript
// sveltekit-app/src/routes/[word]/+page.ts
export const load: PageLoad = async ({ params, fetch, setHeaders }) => {
  // Cache for 1 hour
  setHeaders({
    'cache-control': 'public, max-age=3600'
  });
  
  // ... rest of code
};
```

### 2. Prerender Static Pages

For frequently accessed pages, enable prerendering:

```typescript
// sveltekit-app/src/routes/[word]/+page.ts
export const prerender = true; // Only if you have a finite list of words
```

### 3. Add Service Worker (Optional)

Create `sveltekit-app/src/service-worker.ts` for offline support:

```typescript
/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
```

## Monitoring

### 1. Cloudflare Analytics

View analytics in Cloudflare Dashboard:
- Page views
- Unique visitors
- Bandwidth usage
- Geographic distribution

### 2. Real User Monitoring (RUM)

Add to `sveltekit-app/src/routes/+layout.svelte`:

```svelte
<script>
  import { onMount } from 'svelte';
  
  onMount(() => {
    // Track page load time
    if (window.performance) {
      const perfData = window.performance.timing;
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      console.log('Page load time:', pageLoadTime, 'ms');
    }
  });
</script>
```

## Summary

**Development Workflow:**
1. Make changes to SvelteKit app
2. Test locally with `npm run dev` (uses local files)
3. Build with `npm run build`
4. Deploy with `npx wrangler pages deploy`

**Production URLs:**
- **App**: `https://kiokun-dictionary.pages.dev`
- **Data**: `https://cdn.jsdelivr.net/gh/Kimeiga/japanese-dict-{shard}@main/{word}.json`

**Key Features:**
- ✅ Automatic environment detection
- ✅ Local files in dev, CDN in prod
- ✅ Zero-config deployment
- ✅ Global CDN (Cloudflare + jsDelivr)
- ✅ Free hosting

🚀 **Ready to deploy!**

