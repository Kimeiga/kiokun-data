# Deployment Checklist

Use this checklist to ensure everything is set up correctly before deploying to production.

## Pre-Deployment Checklist

### Local Development

- [ ] **Dependencies installed**
  ```bash
  npm install
  npm install -g wrangler
  ```

- [ ] **Wrangler authenticated**
  ```bash
  wrangler login
  ```

- [ ] **D1 database created**
  ```bash
  wrangler d1 create kiokun-notes-db
  ```

- [ ] **Database ID updated in wrangler.toml**
  - [ ] Copied `database_id` from D1 creation output
  - [ ] Pasted into `wrangler.toml` under `[[d1_databases]]`

- [ ] **Local migrations run**
  ```bash
  wrangler d1 execute kiokun-notes-db --local --file=./migrations/0001_init.sql
  ```

- [ ] **R2 bucket created**
  ```bash
  wrangler r2 bucket create kiokun-images
  ```

- [ ] **R2 API credentials obtained**
  - [ ] Created R2 API token in Cloudflare Dashboard
  - [ ] Copied Access Key ID
  - [ ] Copied Secret Access Key
  - [ ] Noted Account ID from dashboard URL

- [ ] **.dev.vars file created**
  ```bash
  cp .dev.vars.example .dev.vars
  ```

- [ ] **.dev.vars populated with credentials**
  - [ ] `R2_ACCESS_KEY_ID` set
  - [ ] `R2_SECRET_ACCESS_KEY` set
  - [ ] `R2_ACCOUNT_ID` set

- [ ] **Local dev server works**
  ```bash
  npm run dev
  # Visit http://localhost:5173
  ```

- [ ] **Can create notes locally**
  - [ ] Text-only note works
  - [ ] Note with image works
  - [ ] Notes display correctly
  - [ ] Can delete notes

### Code Repository

- [ ] **Git repository initialized**
  ```bash
  git init
  ```

- [ ] **.gitignore is correct**
  - [ ] `.dev.vars` is ignored
  - [ ] `node_modules` is ignored
  - [ ] `.svelte-kit` is ignored

- [ ] **Code committed**
  ```bash
  git add .
  git commit -m "Initial commit: SvelteKit + Cloudflare D1 + R2"
  ```

- [ ] **GitHub repository created**
  - [ ] Created repo on GitHub
  - [ ] Added remote: `git remote add origin <url>`

- [ ] **Code pushed to GitHub**
  ```bash
  git push -u origin main
  ```

## Deployment Checklist

### Cloudflare Pages Setup

- [ ] **Pages project created**
  - [ ] Logged into Cloudflare Dashboard
  - [ ] Navigated to Workers & Pages
  - [ ] Clicked "Create application" → "Pages"
  - [ ] Selected "Connect to Git"
  - [ ] Connected GitHub account
  - [ ] Selected repository

- [ ] **Build settings configured**
  - [ ] Framework preset: **SvelteKit**
  - [ ] Build command: `npm run build`
  - [ ] Build output directory: `.svelte-kit/cloudflare`
  - [ ] Root directory: `/` (or `/sveltekit-app` if in monorepo)

- [ ] **Initial deployment successful**
  - [ ] Build completed without errors
  - [ ] Deployment shows "Success"
  - [ ] Can visit preview URL

### Bindings Configuration

- [ ] **D1 binding added**
  - [ ] Navigated to Settings → Functions
  - [ ] Clicked "Add binding" → "D1 database"
  - [ ] Variable name: `DB`
  - [ ] Selected database: `kiokun-notes-db`
  - [ ] Clicked "Save"

- [ ] **R2 binding added**
  - [ ] Clicked "Add binding" → "R2 bucket"
  - [ ] Variable name: `BUCKET`
  - [ ] Selected bucket: `kiokun-images`
  - [ ] Clicked "Save"

- [ ] **Environment variables added**
  - [ ] Added `R2_ACCESS_KEY_ID` (plain text)
  - [ ] Added `R2_SECRET_ACCESS_KEY` (encrypted)
  - [ ] Added `R2_ACCOUNT_ID` (plain text)
  - [ ] Clicked "Save"

### Production Database

- [ ] **Production migrations run**
  ```bash
  wrangler d1 execute kiokun-notes-db --remote --file=./migrations/0001_init.sql
  ```

- [ ] **Sample data visible in production**
  - [ ] Can query database:
    ```bash
    wrangler d1 execute kiokun-notes-db --remote --command="SELECT * FROM notes"
    ```

### Post-Deployment Testing

- [ ] **Production site accessible**
  - [ ] Visited production URL (e.g., `kiokun-notes.pages.dev`)
  - [ ] Page loads without errors

- [ ] **Sample notes visible**
  - [ ] Can see the 2 sample notes from migration

- [ ] **Can create text note**
  - [ ] Filled in note text
  - [ ] Clicked "Create Note"
  - [ ] Note appears in list

- [ ] **Can upload image**
  - [ ] Selected an image file
  - [ ] Preview shows correctly
  - [ ] Clicked "Create Note"
  - [ ] Note with image appears in list
  - [ ] Image displays correctly

- [ ] **Can delete note**
  - [ ] Clicked "Delete" on a note
  - [ ] Confirmed deletion
  - [ ] Note removed from list

- [ ] **Browser console has no errors**
  - [ ] Opened DevTools → Console
  - [ ] No red errors visible

### Auto-Deploy Testing

- [ ] **Auto-deploy works**
  - [ ] Made a small change (e.g., updated README)
  - [ ] Committed and pushed to GitHub
  - [ ] Cloudflare Pages automatically started build
  - [ ] Build completed successfully
  - [ ] Changes visible on production site

## Production Checklist

### Performance

- [ ] **Page loads quickly**
  - [ ] Initial load < 2 seconds
  - [ ] Images load quickly

- [ ] **No console errors**
  - [ ] Checked browser console
  - [ ] No JavaScript errors

- [ ] **Mobile responsive**
  - [ ] Tested on mobile device or DevTools mobile view
  - [ ] Layout looks good
  - [ ] Touch interactions work

### Security

- [ ] **Environment variables secure**
  - [ ] `.dev.vars` not committed to git
  - [ ] Production secrets marked as "Encrypted" in dashboard

- [ ] **R2 bucket is private**
  - [ ] Bucket not publicly accessible
  - [ ] Only presigned URLs work

- [ ] **File upload validation works**
  - [ ] Can only upload images
  - [ ] File size limit enforced (5MB)

### Monitoring

- [ ] **Cloudflare Analytics enabled**
  - [ ] Can view traffic in dashboard
  - [ ] Can see request counts

- [ ] **Error logging works**
  - [ ] Can view logs in Workers & Pages → Logs
  - [ ] Errors are captured

## Optional Enhancements

### Custom Domain

- [ ] **Custom domain added**
  - [ ] Added domain in Pages settings
  - [ ] Updated DNS records
  - [ ] SSL certificate issued
  - [ ] Domain accessible

### CORS Configuration

- [ ] **R2 CORS configured** (if needed for public access)
  - [ ] Set CORS rules in R2 bucket settings
  - [ ] Tested cross-origin requests

### Monitoring & Alerts

- [ ] **Uptime monitoring** (optional)
  - [ ] Set up external monitoring (e.g., UptimeRobot)
  - [ ] Configured alerts

- [ ] **Error alerts** (optional)
  - [ ] Set up Cloudflare Workers alerts
  - [ ] Configured email notifications

## Troubleshooting

If something doesn't work, check:

1. **Build logs** in Cloudflare Dashboard
2. **Runtime logs** in Workers & Pages → Logs
3. **Browser console** for client-side errors
4. **Network tab** for failed requests

Common issues:

- **"Database not available"** → Check D1 binding
- **"R2 credentials not configured"** → Check environment variables
- **Images not uploading** → Check R2 binding and credentials
- **Build fails** → Check build logs for specific error

## Success Criteria

✅ All checkboxes above are checked
✅ Production site is accessible
✅ Can create, view, and delete notes
✅ Can upload and view images
✅ Auto-deploy works on git push
✅ No console errors
✅ Mobile responsive

## Next Steps After Deployment

1. **Monitor usage** in Cloudflare Dashboard
2. **Add authentication** for user accounts
3. **Add more features** (search, tags, etc.)
4. **Optimize performance** (caching, compression)
5. **Add analytics** (user behavior tracking)

## Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [SvelteKit Deployment](https://kit.svelte.dev/docs/adapter-cloudflare)

---

**Congratulations! 🎉**

Your SvelteKit + Cloudflare app is now live in production!

