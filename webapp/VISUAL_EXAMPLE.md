# Visual Example: Before and After Labels

## Example Entry: 誼 (friendship)

### Raw Data
```
誼, 誼み, 好, 好み [よしみ, ぎ, よしび]
n uk friendship; friendly relations; connection; relation; intimacy
```

### Current Display (Before)
```
誼, 誼み, 好, 好み [よしみ, ぎ, よしび]

[n] [uk] friendship; friendly relations; connection; relation; intimacy
```

**Problem**: Users don't know what `n` or `uk` mean!

### With Labels (After)

#### Option 1: Tooltips (Recommended)
```html
誼, 誼み, 好, 好み [よしみ, ぎ, よしび]

[n] [uk] friendship; friendly relations; connection; relation; intimacy
 ↑   ↑
 │   └─ Hover shows: "word usually written using kana alone"
 └───── Hover shows: "noun (common) (futsuumeishi)"
```

**Benefits**: 
- Clean, compact UI
- Full information available on hover
- Learner-friendly

#### Option 2: Full Text
```
誼, 誼み, 好, 好み [よしみ, ぎ, よしび]

[noun] [usually kana] friendship; friendly relations; connection; relation; intimacy
```

**Benefits**:
- Immediately clear
- No hover needed

**Drawbacks**:
- Takes more space
- Can be verbose for complex entries

## More Examples

### Example 2: 食べる (to eat)

#### Raw
```
v1 vt to eat
```

#### With Tooltips
```html
[v1] [vt] to eat
 ↑    ↑
 │    └─ "transitive verb"
 └────── "Ichidan verb"
```

#### Full Text
```
[Ichidan verb] [transitive] to eat
```

### Example 3: お願いします (please)

#### Raw
```
exp hon pol please
```

#### With Tooltips
```html
[exp] [hon] [pol] please
  ↑     ↑     ↑
  │     │     └─ "polite (teineigo) language"
  │     └─────── "honorific or respectful (sonkeigo) language"
  └───────────── "expression"
```

#### Full Text
```
[expression] [honorific] [polite] please
```

### Example 4: コンピューター (computer)

#### Raw
```
n comp from eng computer
```

#### With Tooltips
```html
[n] [comp] [from English] computer
 ↑    ↑         ↑
 │    │         └─ Language source info
 │    └─────────── "computing"
 └──────────────── "noun (common) (futsuumeishi)"
```

#### Full Text
```
[noun] [computing] [from English] computer
```

### Example 5: 行く (to go) - Irregular verb

#### Raw
```
v5k-s vi to go; to move
```

#### With Tooltips
```html
[v5k-s] [vi] to go; to move
   ↑     ↑
   │     └─ "intransitive verb"
   └─────── "Godan verb - Iku/Yuku special class"
```

#### Full Text
```
[Godan verb (iku/yuku)] [intransitive] to go; to move
```

### Example 6: 関西弁 word

#### Raw
```
n ksb dialect word
```

#### With Tooltips
```html
[n] [ksb] dialect word
 ↑    ↑
 │    └─ "Kansai-ben"
 └────── "noun (common) (futsuumeishi)"
```

#### Full Text
```
[noun] [Kansai dialect] dialect word
```

## Recommended Approach

**Use tooltips (Option 1)** because:

1. ✅ Keeps UI clean and compact
2. ✅ Matches Jisho.org's approach (familiar to learners)
3. ✅ Provides full information when needed
4. ✅ Scales well with multiple tags
5. ✅ Professional appearance

## Implementation

```javascript
// In your renderJapaneseWords method, around line 1100-1110:

// Part of speech tags with tooltips
if (sense.partOfSpeech && sense.partOfSpeech.length > 0) {
    sense.partOfSpeech.forEach(pos => {
        const label = this.getPartOfSpeechLabel(pos);
        html += `<span class="pos-tag" title="${label}">${pos}</span>`;
    });
}

// Misc tags with tooltips
if (sense.misc && sense.misc.length > 0) {
    sense.misc.forEach(misc => {
        const label = this.getMiscLabel(misc);
        html += `<span class="pos-tag" style="background: #fff3cd; color: #856404;" title="${label}">${misc}</span>`;
    });
}

// Field tags with tooltips (if you want to display them)
if (sense.field && sense.field.length > 0) {
    sense.field.forEach(field => {
        const label = this.getFieldLabel(field);
        html += `<span class="pos-tag" style="background: #e3f2fd; color: #1976d2;" title="${label}">${field}</span>`;
    });
}
```

## CSS Enhancement (Optional)

Add a subtle animation on hover to make tooltips more discoverable:

```css
.pos-tag {
    cursor: help; /* Shows question mark cursor */
    transition: all 0.2s ease;
}

.pos-tag:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
```

This makes it clear that the badges are interactive!

