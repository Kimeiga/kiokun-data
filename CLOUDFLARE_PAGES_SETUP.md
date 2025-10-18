# Cloudflare Pages Setup Guide for KIOKUN

This guide will help you set up automatic deployments to Cloudflare Pages at `kiokun.pages.dev`.

## 🎯 Goal

Deploy the SvelteKit app to Cloudflare Pages automatically on every push to the `main` branch.

---

## ✅ Option 1: Cloudflare Dashboard (Recommended - Easiest)

This is the **easiest and recommended** method. It takes ~2 minutes and requires no secrets or configuration.

### Steps:

1. **Go to Cloudflare Dashboard**
   - Visit: https://dash.cloudflare.com/
   - Log in with your account (hak7alp@gmail.com)

2. **Navigate to Pages**
   - Click **Workers & Pages** in the left sidebar
   - Click **Create application**
   - Click **Pages** tab
   - Click **Connect to Git**

3. **Connect GitHub Repository**
   - Click **Connect GitHub**
   - Authorize Cloudflare to access your GitHub account
   - Select the repository: `Kimeiga/kiokun-data`
   - Click **Begin setup**

4. **Configure Build Settings**
   - **Project name**: `kiokun` (this will make it available at `kiokun.pages.dev`)
   - **Production branch**: `main`
   - **Framework preset**: Select **SvelteKit**
   - **Build command**: `npm run build`
   - **Build output directory**: `.svelte-kit/cloudflare`
   - **Root directory**: `sveltekit-app`

5. **Deploy**
   - Click **Save and Deploy**
   - Wait ~2-3 minutes for the first build
   - Your site will be live at: **https://kiokun.pages.dev** 🎉

### What This Does:

- ✅ Automatically deploys on every push to `main`
- ✅ Creates preview deployments for pull requests
- ✅ Provides build logs and deployment history
- ✅ Handles SSL certificates automatically
- ✅ Serves from Cloudflare's global CDN

---

## 🔧 Option 2: GitHub Actions (Alternative)

If you prefer to use GitHub Actions instead of Cloudflare's built-in Git integration, follow these steps.

### Prerequisites:

You need to create two GitHub secrets:

1. **CLOUDFLARE_API_TOKEN**
2. **CLOUDFLARE_ACCOUNT_ID**

### Step 1: Get Cloudflare Account ID

1. Go to https://dash.cloudflare.com/
2. Click on **Workers & Pages** in the left sidebar
3. Your Account ID is shown in the right sidebar
4. Copy it (format: `8c6ab7c9be1fad147cec0181d16e4036`)

### Step 2: Create Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Click **Use template** next to **Edit Cloudflare Workers**
4. Under **Account Resources**, select your account
5. Under **Zone Resources**, select **All zones**
6. Click **Continue to summary**
7. Click **Create Token**
8. **Copy the token** (you won't be able to see it again!)

### Step 3: Add Secrets to GitHub

1. Go to your GitHub repository: https://github.com/Kimeiga/kiokun-data
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add two secrets:
   - Name: `CLOUDFLARE_API_TOKEN`, Value: (paste the token from Step 2)
   - Name: `CLOUDFLARE_ACCOUNT_ID`, Value: (paste the ID from Step 1)

### Step 4: Create Cloudflare Pages Project

Run this command in your terminal:

```bash
cd sveltekit-app
npx wrangler pages project create kiokun --production-branch=main
```

### Step 5: Push to GitHub

The workflow file `.github/workflows/deploy-cloudflare-pages.yml` is already created.

Just push to main:

```bash
git add .github/workflows/deploy-cloudflare-pages.yml
git commit -m "Add Cloudflare Pages deployment workflow"
git push origin main
```

The GitHub Action will automatically:
1. Build your SvelteKit app
2. Deploy to Cloudflare Pages
3. Make it available at `kiokun.pages.dev`

---

## 🔍 Verify Deployment

After deployment (either method), verify it works:

1. **Visit your site**: https://kiokun.pages.dev
2. **Check deployment status**:
   - Cloudflare Dashboard: https://dash.cloudflare.com/ → Workers & Pages → kiokun
   - GitHub Actions: https://github.com/Kimeiga/kiokun-data/actions

3. **Test a word page**: https://kiokun.pages.dev/好
   - Open browser console (F12)
   - Should see: `[PROD] Fetching from: https://cdn.jsdelivr.net/gh/...`
   - Data should load from jsDelivr CDN

---

## 🎨 Custom Domain (Optional)

If you want to use a custom domain like `dictionary.kiokun.com`:

1. Go to Cloudflare Dashboard → Workers & Pages → kiokun
2. Click **Custom domains**
3. Click **Set up a custom domain**
4. Enter your domain
5. Follow the DNS setup instructions

---

## 🐛 Troubleshooting

### Build Fails

**Check build logs:**
- Cloudflare Dashboard: Workers & Pages → kiokun → Deployments → (click deployment) → View logs
- GitHub Actions: Actions tab → (click workflow run) → View logs

**Common issues:**
- Missing dependencies: Make sure `package-lock.json` is committed
- Build command wrong: Should be `npm run build` in `sveltekit-app` directory
- Output directory wrong: Should be `.svelte-kit/cloudflare`

### Site Shows 404

**Possible causes:**
1. Build output directory is wrong (should be `.svelte-kit/cloudflare`)
2. SvelteKit adapter is wrong (should be `@sveltejs/adapter-cloudflare`)
3. Build failed - check logs

**Fix:**
```bash
cd sveltekit-app
npm run build
ls -la .svelte-kit/cloudflare/  # Should show _worker.js and other files
```

### Data Not Loading

**Check browser console:**
- Should see `[PROD] Fetching from: https://cdn.jsdelivr.net/gh/...`
- If you see `[DEV]`, the environment detection is wrong

**Verify jsDelivr URLs work:**
```bash
curl -I https://cdn.jsdelivr.net/gh/Kimeiga/japanese-dict-han-1char@main/好.json
```

Should return `200 OK`. If it returns `404`, the dictionary build hasn't completed yet.

---

## 📊 Monitoring

### View Analytics

1. Go to Cloudflare Dashboard → Workers & Pages → kiokun
2. Click **Analytics** tab
3. View:
   - Requests per second
   - Bandwidth usage
   - Geographic distribution
   - Error rates

### View Deployment History

1. Go to Cloudflare Dashboard → Workers & Pages → kiokun
2. Click **Deployments** tab
3. See all deployments with:
   - Commit hash
   - Build time
   - Deployment status
   - Preview URLs

---

## 🚀 Next Steps

After deployment:

1. ✅ Test the site at `kiokun.pages.dev`
2. ✅ Verify data loads from jsDelivr
3. ✅ Test search functionality
4. ✅ Test word pages (好, 地図, etc.)
5. ✅ Check browser console for errors
6. ✅ Test on mobile devices
7. ✅ Set up custom domain (optional)

---

## 📝 Summary

**Recommended Setup:**
- Use **Option 1** (Cloudflare Dashboard) for easiest setup
- Takes ~2 minutes
- No secrets needed
- Automatic deployments on push to main
- Site available at: **https://kiokun.pages.dev**

**Current Status:**
- ✅ SvelteKit app configured with Cloudflare adapter
- ✅ Environment detection implemented (dev vs prod)
- ✅ GitHub Actions workflow created (backup option)
- ⏳ Waiting for you to connect GitHub repo in Cloudflare Dashboard

**What Happens Next:**
1. You connect the repo in Cloudflare Dashboard
2. Cloudflare builds and deploys automatically
3. Site goes live at `kiokun.pages.dev`
4. Future pushes to `main` auto-deploy
5. Pull requests get preview deployments

🎉 **You're ready to deploy!**

