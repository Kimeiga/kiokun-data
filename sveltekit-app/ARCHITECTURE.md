# Architecture Overview

This document explains how the SvelteKit + Cloudflare (D1 + R2) app works.

## Tech Stack

- **Frontend:** SvelteKit 2.x (Svelte 5 with runes)
- **Backend:** Cloudflare Workers (via SvelteKit server endpoints)
- **Database:** Cloudflare D1 (SQLite)
- **File Storage:** Cloudflare R2 (S3-compatible)
- **Hosting:** Cloudflare Pages
- **Adapter:** `@sveltejs/adapter-cloudflare`

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              SvelteKit Frontend                       │  │
│  │  - +page.svelte (home page)                          │  │
│  │  - UploadForm.svelte (upload UI)                     │  │
│  │  - NoteCard.svelte (display notes)                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP Requests
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Workers (SvelteKit SSR)             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Server Endpoints (API Routes)               │  │
│  │  - GET/POST /api/notes (CRUD operations)            │  │
│  │  - POST /api/uploads (presigned URLs)               │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│         ┌──────────────────┴──────────────────┐            │
│         ▼                                      ▼            │
│  ┌─────────────┐                      ┌─────────────┐      │
│  │ D1 Database │                      │  R2 Bucket  │      │
│  │  (SQLite)   │                      │  (Objects)  │      │
│  └─────────────┘                      └─────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Creating a Note with Image

```
1. User fills form → UploadForm.svelte
2. User clicks "Create Note"
3. If image selected:
   a. POST /api/uploads → Get presigned URL
   b. PUT to presigned URL → Upload directly to R2
4. POST /api/notes → Save note + image_key to D1
5. Refresh notes list → GET /api/notes
6. Display notes with images (presigned GET URLs)
```

### Detailed Flow Diagram

```
┌─────────┐
│ Browser │
└────┬────┘
     │
     │ 1. POST /api/uploads
     │    { filename, contentType }
     ▼
┌─────────────────┐
│ /api/uploads    │
│ +server.ts      │
│                 │
│ - Validate file │
│ - Generate key  │
│ - Create        │
│   presigned URL │
└────┬────────────┘
     │
     │ 2. Return { uploadUrl, key }
     ▼
┌─────────┐
│ Browser │
└────┬────┘
     │
     │ 3. PUT to presigned URL
     │    (direct to R2, bypasses server)
     ▼
┌─────────────────┐
│  R2 Bucket      │
│  (kiokun-images)│
│                 │
│ - Store file    │
│ - Return 200 OK │
└─────────────────┘
     │
     │ 4. Upload complete
     ▼
┌─────────┐
│ Browser │
└────┬────┘
     │
     │ 5. POST /api/notes
     │    { text, image_key }
     ▼
┌─────────────────┐
│ /api/notes      │
│ +server.ts      │
│                 │
│ - Insert into   │
│   D1 database   │
└────┬────────────┘
     │
     │ 6. Return { success: true }
     ▼
┌─────────┐
│ Browser │
│         │
│ - Refresh list  │
│ - Display notes │
└─────────┘
```

## File Structure

```
sveltekit-app/
├── src/
│   ├── routes/                    # File-based routing
│   │   ├── +page.svelte          # Home page (/)
│   │   └── api/                  # API endpoints
│   │       ├── notes/
│   │       │   └── +server.ts    # GET/POST/DELETE /api/notes
│   │       └── uploads/
│   │           └── +server.ts    # POST /api/uploads
│   │
│   ├── lib/
│   │   ├── components/           # Reusable components
│   │   │   ├── NoteCard.svelte
│   │   │   └── UploadForm.svelte
│   │   └── utils/
│   │       └── r2-presign.ts     # R2 presigned URL utilities
│   │
│   ├── app.d.ts                  # TypeScript types for platform.env
│   └── app.html                  # HTML template
│
├── migrations/
│   └── 0001_init.sql             # D1 database schema
│
├── static/                       # Static assets
│   └── favicon.png
│
├── wrangler.toml                 # Cloudflare configuration
├── svelte.config.js              # SvelteKit config
├── vite.config.ts                # Vite config
├── package.json
└── tsconfig.json
```

## Key Concepts

### 1. Cloudflare Bindings

Bindings are how you access Cloudflare resources from your code:

```typescript
// In any +server.ts file
export const GET: RequestHandler = async ({ platform }) => {
  // Access D1 database
  const db = platform.env.DB;
  
  // Access R2 bucket
  const bucket = platform.env.BUCKET;
  
  // Access environment variables
  const accessKey = platform.env.R2_ACCESS_KEY_ID;
};
```

Bindings are configured in:
- `wrangler.toml` (for local dev)
- Cloudflare Dashboard → Settings → Functions (for production)

### 2. Presigned URLs

Presigned URLs allow direct browser-to-R2 uploads without going through your server:

**Benefits:**
- Faster uploads (no server bottleneck)
- Lower server costs (no bandwidth through Workers)
- Better scalability

**How it works:**
1. Server generates a temporary signed URL (valid for 1 hour)
2. Browser uploads directly to R2 using that URL
3. Server only stores the file key in the database

```typescript
// Generate presigned URL (server-side)
const uploadUrl = await generatePresignedUploadUrl(
  accessKeyId,
  secretAccessKey,
  accountId,
  'kiokun-images',
  'unique-key.jpg',
  'image/jpeg',
  3600 // expires in 1 hour
);

// Upload from browser (client-side)
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type }
});
```

### 3. D1 Database

D1 is SQLite running on Cloudflare's edge:

```typescript
// Query example
const result = await platform.env.DB
  .prepare('SELECT * FROM notes WHERE id = ?')
  .bind(noteId)
  .first();

// Insert example
await platform.env.DB
  .prepare('INSERT INTO notes (id, text, created_at) VALUES (?, ?, ?)')
  .bind(id, text, timestamp)
  .run();
```

**Schema:**
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  image_key TEXT,
  created_at INTEGER NOT NULL
);
```

### 4. SvelteKit File-Based Routing

Routes are defined by the file structure:

- `src/routes/+page.svelte` → `/`
- `src/routes/api/notes/+server.ts` → `/api/notes`
- `src/routes/api/uploads/+server.ts` → `/api/uploads`

**Server endpoints** (`+server.ts`) export HTTP method handlers:
```typescript
export const GET: RequestHandler = async ({ request, platform }) => {
  // Handle GET request
};

export const POST: RequestHandler = async ({ request, platform }) => {
  // Handle POST request
};
```

### 5. Svelte 5 Runes

This app uses Svelte 5's new runes syntax:

```svelte
<script lang="ts">
  // Reactive state
  let count = $state(0);
  
  // Derived state
  let doubled = $derived(count * 2);
  
  // Props
  let { note }: Props = $props();
</script>
```

## Security Considerations

### 1. Presigned URLs

- URLs expire after 1 hour (configurable)
- Only allow specific operations (PUT for upload, GET for download)
- Validate file types and sizes before generating URLs

### 2. Input Validation

- Validate file types (only images)
- Validate file sizes (max 5MB)
- Sanitize user input before storing in database

### 3. Environment Variables

- Never commit `.dev.vars` to git
- Use encrypted variables in Cloudflare Dashboard for secrets
- Rotate R2 API tokens periodically

### 4. CORS

- R2 buckets are private by default
- Presigned URLs handle CORS automatically
- For public buckets, configure CORS rules in Cloudflare Dashboard

## Performance Optimizations

### 1. Direct-to-R2 Uploads

- Bypasses server for file uploads
- Reduces latency and server load
- Scales infinitely

### 2. Edge Computing

- SvelteKit runs on Cloudflare Workers (edge)
- D1 queries run close to users
- R2 serves files from nearest location

### 3. Caching

- Static assets cached by Cloudflare CDN
- Presigned URLs cached for 1 hour
- Consider adding browser caching headers

## Scaling Considerations

### Free Tier Limits

- **D1:** 5 GB storage, 5M reads/day, 100K writes/day
- **R2:** 10 GB storage, 10M Class A operations/month
- **Workers:** 100K requests/day

### When to Upgrade

- D1: When you exceed 5 GB or need more reads/writes
- R2: When you exceed 10 GB storage
- Workers: When you exceed 100K requests/day

### Cost Estimates (Paid Tier)

- **D1:** $0.75/GB storage, $0.001/1K reads, $1/1M writes
- **R2:** $0.015/GB storage, $4.50/1M Class A operations
- **Workers:** $5/10M requests

For a dictionary app with 10K users:
- Estimated cost: $5-10/month

## Monitoring and Debugging

### Local Development

```bash
# View D1 database
wrangler d1 execute kiokun-notes-db --local --command="SELECT * FROM notes"

# View R2 bucket contents
wrangler r2 object list kiokun-images

# Check logs
npm run dev
# Logs appear in terminal
```

### Production

1. **Cloudflare Dashboard → Workers & Pages → Your Project**
2. Click **"Logs"** tab
3. View real-time logs and errors

### Common Issues

- **"Database not available"** → Check D1 binding
- **"R2 credentials not configured"** → Check environment variables
- **Presigned URLs not working** → Check R2 credentials and bucket name
- **Images not displaying** → URLs expired, refresh page

## Future Enhancements

1. **Authentication** - Add user accounts with Clerk/Auth0
2. **Search** - Full-text search in D1
3. **Tags/Categories** - Organize notes
4. **Image Optimization** - Compress and resize images
5. **Offline Support** - Service worker for offline access
6. **Real-time Sync** - WebSockets for multi-device sync
7. **Analytics** - Track usage with Cloudflare Analytics

