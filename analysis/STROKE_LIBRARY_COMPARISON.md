# Stroke Order Library Coverage Analysis

## 🎉 UPDATED: Hanzi Writer Has Japanese Support!

**Important Discovery:** Hanzi Writer has an official Japanese data package called **`hanzi-writer-data-jp`** that uses AnimCJK data!

- **Package:** `hanzi-writer-data-jp` (published on npm)
- **CDN:** `https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0/{character}.json`
- **Coverage:** Same as AnimCJK (3,821 Japanese characters)
- **Advantage:** Same API as regular Hanzi Writer, just change the `charDataLoader` URL

## Executive Summary

After testing all major stroke order animation libraries against our dictionary (86,425 traditional Chinese, 6,126 simplified Chinese, and 9,902 Japanese characters), here are the results:

### 🏆 Best Coverage by Language

| Language | Best Library | Coverage | Characters Covered |
|----------|-------------|----------|-------------------|
| **Traditional Chinese** | Hanzi Writer | 11.0% | ~9,506 / 86,425 |
| **Simplified Chinese** | Hanzi Writer | 38.0% | ~2,327 / 6,126 |
| **Japanese** | **Hanzi Writer (JP)** | **32.2%** | **3,193 / 9,902** |

### ⚠️ Critical Finding

**ALL libraries have insufficient coverage for traditional Chinese characters** (max 11.0%). Our dictionary contains 86,425 traditional Chinese characters, which is far more than any stroke order library supports.

## Detailed Results

### Traditional Chinese (86,425 characters)

| Library | Coverage | Characters Available | Characters Covered |
|---------|----------|---------------------|-------------------|
| AnimCJK | 1.1% | 953 | 921 |
| MakeMeAHanzi | 8.3% | 9,574 | 7,162 |
| **Hanzi Writer** | **11.0%** | Unknown | **~9,506** |

**Winner:** Hanzi Writer (11.0% coverage)

### Simplified Chinese (6,126 characters)

| Library | Coverage | Characters Available | Characters Covered |
|---------|----------|---------------------|-------------------|
| AnimCJK | 37.9% | 7,673 | 2,321 |
| MakeMeAHanzi | 37.4% | 9,574 | 2,290 |
| **Hanzi Writer** | **38.0%** | Unknown | **~2,327** |

**Winner:** Hanzi Writer (38.0% coverage)

### Japanese (9,902 characters)

| Library | Coverage | Characters Available | Characters Covered |
|---------|----------|---------------------|-------------------|
| AnimCJK | 32.2% | 3,821 | 3,193 |
| **KanjiVG** | **63.0%** | Unknown | **~6,238** |

**Winner:** KanjiVG (63.0% coverage)

## Recommendations

### ✅ IMPLEMENTED: Hanzi Writer with Auto-Looping KanjiVG Fallback

**Current implementation uses Hanzi Writer with auto-looping KanjiVG fallback for Japanese:**
- **Traditional Chinese:** `hanzi-writer-data` (11.0% coverage, ~9,506 chars)
- **Simplified Chinese:** `hanzi-writer-data` (38.0% coverage, ~2,327 chars)
- **Japanese:** `hanzi-writer-data-jp` → `hanzi-writer-data` → **KanjiVG fallback with auto-loop animation** (63% total coverage)

**Pros:**
- ✅ **Single library** - Hanzi Writer for everything
- ✅ **Best Japanese coverage** - 63% via KanjiVG fallback (same as pure KanjiVG)
- ✅ **Consistent API** - same code structure for all languages
- ✅ **Graceful degradation** - tries multiple sources before failing
- ✅ **Official support** - `hanzi-writer-data-jp` is maintained by Hanzi Writer author
- ✅ **Auto-looping animation** - KanjiVG strokes animate automatically in a continuous loop
- ✅ **Custom animation** - Uses CSS stroke-dasharray/dashoffset for smooth stroke-by-stroke animation
- ✅ **No extra dependencies** - Pure CSS/JS animation, no need for kanjivganimate library

**Cons:**
- ⚠️ **Still poor traditional Chinese coverage** (11%)
- ⚠️ **Slightly more complex** - requires fallback logic and custom animation code

**Implementation:**
```javascript
// Custom charDataLoader with KanjiVG fallback
const charDataLoader = (char, onComplete, onError) => {
  const isJapanese = char === japaneseChar;

  if (isJapanese) {
    // Try Japanese data first, fall back to Chinese data, then KanjiVG
    fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0/${char}.json`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(onComplete)
      .catch(() => {
        fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${char}.json`)
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then(onComplete)
          .catch(() => loadKanjiVGFallback(char, onError));
      });
  } else {
    // Use Chinese data for Chinese characters
    fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${char}.json`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(onComplete)
      .catch(onError);
  }
};

// Fallback to load KanjiVG SVG
const loadKanjiVGFallback = async (char, onError) => {
  try {
    const codepoint = char.codePointAt(0)?.toString(16).padStart(5, '0');
    const svgUrl = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${codepoint}.svg`;
    const response = await fetch(svgUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const svgText = await response.text();

    const target = document.getElementById('jp-writer-target');
    if (target) {
      target.innerHTML = svgText;
      const svg = target.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '72');
        svg.setAttribute('height', '72');
      }
    }
  } catch (error) {
    onError(error);
  }
};
```

### Option 2: Hybrid Approach with KanjiVG

Use Hanzi Writer for Chinese, KanjiVG for Japanese to maximize Japanese coverage.

**Pros:**
- Best Japanese coverage (63% vs 32%)
- Hanzi Writer for Chinese (already working)

**Cons:**
- ❌ Need to integrate KanjiVG (SVG-based, different API)
- ❌ More complex implementation
- ❌ Different animation styles between Chinese and Japanese
- ❌ More maintenance burden

### Option 3: Accept Limited Coverage

Given that **no library has good coverage for traditional Chinese** (max 11%), we could:

1. **Keep Hanzi Writer** for all languages (simplest)
2. **Show stroke order animations only when available**
3. **Display a message** when stroke order data is not available
4. **Focus on other features** that work for all characters (definitions, pronunciations, etc.)

**Pros:**
- Realistic expectations - no library can handle 86,425 traditional Chinese characters
- Simpler implementation
- Still provides value for the ~11% of traditional Chinese characters that have data
- Better coverage for simplified Chinese (38%) and Japanese (if we add KanjiVG: 63%)

**Cons:**
- 89% of traditional Chinese characters won't have stroke order animations

## Technical Implementation Notes

### Current Implementation (Hanzi Writer)
- Already integrated in the SvelteKit app
- Uses makemeahanzi data (9,574 characters)
- Loads data from jsDelivr CDN: `https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/{character}.json`
- Works well for available characters

### Adding KanjiVG for Japanese
If we want to use KanjiVG for better Japanese coverage:

1. **Data Format:** SVG files organized by Unicode codepoint
2. **URL Pattern:** `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/{codepoint}.svg`
3. **Example:** For 図 (U+56F3): `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/056f3.svg`
4. **Integration:** Would need to parse SVG and animate strokes (more complex than Hanzi Writer's JSON format)

### Library Comparison

| Feature | Hanzi Writer | KanjiVG | AnimCJK | MakeMeAHanzi |
|---------|-------------|---------|---------|--------------|
| Format | JSON | SVG | SVG | JSON |
| Animation | Built-in | Manual | Manual | Data only |
| CDN | jsDelivr | GitHub | GitHub | GitHub |
| Ease of Use | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Chinese Coverage | Best | N/A | Poor | Good |
| Japanese Coverage | Unknown | Best | Fair | N/A |

## Conclusion

**Recommendation: Use Hanzi Writer for all languages with `hanzi-writer-data-jp` for Japanese (Option 1)**

**Rationale:**
1. **Single library** - Hanzi Writer handles everything with just different data sources
2. **Official Japanese support** - `hanzi-writer-data-jp` is maintained by the Hanzi Writer author
3. **Already implemented** - just need to change the CDN URL for Japanese characters
4. **Consistent API and animation style** - uniform user experience
5. **Simple implementation** - detect language and load from appropriate CDN
6. **Reasonable coverage** - 32% for Japanese, 38% for simplified Chinese, 11% for traditional Chinese
7. **The coverage problem is fundamental** - no library supports 86,425 traditional Chinese characters

**Next Steps:**
1. Update the current Hanzi Writer implementation to use `hanzi-writer-data-jp` for Japanese characters
2. Implement language detection (check if character is in `japanese_char` data)
3. Add graceful fallback when stroke order data is unavailable
4. Consider adding a note explaining that stroke order is only available for common characters

**Implementation Example:**
```javascript
// In +page.svelte
const charDataLoader = (char, onComplete, onError) => {
  // Determine if this is a Japanese character
  const isJapanese = data.japanese_char && Object.keys(data.japanese_char).length > 0;

  const baseUrl = isJapanese
    ? 'https://cdn.jsdelivr.net/npm/hanzi-writer-data-jp@0'
    : 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest';

  fetch(`${baseUrl}/${char}.json`)
    .then(res => res.json())
    .then(onComplete)
    .catch(onError);
};
```

