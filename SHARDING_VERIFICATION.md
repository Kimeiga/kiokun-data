# Dictionary Sharding Verification

## Overview

This document explains how the dictionary sharding works and how to verify it's working correctly.

## Sharding Logic

The dictionary is split into 4 shards based on the number of Han (CJK) characters in each word:

1. **non-han**: Words with 0 Han characters (hiragana, katakana, romaji)
2. **han-1char**: Words with exactly 1 Han character
3. **han-2char**: Words with exactly 2 Han characters  
4. **han-3plus**: Words with 3 or more Han characters

### Han Character Detection

Han characters are detected using Unicode ranges:

```rust
fn is_han_character(c: char) -> bool {
    matches!(c,
        '\u{4E00}'..='\u{9FFF}'   | // CJK Unified Ideographs
        '\u{3400}'..='\u{4DBF}'   | // CJK Unified Ideographs Extension A
        '\u{20000}'..='\u{2A6DF}' | // CJK Unified Ideographs Extension B
        '\u{2A700}'..='\u{2B73F}' | // CJK Unified Ideographs Extension C
        '\u{2B740}'..='\u{2B81F}' | // CJK Unified Ideographs Extension D
        '\u{2B820}'..='\u{2CEAF}' | // CJK Unified Ideographs Extension E
        '\u{2CEB0}'..='\u{2EBEF}' | // CJK Unified Ideographs Extension F
        '\u{30000}'..='\u{3134F}'   // CJK Unified Ideographs Extension G
    )
}
```

These ranges are verified against the official Unicode specification (Unicode 17.0).

## Building Shards Locally

### Recommended: Build All Shards to Subdirectories (Fastest)

Build once and output to 4 subdirectories inside `output_dictionary/`:

```bash
cargo run --release --bin merge_dictionaries -- --individual-files --optimize --mode all --shard-output
```

This creates 4 subdirectories inside `output_dictionary/`:
- `output_dictionary/output_non-han/` (42,333 files)
- `output_dictionary/output_han-1char/` (124,673 files)
- `output_dictionary/output_han-2char/` (134,946 files)
- `output_dictionary/output_han-3plus/` (130,700 files)

**Advantages:**
- ✅ Only build once (~10 minutes)
- ✅ All files in one place for easy verification
- ✅ Perfect for local development and testing

### Alternative: Build Each Shard Separately

Build each shard to its own top-level directory:

```bash
# Build each shard separately
cargo run --release --bin merge_dictionaries -- --individual-files --optimize --mode non-han
cargo run --release --bin merge_dictionaries -- --individual-files --optimize --mode han-1char
cargo run --release --bin merge_dictionaries -- --individual-files --optimize --mode han-2char
cargo run --release --bin merge_dictionaries -- --individual-files --optimize --mode han-3plus
```

This creates 4 top-level directories:
- `output_non-han/`
- `output_han-1char/`
- `output_han-2char/`
- `output_han-3plus/`

**Use this when:**
- You only need to build one specific shard
- You're running in CI/CD with parallel builds

## Running Tests

### Unit Tests

Run the comprehensive sharding tests:

```bash
cargo test --test sharding_tests
```

These tests verify:
- ✅ Han character detection for all Unicode ranges
- ✅ Correct shard assignment based on Han character count
- ✅ Edge cases (empty strings, punctuation, mixed content)
- ✅ Real dictionary examples
- ✅ Unicode range boundaries

### Verification Script

After building the shards, run the verification script:

```bash
./scripts/verify_sharding.sh
```

This script:
1. Checks that all 4 shard directories exist
2. Counts files in each shard
3. Verifies no duplicate files across shards
4. Samples 10 random files from each shard and verifies Han character counts

## Expected File Counts

Based on the dictionary sources:

### non-han (~350K files)
- Japanese kana-only words (ひらがな, カタカナ)
- Romaji entries
- Mixed kana entries

### han-1char (~125K files)
- Single Chinese characters (好, 地, 的)
- Japanese words with 1 kanji + kana (好き, 見る)

### han-2char (~310K files)
- Two-character Chinese words (地圖, 中國)
- Two-character Japanese words (地図, 日本)

### han-3plus (~310K files)
- Three+ character Chinese words (一把好手)
- Three+ character Japanese words (図書館)

**Total: ~1.1M files**

## Why Similar File Counts Are Expected

You might notice that all 4 shards have large, similar file counts (hundreds of thousands each). This is **correct** and expected because:

1. **Chinese dictionary** has ~145K entries:
   - ~125K single characters → `han-1char`
   - ~310K two-character words → `han-2char`
   - Remaining → `han-3plus`

2. **Japanese dictionary** has ~211K entries distributed across all shards:
   - Kana-only (ありがとう) → `non-han`
   - 1 kanji + kana (好き) → `han-1char`
   - 2 kanji (地図) → `han-2char`
   - 3+ kanji (図書館) → `han-3plus`

3. **Character entries** (~93K) are distributed based on their character count

## Verification Checklist

- [ ] All 4 shard directories exist
- [ ] No duplicate files across shards
- [ ] Sample files in each shard have correct Han character counts
- [ ] Total file count matches expected (~1.1M files)
- [ ] Unit tests pass
- [ ] Verification script passes

## Frontend Integration

The SvelteKit app automatically detects which shard to use:

```typescript
export function getShardForWord(word: string): ShardType {
  const hanCount = countHanCharacters(word);
  
  if (hanCount === 0) return 'non-han';
  if (hanCount === 1) return 'han-1char';
  if (hanCount === 2) return 'han-2char';
  return 'han-3plus';
}

export function getR2Url(word: string): string {
  const shard = getShardForWord(word);
  return `https://pub-3cf0f772ecad4e0fbb2a59a0ea02df4e.r2.dev/${shard}/${word}.json`;
}
```

## Deployment

The GitHub Actions workflow builds all 4 shards in parallel and uploads them to Cloudflare R2:

```yaml
strategy:
  matrix:
    shard-type: [non-han, han-1char, han-2char, han-3plus]
```

Each shard is uploaded to:
```
https://pub-3cf0f772ecad4e0fbb2a59a0ea02df4e.r2.dev/{shard-type}/{word}.json
```

## Troubleshooting

### "Directory does not exist" error

Make sure you've built the shards first:
```bash
cargo run --release --bin merge_dictionaries -- --individual-files --optimize --mode non-han
# ... repeat for other shards
```

### "Incorrect Han character count" error

This indicates a bug in the sharding logic. Check:
1. The `is_han_character()` function in `src/main.rs`
2. The `ShardType::from_key()` function in `src/main.rs`
3. Run unit tests to identify the issue

### Duplicate files across shards

This should never happen. If it does, it indicates a critical bug in the sharding logic. Each word should be assigned to exactly one shard.

## References

- [Unicode CJK Unified Ideographs](https://en.wikipedia.org/wiki/CJK_Unified_Ideographs)
- [Unicode 17.0 Specification](https://www.unicode.org/versions/Unicode17.0.0/)
- Unit tests: `tests/sharding_tests.rs`
- Verification script: `scripts/verify_sharding.sh`

