# 🚀 Auth Quick Start: Get Authentication Working in 10 Minutes

This is the fastest path to get authentication working. For detailed explanations, see the other documentation files.

## Step 1: Google OAuth (5 minutes)

1. Go to https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure OAuth consent screen:
   - User Type: External
   - App name: Kiokun Dictionary
   - Support email: your email
   - Add scopes: email, profile, openid
6. Create OAuth 2.0 Client ID:
   - Type: **Web application**
   - Name: Kiokun
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5173/api/auth/callback/google`
7. **Copy the Client ID and Client Secret**

## Step 2: Database (2 minutes)

```bash
cd sveltekit-app

# Create database
wrangler d1 create kiokun-notes-db

# Copy the database_id from the output
# Update wrangler.toml line 10 with your database_id

# Run migration
wrangler d1 execute kiokun-notes-db --local --file=./migrations/0000_misty_sleeper.sql
```

## Step 3: Environment Variables (1 minute)

```bash
# Copy example file
cp .dev.vars.example .dev.vars

# Edit .dev.vars and add your Google credentials:
# GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=your_client_secret
# BASE_URL=http://localhost:5173
# ADMIN_EMAIL=your_email@gmail.com
```

## Step 4: Add to Your App (2 minutes)

**Option A: Quick test (just add auth button to existing layout)**

Edit `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import AuthButton from '$lib/components/AuthButton.svelte';
  // ... your existing code
</script>

<!-- Add this somewhere in your header/nav -->
<AuthButton />

<!-- ... rest of your layout -->
```

**Option B: Full integration (add notes to character pages)**

Edit `src/routes/[word]/+page.svelte` and add at the bottom:

```svelte
<script lang="ts">
  import Notes from '$lib/components/Notes.svelte';
  import { page } from '$app/stores';
  // ... your existing code
</script>

<!-- ... your existing character display code ... -->

<!-- Add this at the bottom -->
<Notes character={$page.params.word} />
```

## Step 5: Test (1 minute)

```bash
npm run dev
```

1. Visit http://localhost:5173
2. Click "Sign in with Google"
3. Authorize the app
4. You should see your name/avatar
5. Navigate to a character page (if you added Notes component)
6. Try creating a note

## ✅ Done!

If everything worked, you now have:
- ✅ Google OAuth authentication
- ✅ User sessions stored in D1
- ✅ Notes functionality (if you added it)
- ✅ Admin role (your email)

## 🚨 Troubleshooting

### "Redirect URI mismatch"
Make sure your Google OAuth redirect URI is **exactly**: `http://localhost:5173/api/auth/callback/google`

### "Database not found"
1. Check you ran `wrangler d1 create kiokun-notes-db`
2. Check you updated the `database_id` in `wrangler.toml`
3. Check you ran the migration

### "Session not persisting"
1. Check `.dev.vars` has the correct values
2. Check cookies are enabled in your browser
3. Try clearing cookies and signing in again

### Still not working?
See `AUTH_SETUP.md` for detailed troubleshooting.

## 📦 Production Deployment

When you're ready to deploy:

1. **Run migration on production database:**
   ```bash
   wrangler d1 execute kiokun-notes-db --remote --file=./migrations/0000_misty_sleeper.sql
   ```

2. **Add environment variables in Cloudflare Pages:**
   - Go to your Cloudflare Pages project
   - Settings → Environment Variables
   - Add: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BASE_URL`, `ADMIN_EMAIL`

3. **Update Google OAuth redirect URIs:**
   - Add your production URL: `https://your-domain.com/api/auth/callback/google`

4. **Deploy:**
   ```bash
   npm run deploy
   ```

## 📚 Next Steps

- Read `INTEGRATION_GUIDE.md` for more integration options
- Read `BETTER_AUTH_IMPLEMENTATION.md` to understand how it works
- Customize the UI components to match your design
- Add more features!

---

**That's it!** You should now have a working authentication system. 🎉

