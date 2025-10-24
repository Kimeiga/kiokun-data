# Dictionary Search Feature

This document describes the full-text search feature for searching dictionary definitions in English.

## Overview

The search feature allows users to search for dictionary entries by English definitions when they don't know the exact Chinese or Japanese word. It uses Cloudflare D1 with SQLite FTS5 (Full-Text Search) for fast, efficient searching.

## Architecture

### Components

1. **D1 Database Table** (`dictionary_search`)
   - FTS5 virtual table for full-text search
   - Stores word, language, definition, pronunciation, and commonality
   - Automatically tokenizes and stems English text for better search results

2. **Rust CLI Tool** (`--build-search-index`)
   - Extracts all definitions from Chinese and Japanese dictionaries
   - Outputs CSV file for bulk import into D1
   - Located in `src/search_index_builder.rs`

3. **Search API** (`/api/search`)
   - Queries the FTS5 table
   - Groups results by word
   - Ranks by commonality and relevance
   - Located in `sveltekit-app/src/routes/api/search/+server.ts`

4. **Search Results Page** (`/search`)
   - Displays search results with word, pronunciation, and definitions
   - Shows language badges and commonality indicators
   - Located in `sveltekit-app/src/routes/search/+page.svelte`

5. **Smart Navigation** (`navigateOrSearch`)
   - Tries exact word match first
   - Falls back to search if word not found
   - Located in `sveltekit-app/src/lib/utils/search-navigation.ts`

## Setup Instructions

### 1. Run Database Migration

Create the FTS5 search table:

```bash
cd sveltekit-app

# For local development
wrangler d1 execute kiokun-notes-db --local --file=migrations/0002_search_index.sql

# For production
wrangler d1 execute kiokun-notes-db --remote --file=migrations/0002_search_index.sql
```

### 2. Build Search Index

Generate the CSV file with all searchable definitions:

```bash
cd ..  # Back to project root
cargo run --release --bin build_dictionary -- --build-search-index
```

This will:
- Load Chinese and Japanese dictionaries
- Extract all definitions
- Output `output_search_index.csv` (~500MB with all definitions)
- Print import instructions

### 3. Import Data into D1

Import the CSV into the D1 database:

```bash
cd sveltekit-app

# For local development
wrangler d1 execute kiokun-notes-db --local --command=".mode csv" --command=".import ../output_search_index.csv dictionary_search"

# For production
wrangler d1 execute kiokun-notes-db --remote --command=".mode csv" --command=".import ../output_search_index.csv dictionary_search"
```

**Note:** The import may take several minutes depending on the size of the CSV file.

### 4. Verify the Import

Check that data was imported successfully:

```bash
# Local
wrangler d1 execute kiokun-notes-db --local --command="SELECT COUNT(*) FROM dictionary_search"

# Production
wrangler d1 execute kiokun-notes-db --remote --command="SELECT COUNT(*) FROM dictionary_search"
```

You should see a count of several hundred thousand entries.

## Usage

### User Experience

1. **Exact Match**: User types "地図" → Goes directly to the word page
2. **No Match**: User types "map" → Redirects to `/search?q=map` with results
3. **Search Page**: Shows all words with "map" in their definitions

### Search Behavior

- **Tokenization**: Searches are automatically tokenized (e.g., "running" matches "run")
- **Stemming**: Porter stemming applied (e.g., "running" matches "runs", "ran")
- **Ranking**: Results ranked by:
  1. Common words first (Japanese `is_common` flag)
  2. FTS5 relevance score (how well the query matches)

### API Usage

```typescript
// Search for definitions containing "hello"
const response = await fetch('/api/search?q=hello&limit=20');
const data = await response.json();

// Response format:
{
  query: "hello",
  results: [
    {
      word: "こんにちは",
      language: "japanese",
      pronunciation: "こんにちは",
      definitions: ["hello", "good day", "good afternoon"],
      is_common: true
    },
    // ... more results
  ],
  total: 15
}
```

## Data Structure

### FTS5 Table Schema

```sql
CREATE VIRTUAL TABLE dictionary_search USING fts5(
  word,              -- The dictionary word (e.g., "地図", "好")
  language,          -- 'chinese' or 'japanese'
  definition,        -- English definition text
  pronunciation,     -- Pinyin for Chinese, kana for Japanese
  is_common,         -- 1 for common words, 0 for uncommon
  tokenize = 'porter unicode61'
);
```

### CSV Format

```csv
word,language,definition,pronunciation,is_common
地図,japanese,map,ちず,1
好,chinese,good,hǎo,0
```

## Performance Considerations

### Database Size

- **Entries**: ~500,000+ searchable definitions
- **Storage**: ~50-100MB in D1 (compressed)
- **Query Speed**: <100ms for most searches

### Optimization Tips

1. **Limit Results**: Default limit is 20, max is 100
2. **Common Words First**: Common words ranked higher
3. **Grouping**: Results grouped by word to avoid duplicates

## Maintenance

### Updating the Index

When dictionary data changes:

1. Rebuild the search index:
   ```bash
   cargo run --release --bin build_dictionary -- --build-search-index
   ```

2. Clear the old data:
   ```bash
   wrangler d1 execute kiokun-notes-db --remote --command="DELETE FROM dictionary_search"
   ```

3. Re-import the CSV:
   ```bash
   wrangler d1 execute kiokun-notes-db --remote --command=".mode csv" --command=".import ../output_search_index.csv dictionary_search"
   ```

### Monitoring

Check search performance in Cloudflare dashboard:
- D1 Analytics → Query performance
- Look for slow queries (>1s)
- Monitor database size

## Troubleshooting

### "Database not available" Error

- Check that D1 binding is configured in `wrangler.toml`
- Verify database exists: `wrangler d1 list`
- Check migration was run: `wrangler d1 execute kiokun-notes-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"`

### No Search Results

- Verify data was imported: `wrangler d1 execute kiokun-notes-db --remote --command="SELECT COUNT(*) FROM dictionary_search"`
- Check FTS5 table exists: `wrangler d1 execute kiokun-notes-db --remote --command="SELECT * FROM dictionary_search LIMIT 1"`
- Try a simple query: `/api/search?q=hello`

### Slow Searches

- Reduce limit parameter
- Check D1 analytics for query performance
- Consider adding more specific search terms

## Future Enhancements

Potential improvements:

1. **Autocomplete**: Suggest words as user types
2. **Advanced Filters**: Filter by language, commonality, part of speech
3. **Search History**: Save recent searches
4. **Fuzzy Matching**: Handle typos and misspellings
5. **Phrase Search**: Search for exact phrases
6. **Wildcard Search**: Support `*` and `?` wildcards

## Related Files

- Migration: `sveltekit-app/migrations/0002_search_index.sql`
- Rust Builder: `src/search_index_builder.rs`
- API Endpoint: `sveltekit-app/src/routes/api/search/+server.ts`
- Search Page: `sveltekit-app/src/routes/search/+page.svelte`
- Navigation Util: `sveltekit-app/src/lib/utils/search-navigation.ts`
- Header Component: `sveltekit-app/src/lib/components/Header.svelte`
- Home Page: `sveltekit-app/src/routes/+page.svelte`

