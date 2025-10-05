# Integration Example for Japanese Labels

## How to Use japanese_labels.json in the Webapp

### 1. Load the labels at app initialization

```javascript
class KiokunApp {
    constructor() {
        this.currentWord = null;
        this.labels = null; // Add this
        this.setupEventListeners();
        this.loadLabels(); // Add this
        this.loadFromURL();
    }

    async loadLabels() {
        try {
            const response = await fetch('japanese_labels.json');
            this.labels = await response.json();
        } catch (error) {
            console.error('Failed to load labels:', error);
            this.labels = {}; // Fallback to empty object
        }
    }
}
```

### 2. Create helper methods to get label text

```javascript
getPartOfSpeechLabel(pos) {
    if (!this.labels?.partOfSpeech) return pos;
    return this.labels.partOfSpeech[pos] || pos;
}

getMiscLabel(misc) {
    if (!this.labels?.misc) return misc;
    return this.labels.misc[misc] || misc;
}

getFieldLabel(field) {
    if (!this.labels?.field) return field;
    return this.labels.field[field] || field;
}

getDialectLabel(dialect) {
    if (!this.labels?.dialect) return dialect;
    return this.labels.dialect[dialect] || dialect;
}

getTagLabel(tag) {
    if (!this.labels?.tag) return tag;
    return this.labels.tag[tag] || tag;
}

getGlossTypeLabel(glossType) {
    if (!this.labels?.glossType) return glossType;
    return this.labels.glossType[glossType] || glossType;
}

getLanguageSourceLabel(lang) {
    if (!this.labels?.languageSource) return lang;
    return this.labels.languageSource[lang] || lang;
}
```

### 3. Update the rendering to use labels

#### Current code (lines 1100-1111):
```javascript
// Part of speech tags inline
if (sense.partOfSpeech && sense.partOfSpeech.length > 0) {
    sense.partOfSpeech.forEach(pos => {
        html += `<span class="pos-tag" style="display: inline; margin-right: 6px;">${pos}</span>`;
    });
}

// Misc tags inline (like (uk) for usually kana)
if (sense.misc && sense.misc.length > 0) {
    sense.misc.forEach(misc => {
        html += `<span class="pos-tag" style="display: inline; margin-right: 6px; background: #fff3cd; color: #856404;">${misc}</span>`;
    });
}
```

#### Updated code with labels:
```javascript
// Part of speech tags inline
if (sense.partOfSpeech && sense.partOfSpeech.length > 0) {
    sense.partOfSpeech.forEach(pos => {
        const label = this.getPartOfSpeechLabel(pos);
        html += `<span class="pos-tag" style="display: inline; margin-right: 6px;" title="${label}">${pos}</span>`;
    });
}

// Misc tags inline (like (uk) for usually kana)
if (sense.misc && sense.misc.length > 0) {
    sense.misc.forEach(misc => {
        const label = this.getMiscLabel(misc);
        html += `<span class="pos-tag" style="display: inline; margin-right: 6px; background: #fff3cd; color: #856404;" title="${label}">${misc}</span>`;
    });
}
```

### 4. Alternative: Show full labels instead of codes

If you want to show the full text instead of abbreviations:

```javascript
// Part of speech tags inline - FULL TEXT VERSION
if (sense.partOfSpeech && sense.partOfSpeech.length > 0) {
    sense.partOfSpeech.forEach(pos => {
        const label = this.getPartOfSpeechLabel(pos);
        html += `<span class="pos-tag" style="display: inline; margin-right: 6px;">${label}</span>`;
    });
}

// Misc tags inline - FULL TEXT VERSION
if (sense.misc && sense.misc.length > 0) {
    sense.misc.forEach(misc => {
        const label = this.getMiscLabel(misc);
        html += `<span class="pos-tag" style="display: inline; margin-right: 6px; background: #fff3cd; color: #856404;">${label}</span>`;
    });
}
```

### 5. Handle other tag types

#### Field tags (if you want to display them):
```javascript
// Field tags (domain/subject area)
if (sense.field && sense.field.length > 0) {
    sense.field.forEach(field => {
        const label = this.getFieldLabel(field);
        html += `<span class="pos-tag" style="display: inline; margin-right: 6px; background: #e3f2fd; color: #1976d2;" title="${label}">${field}</span>`;
    });
}
```

#### Dialect tags:
```javascript
// Dialect tags
if (sense.dialect && sense.dialect.length > 0) {
    sense.dialect.forEach(dialect => {
        const label = this.getDialectLabel(dialect);
        html += `<span class="pos-tag" style="display: inline; margin-right: 6px; background: #f3e5f5; color: #7b1fa2;" title="${label}">${dialect}</span>`;
    });
}
```

#### Language source (for loanwords):
```javascript
// Language source (for loanwords)
if (sense.languageSource && sense.languageSource.length > 0) {
    sense.languageSource.forEach(langSrc => {
        const langLabel = this.getLanguageSourceLabel(langSrc.lang);
        const prefix = langSrc.wasei ? 'wasei ' : '';
        const fullText = langSrc.text ? ` (${langSrc.text})` : '';
        html += `<span class="pos-tag" style="display: inline; margin-right: 6px; background: #fff3cd; color: #856404;">from ${prefix}${langLabel}${fullText}</span>`;
    });
}
```

#### Kanji/Kana tags (on word forms):
```javascript
// For kanji entries
if (word.kanji && word.kanji.length > 0) {
    word.kanji.forEach(k => {
        html += `<span style="font-size: 18px; font-family: 'MS Mincho', serif; font-weight: 600;">${k.text}</span>`;
        
        // Show tags if present
        if (k.tags && k.tags.length > 0) {
            k.tags.forEach(tag => {
                const label = this.getTagLabel(tag);
                html += ` <span class="pos-tag" style="font-size: 10px; background: #fce4ec; color: #c2185b;" title="${label}">${tag}</span>`;
            });
        }
    });
}
```

## Recommended Approach

**For learner-friendly UI:**
1. Show **abbreviations** (e.g., "n", "uk") in the badges
2. Add **full descriptions** in the `title` attribute for tooltips
3. This keeps the UI clean while providing detailed info on hover

**Example output:**
```html
<span class="pos-tag" title="noun (common) (futsuumeishi)">n</span>
<span class="pos-tag" title="word usually written using kana alone">uk</span>
```

When users hover over "n", they'll see "noun (common) (futsuumeishi)"
When users hover over "uk", they'll see "word usually written using kana alone"

This matches the design philosophy you mentioned: "optimized for learner experience"

