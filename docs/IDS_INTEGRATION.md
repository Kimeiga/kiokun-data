# CHISE IDS Integration

## Overview

This document describes the integration of CHISE IDS (Ideographic Description Sequence) data into the kiokun-data project. IDS provides character decomposition information showing how Chinese/Japanese characters are composed from smaller components.

## What is IDS?

IDS (Ideographic Description Sequence) is a standardized way to describe the structure of Han ideographs (Chinese/Japanese characters) using:

1. **IDS Operators** - Special Unicode characters (U+2FF0 - U+2FFB) that describe spatial relationships:
   - `⿰` (U+2FF0): Left-right composition (e.g., 好 = ⿰女子 = woman + child)
   - `⿱` (U+2FF1): Top-bottom composition (e.g., 字 = ⿱宀子 = roof + child)
   - `⿲` (U+2FF2): Left-middle-right (3 components horizontally)
   - `⿳` (U+2FF3): Top-middle-bottom (3 components vertically)
   - `⿴` (U+2FF4): Surround
   - `⿵` (U+2FF5): Surround from above
   - `⿶` (U+2FF6): Surround from below
   - `⿷` (U+2FF7): Surround from left
   - `⿸` (U+2FF8): Surround from upper left
   - `⿹` (U+2FF9): Surround from upper right
   - `⿺` (U+2FFA): Surround from lower left
   - `⿻` (U+2FFB): Overlaid

2. **Component Characters** - The actual character components that make up the character

## Data Sources

### Downloaded Files

Located in `data/ids/`:

1. **IDS-UCS-Basic.txt** (20,992 entries)
   - CJK Unified Ideographs (U+4E00 ~ U+9FA5)
   - Core Chinese/Japanese characters
   - 20,568 entries have decomposition data

2. **IDS-UCS-Ext-A.txt** (6,604 entries)
   - CJK Extension A (U+3400 ~ U+4DB5)
   - Extended Chinese characters
   - 6,582 entries have decomposition data

3. **IDS-JIS-X0208-1990.txt** (6,398 entries)
   - Japanese Industrial Standard character set
   - All 6,398 entries have decomposition data

**Total: 33,994 unique characters with IDS data**

### File Format

The IDS files are UTF-8 encoded text files with tab-separated values:

```
<CODEPOINT><TAB><CHARACTER><TAB><IDS>(<TAB>@apparent=<IDS>)
```

Example:
```
U+4E00	一	一
U+597D	好	⿰女子
U+5B57	字	⿱宀子
U+660E	明	⿰日月
U+4F11	休	⿰亻木
U+6797	林	⿰木木
```

Lines starting with `;;` are comments and are skipped.

### Optional @apparent Field

Some entries have an `@apparent` field that provides an alternative decomposition representing the apparent visual structure vs. the functional/etymological structure.

## Implementation

### Rust Types

**`src/ids_types.rs`**:

```rust
pub struct IdsEntry {
    pub codepoint: String,      // e.g., "U+597D"
    pub character: String,       // e.g., "好"
    pub ids: String,             // e.g., "⿰女子"
    pub apparent_ids: Option<String>, // Optional apparent structure
}

pub type IdsDatabase = HashMap<String, IdsEntry>;
```

### Loading Functions

**`src/main.rs`**:

- `load_ids_file(path: &str)` - Loads a single IDS file
- `load_all_ids_files()` - Loads all three IDS files and merges them
- `enrich_chinese_chars_with_ids()` - Adds IDS data to Chinese character dictionary
- `enrich_japanese_chars_with_ids()` - Adds IDS data to Japanese character dictionary

### Character Type Extensions

Both `ChineseCharacter` and `KanjiCharacter` structs now include:

```rust
#[serde(skip_serializing_if = "Option::is_none")]
pub ids: Option<String>,

#[serde(skip_serializing_if = "Option::is_none")]
pub ids_apparent: Option<String>,
```

## Results

### Enrichment Statistics

When running the program:

```
📚 Loading IDS (character decomposition) database...
  ✅ Loaded 20992 IDS entries (20568 with decomposition)
  📖 Loaded data/ids/IDS-UCS-Basic.txt
  ✅ Loaded 6604 IDS entries (6582 with decomposition)
  📖 Loaded data/ids/IDS-UCS-Ext-A.txt
  ✅ Loaded 6398 IDS entries (6398 with decomposition)
  📖 Loaded data/ids/IDS-JIS-X0208-1990.txt
  ✅ Total unique characters in IDS database: 33994

🔧 Enriching character dictionaries with IDS decomposition data...
  ✅ Enriched 27126 Chinese characters with IDS decomposition data
  ✅ Enriched 9980 Japanese kanji with IDS decomposition data
```

### Coverage

- **Chinese Characters**: 27,126 out of 93,831 (28.9%) have IDS decomposition
- **Japanese Kanji**: 9,980 out of 10,383 (96.1%) have IDS decomposition

The high coverage for Japanese kanji is because the JIS-X0208 standard covers most commonly used kanji.

## Examples

### Common Characters with IDS

| Character | Meaning | IDS | Decomposition |
|-----------|---------|-----|---------------|
| 好 | good | ⿰女子 | woman (女) + child (子) |
| 字 | character | ⿱宀子 | roof (宀) + child (子) |
| 明 | bright | ⿰日月 | sun (日) + moon (月) |
| 休 | rest | ⿰亻木 | person (亻) + tree (木) |
| 林 | forest | ⿰木木 | tree (木) + tree (木) |

## Usage in Output

The IDS data is now available in the character dictionaries and can be:

1. **Displayed in the webapp** - Show learners how characters are composed
2. **Used for search** - Find characters by component
3. **Used for mnemonics** - Help learners remember characters through their components
4. **Used for analysis** - Study character composition patterns

## Future Enhancements

Potential future work:

1. **Component Analysis** - Parse IDS strings to extract individual components
2. **Radical Matching** - Cross-reference IDS components with radical data
3. **Similarity Search** - Find characters with similar structures
4. **Learning Paths** - Suggest learning order based on component dependencies
5. **Extended Coverage** - Download additional IDS extension files (Ext-B through Ext-I)

## References

- **CHISE IDS Project**: https://gitlab.chise.org/CHISE/ids
- **IDS Specification**: Part of Unicode Standard
- **CHISE (Character Information Service Environment)**: http://www.chise.org/

## License

The CHISE IDS data is provided by the CHISE project. Please refer to their repository for licensing information.

