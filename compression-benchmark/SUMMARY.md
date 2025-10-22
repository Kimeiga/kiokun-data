# Compression Benchmark Summary

**Test File**: 好.json (17.04 KB)

## Complete Performance Comparison

| Method | Size | Reduction | Compress (Rust) | Decompress (JS) | Library | Total Time* |
|--------|------|-----------|----------------|-----------------|---------|-------------|
| **Uncompressed** | 17.04 KB | 0% | - | ~0.5ms | 0 KB | 0.5ms |
| **Gzip 1** | 7.46 KB | 56.2% | 0.20ms | ~1.5ms | 45 KB | 1.7ms |
| **Gzip 6** | 6.14 KB | 63.9% | 0.34ms | ~1.5ms | 45 KB | 1.8ms |
| **Gzip 9** | 6.14 KB | 64.0% | 0.38ms | ~1.5ms | 45 KB | 1.9ms |
| **Brotli 1** | 7.16 KB | 58.0% | 0.27ms | ~2.5ms | 60 KB | 2.8ms |
| **Brotli 6** | 6.16 KB | 63.9% | 0.74ms | ~3.0ms | 60 KB | 3.7ms |
| **Brotli 11** | **5.13 KB** | **69.9%** | 19.4ms | ~4.0ms | 60 KB | 23.4ms |
| **LZ4** | 8.91 KB | 47.7% | 0.06ms | ~0.8ms | 15 KB | 0.9ms |
| **Zstd 1** | 7.15 KB | 58.0% | 0.16ms | ~2.5ms | 200 KB | 2.7ms |
| **Zstd 10** | 6.32 KB | 62.9% | 2.1ms | ~3.0ms | 200 KB | 5.1ms |
| **Zstd 19** | 5.96 KB | 65.0% | 10.3ms | ~4.0ms | 200 KB | 14.3ms |

\* Total Time = Compression (one-time during build) + Decompression (every page load)

**Note**: Decompression times are estimates. Run http://localhost:3000/ to measure exact times in your browser.

## Key Insights

### 🏆 Winner: Brotli 11
- **Best compression**: 5.13 KB (69.9% reduction)
- **One-time cost**: 19.4ms compression during build (doesn't matter)
- **Runtime cost**: ~4ms decompression per page load (acceptable)
- **Library overhead**: 60 KB (loaded once, cached)

### ⚡ Fastest: LZ4
- **Fastest overall**: 0.9ms total time
- **Fastest decompression**: ~0.8ms
- **Trade-off**: Only 47.7% compression (8.91 KB)
- **Best for**: Speed-critical applications

### 🎯 Best Balance: Brotli 6 or Gzip 9
- **Brotli 6**: 6.16 KB, 3.7ms total
- **Gzip 9**: 6.14 KB, 1.9ms total
- **Similar compression**, Gzip is faster to decompress
- **Best for**: Good compression with minimal overhead

## Compression Time Analysis

**Why compression time doesn't matter much:**
- Compression happens **once** during the build process
- Even Brotli 11's 19.4ms is negligible for a build step
- You're building 461K files, so total build time is dominated by I/O, not compression
- 19.4ms × 461K files = ~2.5 hours (but parallelizable)

**Why decompression time matters:**
- Happens **every time** a user loads a page
- Directly impacts user experience
- Should be <5ms for good UX

## Library Size Impact

| Library | Size | Impact |
|---------|------|--------|
| pako (Gzip) | 45 KB | ✅ Small, one-time download |
| brotli-wasm | 60 KB | ✅ Small, one-time download |
| lz4js | 15 KB | ✅ Tiny, negligible |
| zstd-js | 200 KB | ⚠️ Larger, but still one-time |

**All libraries are loaded once and cached**, so the overhead is minimal.

## Recommendation by Use Case

### For Dictionary App (Your Use Case)
**Use Brotli 11**
- ✅ Best compression (5.13 KB vs 17.04 KB original)
- ✅ Acceptable decompression time (~4ms)
- ✅ Small library (60 KB)
- ✅ Saves bandwidth for 461K files
- ✅ Better than field shortening (40% vs 70%)

### For Real-Time Applications
**Use LZ4**
- ✅ Fastest decompression (~0.8ms)
- ✅ Smallest library (15 KB)
- ⚠️ Lower compression (47.7%)

### For Maximum Compatibility
**Use Gzip 9**
- ✅ Universal browser support
- ✅ Fast decompression (~1.5ms)
- ✅ Good compression (64%)
- ✅ Well-tested libraries

## Field Shortening Comparison

| Approach | File Size | Code Complexity | Maintenance |
|----------|-----------|-----------------|-------------|
| **Brotli 11 only** | 5.13 KB | Low | Easy |
| Field shortening only | ~10 KB | High | Hard |
| Field + Brotli 11 | ~3 KB | Very High | Very Hard |

**Verdict**: Brotli 11 alone gives 70% compression with zero code complexity. The extra 2 KB savings from field shortening is not worth the maintenance burden.

## Next Steps

1. ✅ Benchmark complete
2. ⏭️ Remove broken optimization code
3. ⏭️ Implement Brotli 11 compression in Rust build
4. ⏭️ Update frontend to decompress Brotli files
5. ⏭️ Test locally
6. ⏭️ Deploy to production

**Estimated implementation time**: 1-2 hours (vs weeks for field shortening)

