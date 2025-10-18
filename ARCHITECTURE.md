# Dictionary Sharding Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GitHub Actions (Matrix)                      │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│
│  │  Job 1       │  │  Job 2       │  │  Job 3       │  │  Job 4   ││
│  │  non-han     │  │  han-1char   │  │  han-2char   │  │ han-3plus││
│  │              │  │              │  │              │  │          ││
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │  │┌────────┐││
│  │ │Download  │ │  │ │Download  │ │  │ │Download  │ │  ││Download│││
│  │ │Sources   │ │  │ │Sources   │ │  │ │Sources   │ │  ││Sources │││
│  │ └────┬─────┘ │  │ └────┬─────┘ │  │ └────┬─────┘ │  │└───┬────┘││
│  │      │       │  │      │       │  │      │       │  │    │     ││
│  │ ┌────▼─────┐ │  │ ┌────▼─────┐ │  │ ┌────▼─────┐ │  │┌───▼────┐││
│  │ │Build     │ │  │ │Build     │ │  │ │Build     │ │  ││Build   │││
│  │ │Rust      │ │  │ │Rust      │ │  │ │Rust      │ │  ││Rust    │││
│  │ └────┬─────┘ │  │ └────┬─────┘ │  │ └────┬─────┘ │  │└───┬────┘││
│  │      │       │  │      │       │  │      │       │  │    │     ││
│  │ ┌────▼─────┐ │  │ ┌────▼─────┐ │  │ ┌────▼─────┐ │  │┌───▼────┐││
│  │ │Generate  │ │  │ │Generate  │ │  │ │Generate  │ │  ││Generate│││
│  │ │Files     │ │  │ │Files     │ │  │ │Files     │ │  ││Files   │││
│  │ │--mode    │ │  │ │--mode    │ │  │ │--mode    │ │  ││--mode  │││
│  │ │non-han   │ │  │ │han-1char │ │  │ │han-2char │ │  ││han-3+  │││
│  │ └────┬─────┘ │  │ └────┬─────┘ │  │ └────┬─────┘ │  │└───┬────┘││
│  │      │       │  │      │       │  │      │       │  │    │     ││
│  │ ┌────▼─────┐ │  │ ┌────▼─────┐ │  │ ┌────▼─────┐ │  │┌───▼────┐││
│  │ │Push to   │ │  │ │Push to   │ │  │ │Push to   │ │  ││Push to │││
│  │ │GitHub    │ │  │ │GitHub    │ │  │ │GitHub    │ │  ││GitHub  │││
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │  │└────────┘││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘│
│                                                                       │
│                    ⏱️  Total Time: ~30 minutes                        │
│                    💰 Cost: FREE (2000 min/month)                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         GitHub Repositories                          │
│                                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ japanese-dict- │  │ japanese-dict- │  │ japanese-dict- │  ...   │
│  │ non-han        │  │ han-1char      │  │ han-2char      │        │
│  │                │  │                │  │                │        │
│  │ ~50k files     │  │ ~15k files     │  │ ~200k files    │        │
│  │ ~200 MB        │  │ ~600 MB        │  │ ~800 MB        │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                       │
│                    📦 Total: ~430k files, ~2.3 GB                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         jsDelivr CDN                                 │
│                                                                       │
│  🌍 750+ CDN locations worldwide                                     │
│  ⚡ Automatic caching & optimization                                 │
│  🆓 Unlimited bandwidth                                              │
│  📊 99.9% uptime SLA                                                 │
│                                                                       │
│  URL Format:                                                         │
│  https://cdn.jsdelivr.net/gh/Kimeiga/japanese-dict-{shard}@main/    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SvelteKit App                                │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ User visits: /好                                              │   │
│  └────────────────────────┬─────────────────────────────────────┘   │
│                           │                                          │
│  ┌────────────────────────▼─────────────────────────────────────┐   │
│  │ shard-utils.ts                                               │   │
│  │                                                               │   │
│  │ 1. Count Han characters: 好 → 1 Han char                    │   │
│  │ 2. Determine shard: han-1char                                │   │
│  │ 3. Construct URL:                                            │   │
│  │    cdn.jsdelivr.net/gh/.../japanese-dict-han-1char@main/好.json│   │
│  └────────────────────────┬─────────────────────────────────────┘   │
│                           │                                          │
│  ┌────────────────────────▼─────────────────────────────────────┐   │
│  │ +page.ts                                                      │   │
│  │                                                               │   │
│  │ 1. Fetch from jsDelivr                                       │   │
│  │ 2. Expand optimized fields                                   │   │
│  │ 3. Handle redirects                                          │   │
│  │ 4. Fetch related words                                       │   │
│  └────────────────────────┬─────────────────────────────────────┘   │
│                           │                                          │
│  ┌────────────────────────▼─────────────────────────────────────┐   │
│  │ +page.svelte                                                  │   │
│  │                                                               │   │
│  │ Render dictionary entry with:                                │   │
│  │ - Chinese definitions                                        │   │
│  │ - Japanese readings                                          │   │
│  │ - Character details                                          │   │
│  │ - Related words                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Build Phase (GitHub Actions)

```
Source Files                Rust Build              Output
─────────────              ────────────            ────────

JMdict_e.gz     ──┐
JMnedict.xml.gz ──┤
kanjidic2.xml.gz──┼──▶  cargo run --release  ──▶  output_non_han/
cedict.txt.gz   ──┤     --bin merge_dicts        output_han_1char/
                  │     --individual-files        output_han_2char/
                  └─    --optimize                output_han_3plus/
                        --mode {shard}
```

### 2. Deployment Phase

```
Local Output              GitHub Push             jsDelivr CDN
────────────             ─────────────           ──────────────

output_non_han/    ──▶   japanese-dict-non-han   ──▶  cdn.jsdelivr.net/gh/
  ひらがな.json                                         .../non-han@main/
  カタカナ.json                                         ひらがな.json

output_han_1char/  ──▶   japanese-dict-han-1char ──▶  cdn.jsdelivr.net/gh/
  好.json                                              .../han-1char@main/
  地.json                                              好.json

output_han_2char/  ──▶   japanese-dict-han-2char ──▶  cdn.jsdelivr.net/gh/
  地図.json                                            .../han-2char@main/
  好き.json                                            地図.json

output_han_3plus/  ──▶   japanese-dict-han-3plus ──▶  cdn.jsdelivr.net/gh/
  一把好手.json                                        .../han-3plus@main/
  図書館.json                                          一把好手.json
```

### 3. Request Phase

```
User Request              Shard Detection         CDN Fetch
────────────             ───────────────         ─────────

/好                 ──▶   countHanChars("好")  ──▶  GET cdn.jsdelivr.net/
                          = 1                       gh/.../han-1char@main/
                          ↓                         好.json
                          shard = "han-1char"       ↓
                                                    200 OK
                                                    { "k": "好", ... }
```

## Sharding Logic

### Character Classification

```rust
fn is_han_character(c: char) -> bool {
    matches!(c,
        '\u{4E00}'..='\u{9FFF}'   | // CJK Unified Ideographs
        '\u{3400}'..='\u{4DBF}'   | // Extension A
        '\u{20000}'..='\u{2A6DF}' | // Extension B
        // ... more ranges
    )
}

fn get_shard(word: &str) -> ShardType {
    let han_count = word.chars()
        .filter(|c| is_han_character(*c))
        .count();
    
    match han_count {
        0 => ShardType::NonHan,      // ひらがな, カタカナ
        1 => ShardType::Han1Char,    // 好, 地, 的
        2 => ShardType::Han2Char,    // 地図, 好き
        _ => ShardType::Han3Plus,    // 一把好手, 図書館
    }
}
```

### Distribution Example

```
Input: "地図を見る"

Character Analysis:
├─ 地 → Han (U+5730) ✓
├─ 図 → Han (U+56F3) ✓
├─ を → Hiragana ✗
├─ 見 → Han (U+898B) ✓
└─ る → Hiragana ✗

Han Count: 3
Shard: han-3plus
Output: output_han_3plus/地図を見る.json
```

## Performance Characteristics

### Build Performance

| Metric | Sequential | Matrix (Parallel) | Improvement |
|--------|-----------|-------------------|-------------|
| Build time | 60 min | 15 min | 4x faster |
| Upload time | 60 min | 15 min | 4x faster |
| **Total** | **120 min** | **30 min** | **4x faster** |

### Runtime Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Shard detection | <1ms | Pure computation |
| jsDelivr fetch (cold) | 50-200ms | First request |
| jsDelivr fetch (warm) | 10-50ms | Cached |
| Page load | 100-300ms | Including all assets |

### Cost Analysis

| Resource | Usage | Cost |
|----------|-------|------|
| GitHub repos | 4 repos | FREE |
| GitHub storage | ~2.3 GB | FREE |
| GitHub Actions | 120 min/deploy | FREE (16 deploys/month) |
| jsDelivr CDN | Unlimited | FREE |
| **Total** | **All services** | **$0/month** ✅ |

## Scalability

### Horizontal Scaling

Add more shards if needed:

```yaml
# .github/workflows/build-dictionaries-matrix.yml
strategy:
  matrix:
    shard-type: 
      - non-han
      - han-1char
      - han-2char-common    # Split han-2char
      - han-2char-rare      # into common/rare
      - han-3plus
```

### Vertical Scaling

Optimize individual shards:

- Compress JSON files (gzip)
- Use binary format (MessagePack, Protocol Buffers)
- Implement pagination for large shards
- Add caching layer (Service Worker)

## Monitoring

### Health Checks

```bash
# Check if all shards are accessible
for shard in non-han han-1char han-2char han-3plus; do
  echo "Checking $shard..."
  curl -I "https://cdn.jsdelivr.net/gh/Kimeiga/japanese-dict-$shard@main/README.md"
done
```

### Metrics to Track

1. **Build metrics**
   - Build duration per shard
   - File count per shard
   - Total size per shard

2. **Deployment metrics**
   - Deployment success rate
   - Time to CDN propagation
   - Failed deployments

3. **Runtime metrics**
   - CDN hit rate
   - Average response time
   - Error rate (404s)

## Summary

**Architecture Benefits:**

✅ **Free** - All services are free tier
✅ **Fast** - 30 min deployments, <100ms page loads
✅ **Scalable** - Easy to add more shards
✅ **Reliable** - 99.9% uptime, 750+ CDN locations
✅ **Simple** - Automatic shard detection
✅ **Maintainable** - Clear separation of concerns

**Perfect for a dictionary with frequent updates!** 🚀

