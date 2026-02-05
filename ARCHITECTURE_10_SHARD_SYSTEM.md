# Kiokun Dictionary - 30-Shard Architecture with Subdirectories

## Overview

The Kiokun Dictionary uses an optimized 30-shard system with 256 subdirectories per shard to distribute ~435,000 dictionary files across GitHub repositories for global CDN delivery via jsDelivr.

This architecture was designed to address GitHub's limits on:
1. **Files per directory**: Each subdirectory has ~40-50 files (vs 45K+ before)
2. **Commit tree size**: Each repo has ~10-13K files (vs 45K+ before)
3. **Repository operations**: Smaller repos = faster git operations

## Architecture Benefits

### Performance
- **Parallel deployment**: All 30 shards deploy simultaneously
- **Global CDN**: jsDelivr provides worldwide fast access
- **Zero cost**: $0/month (vs ~$30+/month with Cloudflare R2)
- **GitHub-friendly**: Well within all GitHub limits

### Reliability
- **Under jsDelivr limits**: Each repo <50MB for individual file access
- **Hash-based distribution**: Even load balancing across shards and subdirectories
- **Future-proof**: 2 reserved shards for growth
- **Consistent performance**: No single points of failure

## Shard Distribution

### Non-Han Shards (4 shards, ~11K files each)
| Shard | Repository | Files | Content Type |
|-------|------------|-------|--------------|
| 1 | `kiokun2-dict-non-han-1` | ~11K | English, kana, symbols |
| 2 | `kiokun2-dict-non-han-2` | ~11K | English, kana, symbols |
| 3 | `kiokun2-dict-non-han-3` | ~11K | English, kana, symbols |
| 4 | `kiokun2-dict-non-han-4` | ~11K | English, kana, symbols |

### Han 1-Character Shards (8 shards, ~11K files each)
| Shard | Repository | Files | Content Type |
|-------|------------|-------|--------------|
| 5-12 | `kiokun2-dict-han-1char-{1-8}` | ~11K each | Single Han characters |

### Han 2-Character Shards (8 shards, ~13K files each)
| Shard | Repository | Files | Content Type |
|-------|------------|-------|--------------|
| 13-20 | `kiokun2-dict-han-2char-{1-8}` | ~13K each | 2-character words |

### Han 3+ Character Shards (8 shards, ~12K files each)
| Shard | Repository | Files | Content Type |
|-------|------------|-------|--------------|
| 21-28 | `kiokun2-dict-han-3plus-{1-8}` | ~12K each | 3+ character words |

### Reserved Shards (2 shards, empty)
| Shard | Repository | Files | Content Type |
|-------|------------|-------|--------------|
| 29 | `kiokun2-dict-reserved-1` | 0 | Future growth |
| 30 | `kiokun2-dict-reserved-2` | 0 | Future growth |

## Subdirectory Structure

Each shard uses 256 subdirectories (00-ff) based on the hash of the word:

```
kiokun2-dict-non-han-1/
├── 00/
│   ├── word1.json.deflate
│   └── word2.json.deflate
├── 01/
│   └── word3.json.deflate
├── ...
└── ff/
    └── wordN.json.deflate
```

This results in ~40-50 files per subdirectory, well within GitHub's limits.

## URL Structure

### Production URLs (Raw GitHub)
```
https://raw.githubusercontent.com/Kimeiga/kiokun2-dict-{shard}/main/{subdir}/{word}.json.deflate
```

### Examples
- English: `hello` → `https://raw.githubusercontent.com/Kimeiga/kiokun2-dict-non-han-2/main/a3/hello.json.deflate`
- Single Han: `人` → `https://raw.githubusercontent.com/Kimeiga/kiokun2-dict-han-1char-5/main/7f/人.json.deflate`
- 2-char word: `你好` → `https://raw.githubusercontent.com/Kimeiga/kiokun2-dict-han-2char-3/main/2b/你好.json.deflate`

## Sharding Algorithm

### Logic Flow
1. Count Han characters in the word
2. Apply hash-based distribution for shard selection
3. Calculate subdirectory from hash (first 2 hex digits)
4. Route to appropriate shard and subdirectory

### Implementation (TypeScript)
```typescript
function getShardName(word: string): string {
  const hanCount = countHanCharacters(word);
  const hash = simpleHash(word);

  if (hanCount === 0) {
    const shardNum = (hash % 4) + 1;
    return `non-han-${shardNum}`;
  } else if (hanCount === 1) {
    const shardNum = (hash % 8) + 1;
    return `han-1char-${shardNum}`;
  } else if (hanCount === 2) {
    const shardNum = (hash % 8) + 1;
    return `han-2char-${shardNum}`;
  } else {
    const shardNum = (hash % 8) + 1;
    return `han-3plus-${shardNum}`;
  }
}

function getSubdir(word: string): string {
  const hash = simpleHash(word);
  return (hash & 0xFF).toString(16).padStart(2, '0');
}
```

## Deployment Pipeline

### GitHub Actions Workflow
- **Trigger**: Push to `main` branch (changes to `src/`, `data/`, etc.)
- **Matrix Strategy**: 30 parallel jobs (one per shard)
- **Output**: Individual repositories updated via GitHub API

### Build Process
1. **Compile Rust**: Dictionary merger with optimized field names
2. **Process Data**: Load Chinese, Japanese, and character data
3. **Generate Shards**: Build individual shard with ~10-13K files in 256 subdirectories
4. **Deploy**: Push to respective GitHub repository
5. **CDN**: jsDelivr/GitHub automatically updates cache

## Migration History

### Timeline
- **Pre-2025**: Used Cloudflare R2 storage (~$30+/month)
- **2025-01-27**: Migrated to 23-shard GitHub + jsDelivr system
- **2025-01-27**: Optimized to 10-shard system for faster deployment
- **2025-02-05**: Expanded to 30-shard system with subdirectories to address GitHub limits

### Why 30 Shards with Subdirectories?
GitHub Support flagged issues with the 10-shard system:
- **460K+ files in single directory**: Caused timeouts and codeload errors
- **26MB commit tree**: Too large for efficient git operations

The new architecture addresses both:
- **~10-13K files per repo**: Well under any limit
- **~40-50 files per subdirectory**: Trivial for GitHub
- **~6-8MB commit tree per repo**: Much more manageable

## Development

### Local Testing
```bash
# Build specific shard
cargo run --release --bin build_dictionary -- \
  --mode han-1char-1

# Test shard URL generation
npm test shard-utils
```

### Frontend Integration
```typescript
import { getDictionaryUrl } from '$lib/shard-utils';

// Automatically routes to correct shard and subdirectory
const url = await getDictionaryUrl('你好');
const response = await fetch(url);
const data = await response.json();
```

## Monitoring & Troubleshooting

### Health Checks
- Monitor GitHub Actions for deployment failures
- Check jsDelivr CDN availability
- Verify file counts per shard (expected ranges: 10K-15K)

### Common Issues
- **404 errors**: Check word encoding (use `encodeURIComponent`) and subdirectory calculation
- **Slow responses**: jsDelivr cache warming (first requests slower)
- **Build failures**: Check GitHub Action logs for Rust compilation errors

### Performance Metrics
- **Cache hit rate**: >95% after warmup
- **Response time**: <100ms globally (jsDelivr CDN)
- **Availability**: 99.9% (jsDelivr SLA)

## Future Considerations

### Scaling Options
- **Shard splitting**: Can split large shards further if needed
- **Geographic distribution**: jsDelivr handles automatically
- **Data growth**: 2 reserved shards provide expansion capacity

### Alternative CDNs
If jsDelivr limits become restrictive:
- **Statically**: GitHub-based static hosting
- **GitHub Pages**: Direct repository hosting
- **Cloudflare Pages**: Connected to GitHub repositories