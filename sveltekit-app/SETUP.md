# Complete Setup Guide

This guide will walk you through setting up the SvelteKit + Cloudflare (D1 + R2) app from scratch.

## Prerequisites

1. **Node.js 18+** - [Download here](https://nodejs.org/)
2. **Cloudflare Account** - [Sign up here](https://dash.cloudflare.com/sign-up)
3. **Git** - For version control and GitHub deployment

## Step-by-Step Setup

### 1. Install Dependencies

```bash
cd sveltekit-app
npm install
```

### 2. Install Wrangler CLI (if not already installed)

```bash
npm install -g wrangler
```

### 3. Login to Cloudflare

```bash
wrangler login
```

This will open a browser window to authenticate with Cloudflare.

### 4. Create D1 Database

```bash
wrangler d1 create kiokun-notes-db
```

**Important:** Copy the `database_id` from the output. It looks like:
```
✅ Successfully created DB 'kiokun-notes-db' in region WEUR
Created your database using D1's new storage backend.

[[d1_databases]]
binding = "DB"
database_name = "kiokun-notes-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Update `wrangler.toml` with your actual `database_id`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "kiokun-notes-db"
database_id = "YOUR_ACTUAL_DATABASE_ID_HERE"  # Replace this!
```

### 5. Run Database Migrations

For local development:
```bash
wrangler d1 execute kiokun-notes-db --local --file=./migrations/0001_init.sql
```

For production (do this after deploying):
```bash
wrangler d1 execute kiokun-notes-db --remote --file=./migrations/0001_init.sql
```

### 6. Create R2 Bucket

```bash
wrangler r2 bucket create kiokun-images
```

You should see:
```
✅ Created bucket 'kiokun-images' with default storage class set to Standard.
```

### 7. Get R2 API Credentials

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** in the left sidebar
3. Click **"Manage R2 API Tokens"**
4. Click **"Create API Token"**
5. Configure the token:
   - **Token Name:** `kiokun-notes-r2-token`
   - **Permissions:** Select "Object Read & Write"
   - **TTL:** Leave as default or set to "Forever"
6. Click **"Create API Token"**
7. **Copy the credentials** (you won't see them again!):
   - Access Key ID
   - Secret Access Key

8. Get your **Account ID**:
   - Look at your browser URL: `https://dash.cloudflare.com/<ACCOUNT_ID>/r2`
   - The `<ACCOUNT_ID>` is what you need

### 8. Create Local Environment File

Copy the example file:
```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and fill in your actual values:
```env
R2_ACCESS_KEY_ID=your_actual_access_key_id
R2_SECRET_ACCESS_KEY=your_actual_secret_access_key
R2_ACCOUNT_ID=your_actual_account_id
```

**Important:** Never commit `.dev.vars` to git! It's already in `.gitignore`.

### 9. Start Development Server

```bash
npm run dev
```

The app should now be running at `http://localhost:5173`

### 10. Test the App

1. Open `http://localhost:5173` in your browser
2. You should see the Kiokun Notes homepage with 2 sample notes
3. Try creating a new note with text
4. Try uploading an image with a note
5. Try deleting a note

## Deployment to Cloudflare Pages

### Option A: GitHub Integration (Recommended)

#### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: SvelteKit + Cloudflare D1 + R2"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kiokun-notes.git
git push -u origin main
```

#### 2. Connect to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **"Workers & Pages"** in the left sidebar
3. Click **"Create application"** → **"Pages"** → **"Connect to Git"**
4. Select your GitHub repository
5. Configure build settings:
   - **Project name:** `kiokun-notes` (or your choice)
   - **Production branch:** `main`
   - **Framework preset:** SvelteKit
   - **Build command:** `npm run build`
   - **Build output directory:** `.svelte-kit/cloudflare`
6. Click **"Save and Deploy"**

#### 3. Add Bindings in Cloudflare Dashboard

After the first deployment:

1. Go to your Pages project → **Settings** → **Functions**
2. Scroll to **"Bindings"**

**Add D1 Binding:**
- Click **"Add binding"** → **"D1 database"**
- Variable name: `DB`
- D1 database: Select `kiokun-notes-db`
- Click **"Save"**

**Add R2 Binding:**
- Click **"Add binding"** → **"R2 bucket"**
- Variable name: `BUCKET`
- R2 bucket: Select `kiokun-images`
- Click **"Save"**

**Add Environment Variables:**
- Click **"Add variable"** (under Environment Variables section)
- Add these three variables:
  - `R2_ACCESS_KEY_ID` = your access key
  - `R2_SECRET_ACCESS_KEY` = your secret key (mark as "Encrypt")
  - `R2_ACCOUNT_ID` = your account ID
- Click **"Save"**

#### 4. Run Production Database Migration

```bash
wrangler d1 execute kiokun-notes-db --remote --file=./migrations/0001_init.sql
```

#### 5. Redeploy

After adding bindings, trigger a new deployment:
- Go to **Deployments** tab
- Click **"Retry deployment"** on the latest deployment

OR just push a new commit:
```bash
git commit --allow-empty -m "Trigger redeploy"
git push
```

Your app should now be live at `https://kiokun-notes.pages.dev`!

### Option B: Direct Deploy with Wrangler

```bash
# Build the app
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy .svelte-kit/cloudflare --project-name=kiokun-notes
```

Then follow steps 3-5 from Option A to add bindings.

## Troubleshooting

### "Database not available" error

**Cause:** D1 binding not configured or database not created.

**Solution:**
1. Make sure you created the database: `wrangler d1 create kiokun-notes-db`
2. Update `wrangler.toml` with the correct `database_id`
3. Run migrations: `wrangler d1 execute kiokun-notes-db --local --file=./migrations/0001_init.sql`

### "R2 credentials not configured" error

**Cause:** R2 environment variables not set.

**Solution:**
1. Make sure `.dev.vars` exists with correct values (local)
2. Make sure environment variables are set in Cloudflare Dashboard (production)

### Presigned URLs not working

**Cause:** Incorrect R2 credentials or bucket name.

**Solution:**
1. Verify credentials in `.dev.vars` are correct
2. Verify bucket name in `wrangler.toml` matches the actual bucket
3. Check that the bucket was created: `wrangler r2 bucket list`

### Images not displaying

**Cause:** Presigned URLs expired or CORS issues.

**Solution:**
1. Presigned URLs expire after 1 hour by default
2. Refresh the page to get new presigned URLs
3. For production, consider making the bucket public or using longer expiry times

### Build fails on Cloudflare Pages

**Cause:** Missing dependencies or incorrect build settings.

**Solution:**
1. Make sure `package.json` has all dependencies
2. Verify build command is `npm run build`
3. Verify build output directory is `.svelte-kit/cloudflare`
4. Check build logs in Cloudflare Dashboard for specific errors

## Next Steps

Now that your app is running, you can:

1. **Customize the UI** - Edit components in `src/lib/components/`
2. **Add authentication** - Integrate Clerk, Auth0, or build custom auth
3. **Add more features** - Search, tags, categories, etc.
4. **Optimize images** - Add image compression, thumbnails
5. **Add analytics** - Track usage with Cloudflare Analytics

## Resources

- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)

## Getting Help

If you run into issues:

1. Check the [Cloudflare Community](https://community.cloudflare.com/)
2. Check the [SvelteKit Discord](https://svelte.dev/chat)
3. Review the error logs in Cloudflare Dashboard
4. Check browser console for client-side errors

