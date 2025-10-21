# Migration to 10-Shard System - Frontend Changes

## Overview
This document outlines the frontend changes made to support the new optimized 10-shard system for the Kiokun Dictionary.

## Changes Made

### 1. Updated `shard-utils.ts`
**File**: `sveltekit-app/src/lib/shard-utils.ts`

#### Key Changes:
- **Simplified sharding logic**: From 23 complex shards to 10 logical shards
- **New URL structure**: Uses `kiokun2-dict-*` repositories
- **Improved documentation**: Comprehensive inline documentation for future developers
- **Hash-based distribution**: Ensures even load balancing

#### New Functions:
```typescript
// NEW: Get shard name for a word
getShardName(word: string): string

// UPDATED: Uses kiokun2-dict-* repositories
getJsDelivrUrl(word: string): string

// SIMPLIFIED: Always uses jsDelivr CDN
getDictionaryUrl(word: string): string
```

#### Removed Functions:
- `getR2Url()` - No longer needed (R2 migration complete)
- Complex 23-shard logic - Simplified to 10 shards

### 2. Shard Distribution Logic

#### Old System (23 shards):
- Complex length and Unicode range-based distribution
- Required 23 different repository names
- Inconsistent file counts across shards

#### New System (10 shards):
- Simple Han character count-based distribution
- Hash-based load balancing for even distribution
- Consistent file counts (30K-45K per shard)

```typescript
// Example routing:
"hello"     → kiokun2-dict-non-han
"人"        → kiokun2-dict-han-1char-1 (or han-1char-2)
"你好"      → kiokun2-dict-han-2char-1/2/3
"中华人民"  → kiokun2-dict-han-3plus-1/2/3
```

## Performance Improvements

### Deployment Speed
- **Old**: 3m12s (23 shards in 3 batches)
- **New**: 1m16s (10 shards all parallel)
- **Improvement**: 61% faster

### Repository Management
- **Old**: 23 repositories to maintain
- **New**: 10 repositories (9 active + 1 reserved)
- **Improvement**: 57% fewer repos

### CDN Performance
- **Consistency**: All shards work reliably with jsDelivr
- **Load balancing**: Hash-based distribution prevents hotspots
- **Caching**: Better cache efficiency with logical grouping

## URL Examples

### Before (23-shard system):
```
https://cdn.jsdelivr.net/gh/Kimeiga/kiokun-dict-han1-len1-1@latest/人.json
https://cdn.jsdelivr.net/gh/Kimeiga/kiokun-dict-han2-len2-4e5f-1@latest/你好.json
```

### After (10-shard system):
```
https://cdn.jsdelivr.net/gh/Kimeiga/kiokun2-dict-han-1char-1@latest/人.json
https://cdn.jsdelivr.net/gh/Kimeiga/kiokun2-dict-han-2char-2@latest/你好.json
```

## Testing

### Verify URL Generation
```typescript
import { getDictionaryUrl, getShardName } from '$lib/shard-utils';

// Test various word types
console.log(getShardName('hello'));    // → 'non-han'
console.log(getShardName('人'));       // → 'han-1char-1' or 'han-1char-2'
console.log(getShardName('你好'));     // → 'han-2char-1/2/3'

// Test URL generation
console.log(getDictionaryUrl('人'));
// → https://cdn.jsdelivr.net/gh/Kimeiga/kiokun2-dict-han-1char-X@latest/人.json
```

### Manual Testing
1. Open browser dev tools
2. Test dictionary lookups for various word types
3. Verify all requests go to `kiokun2-dict-*` repositories
4. Check response times and success rates

## Rollback Plan

If issues arise, revert by:
1. Restore old `shard-utils.ts` from git history
2. Update GitHub Actions to use original 23-shard repositories
3. Frontend will automatically use old URLs

## Monitoring

### Key Metrics to Watch
- **Request success rate**: Should remain >99%
- **Response times**: Should be <100ms globally
- **Error patterns**: Watch for 404s (incorrect shard routing)

### Debug Tools
```typescript
// Add to browser console for debugging
window.debugShard = (word) => {
  const shard = getShardName(word);
  const url = getDictionaryUrl(word);
  console.log(`Word: ${word} → Shard: ${shard} → URL: ${url}`);
};

// Test various words
debugShard('hello');
debugShard('人');
debugShard('你好');
```

## Future Improvements

### Potential Optimizations
1. **Client-side caching**: Cache responses for frequently accessed words
2. **Predictive loading**: Pre-load likely next words
3. **Fallback mechanisms**: Graceful degradation if CDN fails

### Scalability Considerations
- **Reserved shard**: `kiokun2-dict-reserved` ready for expansion
- **Additional shards**: Can add more if individual shards grow too large
- **Alternative CDNs**: Architecture supports switching CDN providers