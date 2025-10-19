# Dictionary Sharding System

This document describes the 23-shard system used to distribute dictionary files across GitHub repositories for jsDelivr CDN delivery.

## Overview

The dictionary contains **~432,000 JSON files** which is too large for a single GitHub repository. We split the data into **23 shards**, each containing under 20,000 files, optimized for:

- ✅ **Free hosting** via GitHub + jsDelivr CDN
- ✅ **Fast deployments** (only changed files uploaded)
- ✅ **Parallel deployment** (all 23 shards deploy simultaneously)
- ✅ **No costs** (unlike Cloudflare R2 which charged for uploads)

## Shard Distribution

### Non-Han Shards (2,283 files)
- `non-han-non-kana` - Latin letters, numbers, symbols

### Kana-Only Shards (40,324 files → 2 shards)
- `kana-only-1` - Hiragana + Katakana ア-ゴ (~20K files)
- `kana-only-2` - Katakana サ-ワ (~20K files)

### Han1 Shards (89,626 files → 7 shards)
**1 Han character, length 1** (66,624 files → 4 shards):
- `han1-len1-1` - First 20K (hash-based distribution)
- `han1-len1-2` - Next 20K
- `han1-len1-3` - Next 20K
- `han1-len1-4` - Remaining ~7K

**1 Han character, other lengths** (23,002 files → 3 shards):
- `han1-len2` - 3,495 files
- `han1-len3` - 6,006 files
- `han1-len4plus` - 13,501 files

### Han2 Shards (102,800 files → 9 shards)
**2 Han characters, length 2** (75,254 files → 6 shards by Unicode range):
- `han2-len2-4e5f-1` - U+4E00-U+5FFF, first half (~13.5K)
- `han2-len2-4e5f-2` - U+4E00-U+5FFF, second half (~13.5K)
- `han2-len2-607f-1` - U+6000-U+7FFF, first half (~14K)
- `han2-len2-607f-2` - U+6000-U+7FFF, second half (~14K)
- `han2-len2-809f-1` - U+8000-U+9FFF, first half (~10K)
- `han2-len2-809f-2` - U+8000-U+9FFF, second half (~10K)

**2 Han characters, other lengths** (27,546 files → 3 shards):
- `han2-len3` - 9,157 files
- `han2-len4` - 7,406 files
- `han2-len5plus` - 10,983 files

### Han3 Shards (47,296 files → 5 shards)
**3 Han characters, length 3** (38,860 files → 2 shards):
- `han3-len3-1` - First half (~19.5K, hash-based)
- `han3-len3-2` - Second half (~19.5K)

**3 Han characters, other lengths** (8,436 files → 3 shards):
- `han3-len4` - 3,556 files
- `han3-len5` - 1,921 files
- `han3-len6plus` - 2,959 files

### Han4+ Shards (48,833 files → 3 shards)
- `han4plus-1` - First 20K (hash-based distribution)
- `han4plus-2` - Next 20K
- `han4plus-3` - Remaining ~9K

## Implementation

### Rust (Backend)
The sharding logic is implemented in `src/main.rs`:

```rust
impl ShardType {
    fn from_key(key: &str) -> Self {
        // Determines shard based on:
        // 1. Han character count
        // 2. Total string length
        // 3. Unicode range of first Han character
        // 4. Hash-based distribution for even splits
    }
}
```

### TypeScript (Frontend)
The frontend shard detection is in `sveltekit-app/src/lib/shard-utils.ts`:

```typescript
export function getShardForWord(word: string): ShardType {
    // MUST match Rust implementation exactly
    // Uses same hash function for consistent distribution
}
```

### Hash Function
Both Rust and TypeScript use the same simple hash for consistent distribution:

```
hash = 0
for each character c:
    hash = (hash * 31 + charCode(c)) mod 2^32
```

## GitHub Repositories

All 23 shards are stored in separate GitHub repositories:
- `Kimeiga/kiokun-dict-non-han-non-kana`
- `Kimeiga/kiokun-dict-kana-only-1`
- `Kimeiga/kiokun-dict-kana-only-2`
- ... (20 more)

## Deployment

### Creating Repositories
```bash
./scripts/create-github-repos.sh
```

### Building and Deploying
The GitHub Actions workflow `.github/workflows/deploy-to-github-23-shards.yml` handles:

1. **Build** - Single build with `--shard-output` flag creates all 23 shards
2. **Deploy** - Matrix strategy deploys all 23 shards in parallel (10 at a time)
3. **Verify** - Checks file counts are reasonable (100-30,000 per shard)
4. **Push** - Uses orphan branches to keep repo history small

### Manual Trigger
```bash
# Trigger via GitHub UI: Actions → Deploy Dictionary to 23 GitHub Repos → Run workflow
```

## CDN Access

Files are accessed via jsDelivr CDN:
```
https://cdn.jsdelivr.net/gh/Kimeiga/kiokun-dict-{shard}@latest/{word}.json
```

Example:
```
https://cdn.jsdelivr.net/gh/Kimeiga/kiokun-dict-han2-len2-4e5f-1@latest/地図.json
```

## Performance

- **Build time**: ~10 minutes (single build, all shards)
- **Deploy time**: ~5-10 minutes per shard (parallel deployment)
- **Total deployment**: ~10-15 minutes (vs 50+ minutes with R2)
- **Cost**: $0 (vs ~$5-10/month with R2)

## Verification

After deployment, verify shard distribution:
```bash
cargo run --release -- --individual-files --optimize --shard-output
find output_* -name "*.json" | wc -l  # Should be ~432,000
```

## Migration from R2

The old R2-based system has been disabled:
- ✅ Old workflows renamed to `.disabled`
- ✅ Frontend updated to use jsDelivr instead of R2
- ✅ New 23-shard system implemented

To switch back to R2 (not recommended):
1. Rename `.disabled` workflows back to `.yml`
2. Update `sveltekit-app/src/lib/shard-utils.ts` to use `getR2Url()` instead of `getJsDelivrUrl()`

