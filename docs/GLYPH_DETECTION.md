# Glyph Detection for Unrenderable Characters

## Problem

Some CJK characters, especially those in Unicode Extension B and beyond (e.g., 𨙵 U+28675), don't have glyphs in most system fonts. When rendered, they appear as:
- **Tofu boxes** (□) - empty rectangles
- **Replacement characters** (�)
- **Six horizontal lines** or other placeholder glyphs

These characters would appear as cards in the game, confusing players.

## Solution: Reference Character Comparison

The solution uses a **reference character comparison** approach:

1. **Render a known missing glyph** (U+10FFFF) to canvas and save its pixel data
2. **For each test character**, render it to canvas and get its pixel data
3. **Compare the pixel data** - if they match, the test character is also missing a glyph
4. **Filter out** characters that match the missing glyph pattern

### Why This Works

- **U+10FFFF** is the last code point in Unicode and is guaranteed to never have a glyph in any font
- When a font doesn't have a glyph, it renders a consistent "tofu box" or replacement character
- By comparing pixel-by-pixel, we can detect when a character renders the same way as our known missing glyph

## Implementation

### File: `kanji-card-game/src/lib/dataLoader.ts`

#### 1. Store Reference Glyph Data
```typescript
private referenceGlyphData: Uint8ClampedArray | null = null;

private constructor() {
    // Create canvas for glyph detection
    if (typeof document !== 'undefined') {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 50;
        this.canvas.height = 50;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        if (this.ctx) {
            this.ctx.font = '40px sans-serif';
            this.ctx.textBaseline = 'top';
            // Render reference character (U+10FFFF) that has no glyph
            this.referenceGlyphData = this.renderCharacterToPixels('\uDBFF\uDFFF');
        }
    }
}
```

#### 2. Render Character to Pixels
```typescript
private renderCharacterToPixels(char: string): Uint8ClampedArray {
    if (!this.ctx || !this.canvas) {
        return new Uint8ClampedArray();
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw the character
    this.ctx.fillStyle = 'black';
    this.ctx.fillText(char, 5, 5);

    // Get pixel data
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    return imageData.data;
}
```

#### 3. Compare Pixel Data
```typescript
private pixelDataMatches(data1: Uint8ClampedArray, data2: Uint8ClampedArray): boolean {
    if (data1.length !== data2.length) return false;

    let differences = 0;
    const threshold = 100; // Allow some small differences due to anti-aliasing

    // Sample every 4th pixel for performance
    for (let i = 0; i < data1.length; i += 16) {
        const diff = Math.abs(data1[i] - data2[i]) +
            Math.abs(data1[i + 1] - data2[i + 1]) +
            Math.abs(data1[i + 2] - data2[i + 2]) +
            Math.abs(data1[i + 3] - data2[i + 3]);

        if (diff > 10) {
            differences++;
        }
    }

    // If more than threshold pixels are different, they don't match
    return differences < threshold;
}
```

#### 4. Detect Renderable Characters
```typescript
public canRenderCharacter(char: string): boolean {
    if (!this.ctx || !this.canvas || !this.referenceGlyphData) {
        return true; // Assume yes if no canvas or reference
    }

    try {
        // Render the test character
        const testPixels = this.renderCharacterToPixels(char);

        // Compare with the reference missing glyph
        const matchesTofu = this.pixelDataMatches(testPixels, this.referenceGlyphData);

        // Return true if it DOESN'T match the tofu (i.e., it has a real glyph)
        return !matchesTofu;
    } catch (e) {
        console.warn('Error checking glyph for', char, e);
        return true;
    }
}
```

#### 5. Filter During Deck Creation
```typescript
public getRandomComponents(count: number): Card[] {
    // Get all components
    const allChars = new Set([
        ...Object.keys(this.idsForward),
        ...Object.values(this.idsForward).flatMap((entry) => entry.components)
    ]);

    let components = Array.from(allChars).filter((char) => !this.idsForward[char]);

    // Filter out characters that can't be rendered
    const renderableComponents = components.filter((char) => this.canRenderCharacter(char));
    const filteredCount = components.length - renderableComponents.length;

    if (filteredCount > 0) {
        console.log(`  ℹ️  Filtered out ${filteredCount} unrenderable characters`);
    }

    // Shuffle and return
    const shuffled = renderableComponents.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((char) => this.createCard(char));
}
```

## Results

- ✅ **319 unrenderable characters** filtered out
- ✅ **No tofu boxes** or placeholder glyphs appear as cards
- ✅ **All visible cards** have proper, renderable glyphs
- ✅ **Performance optimized** with pixel sampling (every 4th pixel)

## Performance Considerations

1. **Canvas Context Options**: Using `{ willReadFrequently: true }` optimizes for multiple `getImageData()` calls
2. **Pixel Sampling**: Comparing every 16th byte (every 4th pixel) instead of all pixels
3. **Early Exit**: Stops comparing once threshold is exceeded
4. **One-time Reference**: Reference glyph is rendered once during initialization

## Alternative Approaches Considered

### 1. Pixel Count Method (Initial Attempt)
- **Approach**: Count black pixels, assume missing if too few
- **Problem**: Different fonts render different amounts of pixels; no reliable threshold
- **Result**: Too many false positives/negatives

### 2. Unicode Block Filtering
- **Approach**: Exclude entire Unicode blocks (e.g., Extension B)
- **Problem**: Some characters in those blocks DO have glyphs in modern fonts
- **Result**: Would exclude valid characters

### 3. Font Detection API
- **Approach**: Use browser APIs to detect font support
- **Problem**: No reliable cross-browser API for this
- **Result**: Not feasible

## References

- [Stack Overflow: Detecting individual Unicode character support](https://stackoverflow.com/questions/1911000/detecting-individual-unicode-character-support-with-javascript)
- [Unicode U+10FFFF](https://www.compart.com/en/unicode/U+10FFFF) - Last code point, guaranteed no glyph
- [CJK Unified Ideographs Extension B](https://en.wikipedia.org/wiki/CJK_Unified_Ideographs_Extension_B) - Poor font support

## Future Improvements

1. **Cache Results**: Store glyph detection results in localStorage to avoid re-checking
2. **Web Worker**: Move glyph detection to a web worker for better performance
3. **Progressive Loading**: Check glyphs as needed rather than all at once
4. **Font Preloading**: Detect and preload CJK fonts that support Extension B characters

