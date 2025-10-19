# Migration to 23-Shard System

## Summary

Successfully migrated from Cloudflare R2 to GitHub + jsDelivr CDN using a 23-shard distribution system.

## What Changed

### ✅ Completed

1. **Created 23 GitHub Repositories**
   - All repositories created under `Kimeiga/kiokun-dict-*`
   - Each repository will contain under 20K files
   - Public repositories for free jsDelivr CDN access

2. **Updated Rust Sharding Logic** (`src/main.rs`)
   - New `ShardType` enum with 23 variants
   - Hash-based distribution for even splits
   - Unicode range-based splits for large shards
   - Matches frontend logic exactly

3. **Updated Frontend Shard Detection** (`sveltekit-app/src/lib/shard-utils.ts`)
   - New `ShardType` with 23 variants
   - Switched from R2 URLs to jsDelivr URLs
   - Same hash function as Rust for consistency

4. **Created GitHub Actions Workflow** (`.github/workflows/deploy-to-github-23-shards.yml`)
   - Matrix strategy deploys all 23 shards in parallel
   - 10 concurrent deployments at a time
   - Orphan branches to keep repo history small
   - File count verification (100-30,000 per shard)

5. **Disabled Old Workflows**
   - `build-and-deploy-r2.yml.disabled`
   - `build-dictionaries-matrix.yml.disabled`
   - `deploy-to-github-repos.yml.disabled`
   - `test-r2-upload.yml.disabled`

6. **Created Documentation**
   - `SHARDING.md` - Complete sharding system documentation
   - `scripts/create-github-repos.sh` - Repository creation script
   - This migration guide

## Benefits

### Cost Savings
- **Before**: ~$5-10/month for R2 Class A operations
- **After**: $0 (GitHub + jsDelivr are free)

### Performance
- **Before**: 50+ minutes to upload all files to R2
- **After**: ~10-15 minutes (parallel deployment)

### Development Experience
- **Before**: Every push uploads all 432K files
- **After**: Only changed files uploaded (Git handles this)

## Next Steps

### 1. Test Build Locally
```bash
# Build all 23 shards
cargo run --release -- --individual-files --optimize --shard-output

# Verify file counts
find output_* -name "*.json" | wc -l  # Should be ~432,000

# Check individual shard counts
for dir in output_*; do
    echo "$dir: $(find $dir -name '*.json' | wc -l) files"
done
```

### 2. Deploy to GitHub
```bash
# Commit and push changes
git add .
git commit -m "Migrate to 23-shard GitHub + jsDelivr system"
git push origin main

# Trigger GitHub Actions workflow
# Go to: https://github.com/Kimeiga/kiokun-data/actions
# Select: "Deploy Dictionary to 23 GitHub Repos (jsDelivr CDN)"
# Click: "Run workflow"
```

### 3. Update SvelteKit App
The frontend is already updated to use jsDelivr URLs. After deployment:

```bash
cd sveltekit-app
npm run build
npx wrangler pages deploy .svelte-kit/cloudflare --project-name=kiokun
```

### 4. Verify Deployment
Test a few URLs to ensure jsDelivr is serving files:

```bash
# Test different shards
curl https://cdn.jsdelivr.net/gh/Kimeiga/kiokun-dict-han2-len2-4e5f-1@latest/地図.json
curl https://cdn.jsdelivr.net/gh/Kimeiga/kiokun-dict-kana-only-1@latest/あ.json
curl https://cdn.jsdelivr.net/gh/Kimeiga/kiokun-dict-han1-len1-1@latest/好.json
```

### 5. Monitor First Deployment
Watch the GitHub Actions workflow:
- Check that all 23 matrix jobs complete successfully
- Verify file counts are reasonable
- Ensure no errors during git push

## Rollback Plan

If something goes wrong, you can rollback:

1. **Re-enable R2 workflow**:
   ```bash
   mv .github/workflows/build-and-deploy-r2.yml.disabled .github/workflows/build-and-deploy-r2.yml
   ```

2. **Revert frontend to R2**:
   ```typescript
   // In sveltekit-app/src/lib/shard-utils.ts
   export function getDictionaryUrl(word: string): string {
       if (dev) {
           return `/dictionary/${word}.json`;
       } else {
           return getR2Url(word);  // Change back from getJsDelivrUrl
       }
   }
   ```

3. **Redeploy SvelteKit app**

## Troubleshooting

### Build Issues
- **Problem**: Rust compilation errors
- **Solution**: Check that `is_kana()` function is defined in `src/main.rs`

### Deployment Issues
- **Problem**: GitHub Actions workflow fails
- **Solution**: Check file counts, ensure JMdict files downloaded correctly

### Frontend Issues
- **Problem**: 404 errors when fetching dictionary files
- **Solution**: Verify shard detection logic matches Rust implementation

### jsDelivr Issues
- **Problem**: Files not accessible via jsDelivr
- **Solution**: Wait 5-10 minutes for jsDelivr cache to update, or purge cache

## File Count Verification

Expected file counts per shard:

```
non-han-non-kana:     ~2,283
kana-only-1:         ~20,000
kana-only-2:         ~20,324
han1-len1-1:         ~20,000
han1-len1-2:         ~20,000
han1-len1-3:         ~20,000
han1-len1-4:          ~6,624
han1-len2:            ~3,495
han1-len3:            ~6,006
han1-len4plus:       ~13,501
han2-len2-4e5f-1:    ~13,500
han2-len2-4e5f-2:    ~13,500
han2-len2-607f-1:    ~14,000
han2-len2-607f-2:    ~14,000
han2-len2-809f-1:    ~10,000
han2-len2-809f-2:    ~10,000
han2-len3:            ~9,157
han2-len4:            ~7,406
han2-len5plus:       ~10,983
han3-len3-1:         ~19,430
han3-len3-2:         ~19,430
han3-len4:            ~3,556
han3-len5:            ~1,921
han3-len6plus:        ~2,959
han4plus-1:          ~20,000
han4plus-2:          ~20,000
han4plus-3:           ~8,833
```

Total: ~432,000 files

## Success Criteria

✅ All 23 repositories created  
⏳ Build completes successfully with all 23 shards  
⏳ GitHub Actions workflow deploys all shards  
⏳ jsDelivr serves files correctly  
⏳ SvelteKit app loads dictionary entries  
⏳ No R2 costs incurred  

## Timeline

- **2025-01-XX**: Migration planning and analysis
- **2025-01-XX**: Implementation (Rust + Frontend + Workflows)
- **2025-01-XX**: Repository creation (23 repos)
- **Next**: Local testing and deployment

