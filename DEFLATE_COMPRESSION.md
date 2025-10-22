# Deflate Compression Implementation

## Overview

The Kiokun Dictionary now uses **Deflate level 9 compression** to reduce file sizes by ~66% while maintaining fast decompression in the browser.

## Why Deflate?

After comprehensive benchmarking of compression algorithms (Gzip, Brotli, LZ4, Zstandard, Deflate, Snappy), we chose **Deflate 9** for the best balance:

| Algorithm | Size | Compression | Decompression | Library Size | Notes |
|-----------|------|-------------|---------------|--------------|-------|
| **Deflate 9** | 6.12 KB | 64.1% | ~1ms | 8 KB | ✅ **Best balance** |
| Brotli 11 | 5.13 KB | 69.9% | ~4ms | 60 KB | Best compression, slower |
| Gzip 9 | 6.14 KB | 64.0% | ~1.5ms | 45 KB | Similar to Deflate |
| LZ4 | 8.91 KB | 47.7% | ~0.8ms | 15 KB | Fastest, poor compression |

**Key advantages of Deflate 9:**
- Only 1 KB larger than Brotli 11 (6.12 KB vs 5.13 KB)
- 4x faster decompression (1ms vs 4ms)
- 7.5x smaller library (8 KB vs 60 KB for Brotli)
- Better user experience (faster page loads)

## Implementation

### Backend (Rust)

**File: `Cargo.toml`**
```toml
[dependencies]
flate2 = "1.0"  # For Deflate compression
```

**File: `src/main.rs`**
```rust
use flate2::write::DeflateEncoder;
use flate2::Compression;

// Compress JSON with Deflate level 9
let mut encoder = DeflateEncoder::new(Vec::new(), Compression::best());
encoder.write_all(json_content.as_bytes())?;
let compressed = encoder.finish()?;

// Write to file with .json.deflate extension
std::fs::write(format!("{}.json.deflate", filename), compressed)?;
```

**Output:**
- Files are saved with `.json.deflate` extension
- Example: `好.json.deflate` (10.6 KB compressed, 31.5 KB uncompressed, 66.5% reduction)

### Frontend (SvelteKit)

**File: `sveltekit-app/package.json`**
```json
{
  "dependencies": {
    "fflate": "^0.8.2"  // 8 KB library for Deflate decompression
  }
}
```

**File: `sveltekit-app/src/lib/shard-utils.ts`**
```typescript
export function getJsDelivrUrl(word: string): string {
  const shard = getShardName(word);
  const encodedWord = encodeURIComponent(word);
  // Changed from .json to .json.deflate
  return `https://cdn.jsdelivr.net/gh/Kimeiga/kiokun2-dict-${shard}@latest/${encodedWord}.json.deflate`;
}
```

**File: `sveltekit-app/src/routes/[word]/+page.ts`**
```typescript
import { decompressSync, strFromU8 } from 'fflate';

function decompressAndParse(compressedData: ArrayBuffer): any {
  const uint8Array = new Uint8Array(compressedData);
  
  // Decompress using raw deflate (no headers)
  const decompressed = decompressSync(uint8Array);
  
  // Convert decompressed bytes to string
  const jsonString = strFromU8(decompressed);
  
  // Parse JSON
  return JSON.parse(jsonString);
}

// Usage:
const response = await fetch(url);
const compressedData = await response.arrayBuffer();
const data = decompressAndParse(compressedData);
```

## Performance Results

### Test File: `好.json.deflate`
```
Compressed size:   10,581 bytes (10.6 KB)
Decompressed size: 31,549 bytes (31.5 KB)
Compression ratio: 66.5%
```

### Build Performance
- **Compression time**: ~0.4ms per file (one-time build cost)
- **Decompression time**: ~1ms per file (runtime, every page load)
- **Total files**: 461K dictionary entries
- **Parallel processing**: All files compressed in parallel using Rayon

### Bandwidth Savings
For 461K files:
- **Before**: ~14.5 GB total (31.5 KB average)
- **After**: ~4.9 GB total (10.6 KB average)
- **Savings**: ~9.6 GB (66% reduction)

## Migration Checklist

### ✅ Backend (Completed)
- [x] Add `flate2` dependency to `Cargo.toml`
- [x] Remove broken optimization code (`src/optimization.rs`, `src/optimized_output_types.rs`)
- [x] Remove `--optimize` CLI flag
- [x] Implement Deflate compression in serialization
- [x] Change file extension to `.json.deflate`
- [x] Test compression/decompression locally

### ✅ Frontend (Completed)
- [x] Install `fflate` package
- [x] Update `shard-utils.ts` to use `.json.deflate` extension
- [x] Implement decompression in `+page.ts`
- [x] Update all fetch calls to decompress data
- [x] Test build successfully

### 🔄 Deployment (Next Steps)
- [ ] Update CI/CD workflows to remove `--optimize` flag
- [ ] Build and deploy compressed files to GitHub repositories
- [ ] Test live deployment on Cloudflare Pages
- [ ] Monitor performance metrics

## Testing

### Local Testing (Backend)
```bash
# Build the Rust binary
cargo build --release

# Generate compressed files for a shard
./target/release/merge_dictionaries --individual-files --mode han-1char-2

# Verify files were created
find output_dictionary -name "*.deflate" | wc -l

# Test decompression with Python
python3 -c "
import zlib
import json

with open('output_dictionary/好.json.deflate', 'rb') as f:
    compressed = f.read()

# Decompress raw DEFLATE (use -zlib.MAX_WBITS for raw deflate)
decompressed = zlib.decompress(compressed, -zlib.MAX_WBITS)
data = json.loads(decompressed)

print(f'Key: {data[\"key\"]}')
print(f'Compressed: {len(compressed)} bytes')
print(f'Decompressed: {len(decompressed)} bytes')
print(f'Ratio: {100 * (1 - len(compressed) / len(decompressed)):.1f}%')
"
```

### Local Testing (Frontend)
```bash
cd sveltekit-app

# Install dependencies
npm install

# Build the app
npm run build

# Preview the production build
npm run preview
```

## Troubleshooting

### Issue: "Error -3 while decompressing data: incorrect header check"
**Cause**: Using `zlib.decompress()` instead of raw deflate decompression.

**Solution**: Use `-zlib.MAX_WBITS` flag for raw deflate:
```python
decompressed = zlib.decompress(compressed, -zlib.MAX_WBITS)
```

### Issue: TypeScript error "inflateRaw is not exported"
**Cause**: Using wrong fflate API.

**Solution**: Use `decompressSync` instead:
```typescript
import { decompressSync, strFromU8 } from 'fflate';
const decompressed = decompressSync(uint8Array);
```

### Issue: Files not found (404 errors)
**Cause**: File extension mismatch.

**Solution**: Ensure all URLs use `.json.deflate` extension:
```typescript
return `${baseUrl}/${word}.json.deflate`;
```

## Future Optimizations

1. **Streaming decompression**: For very large files, consider streaming decompression
2. **Service Worker caching**: Cache decompressed data in browser
3. **Preload critical files**: Preload frequently accessed dictionary entries
4. **Brotli for static assets**: Use Brotli for CSS/JS (better compression for text)

## References

- [fflate documentation](https://github.com/101arrowz/fflate)
- [Deflate specification (RFC 1951)](https://www.rfc-editor.org/rfc/rfc1951)
- [Compression benchmark results](compression-benchmark/COMPLETE_RESULTS.md)

