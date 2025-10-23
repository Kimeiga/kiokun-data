# Authentication Setup Guide

This guide will help you set up Google OAuth authentication with Better Auth and Drizzle ORM.

## Prerequisites

- A Google Cloud Platform account
- Cloudflare account with D1 database access

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Configure the OAuth consent screen if you haven't already:
   - User Type: External (for testing) or Internal (for organization)
   - Fill in app name, user support email, and developer contact
   - Add scopes: `email`, `profile`, `openid`
6. Create OAuth 2.0 Client ID:
   - Application type: **Web application**
   - Name: `Kiokun Dictionary`
   - Authorized JavaScript origins:
     - `http://localhost:5173` (for local development)
     - `https://your-production-domain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:5173/api/auth/callback/google` (for local)
     - `https://your-production-domain.com/api/auth/callback/google` (for production)
7. Copy the **Client ID** and **Client Secret**

## Step 2: Set Up Cloudflare D1 Database

### Create the database

```bash
cd sveltekit-app
wrangler d1 create kiokun-notes-db
```

This will output a database ID. Copy it and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "kiokun-notes-db"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with the actual ID
```

### Run migrations locally

```bash
wrangler d1 execute kiokun-notes-db --local --file=./migrations/0000_misty_sleeper.sql
```

### Run migrations in production

```bash
wrangler d1 execute kiokun-notes-db --remote --file=./migrations/0000_misty_sleeper.sql
```

## Step 3: Configure Environment Variables

### Local Development

1. Copy `.dev.vars.example` to `.dev.vars`:
   ```bash
   cp .dev.vars.example .dev.vars
   ```

2. Edit `.dev.vars` and fill in your values:
   ```
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   BASE_URL=http://localhost:5173
   ADMIN_EMAIL=your_email@gmail.com
   ```

### Production (Cloudflare Pages)

1. Go to your Cloudflare Pages project
2. Navigate to **Settings** → **Environment variables**
3. Add the following variables:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
   - `BASE_URL`: Your production URL (e.g., `https://kiokun.pages.dev`)
   - `ADMIN_EMAIL`: Your admin email address

## Step 4: Test Authentication

1. Start the development server:
   ```bash
   npm run dev
   ```

2. The auth button should appear in your app (you'll need to add it to your layout)

3. Click "Sign in with Google" and test the OAuth flow

## Step 5: Add Auth Button to Your Layout

Add the `AuthButton` component to your main layout:

```svelte
<script>
  import AuthButton from '$lib/components/AuthButton.svelte';
</script>

<header>
  <nav>
    <!-- Your existing nav items -->
    <AuthButton />
  </nav>
</header>
```

## Using Authentication in Your App

### Check if user is logged in (client-side)

```svelte
<script lang="ts">
  import { useSession } from '$lib/auth-client';
  
  const session = useSession();
</script>

{#if $session.data?.user}
  <p>Welcome, {$session.data.user.name}!</p>
{:else}
  <p>Please sign in</p>
{/if}
```

### Check if user is logged in (server-side)

In any `+page.server.ts` or `+server.ts`:

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/');
  }
  
  return {
    user: locals.user,
    isAdmin: locals.isAdmin
  };
};
```

### Protect API routes

```typescript
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';

export async function POST({ locals }: RequestEvent) {
  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }
  
  // Your API logic here
}
```

## Database Schema

The following tables are created:

- **user**: Stores user information (id, name, email, image, etc.)
- **session**: Stores active sessions
- **account**: Stores OAuth provider information
- **verification**: Stores verification tokens
- **notes**: Stores user notes (with userId foreign key)

## Admin Users

Users with the email matching `ADMIN_EMAIL` environment variable will have `locals.isAdmin = true`.

You can check this in your code:

```typescript
if (locals.isAdmin) {
  // Admin-only functionality
}
```

## Troubleshooting

### "Redirect URI mismatch" error

Make sure your redirect URI in Google Cloud Console exactly matches:
- Local: `http://localhost:5173/api/auth/callback/google`
- Production: `https://your-domain.com/api/auth/callback/google`

### Database not found

Make sure you've:
1. Created the D1 database with `wrangler d1 create`
2. Updated the `database_id` in `wrangler.toml`
3. Run the migrations with `wrangler d1 execute`

### Session not persisting

Check that:
1. Cookies are enabled in your browser
2. You're using HTTPS in production (required for secure cookies)
3. The `BASE_URL` environment variable is set correctly

## Next Steps

- Create notes API endpoints (`/api/notes/[character]`)
- Add notes UI components to character pages
- Seed the database with your existing notes from `notes.json`

