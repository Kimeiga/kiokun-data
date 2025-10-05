# Japanese Dictionary Labels Reference

This document provides a comprehensive mapping of all tags, labels, and codes used in the Japanese dictionary to their full English descriptions.

## Usage

The `japanese_labels.json` file contains all mappings organized by category. Use it in the frontend to display human-readable labels for dictionary entries.

Example entry from JMdict:
```
誼, 誼み, 好, 好み [よしみ, ぎ, よしび]
n uk friendship; friendly relations; connection; relation; intimacy
```

Where:
- `n` = noun (from `partOfSpeech`)
- `uk` = usually written using kana alone (from `misc`)

## Categories Covered

### 1. Part of Speech (`partOfSpeech`)
Grammatical categories for words. Examples:
- `n` → "noun (common) (futsuumeishi)"
- `v5r` → "Godan verb with 'ru' ending"
- `adj-i` → "adjective (keiyoushi)"
- `vi` → "intransitive verb"
- `vt` → "transitive verb"

**Total entries:** 86 part-of-speech tags

### 2. Miscellaneous Tags (`misc`)
Usage notes, register, and special characteristics. Examples:
- `uk` → "word usually written using kana alone"
- `hon` → "honorific or respectful (sonkeigo) language"
- `hum` → "humble (kenjougo) language"
- `arch` → "archaic"
- `sl` → "slang"
- `vulg` → "vulgar expression or word"
- `yoji` → "yojijukugo"

**Total entries:** 53 miscellaneous tags

### 3. Field/Domain (`field`)
Subject area or domain of usage. Examples:
- `comp` → "computing"
- `med` → "medicine"
- `law` → "law"
- `sports` → "sports"
- `Buddh` → "Buddhism"
- `math` → "mathematics"

**Total entries:** 96 field tags

### 4. Dialect (`dialect`)
Regional Japanese dialects. Examples:
- `ksb` → "Kansai-ben"
- `ktb` → "Kantou-ben"
- `hob` → "Hokkaido-ben"
- `osb` → "Osaka-ben"

**Total entries:** 12 dialect tags

### 5. Kanji/Kana Tags (`tag`)
Special notations for kanji and kana usage. Examples:
- `ateji` → "ateji (phonetic) reading"
- `gikun` → "gikun (meaning as reading) or jukujikun (special kanji reading)"
- `iK` → "word containing irregular kanji usage"
- `oK` → "word containing out-dated kanji"
- `rK` → "rarely-used kanji form"
- `sK` → "search-only kanji form"

**Total entries:** 11 kanji/kana tags

### 6. Gloss Type (`glossType`)
Type of definition/gloss provided. Examples:
- `literal` → "literally"
- `figurative` → "figurative"
- `explanation` → "explanation"
- `trademark` → "trademark"

**Total entries:** 4 gloss types

### 7. Language Source (`languageSource`)
Origin language for loanwords. Examples:
- `eng` → "English"
- `fre` → "French"
- `ger` → "German"
- `chi` → "Chinese"
- `kor` → "Korean"
- `por` → "Portuguese"

**Total entries:** 66 language codes

## Complete Coverage

This mapping covers **ALL** possible tags that can appear in the Japanese dictionary based on the Rust type definitions in `src/japanese_types.rs`:

✅ **PartOfSpeech enum** (lines 409-574) - 86 variants
✅ **Misc enum** (lines 350-405) - 53 variants
✅ **Field enum** (lines 143-244) - 96 variants
✅ **Dialect enum** (lines 100-113) - 12 variants
✅ **Tag enum** (lines 56-72) - 11 variants
✅ **GlossType enum** (lines 258-263) - 4 variants
✅ **Lang enum** (lines 276-346) - 66 variants

**Total: 328 unique tags mapped**

## Frontend Usage Example

```javascript
// Load the labels
const labels = await fetch('japanese_labels.json').then(r => r.json());

// Display a part of speech tag
const pos = "v5r";
console.log(labels.partOfSpeech[pos]); 
// Output: "Godan verb with 'ru' ending"

// Display a misc tag
const misc = "uk";
console.log(labels.misc[misc]);
// Output: "word usually written using kana alone"

// Display a field tag
const field = "comp";
console.log(labels.field[field]);
// Output: "computing"
```

## Notes

- All tags are case-sensitive and should match exactly as they appear in the JSON data
- Some tags use special characters (e.g., `m-sl`, `net-sl`, `on-mim`)
- Some tags use capital letters (e.g., `Buddh`, `Christn`, `Shinto`, `MA`)
- Language codes follow ISO 639-2/B three-letter codes (bibliographic)

