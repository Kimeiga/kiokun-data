# Variant Resolution Failure Analysis

## Summary
- **Total variant definitions found**: 3,545
- **Successfully resolved**: 1,741 (49.1%)
- **Unresolvable variants**: 1,804 (50.9%)

## Categories of Unresolvable Variants

### 1. **Multiple Character References** (Most Common)
These contain references to multiple characters separated by `|` or `,`:

```
傌 → 罵|骂  (traditional|simplified pairs)
㐺 → 眾|众
丒 → 醜|丑
両 → 兩|两
麽 → 麼|么
```

**Issue**: The regex pattern only captures single characters, not multiple character references.
**Count**: ~400+ cases

### 2. **Complex Parenthetical References**
These have additional context in parentheses that breaks the pattern:

```
儁 → 俊)  (missing opening parenthesis)
㒗 → 儓)
㒲 → 財)
㓂 → 寇)
```

**Issue**: Malformed parentheses or extra characters after the reference.
**Count**: ~300+ cases

### 3. **Non-Standard Variant Descriptions**
These don't follow the standard "variant of X" pattern:

```
"(non-classical variant of U+53A8 厨) a kitchen, a sideboard..."
"(a variant of U+6AB3 檳) the areca-nut"
"(a variant of U+5E06 帆) a sail, to sail"
"variant of other characters"
"variant of 'to be'"
"Variant of U+571F 土"
"Variant of U+4E99 亙"
```

**Issue**: Different phrasing, Unicode references, or generic descriptions.
**Count**: ~200+ cases

### 4. **Erhua Variants**
These are phonetic variants with "erhua" (儿化):

```
"erhua variant of 上邊|上边[shàng​bian]"
"erhua variant of 上鉤|上钩[shàng​gōu]"
"erhua variant of 一點|一点[yī​diǎn]"
```

**Issue**: These are phonetic variants, not character variants.
**Count**: ~100+ cases

### 5. **Phrase/Compound Variants**
These reference entire phrases or compounds:

```
"variant of 三個臭皮匠，賽過一個諸葛亮|三个臭皮匠，赛过一个诸葛亮[...]"
"variant of 風採|风采[fēng​cǎi]"
"variant of 叮嚀|叮咛[dīng​níng]"
```

**Issue**: These reference multi-character phrases, not single characters.
**Count**: ~200+ cases

### 6. **Missing Referenced Characters**
These extract correctly but the referenced character doesn't exist in our dictionary:

```
㕘 → 參)  (extracted "參" but not found in dictionary)
㕯 → 訥|讷  (extracted "訥" but not found)
㘫 → 阱)  (extracted "阱" but not found)
```

**Issue**: Referenced character not in our Chinese dictionary.
**Count**: ~300+ cases

### 7. **Malformed References**
These have syntax issues that prevent extraction:

```
僮 → 壯|壮,  (trailing comma)
剕 → 腓,  (trailing comma)
佡 → 仙,  (trailing comma)
```

**Issue**: Extra punctuation or malformed syntax.
**Count**: ~100+ cases

## Potential Solutions

### High Impact (Would resolve ~60% of failures):

1. **Handle Multiple Character References**:
   ```rust
   // Split on | and , to handle traditional|simplified pairs
   let references = variant_ref.split(&['|', ','][..])
       .map(|s| s.trim())
       .filter(|s| !s.is_empty())
       .collect::<Vec<_>>();
   ```

2. **Improve Regex Patterns**:
   ```rust
   let patterns = [
       r"variant of ([^\[\s\)]+)",  // Handle closing parentheses
       r"variant of ([^,\|\[\s]+)", // Handle commas and pipes
       r"\(.*variant of ([^\[\s\)]+)\)", // Handle parenthetical variants
   ];
   ```

3. **Handle Unicode References**:
   ```rust
   // Extract from "variant of U+53A8 厨" -> "厨"
   r"variant of U\+[0-9A-F]+ ([^\s\)]+)"
   ```

### Medium Impact (Would resolve ~25% of failures):

4. **Expand Dictionary Coverage**: Add missing referenced characters to the Chinese dictionary.

5. **Handle Phrase Variants**: For compound variants, try to extract the key character.

### Low Impact (Would resolve ~15% of failures):

6. **Clean Malformed References**: Strip trailing punctuation and fix syntax issues.

7. **Skip Erhua Variants**: These are phonetic, not semantic variants.

## Recommended Implementation Priority

1. **Phase 1**: Handle multiple character references (biggest impact)
2. **Phase 2**: Improve regex patterns for malformed syntax
3. **Phase 3**: Add Unicode reference extraction
4. **Phase 4**: Expand dictionary coverage for missing characters

This would potentially increase the success rate from 49.1% to ~75-80%.
