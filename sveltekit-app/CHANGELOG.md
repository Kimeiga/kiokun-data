# Changelog

All notable changes to the Kiokun Dictionary Web Application.

## [1.0.0] - 2025-10-06

### Added - Initial Release

#### Core Features
- **Dynamic Routing**: Direct URL access to any character (e.g., `/好`, `/的`, `/地圖`)
- **File-based Data**: Serves individual JSON files from `output_dictionary/` for optimal performance
- **Unified Display**: Shows Chinese and Japanese words in a single flowing page without tabs

#### Character Display
- Large character with Chinese pinyin and Japanese readings
- Mnemonic hints (💡) for etymology and memory aids
- Component breakdown (🧩) with meaning/phonetic indicators

#### Historical Evolution (🏛️)
- Horizontal scrollable images showing script evolution
- Oracle, Bronze, Seal, Clerical, Regular scripts
- **Modern form rendered with font** instead of broken image
  - Detects `type === 'Regular' && era === 'Modern'`
  - Displays actual character using MS Mincho font at 60px

#### Usage Statistics (📊)
- HSK level badge (blue background)
- Movie and Book ranking badges (light blue/purple)
- Frequency bars with gradients (blue for movies, purple for books)
- Top words grid with background progress bars

#### Chinese Words Section
- **Character + Pinyin Display**: Shows character next to each pronunciation (e.g., **好** [hǎo])
- Multiple pronunciations displayed separately
- Definitions listed below each pronunciation
- Consistent layout with Japanese section

#### Japanese Words Section
- **Character + Kana Display**: Shows character next to readings (e.g., **好** [こう])
- **Full Part-of-Speech Labels**: Displays complete labels (e.g., "prefix" not "pref", "noun" not "n")
- **Misc Tags as Styled Badges**: Light blue background (#e3f2fd) with blue text (#1976d2)
  - Example: "usually kana" displayed as styled badge
- **Inline "Other Forms"**: Displayed with semicolons (e.g., "誼 [よしみ, ぎ, よしび]; 誼み [よしみ]")
- **Bold Current Character**: Current character bolded in "Other forms" section
- **Related Words Integration**: Related Japanese words shown in same section (no separate card)

#### Label System
- **Japanese Labels File**: `static/japanese_labels.json` with 100+ mappings
- **Part-of-Speech Mapping**: 
  - `pref` → `prefix`
  - `n` → `noun`
  - `adj-na` → `na-adjective`
  - `v5u` → `Godan verb with 'u' ending`
  - And many more...
- **Misc Tag Mapping**:
  - `uk` → `usually kana`
  - `abbr` → `abbreviation`
  - `arch` → `archaism`
  - And more...

#### Technical Implementation
- **SvelteKit 2.x** with **Svelte 5** (runes syntax: `$state`, `$derived`, `$props`)
- **Dynamic Data Loading**: Fetches main entry + related words + labels
- **Helper Functions**: `getPartOfSpeechLabel()` and `getMiscLabel()` for label mapping
- **Inline Styling**: Matches original Python webapp design exactly
- **MS Mincho Font**: Used for all CJK characters

### Changed

#### Display Format
- **Misc Tags**: Changed from separate line to inline badges within definitions
  - Before: Separate line with "usually kana" text
  - After: Inline badge with styled background
- **Definition Format**: Changed to structured format
  - Format: `<number>. <misc-badges> <definition-text>`
  - Example: "1. [usually kana badge] friendship; friendly relations"
- **Other Forms**: Changed from separate lines to inline with semicolons
  - Before: Each form on separate line
  - After: All forms in one line separated by semicolons

#### Section Organization
- **Japanese Words**: Merged direct and related words into single section
  - Removed separate "🇯🇵 Related Japanese Words" header
  - All Japanese words now flow together in one card
- **Chinese Words**: Added character display next to pinyin
  - Before: Only pinyin shown
  - After: Character + pinyin (e.g., **好** [hǎo])

### Fixed

#### Svelte 5 Compatibility
- **Event Handlers**: Changed from `on:error` to `onerror` syntax
- **`{@const}` Placement**: Moved to be direct children of block elements
- **SSR Issues**: Disabled SSR (`export const ssr = false`) to prevent dev server hanging

#### Display Issues
- **Regular Modern Character**: Fixed broken image by rendering with font
- **Label Display**: Fixed abbreviations by implementing full label mapping
- **Other Forms Duplication**: Fixed by filtering out main kanji from "Other forms"
- **Related Words Duplication**: Fixed by showing only one entry per word (not per kanji form)

### Technical Details

#### File Structure
```
sveltekit-app/
├── src/routes/[word]/
│   ├── +page.svelte    # Main display (700+ lines)
│   └── +page.ts        # Data loading with labels
├── static/
│   ├── dictionary/     # Symlink to ../output_dictionary/
│   └── japanese_labels.json  # 8.5KB label mappings
```

#### Key Code Patterns

**Label Mapping**:
```typescript
function getPartOfSpeechLabel(pos: string): string {
  if (!data.labels?.partOfSpeech) return pos;
  return data.labels.partOfSpeech[pos] || pos;
}
```

**Other Forms Display**:
```svelte
{@const otherFormsText = otherKanji
  .map((k) => {
    const readings = word.kana.filter(...).map(...);
    const kanjiPart = k.text === data.word 
      ? `<strong>${k.text}</strong>` 
      : k.text;
    return readings.length > 0 
      ? `${kanjiPart} [${readings.join(', ')}]` 
      : kanjiPart;
  })
  .join('; ')}
<div>{@html otherFormsText}</div>
```

**Historical Evolution**:
```svelte
{#if image.type === 'Regular' && image.era === 'Modern'}
  <div style="font-size: 60px; font-family: 'MS Mincho', serif;">
    {data.word}
  </div>
{:else}
  <img src={image.url} alt="{image.type} {image.era}" />
{/if}
```

### Performance
- **Individual JSON Files**: Direct file access without grepping
- **Static Generation**: Pre-rendered pages for instant loading
- **Lazy Loading**: Related words fetched on-demand
- **Minimal JavaScript**: Svelte compiles to efficient vanilla JS
- **Font Rendering**: Modern characters use fonts instead of images

### Design Principles
1. **Learner-Focused**: Single flowing page, no tabs or conditional display
2. **Consistent Layout**: Chinese and Japanese sections use same format
3. **Full Text Labels**: No abbreviations or tooltips needed
4. **Visual Hierarchy**: Clear typography and spacing
5. **Accessibility**: Semantic HTML and proper ARIA labels

---

## Future Enhancements

### Planned Features
- [ ] Search functionality
- [ ] Bookmarking system
- [ ] Study mode with flashcards
- [ ] Audio pronunciations
- [ ] Example sentences highlighting
- [ ] Mobile-optimized layout
- [ ] Dark mode support
- [ ] Offline PWA support

### Technical Improvements
- [ ] TypeScript strict mode
- [ ] Unit tests for components
- [ ] E2E tests with Playwright
- [ ] Performance monitoring
- [ ] Error boundary components
- [ ] Loading states
- [ ] Skeleton screens

---

**Version 1.0.0** - Initial release with complete feature parity to original Python webapp

*Last updated: October 6, 2025*

