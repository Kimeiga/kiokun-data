# Better Auth Setup Checklist

Use this checklist to ensure you've completed all setup steps.

## ✅ Installation (Already Done)

- [x] Installed `better-auth`
- [x] Installed `drizzle-orm`
- [x] Installed `drizzle-kit`
- [x] Generated database schema
- [x] Generated migration file
- [x] Created auth configuration
- [x] Created API routes
- [x] Created hooks
- [x] Created client utilities
- [x] Created UI components

## 📋 Google OAuth Setup (You Need to Do)

- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Create or select a project
- [ ] Enable Google+ API
- [ ] Configure OAuth consent screen
  - [ ] Add app name
  - [ ] Add support email
  - [ ] Add scopes: email, profile, openid
- [ ] Create OAuth 2.0 Client ID
  - [ ] Type: Web application
  - [ ] Add authorized JavaScript origins
  - [ ] Add authorized redirect URIs
- [ ] Copy Client ID
- [ ] Copy Client Secret

## 🗄️ Database Setup (You Need to Do)

### Local Database

- [ ] Run: `wrangler d1 create kiokun-notes-db`
- [ ] Copy the database ID from output
- [ ] Update `database_id` in `wrangler.toml`
- [ ] Run: `wrangler d1 execute kiokun-notes-db --local --file=./migrations/0000_misty_sleeper.sql`
- [ ] Verify tables created: `wrangler d1 execute kiokun-notes-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"`

### Production Database

- [ ] Run: `wrangler d1 execute kiokun-notes-db --remote --file=./migrations/0000_misty_sleeper.sql`
- [ ] Verify tables created: `wrangler d1 execute kiokun-notes-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`

## 🔐 Environment Variables (You Need to Do)

### Local (.dev.vars)

- [ ] Copy `.dev.vars.example` to `.dev.vars`
- [ ] Add `GOOGLE_CLIENT_ID`
- [ ] Add `GOOGLE_CLIENT_SECRET`
- [ ] Set `BASE_URL=http://localhost:5173`
- [ ] Set `ADMIN_EMAIL` to your email

### Production (Cloudflare Pages)

- [ ] Go to Cloudflare Dashboard → Pages → Your Project → Settings → Environment Variables
- [ ] Add `GOOGLE_CLIENT_ID`
- [ ] Add `GOOGLE_CLIENT_SECRET`
- [ ] Add `BASE_URL` (your production URL)
- [ ] Add `ADMIN_EMAIL`

## 🎨 UI Integration (You Need to Do)

- [ ] Add `<AuthButton />` to your layout
- [ ] Add `<Notes character={...} />` to character pages
- [ ] Test sign in flow
- [ ] Test sign out flow
- [ ] Test creating notes
- [ ] Test editing notes
- [ ] Test deleting notes

## 🧪 Testing (You Need to Do)

### Local Testing

- [ ] Run `npm run dev`
- [ ] Visit `http://localhost:5173`
- [ ] Click "Sign in with Google"
- [ ] Verify redirect to Google
- [ ] Authorize the app
- [ ] Verify redirect back to app
- [ ] Verify user info displays
- [ ] Navigate to a character page
- [ ] Create a note
- [ ] Edit the note
- [ ] Delete the note
- [ ] Sign out
- [ ] Verify signed out state

### Production Testing

- [ ] Deploy to Cloudflare Pages
- [ ] Visit production URL
- [ ] Test sign in flow
- [ ] Test notes functionality
- [ ] Verify admin badge appears (if you're admin)
- [ ] Test on mobile device
- [ ] Test in different browsers

## 📊 Optional: Seed Database

- [ ] Create seed script (see INTEGRATION_GUIDE.md)
- [ ] Sign in once to create your user
- [ ] Run seed script to import notes from `notes.json`
- [ ] Verify notes appear on character pages

## 🐛 Troubleshooting

If something doesn't work, check:

- [ ] Browser console for errors
- [ ] Network tab for failed requests
- [ ] Cloudflare Pages logs
- [ ] Database has tables: `wrangler d1 execute kiokun-notes-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"`
- [ ] Environment variables are set correctly
- [ ] Google OAuth redirect URIs match exactly
- [ ] Cookies are enabled in browser

## 📚 Documentation

- [x] Read `AUTH_SETUP.md` for detailed setup instructions
- [x] Read `BETTER_AUTH_IMPLEMENTATION.md` for technical details
- [x] Read `INTEGRATION_GUIDE.md` for integration steps

## ✨ You're Done!

Once all checkboxes are checked, your authentication and notes system should be fully functional!

## Next Steps

Consider adding:
- [ ] Note search functionality
- [ ] Note categories/tags
- [ ] Rich text editor for notes
- [ ] Note export functionality
- [ ] Email notifications for new notes
- [ ] Note reactions/likes
- [ ] Note sharing

