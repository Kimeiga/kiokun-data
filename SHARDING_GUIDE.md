# Dictionary Sharding Guide

## Overview

The dictionary is split into **4 shards** based on Han character count to enable free hosting via GitHub + jsDelivr CDN. Each shard is stored in a separate GitHub repository and served via jsDelivr's free CDN.

## Sharding Strategy

Files are distributed across 4 shards based on the number of Han (CJK) characters in the key:

| Shard | Han Character Count | Examples | Repository |
|-------|-------------------|----------|------------|
| **non-han** | 0 (no Han chars) | ひらがな, カタカナ, romaji | `Kimeiga/japanese-dict-non-han` |
| **han-1char** | 1 Han character | 好, 地, 的 | `Kimeiga/japanese-dict-han-1char` |
| **han-2char** | 2 Han characters | 地図, 好き, 一人 | `Kimeiga/japanese-dict-han-2char` |
| **han-3plus** | 3+ Han characters | 一把好手, 図書館 | `Kimeiga/japanese-dict-han-3plus` |

### Han Character Detection

Han characters include all CJK Unified Ideographs ranges:
- U+4E00 to U+9FFF (CJK Unified Ideographs)
- U+3400 to U+4DBF (Extension A)
- U+20000 to U+2A6DF (Extension B)
- U+2A700 to U+2B73F (Extension C)
- U+2B740 to U+2B81F (Extension D)
- U+2B820 to U+2CEAF (Extension E)
- U+2CEB0 to U+2EBEF (Extension F)
- U+30000 to U+3134F (Extension G)

## Build System

### Local Build

Build a specific shard:
```bash
cargo run --release --bin merge_dictionaries -- --individual-files --optimize --mode han-1char
```

Build all shards (outputs to `output_dictionary/`):
```bash
cargo run --release --bin merge_dictionaries -- --individual-files --optimize --mode all
```

### GitHub Actions (Matrix Strategy)

The workflow `.github/workflows/build-dictionaries-matrix.yml` builds all 4 shards in parallel:

```yaml
strategy:
  matrix:
    shard-type: [non-han, han-1char, han-2char, han-3plus]
  fail-fast: false
```

**Workflow Steps:**
1. Download dictionary source files (JMdict, KANJIDIC, CC-CEDICT, etc.)
2. Build Rust project
3. Run dictionary build for each shard (parallel)
4. Verify output
5. Clone target repository
6. Sync files to target repository
7. Commit and push

**Timing:**
- Build time per shard: ~15 minutes (parallel)
- Upload time per shard: ~15 minutes (parallel)
- **Total wall-clock time: ~30 minutes** (vs 75 min sequential)

**GitHub Actions Usage:**
- 4 parallel jobs × 30 min = 120 minutes per run
- Free tier: 2000 minutes/month
- **Can run 16 times per month for FREE**
- Overage: $0.008/minute ($3.20 for 20 runs/month)

## Deployment

### Target Repositories

Each shard is deployed to its own GitHub repository:

1. **non-han**: `Kimeiga/japanese-dict-non-han`
2. **han-1char**: `Kimeiga/japanese-dict-han-1char`
3. **han-2char**: `Kimeiga/japanese-dict-han-2char`
4. **han-3plus**: `Kimeiga/japanese-dict-han-3plus`

### jsDelivr CDN URLs

Files are served via jsDelivr CDN:

```
https://cdn.jsdelivr.net/gh/Kimeiga/japanese-dict-{shard}@main/{word}.json
```

**Examples:**
- `https://cdn.jsdelivr.net/gh/Kimeiga/japanese-dict-han-1char@main/好.json`
- `https://cdn.jsdelivr.net/gh/Kimeiga/japanese-dict-han-2char@main/地図.json`
- `https://cdn.jsdelivr.net/gh/Kimeiga/japanese-dict-non-han@main/ひらがな.json`

### Deployment Trigger

Push to `main` branch triggers automatic deployment:

```bash
git add .
git commit -m "Update dictionary data"
git push origin main
```

This will:
1. Build all 4 shards in parallel
2. Upload each shard to its respective repository
3. Files become available on jsDelivr CDN within ~5 minutes

## SvelteKit Integration

### Shard Detection

The SvelteKit app automatically detects which shard a word belongs to:

```typescript
import { getJsDelivrUrl } from '$lib/shard-utils';

// Automatically determines shard and constructs URL
const url = getJsDelivrUrl('好');
// Returns: https://cdn.jsdelivr.net/gh/Kimeiga/japanese-dict-han-1char@main/好.json
```

### Implementation

**File: `sveltekit-app/src/lib/shard-utils.ts`**

```typescript
export function getShardForWord(word: string): ShardType {
  const hanCount = countHanCharacters(word);
  
  if (hanCount === 0) return 'non-han';
  if (hanCount === 1) return 'han-1char';
  if (hanCount === 2) return 'han-2char';
  return 'han-3plus';
}

export function getJsDelivrUrl(word: string): string {
  const shard = getShardForWord(word);
  const repo = `Kimeiga/japanese-dict-${shard}`;
  return `https://cdn.jsdelivr.net/gh/${repo}@main/${word}.json`;
}
```

**File: `sveltekit-app/src/routes/[word]/+page.ts`**

```typescript
import { getJsDelivrUrl } from '$lib/shard-utils';

export const load: PageLoad = async ({ params, fetch }) => {
  const { word } = params;
  const url = getJsDelivrUrl(word);
  const response = await fetch(url);
  // ...
};
```

## Benefits

### ✅ Completely Free
- GitHub: Free public repositories
- jsDelivr: Free CDN with unlimited bandwidth
- GitHub Actions: 2000 free minutes/month (16 deployments)

### ✅ Fast Deployments
- Matrix strategy: 30 minutes (vs 75 min sequential)
- Parallel builds and uploads
- Incremental updates only change affected shards

### ✅ Scalable
- Each shard can be updated independently
- Easy to add more shards if needed
- No single point of failure

### ✅ Global CDN
- jsDelivr serves from 750+ CDN locations worldwide
- Automatic caching and optimization
- 99.9% uptime SLA

## Monitoring

### Verify Deployment

Check if a file is available on jsDelivr:

```bash
curl -I https://cdn.jsdelivr.net/gh/Kimeiga/japanese-dict-han-1char@main/好.json
```

Should return `200 OK` if deployed successfully.

### Check Repository

View files in a shard repository:

```
https://github.com/Kimeiga/japanese-dict-han-1char
```

### GitHub Actions

View workflow runs:

```
https://github.com/Kimeiga/kiokun-data/actions
```

## Troubleshooting

### Build Fails for One Shard

The workflow uses `fail-fast: false`, so other shards continue building. Check the failed shard's logs and re-run just that job.

### jsDelivr Cache Issues

jsDelivr caches files for 7 days. To purge cache:

```
https://purge.jsdelivr.net/gh/Kimeiga/japanese-dict-han-1char@main/好.json
```

### Repository Doesn't Exist

The workflow will create the repository automatically on first run. Make sure the GitHub token has permission to create repositories.

## Future Improvements

### Potential Optimizations

1. **Finer-grained sharding**: Split large shards (e.g., han-3plus) into smaller chunks
2. **Compression**: Use gzip compression for JSON files
3. **Batch updates**: Only rebuild shards with changed source data
4. **CDN alternatives**: Consider Cloudflare R2 for even faster updates

### Monitoring Enhancements

1. **File count tracking**: Monitor number of files per shard over time
2. **Size tracking**: Track total size per shard
3. **Deployment notifications**: Slack/Discord notifications on successful deployment
4. **Error alerts**: Automated alerts for failed builds

## Summary

The sharding system provides:
- **Free hosting** via GitHub + jsDelivr
- **Fast deployments** via parallel matrix builds (30 min)
- **Global CDN** with 750+ locations
- **Scalable architecture** with independent shards
- **Simple integration** with automatic shard detection

Perfect for a dictionary project with frequent updates! 🚀

