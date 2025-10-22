# Compression Benchmark

This benchmark compares different compression algorithms for dictionary JSON files.

## Algorithms Tested

1. **Gzip** (levels 1, 6, 9) - Most widely supported, good balance
2. **Brotli** (levels 1, 6, 11) - Better compression than gzip, modern browsers
3. **LZ4** - Extremely fast decompression, lower compression ratio
4. **Zstandard** (levels 1, 10, 19) - Excellent balance, Facebook's algorithm

## How to Run

### Step 1: Generate Compressed Files

```bash
cd compression-benchmark
cargo run --release
```

This will:
- Read `sample.json` (the 好 character dictionary entry)
- Compress it with all algorithms at different levels
- Output compression statistics
- Save compressed files (`.gz`, `.br`, `.lz4`, `.zst`)

### Step 2: Run Web Benchmark

```bash
node server.js
```

Then open http://localhost:3000/ in your browser.

Click "Run Benchmark" to test decompression speed in the browser.

## What It Measures

### Compression (Rust):
- Compressed file size
- Compression ratio
- Compression time

### Decompression (Browser):
- Decompression time in JavaScript
- Library size overhead
- Overall performance

## Expected Results

Based on typical JSON data:

| Algorithm | Compression | Speed | Library Size | Best For |
|-----------|-------------|-------|--------------|----------|
| Gzip 6 | ~70% | Fast | 45 KB | Universal compatibility |
| Brotli 6 | ~75% | Fast | 60 KB | Modern browsers, best balance |
| Brotli 11 | ~80% | Medium | 60 KB | Maximum compression |
| LZ4 | ~50% | Very Fast | 15 KB | Speed-critical applications |
| Zstd 10 | ~75% | Fast | 200 KB | Good balance, larger library |

## Recommendation

For dictionary files served via CDN:

**Best Choice: Brotli level 6 or 11**
- Excellent compression ratio (75-80%)
- Fast decompression (<5ms)
- Reasonable library size (60 KB)
- Supported by all modern browsers

**Alternative: Zstandard level 10**
- Similar compression to Brotli
- Fast decompression
- Larger library (200 KB) but only loaded once

**For Maximum Speed: LZ4**
- Fastest decompression (<1ms)
- Lower compression (50%)
- Smallest library (15 KB)

## Field Name Shortening Comparison

The benchmark also includes the uncompressed JSON to compare:
- Original JSON with full field names
- Compressed original JSON
- JSON with shortened field names (if implemented)
- Compressed shortened JSON

This helps determine if field shortening provides meaningful additional savings on top of compression.

