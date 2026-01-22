# Kiokun Dictionary Web Application

A modern, high-performance dictionary web application built with **SvelteKit 2.x** and **Svelte 5** that displays unified Chinese-Japanese dictionary entries.

## 🎯 Features

- ✅ **Dynamic Routing**: Access any character directly via URL (e.g., `/好`, `/的`, `/地圖`)
- ✅ **Unified Display**: Chinese and Japanese words in a single flowing page
- ✅ **Full Labels**: Complete part-of-speech and misc tags (e.g., "prefix", "usually kana")
- ✅ **Historical Evolution**: Character evolution images + modern font rendering
- ✅ **Usage Statistics**: HSK levels, frequency data, top word associations
- ✅ **Other Forms**: Alternative kanji/kana forms displayed inline
- ✅ **Related Words**: Integrated display of related Japanese words

## 🚀 Quick Start

### Option 1: Fast Development Build (Recommended)

```bash
# From the root directory, build the SQLite database (~2.5 min)
cargo run --release --bin build_dictionary -- --dev-server

# Navigate to SvelteKit app
cd sveltekit-app

# Install dependencies
npm install

# Start development server (auto-starts CORS server)
npm run dev

# Open browser to http://localhost:5173/好
```

The `--dev-server` flag creates a single SQLite database (`output_dictionary/dictionary.db`) instead of 1.4M individual files, making builds 3x faster.

### Option 2: Production Files

```bash
# From the root directory, build individual files (~7 min)
cargo run --release --bin build_dictionary

# Navigate to SvelteKit app
cd sveltekit-app

# Install dependencies
npm install

# Create symlink to dictionary data
ln -s ../output_dictionary static/dictionary

# Copy labels file
cp ../webapp/japanese_labels.json static/

# Start development server
npm run dev

# Open browser to http://localhost:5173/好
```

## 📁 Project Structure

```
sveltekit-app/
├── src/
│   ├── routes/
│   │   ├── [word]/
│   │   │   ├── +page.svelte          # Main dictionary display page
│   │   │   └── +page.ts              # Server-side data loading
│   │   └── +page.svelte              # Home page
│   ├── lib/
│   │   └── components/               # Reusable components
│   └── app.html                      # HTML template
├── static/
│   ├── dictionary/                   # Symlink to ../output_dictionary/
│   └── japanese_labels.json          # Part-of-speech and misc labels
├── package.json                      # Dependencies
├── svelte.config.js                  # SvelteKit configuration
└── vite.config.ts                    # Vite configuration
```

## 🎨 Display Sections

### 1. Character Display
- Large character with pronunciations
- Chinese pinyin (🇨🇳) and Japanese readings (🇯🇵)
- English gloss

### 2. Mnemonic Hints (💡)
- Etymology and memory aids for learning

### 3. Components (🧩)
- Character components with meaning/phonetic indicators

### 4. Historical Evolution (🏛️)
- Horizontal scrollable images
- Oracle, Bronze, Seal, Clerical, Regular scripts
- Modern form rendered with MS Mincho font

### 5. Usage Statistics (📊)
- HSK level badge (blue)
- Movie and Book ranking badges
- Frequency bars with gradients
- Top words grid with background progress bars

### 6. Chinese Words
- Format: **好** [hǎo]
- Character displayed next to each pinyin
- Multiple pronunciations shown separately
- Definitions listed below

### 7. Japanese Words
- Format: **好** [こう]
- Character displayed next to kana readings
- Full part-of-speech labels (e.g., "prefix" not "pref")
- Misc tags as styled badges (e.g., "usually kana")
- Inline "Other forms" with semicolons
- Bold current character in "Other forms"

## 🔧 Technical Details

### Technology Stack
- **Framework**: SvelteKit 2.x with Svelte 5
- **Syntax**: Runes (`$state`, `$derived`, `$props`)
- **Styling**: Inline styles matching original design
- **Data**: Static JSON files from `output_dictionary/`
- **Fonts**: MS Mincho serif for CJK characters

### Key Implementation Features

#### 1. Dynamic Routing
```typescript
// src/routes/[word]/+page.ts
export const load: PageLoad = async ({ params, fetch }) => {
  const { word } = params;
  const response = await fetch(`/dictionary/${word}.json`);
  const data = await response.json();

  // Load Japanese labels
  const labelsResponse = await fetch('/japanese_labels.json');
  const labels = await labelsResponse.json();

  // Fetch related Japanese words
  const relatedJapaneseWords = [];
  if (data.related_japanese_words) {
    for (const relatedKey of data.related_japanese_words) {
      const relatedResponse = await fetch(`/dictionary/${relatedKey}.json`);
      const relatedData = await relatedResponse.json();
      relatedJapaneseWords.push(...relatedData.japanese_words);
    }
  }

  return { word, data, relatedJapaneseWords, labels };
};
```

#### 2. Label Mapping
```typescript
// Helper functions in +page.svelte
function getPartOfSpeechLabel(pos: string): string {
  return data.labels.partOfSpeech[pos] || pos;
  // "pref" → "prefix", "n" → "noun"
}

function getMiscLabel(misc: string): string {
  return data.labels.misc[misc] || misc;
  // "uk" → "usually kana"
}
```

#### 3. Other Forms Display
```svelte
<!-- Inline format with semicolons and bold current character -->
{@const otherFormsText = otherKanji
  .map((k) => {
    const readings = word.kana
      .filter((kana) =>
        kana.appliesToKanji?.includes('*') ||
        kana.appliesToKanji?.includes(k.text)
      )
      .map((kana) => kana.text);

    const kanjiPart = k.text === data.word
      ? `<strong>${k.text}</strong>`
      : k.text;

    return readings.length > 0
      ? `${kanjiPart} [${readings.join(', ')}]`
      : kanjiPart;
  })
  .join('; ')}
```

#### 4. Historical Evolution Rendering
```svelte
{#if image.type === 'Regular' && image.era === 'Modern'}
  <!-- Display actual character with font -->
  <div style="font-size: 60px; font-family: 'MS Mincho', serif;">
    {data.word}
  </div>
{:else}
  <!-- Display historical image -->
  <img src={image.url} alt="{image.type} {image.era}" />
{/if}
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deployment Options

1. **Cloudflare Pages** (Recommended)
   - 5GB D1 database + 10GB R2 storage
   - Automatic GitHub deployments

2. **Vercel**
   - Automatic GitHub deployments
   - Edge functions support

3. **Netlify**
   - Static site hosting

4. **GitHub Pages**
   - Free static hosting

## 📊 Performance

- **Individual JSON Files**: Direct file access (no grepping)
- **Static Generation**: Pre-rendered pages
- **Lazy Loading**: Related words fetched on-demand
- **Minimal JavaScript**: Svelte compiles to efficient vanilla JS
- **Font Rendering**: Modern characters use fonts (not images)

## 🔍 Example URLs

- `/好` - Character "good"
- `/的` - Particle "de"
- `/地圖` - Word "map"
- `/學生` - Word "student"
- `/頭` - Character "head" (semantically aligned)

## 📝 Design Principles

1. **Learner-Focused**: Single flowing page, no tabs
2. **Consistent Layout**: Chinese and Japanese use same format
3. **Full Text Labels**: No abbreviations or tooltips
4. **Visual Hierarchy**: Clear typography and spacing
5. **Accessibility**: Semantic HTML and ARIA labels

## 🐛 Known Issues

1. **SSR Disabled**: `export const ssr = false` to avoid dev server hanging
2. **Adapter**: Using `@sveltejs/adapter-auto` for development
3. **TypeScript Errors**: Some implicit `any` types in data processing

## 📚 Resources

- [SvelteKit Documentation](https://kit.svelte.dev/)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/what-are-runes)
- [Original Python Webapp](../webapp/index.html)
- [Dictionary Data](../output_dictionary/)

---

**Built with ❤️ using SvelteKit 2.x and Svelte 5**

*Last updated: October 2025*

