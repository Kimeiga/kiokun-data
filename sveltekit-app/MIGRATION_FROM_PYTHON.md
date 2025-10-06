# Migration from Python Webapp

This document explains how the new SvelteKit app replaces the old Python webapp.

## Old Architecture (webapp/)

```
webapp/
├── server.py              # Python HTTP server
├── index.html             # Static HTML with inline JS
└── output_dictionary/     # JSON files served statically
    ├── 的.json
    ├── 和.json
    └── ...
```

**How it worked:**
1. Python server serves `index.html` for all routes
2. Client-side JavaScript reads URL path (e.g., `/的`)
3. Fetches `/output_dictionary/的.json`
4. Renders dictionary entry in browser

**Limitations:**
- No database (just static JSON files)
- No user accounts or authentication
- No note-taking functionality
- No image uploads
- Manual server management
- Not production-ready

## New Architecture (sveltekit-app/)

```
sveltekit-app/
├── src/
│   ├── routes/
│   │   ├── +page.svelte           # Home page
│   │   └── api/
│   │       ├── notes/+server.ts   # Notes API
│   │       └── uploads/+server.ts # Upload API
│   └── lib/
│       └── components/            # Reusable components
├── migrations/
│   └── 0001_init.sql             # Database schema
└── wrangler.toml                 # Cloudflare config
```

**How it works:**
1. SvelteKit handles routing automatically
2. Server endpoints provide APIs for notes and uploads
3. D1 database stores user notes
4. R2 storage holds uploaded images
5. Cloudflare Pages hosts everything

**Advantages:**
- ✅ Database for persistent storage
- ✅ File uploads to R2
- ✅ Production-ready hosting
- ✅ Auto-deploy from GitHub
- ✅ Scalable (edge computing)
- ✅ Free tier (15 GB storage)

## Feature Comparison

| Feature | Old (Python) | New (SvelteKit) |
|---------|--------------|-----------------|
| **Hosting** | Manual server | Cloudflare Pages (auto-deploy) |
| **Routing** | Python + JS | SvelteKit file-based routing |
| **Data Storage** | Static JSON files | D1 database (5 GB free) |
| **File Storage** | None | R2 object storage (10 GB free) |
| **User Notes** | ❌ No | ✅ Yes |
| **Image Uploads** | ❌ No | ✅ Yes |
| **Authentication** | ❌ No | 🔜 Ready to add |
| **Scalability** | Limited | Unlimited (edge) |
| **Cost** | Server costs | Free tier (15 GB) |
| **Deployment** | Manual | Auto (GitHub push) |

## How to Adapt for Dictionary App

The current SvelteKit app is a notes app, but you can easily adapt it for your dictionary:

### Option 1: Keep Static JSON Files

You can still serve your dictionary JSON files statically:

1. Copy `output_dictionary/` to `sveltekit-app/static/dictionary/`
2. Create a route: `src/routes/[character]/+page.svelte`
3. Fetch the JSON file in the page:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  
  let character = $page.params.character;
  let data = $state(null);
  
  onMount(async () => {
    const response = await fetch(`/dictionary/${character}.json`);
    data = await response.json();
  });
</script>

{#if data}
  <div class="dictionary-entry">
    <h1>{character}</h1>
    <!-- Display dictionary data -->
  </div>
{/if}
```

### Option 2: Store Dictionary in D1

For better performance and search capabilities:

1. Create a migration to import dictionary data:

```sql
CREATE TABLE dictionary_entries (
  character TEXT PRIMARY KEY,
  data TEXT NOT NULL  -- JSON string
);

-- Import your data
INSERT INTO dictionary_entries (character, data) VALUES
  ('的', '{"chinese_words": [...], ...}'),
  ('和', '{"chinese_words": [...], ...}');
```

2. Create an API endpoint:

```typescript
// src/routes/api/dictionary/[character]/+server.ts
export const GET: RequestHandler = async ({ params, platform }) => {
  const result = await platform.env.DB
    .prepare('SELECT data FROM dictionary_entries WHERE character = ?')
    .bind(params.character)
    .first();
  
  return json(JSON.parse(result.data));
};
```

### Option 3: Hybrid Approach (Recommended)

Combine both:
- **Dictionary data:** Static JSON files (fast, no database queries)
- **User notes:** D1 database (per-character notes)
- **User images:** R2 storage (screenshots, mnemonics)

**Example structure:**
```
src/routes/
├── +page.svelte                    # Home (search/browse)
├── [character]/
│   ├── +page.svelte               # Dictionary entry
│   └── +page.server.ts            # Load dictionary + user notes
└── api/
    ├── notes/+server.ts           # User notes CRUD
    └── uploads/+server.ts         # Image uploads
```

**Page load:**
```typescript
// src/routes/[character]/+page.server.ts
export const load: PageServerLoad = async ({ params, platform }) => {
  // Load dictionary data (static)
  const dictResponse = await fetch(`/dictionary/${params.character}.json`);
  const dictData = await dictResponse.json();
  
  // Load user notes (D1) - requires auth
  const notes = await platform.env.DB
    .prepare('SELECT * FROM notes WHERE character = ? AND user_id = ?')
    .bind(params.character, userId)
    .all();
  
  return {
    character: params.character,
    dictionary: dictData,
    userNotes: notes.results
  };
};
```

## Migration Steps

### Phase 1: Set Up Infrastructure
1. ✅ Create SvelteKit app (done!)
2. ✅ Set up D1 database (done!)
3. ✅ Set up R2 storage (done!)
4. ✅ Deploy to Cloudflare Pages (ready!)

### Phase 2: Add Dictionary Features
1. Copy dictionary JSON files to `static/dictionary/`
2. Create `[character]` route for dictionary entries
3. Reuse your existing HTML/CSS from `webapp/index.html`
4. Test with a few characters

### Phase 3: Add User Features
1. Add authentication (Clerk, Auth0, or custom)
2. Link notes to user accounts
3. Add per-character notes
4. Add image uploads for mnemonics

### Phase 4: Polish
1. Add search functionality
2. Add favorites/bookmarks
3. Add study progress tracking
4. Add spaced repetition

## Code Reuse

You can reuse most of your existing HTML/CSS:

**Old (webapp/index.html):**
```html
<div class="character">的</div>
<div class="definitions">
  <!-- Dictionary content -->
</div>
```

**New (src/routes/[character]/+page.svelte):**
```svelte
<script lang="ts">
  let { data } = $props();
</script>

<div class="character">{data.character}</div>
<div class="definitions">
  <!-- Same HTML structure -->
</div>

<style>
  /* Copy your existing CSS here */
  .character {
    font-size: 96px;
    /* ... */
  }
</style>
```

## Benefits of Migration

### For Users
- ✅ Can take notes on each character
- ✅ Can upload images (mnemonics, examples)
- ✅ Notes sync across devices
- ✅ Faster page loads (edge computing)

### For You (Developer)
- ✅ No server management
- ✅ Auto-deploy from GitHub
- ✅ Free hosting (15 GB storage)
- ✅ Scalable (handles millions of users)
- ✅ Modern development experience
- ✅ TypeScript type safety

### For Future
- ✅ Easy to add authentication
- ✅ Easy to add user accounts
- ✅ Easy to add premium features
- ✅ Easy to add mobile app (same API)

## Next Steps

1. **Test the current notes app:**
   ```bash
   cd sveltekit-app
   npm install
   npm run dev
   ```

2. **Adapt for dictionary:**
   - Copy dictionary JSON files
   - Create `[character]` route
   - Reuse your HTML/CSS

3. **Add authentication:**
   - Choose provider (Clerk recommended)
   - Add user accounts
   - Link notes to users

4. **Deploy to production:**
   - Push to GitHub
   - Connect to Cloudflare Pages
   - Done!

## Questions?

- **Q: Can I keep using static JSON files?**
  - A: Yes! Put them in `static/dictionary/` and fetch them normally.

- **Q: Do I need to migrate all at once?**
  - A: No! You can run both apps side-by-side during migration.

- **Q: What about my existing users?**
  - A: No existing users yet, so no migration needed!

- **Q: Is this more complex than Python?**
  - A: Initially yes, but much more powerful and production-ready.

- **Q: Can I still use the Python server?**
  - A: Yes, for local development. But SvelteKit is better for production.

## Resources

- [SvelteKit Routing](https://kit.svelte.dev/docs/routing)
- [Cloudflare D1 Guide](https://developers.cloudflare.com/d1/get-started/)
- [Cloudflare R2 Guide](https://developers.cloudflare.com/r2/get-started/)
- [SvelteKit + Cloudflare](https://kit.svelte.dev/docs/adapter-cloudflare)

